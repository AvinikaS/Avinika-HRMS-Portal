import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../../utils/api';
import { HiOutlinePlus, HiOutlineCheckCircle, HiOutlineBan, HiOutlineCash, HiOutlineX, HiOutlineDownload } from 'react-icons/hi';
import EmployeeSelect from '../../components/EmployeeSelect';
import { useYearManager, YearManagerModal, YearSelectDropdown } from '../../components/YearManagerModal';
import * as XLSX from 'xlsx';

export default function LoanManagement() {
    const [loans, setLoans] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('outstanding');
    const [selectedDept, setSelectedDept] = useState('');

    const [filterDept, setFilterDept] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const { years, showYearModal, setShowYearModal, fetchYears } = useYearManager();

    const [departments, setDepartments] = useState([]);
    const filteredEmployees = selectedDept ? employees.filter(e => e.department === selectedDept) : employees;

    const [formData, setFormData] = useState({
        employee: '', loanCategory: 'Personal Loan', amount: '',
        expectedMonth: new Date().getMonth() + 1, expectedYear: new Date().getFullYear(),
        emiStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
        emiStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
        repaymentTerms: 12, interestType: 'No Interest', interestRate: 0, reason: ''
    });

    const fetchLoans = async () => {
        try {
            const { data } = await api.get('/loans');
            setLoans(data.data || []);
        } catch { }
        setLoading(false);
    };

    const fetchEmployees = async () => {
        try {
            const { data } = await api.get('/employees?limit=1000');
            setEmployees(Array.isArray(data.data) ? data.data : []);
        } catch { }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/departments');
            setDepartments((data.data || []).map(d => d.name));
        } catch { }
    };

    useEffect(() => { fetchLoans(); fetchEmployees(); fetchDepartments(); }, []);

    const processedLoans = loans.map(l => ({
        ...l,
        status: (['Approved', 'In Progress', 'Disbursed'].includes(l.status) && l.outstandingAmount <= 0) ? 'Closed' : l.status
    }));

    const filtered = processedLoans.filter(l => {
        if (activeTab === 'outstanding') { if (!['In Progress', 'Disbursed'].includes(l.status)) return false; }
        else if (activeTab === 'requests') { if (!['Pending', 'Offered', 'Approved'].includes(l.status)) return false; }
        else if (activeTab === 'cleared') { if (!['Closed', 'Cancelled', 'Cancelled by Admin', 'Rejected', 'Rejected by Admin', 'Rejected by Employee'].includes(l.status)) return false; }

        if (filterDept && l.employee?.department !== filterDept) return false;
        if (filterMonth && l.expectedMonth !== Number(filterMonth)) return false;
        if (filterYear && l.expectedYear?.toString() !== filterYear.toString()) return false;
        return true;
    });

    const updateStatus = async (id, status, disbursalMode = null) => {
        try {
            const payload = { status };
            if (disbursalMode) payload.disbursalMode = disbursalMode;
            await api.put(`/loans/${id}/status`, payload);
            toast.success(`Loan status updated to ${status}`);
            fetchLoans();
        } catch (err) { toast.error('Failed to update status'); }
    };

    const handleReviewLoan = async (loan) => {
        const defaultMode = loan.disbursalMode || loan.preferredPaymentMethod || 'Payroll System';
        const defaultPayrollMonth = loan.disbursalPayrollMonth || loan.expectedMonth || (new Date().getMonth() + 1);
        const defaultPayrollYear = loan.disbursalPayrollYear || loan.expectedYear || new Date().getFullYear();
        const defaultEmiMonth = loan.emiStartMonth || (new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2);
        const defaultEmiYear = loan.emiStartYear || (new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear());

        const monthsOptions = [1,2,3,4,5,6,7,8,9,10,11,12].map(m =>
            `<option value="${m}">${new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>`
        ).join('');

        const { value: formValues, isConfirmed } = await Swal.fire({
            title: `Review Loan Request`,
            width: '600px',
            html: `
                <div style="text-align:left;font-size:13px;max-height:480px;overflow-y:auto;overflow-x:hidden;padding-right:4px;box-sizing:border-box;">
                    <div style="background:#f8fafc;padding:10px 12px;border-radius:6px;margin-bottom:12px;border:1px solid #e2e8f0;box-sizing:border-box;">
                        <p style="margin:0 0 4px;color:#334155;word-break:break-word;"><strong>Employee:</strong> ${loan.employee?.firstName} ${loan.employee?.lastName} (${loan.employee?.employeeCode || ''})</p>
                        <p style="margin:0 0 4px;color:#334155;word-break:break-word;"><strong>Requested Amount:</strong> ₹${loan.amount?.toLocaleString('en-IN')} &nbsp;|&nbsp; <strong>Requested Tenure:</strong> ${loan.repaymentTerms} months</p>
                        <p style="margin:0 0 4px;color:#334155;word-break:break-word;"><strong>Requested Payment Mode:</strong> <span style="color:#2563eb;font-weight:600;">${loan.preferredPaymentMethod || 'Payroll System'}</span></p>
                        <p style="margin:0;color:#64748b;word-break:break-word;"><strong>Reason:</strong> ${loan.reason || 'N/A'}</p>
                    </div>

                    <label style="display:block;margin-bottom:4px;font-weight:600;color:#1e293b;">Action</label>
                    <select id="swal-action" class="swal2-input" style="margin:0 0 12px;width:100%;max-width:100%;box-sizing:border-box;font-size:13px;">
                        <option value="Offered">✅ Process Review (Approve or Send Offer)</option>
                        <option value="Rejected">❌ Reject Request</option>
                    </select>

                    <div id="swal-offer-section">
                        <div id="swal-terms-indicator" style="background:#f0fdf4;border:1px solid #86efac;padding:8px 12px;border-radius:6px;color:#166534;font-size:12px;font-weight:600;margin-bottom:12px;box-sizing:border-box;">
                            ✅ Terms Unchanged — Request will be DIRECTLY APPROVED
                        </div>

                        <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
                            <div style="flex:1;min-width:120px;">
                                <label style="display:block;margin-bottom:4px;font-weight:600;">Offered Loan Amount (₹)</label>
                                <input id="swal-amount" type="number" min="1" class="swal2-input" value="${loan.amount}" style="margin:0;width:100%;max-width:100%;box-sizing:border-box;font-size:13px;">
                            </div>
                            <div style="flex:1;min-width:120px;">
                                <label style="display:block;margin-bottom:4px;font-weight:600;">Offered Tenure (Months)</label>
                                <input id="swal-tenure" type="number" min="1" max="120" class="swal2-input" value="${loan.repaymentTerms}" style="margin:0;width:100%;max-width:100%;box-sizing:border-box;font-size:13px;">
                            </div>
                        </div>

                        <label style="display:block;margin-bottom:4px;font-weight:600;">Payment Disbursal Mode</label>
                        <select id="swal-disbursal-mode" class="swal2-input" style="margin:0 0 12px;width:100%;max-width:100%;box-sizing:border-box;font-size:13px;">
                            <option value="Payroll System" ${defaultMode === 'Payroll System' ? 'selected' : ''}>Payroll System (With Monthly Salary)</option>
                            <option value="Cash" ${defaultMode === 'Cash' ? 'selected' : ''}>Cash</option>
                            <option value="Cheque" ${defaultMode === 'Cheque' ? 'selected' : ''}>Cheque</option>
                            <option value="Bank Transfer" ${defaultMode === 'Bank Transfer' ? 'selected' : ''}>Direct Bank Transfer</option>
                        </select>

                        <div id="swal-payroll-container" style="display:${defaultMode === 'Payroll System' ? 'block' : 'none'};margin-bottom:12px;">
                            <label style="display:block;margin-bottom:4px;font-weight:600;">Disburse in Payroll Month & Year</label>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                <select id="swal-payroll-month" class="swal2-input" style="margin:0;flex:1;min-width:120px;max-width:100%;box-sizing:border-box;font-size:13px;">
                                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${defaultPayrollMonth === m ? 'selected' : ''}>${new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>`).join('')}
                                </select>
                                <input id="swal-payroll-year" type="number" class="swal2-input" value="${defaultPayrollYear}" style="margin:0;flex:1;min-width:100px;max-width:100%;box-sizing:border-box;font-size:13px;">
                            </div>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="display:block;margin-bottom:4px;font-weight:600;">EMI Deduction Starts On</label>
                            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                                <select id="swal-emi-start-month" class="swal2-input" style="margin:0;flex:1;min-width:120px;max-width:100%;box-sizing:border-box;font-size:13px;">
                                    ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${defaultEmiMonth === m ? 'selected' : ''}>${new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>`).join('')}
                                </select>
                                <input id="swal-emi-start-year" type="number" class="swal2-input" value="${defaultEmiYear}" style="margin:0;flex:1;min-width:100px;max-width:100%;box-sizing:border-box;font-size:13px;">
                            </div>
                        </div>

                        <label style="display:block;margin-bottom:4px;font-weight:600;">Interest Type</label>
                        <select id="swal-interest-type" class="swal2-input" style="margin:0 0 12px;width:100%;max-width:100%;box-sizing:border-box;font-size:13px;">
                            <option value="No Interest" ${loan.interestType === 'No Interest' ? 'selected' : ''}>No Interest</option>
                            <option value="Reducing Balance" ${loan.interestType === 'Reducing Balance' ? 'selected' : ''}>Reducing Balance</option>
                        </select>

                        <div id="swal-interest-rate-container" style="display:${loan.interestType === 'Reducing Balance' ? 'block' : 'none'};margin-bottom:12px;">
                            <label style="display:block;margin-bottom:4px;font-weight:600;">Annual Interest Rate (%)</label>
                            <input id="swal-interest-rate" type="number" min="0" step="0.1" class="swal2-input" value="${loan.interestRate || 0}" placeholder="e.g. 10" style="margin:0;width:100%;max-width:100%;box-sizing:border-box;font-size:13px;">
                        </div>

                        <div id="swal-emi-preview" style="background:#e0f2fe;border:1px solid #7dd3fc;padding:10px;border-radius:6px;color:#0369a1;font-size:12px;font-weight:600;margin-bottom:8px;box-sizing:border-box;word-break:break-word;"></div>
                    </div>

                    <div id="swal-reject-section" style="display:none;">
                        <label style="display:block;margin-bottom:4px;font-weight:600;color:#ef4444;">Rejection Reason *</label>
                        <textarea id="swal-reject-reason" class="swal2-textarea" placeholder="Please provide reason for rejection..." style="margin:0;width:100%;height:80px;box-sizing:border-box;"></textarea>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Submit Decision',
            cancelButtonText: 'Close',
            confirmButtonColor: '#4f46e5',
            didOpen: () => {
                const actionEl = document.getElementById('swal-action');
                const offerSection = document.getElementById('swal-offer-section');
                const rejectSection = document.getElementById('swal-reject-section');
                const modeEl = document.getElementById('swal-disbursal-mode');
                const payrollContainer = document.getElementById('swal-payroll-container');
                const indicator = document.getElementById('swal-terms-indicator');

                const amountEl = document.getElementById('swal-amount');
                const tenureEl = document.getElementById('swal-tenure');
                const rateEl = document.getElementById('swal-interest-rate');
                const typeEl = document.getElementById('swal-interest-type');
                const rateContainer = document.getElementById('swal-interest-rate-container');
                const preview = document.getElementById('swal-emi-preview');

                const payrollMonthEl = document.getElementById('swal-payroll-month');
                const payrollYearEl = document.getElementById('swal-payroll-year');
                const emiMonthEl = document.getElementById('swal-emi-start-month');
                const emiYearEl = document.getElementById('swal-emi-start-year');

                const updatePreview = () => {
                    const P = parseFloat(amountEl.value) || 0;
                    const n = parseInt(tenureEl.value) || 1;
                    const rate = parseFloat(rateEl.value) || 0;
                    const type = typeEl.value;

                    if (P <= 0 || n <= 0) {
                        preview.textContent = 'Invalid amount or tenure';
                        return;
                    }

                    if (type === 'Reducing Balance' && rate > 0) {
                        const r = rate / 12 / 100;
                        const emi = Math.ceil(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
                        const total = emi * n;
                        preview.textContent = `EMI: ₹${emi.toLocaleString('en-IN')}/mo | Total Repayment: ₹${total.toLocaleString('en-IN')} (${rate}% p.a. Reducing)`;
                    } else {
                        const emi = Math.ceil(P / n);
                        preview.textContent = `EMI: ₹${emi.toLocaleString('en-IN')}/mo | Total Repayment: ₹${P.toLocaleString('en-IN')} (No Interest)`;
                    }
                };

                const checkTermsChanged = () => {
                    const P = parseFloat(amountEl.value) || 0;
                    const n = parseInt(tenureEl.value) || 1;
                    const type = typeEl.value;
                    const rate = parseFloat(rateEl.value) || 0;
                    const mode = modeEl.value;

                    const isAmountChanged = P !== loan.amount;
                    const isTenureChanged = n !== loan.repaymentTerms;
                    const isModeChanged = mode !== (loan.preferredPaymentMethod || 'Payroll System');
                    const isInterestChanged = type !== 'No Interest' || rate > 0;
                    const isPayrollDateChanged = (mode === 'Payroll System') && (parseInt(payrollMonthEl?.value) !== (loan.disbursalPayrollMonth || loan.expectedMonth) || parseInt(payrollYearEl?.value) !== (loan.disbursalPayrollYear || loan.expectedYear));
                    const isEmiDateChanged = parseInt(emiMonthEl?.value) !== loan.emiStartMonth || parseInt(emiYearEl?.value) !== loan.emiStartYear;

                    const hasChanged = isAmountChanged || isTenureChanged || isModeChanged || isInterestChanged || isPayrollDateChanged || isEmiDateChanged;

                    if (indicator) {
                        if (hasChanged) {
                            indicator.style.background = '#faf5ff';
                            indicator.style.border = '1px solid #d8b4fe';
                            indicator.style.color = '#6b21a8';
                            indicator.innerHTML = '📩 Terms Modified — OFFER WILL BE SENT TO EMPLOYEE for Accept/Reject';
                        } else {
                            indicator.style.background = '#f0fdf4';
                            indicator.style.border = '1px solid #86efac';
                            indicator.style.color = '#166534';
                            indicator.innerHTML = '✅ Terms Unchanged — Request will be DIRECTLY APPROVED (No employee acceptance needed)';
                        }
                    }
                };

                updatePreview();
                checkTermsChanged();

                amountEl.addEventListener('input', () => { updatePreview(); checkTermsChanged(); });
                tenureEl.addEventListener('input', () => { updatePreview(); checkTermsChanged(); });
                rateEl.addEventListener('input', () => { updatePreview(); checkTermsChanged(); });

                typeEl.addEventListener('change', () => {
                    if (typeEl.value === 'No Interest') {
                        rateContainer.style.display = 'none';
                        rateEl.value = '0';
                    } else {
                        rateContainer.style.display = 'block';
                    }
                    updatePreview();
                    checkTermsChanged();
                });

                modeEl.addEventListener('change', () => {
                    if (modeEl.value === 'Payroll System') {
                        payrollContainer.style.display = 'block';
                    } else {
                        payrollContainer.style.display = 'none';
                    }
                    checkTermsChanged();
                });

                payrollMonthEl?.addEventListener('change', checkTermsChanged);
                payrollYearEl?.addEventListener('input', checkTermsChanged);
                emiMonthEl?.addEventListener('change', checkTermsChanged);
                emiYearEl?.addEventListener('input', checkTermsChanged);

                actionEl.addEventListener('change', () => {
                    if (actionEl.value === 'Rejected') {
                        offerSection.style.display = 'none';
                        rejectSection.style.display = 'block';
                    } else {
                        offerSection.style.display = 'block';
                        rejectSection.style.display = 'none';
                    }
                });
            },
            preConfirm: () => {
                const action = document.getElementById('swal-action').value;
                if (action === 'Rejected') {
                    const rejectionReason = document.getElementById('swal-reject-reason')?.value?.trim();
                    if (!rejectionReason) {
                        Swal.showValidationMessage('Rejection reason is required');
                        return false;
                    }
                    return { action, rejectionReason };
                }

                const amount = parseFloat(document.getElementById('swal-amount').value);
                const repaymentTerms = parseInt(document.getElementById('swal-tenure').value);
                const disbursalMode = document.getElementById('swal-disbursal-mode').value;
                const disbursalPayrollMonth = parseInt(document.getElementById('swal-payroll-month').value);
                const disbursalPayrollYear = parseInt(document.getElementById('swal-payroll-year').value);
                const emiStartMonth = parseInt(document.getElementById('swal-emi-start-month').value);
                const emiStartYear = parseInt(document.getElementById('swal-emi-start-year').value);
                const interestType = document.getElementById('swal-interest-type').value;
                const interestRate = parseFloat(document.getElementById('swal-interest-rate').value) || 0;

                if (!amount || amount <= 0) {
                    Swal.showValidationMessage('Valid loan amount is required');
                    return false;
                }
                if (!repaymentTerms || repaymentTerms <= 0) {
                    Swal.showValidationMessage('Valid repayment tenure is required');
                    return false;
                }

                return {
                    action, amount, repaymentTerms, disbursalMode,
                    disbursalPayrollMonth, disbursalPayrollYear,
                    emiStartMonth, emiStartYear, interestType, interestRate
                };
            }
        });

        if (!isConfirmed || !formValues) return;

        try {
            if (formValues.action === 'Offered') {
                const { data } = await api.put(`/loans/${loan._id}/status`, {
                    status: 'Offered',
                    amount: formValues.amount,
                    repaymentTerms: formValues.repaymentTerms,
                    disbursalMode: formValues.disbursalMode,
                    disbursalPayrollMonth: formValues.disbursalPayrollMonth,
                    disbursalPayrollYear: formValues.disbursalPayrollYear,
                    emiStartMonth: formValues.emiStartMonth,
                    emiStartYear: formValues.emiStartYear,
                    interestType: formValues.interestType,
                    interestRate: formValues.interestRate
                });
                toast.success(data.message || 'Review processed successfully!');
            } else {
                await api.put(`/loans/${loan._id}/status`, { status: 'Rejected', rejectionReason: formValues.rejectionReason });
                toast.success('Loan request rejected');
            }
            fetchLoans();
        } catch (err) { toast.error(err.response?.data?.message || 'Error occurred'); }
    };

    const handleViewLoanHistory = (loan) => {
        const recoveryItems = [...(loan.recoveryHistory || [])]
            .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
            .map(r => {
            const typeLabel = r.overrideType === 'FullSettlement' ? 'Full Settlement' : r.overrideType === 'PartialSettlement' ? 'Partial Settlement' : 'Monthly Payroll EMI';
            const modeLabel = r.paymentMode || 'Payroll System';
            const dateStr = r.settlementDate ? new Date(r.settlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : `${new Date(0, r.month - 1).toLocaleString('default', { month: 'short' })} ${r.year}`;
            const refStr = r.transactionRef ? ` (Ref: ${r.transactionRef})` : '';
            return `
                <tr style="border-bottom:1px solid #e2e8f0;font-size:12px;">
                    <td style="padding:8px 10px;font-weight:600;">${dateStr}</td>
                    <td style="padding:8px 10px;"><span style="background:#e0e7ff;color:#3730a3;padding:2px 6px;border-radius:4px;font-size:11px;">${typeLabel}</span></td>
                    <td style="padding:8px 10px;">${modeLabel}${refStr}</td>
                    <td style="padding:8px 10px;font-weight:700;color:#166534;text-align:right;">INR ${r.amountDeducted.toLocaleString('en-IN')}</td>
                </tr>
            `;
        }).join('');

        const auditTimeline = (loan.history || []).map(h => {
            const d = new Date(h.updatedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `
                <div style="margin-bottom:10px;padding-left:12px;border-left:2px solid #6366f1;font-size:12px;">
                    <div style="font-weight:600;color:#1e293b;">${h.status} <span style="font-size:11px;color:#64748b;font-weight:400;margin-left:6px;">${d}</span></div>
                    <div style="color:#475569;margin-top:2px;">${h.remark || 'N/A'}</div>
                </div>
            `;
        }).join('');

        Swal.fire({
            title: `Loan History & Settlement Trail`,
            width: '640px',
            html: `
                <div style="text-align:left;font-size:13px;max-height:480px;overflow-y:auto;padding-right:4px;">
                    <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:12px;border-radius:8px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <div style="font-weight:700;color:#1e293b;font-size:14px;">${loan.employee?.firstName || ''} ${loan.employee?.lastName || ''} (${loan.loanCategory})</div>
                            <div style="color:#64748b;font-size:12px;margin-top:2px;">Original Loan Amount: <b>INR ${loan.amount.toLocaleString('en-IN')}</b></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-size:11px;color:#64748b;">Remaining Outstanding</div>
                            <div style="font-weight:700;color:${loan.outstandingAmount > 0 ? '#b91c1c' : '#15803d'};font-size:15px;">INR ${loan.outstandingAmount.toLocaleString('en-IN')}</div>
                        </div>
                    </div>

                    <div style="font-weight:700;color:#334155;margin-bottom:8px;font-size:13px;">💳 Payment & Settlement Records (${loan.recoveryHistory?.length || 0})</div>
                    ${loan.recoveryHistory?.length > 0 ? `
                        <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                            <thead>
                                <tr style="background:#f1f5f9;color:#475569;font-size:11px;text-align:left;">
                                    <th style="padding:8px 10px;">Date / Period</th>
                                    <th style="padding:8px 10px;">Type</th>
                                    <th style="padding:8px 10px;">Payment Mode</th>
                                    <th style="padding:8px 10px;text-align:right;">Amount Paid</th>
                                </tr>
                            </thead>
                            <tbody>${recoveryItems}</tbody>
                        </table>
                    ` : '<div style="color:#94a3b8;font-size:12px;margin-bottom:16px;font-style:italic;">No payment or settlement records yet.</div>'}

                    <div style="font-weight:700;color:#334155;margin-bottom:8px;font-size:13px;">📜 Status Audit Log</div>
                    <div>${auditTimeline || '<div style="color:#94a3b8;font-size:12px;">No history logs.</div>'}</div>
                </div>
            `,
            confirmButtonText: 'Close'
        });
    };

    const handleApproveDisbursal = async (loan) => {
        try {
            const mode = loan.disbursalMode || loan.preferredPaymentMethod || 'Payroll System';
            await api.put(`/loans/${loan._id}/status`, { status: 'In Progress', disbursalMode: mode });
            toast.success('Loan disbursed and marked active');
            fetchLoans();
        } catch (err) { toast.error('Failed to disburse loan'); }
    };

    const handleSettleOrCloseLoan = async (loan) => {
        const remainingTermsDefault = Math.max(1, loan.repaymentTerms - (loan.recoveryHistory?.length || 0));
        const { value: formValues, isConfirmed } = await Swal.fire({
            title: `Settle / Restructure Active Loan`,
            width: '540px',
            html: `
                <div style="text-align:left;font-size:13px;padding:4px;">
                    <div style="background:#eef2ff;border:1px solid #c7d2fe;padding:10px 12px;border-radius:6px;margin-bottom:12px;color:#3730a3;">
                        <div style="font-size:12px;font-weight:600;">Current Outstanding Loan Balance</div>
                        <div style="font-size:16px;font-weight:700;margin-top:2px;">INR ${loan.outstandingAmount.toLocaleString('en-IN')}</div>
                    </div>

                    <div style="margin-bottom:12px;">
                        <label style="font-weight:600;display:block;margin-bottom:4px;">Action Type</label>
                        <select id="swal-settle-action" class="swal2-input" style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:38px;">
                            <option value="FullSettlement">✅ Full One-Time Settlement (Close Loan)</option>
                            <option value="PartialSettlement">💳 Partial Payment & Recalculate Remaining EMI</option>
                            <option value="VoidWithoutPayment">⚠️ Void / Cancel Loan (Without Payment)</option>
                        </select>
                    </div>

                    <div id="swal-settle-details">
                        <div style="margin-bottom:12px;">
                            <label id="swal-settle-amount-label" style="font-weight:600;display:block;margin-bottom:4px;">Full Settlement Amount Received (INR)</label>
                            <input id="swal-settle-amount" type="number" class="swal2-input" value="${loan.outstandingAmount}" readonly style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:38px;background:#f1f5f9;cursor:not-allowed;" />
                            <div id="swal-settle-full-note" style="font-size:11px;color:#059669;margin-top:4px;font-weight:500;">✅ Full outstanding balance will be marked as settled and loan will be Closed.</div>
                        </div>

                        <div id="swal-partial-box" style="display:none;margin-bottom:12px;">
                            <div style="margin-bottom:12px;">
                                <label style="font-weight:600;display:block;margin-bottom:4px;">New Remaining EMI Tenure (Months)</label>
                                <input id="swal-settle-tenure" type="number" min="1" max="60" class="swal2-input" value="${remainingTermsDefault}" style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:38px;" />
                            </div>
                            <div id="swal-settle-preview" style="background:#faf5ff;border:1px solid #d8b4fe;padding:8px 12px;border-radius:6px;font-size:12px;color:#6b21a8;margin-bottom:12px;"></div>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-weight:600;display:block;margin-bottom:4px;">Payment Mode Received</label>
                            <select id="swal-settle-mode" class="swal2-input" style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:38px;">
                                <option value="Cash">Cash</option>
                                <option value="Bank Transfer">Bank Transfer / NEFT / UPI</option>
                                <option value="Cheque">Cheque</option>
                            </select>
                        </div>

                        <div style="margin-bottom:12px;">
                            <label style="font-weight:600;display:block;margin-bottom:4px;">Transaction Ref / Cheque No. (Optional)</label>
                            <input id="swal-settle-ref" type="text" class="swal2-input" placeholder="e.g. TXN12345678 or Cheque #0012" style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:38px;" />
                        </div>
                    </div>

                    <div style="margin-bottom:8px;">
                        <label style="font-weight:600;display:block;margin-bottom:4px;">Remarks / Reason</label>
                        <textarea id="swal-settle-remark" class="swal2-textarea" placeholder="Enter details or reason..." style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:60px;"></textarea>
                    </div>
                </div>
            `,
            didOpen: () => {
                const actionEl = document.getElementById('swal-settle-action');
                const detailsEl = document.getElementById('swal-settle-details');
                const partialBox = document.getElementById('swal-partial-box');
                const amountInput = document.getElementById('swal-settle-amount');
                const amountLabel = document.getElementById('swal-settle-amount-label');
                const tenureInput = document.getElementById('swal-settle-tenure');
                const previewEl = document.getElementById('swal-settle-preview');

                const updateCalc = () => {
                    const act = actionEl.value;
                    if (act === 'VoidWithoutPayment') {
                        detailsEl.style.display = 'none';
                        return;
                    }
                    detailsEl.style.display = 'block';

                    if (act === 'PartialSettlement') {
                        partialBox.style.display = 'block';
                        amountLabel.textContent = 'Partial Payment Amount Received (INR)';
                        amountInput.readOnly = false;
                        amountInput.style.background = '#ffffff';
                        amountInput.style.cursor = 'auto';
                        const fullNote = document.getElementById('swal-settle-full-note');
                        if (fullNote) fullNote.style.display = 'none';
                        const paid = parseFloat(amountInput.value) || 0;
                        const remBal = Math.max(0, loan.outstandingAmount - paid);
                        const tenure = parseInt(tenureInput.value) || 1;
                        let newEmi = 0;
                        let interestText = '(Without Interest)';
                        if (loan.interestType === 'Reducing Balance' && loan.interestRate > 0) {
                            const r = loan.interestRate / 12 / 100;
                            newEmi = Math.ceil(remBal * r * Math.pow(1 + r, tenure) / (Math.pow(1 + r, tenure) - 1));
                            interestText = `(${loan.interestRate}% p.a. Reducing)`;
                        } else if (loan.interestType === 'Flat Interest' && loan.interestRate > 0) {
                            const totalRepayment = remBal + (remBal * (loan.interestRate / 100));
                            newEmi = Math.ceil(totalRepayment / tenure);
                            interestText = `(${loan.interestRate}% Flat Interest)`;
                        } else {
                            newEmi = Math.ceil(remBal / tenure);
                            interestText = '(Without Interest)';
                        }
                        previewEl.innerHTML = `Remaining Balance: <b>₹${remBal.toLocaleString('en-IN')}</b> <span style="color:#7c3aed;font-weight:600;">${interestText}</span> | New EMI: <b>₹${newEmi.toLocaleString('en-IN')}/mo</b> for <b>${tenure} months</b>`;
                    } else {
                        partialBox.style.display = 'none';
                        amountLabel.textContent = 'Full Settlement Amount Received (INR)';
                        amountInput.value = loan.outstandingAmount;
                        amountInput.readOnly = true;
                        amountInput.style.background = '#f1f5f9';
                        amountInput.style.cursor = 'not-allowed';
                        const fullNote = document.getElementById('swal-settle-full-note');
                        if (fullNote) fullNote.style.display = 'block';
                    }
                };

                actionEl.addEventListener('change', () => {
                    if (actionEl.value === 'PartialSettlement' && parseFloat(amountInput.value) >= loan.outstandingAmount) {
                        amountInput.value = Math.max(1, loan.outstandingAmount - 1000);
                    } else if (actionEl.value === 'FullSettlement') {
                        amountInput.value = loan.outstandingAmount;
                    }
                    updateCalc();
                });
                amountInput.addEventListener('input', updateCalc);
                tenureInput.addEventListener('input', updateCalc);
                updateCalc();
            },
            showCancelButton: true,
            confirmButtonText: 'Confirm & Submit',
            preConfirm: () => {
                const actionType = document.getElementById('swal-settle-action').value;
                const remark = document.getElementById('swal-settle-remark')?.value?.trim();
                if (actionType === 'VoidWithoutPayment') {
                    if (!remark) {
                        Swal.showValidationMessage('Cancellation reason is required');
                        return false;
                    }
                    return { actionType, remark };
                }

                const settlementAmount = parseFloat(document.getElementById('swal-settle-amount')?.value);
                const paymentMode = document.getElementById('swal-settle-mode')?.value;
                const transactionRef = document.getElementById('swal-settle-ref')?.value?.trim();

                if (!settlementAmount || settlementAmount <= 0) {
                    Swal.showValidationMessage('Valid settlement amount is required');
                    return false;
                }

                if (actionType === 'PartialSettlement') {
                    if (settlementAmount >= loan.outstandingAmount) {
                        Swal.showValidationMessage(`Partial payment must be less than full balance (₹${loan.outstandingAmount})`);
                        return false;
                    }
                    const newTenure = parseInt(document.getElementById('swal-settle-tenure')?.value);
                    if (!newTenure || newTenure <= 0) {
                        Swal.showValidationMessage('Valid remaining tenure is required');
                        return false;
                    }
                    return { actionType, settlementAmount, paymentMode, transactionRef, newTenure, remark };
                }

                return { actionType, settlementAmount, paymentMode, transactionRef, remark };
            }
        });

        if (!isConfirmed || !formValues) return;

        try {
            const { data } = await api.put(`/loans/${loan._id}/settle`, formValues);
            toast.success(data.message || 'Loan settled successfully');
            fetchLoans();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to settle loan');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...formData };
            if (payload.loanCategory === 'Other' && payload.otherLoanCategory) {
                payload.loanCategory = payload.otherLoanCategory;
            }
            await api.post('/loans', payload);
            toast.success('Loan Added Successfully');
            setShowModal(false);
            fetchLoans();
            setActiveTab('requests');
        } catch (err) { toast.error(err.response?.data?.message || 'Error occurred'); }
    };

    const calculateDemoEmi = () => {
        if (!formData.amount || !formData.repaymentTerms) return { total: 0, emi: 0 };
        const P = Number(formData.amount);
        const n = Number(formData.repaymentTerms);
        if (formData.interestType === 'Reducing Balance' && Number(formData.interestRate) > 0) {
            // Reducing Balance EMI Formula: EMI = P * r * (1+r)^n / ((1+r)^n - 1)
            const annualRate = Number(formData.interestRate);
            const r = annualRate / 12 / 100; // monthly rate
            const emi = Math.ceil(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
            const total = emi * n;
            return { total, emi };
        }
        // No Interest
        return { total: P, emi: Math.ceil(P / n) };
    };
    const demo = calculateDemoEmi();

    const openModal = () => {
        setSelectedDept('');
        setFormData({
            employee: '', loanCategory: 'Personal Loan', otherLoanCategory: '', amount: '',
            expectedMonth: new Date().getMonth() + 1, expectedYear: new Date().getFullYear(),
            emiStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
            emiStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
            repaymentTerms: 12, interestType: 'No Interest', interestRate: 0, reason: ''
        });
        setShowModal(true);
    };

    const handleExportExcel = () => {
        if (!filtered.length) {
            toast.error('No data to export for this selection.');
            return;
        }
        const headers = ['Employee Code', 'Employee Name', 'Department', 'Loan Category', 'Amount', 'Balance Pending', 'Terms', 'EMI Amount', 'EMI Starts On', 'Interest', 'Request Month', 'Request Year', 'Status'];
        const wb = XLSX.utils.book_new();

        const buildRow = l => [
            l.employee?.employeeCode || '',
            `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim(),
            l.employee?.department || '',
            l.loanCategory,
            l.amount,
            l.outstandingAmount ?? l.amount,
            l.repaymentTerms,
            l.emiAmount || '-',
            l.emiStartMonth ? `${new Date(0, l.emiStartMonth - 1).toLocaleString('default', { month: 'short' })} ${l.emiStartYear || l.expectedYear}` : '-',
            l.interestType,
            new Date(0, l.expectedMonth - 1).toLocaleString('default', { month: 'short' }),
            l.expectedYear,
            l.status
        ];

        // 1. Master sheet
        const allRows = filtered.map(buildRow);
        const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
        XLSX.utils.book_append_sheet(wb, wsAll, filterDept ? filterDept.substring(0, 31) : 'All Loans');

        // 2. Department-wise sheets if 'All Departments'
        if (!filterDept) {
            const byDept = {};
            filtered.forEach(l => {
                const d = l.employee?.department || 'Unassigned';
                if (!byDept[d]) byDept[d] = [];
                byDept[d].push(l);
            });
            Object.keys(byDept).sort().forEach(dept => {
                const deptRows = byDept[dept].map(buildRow);
                const ws = XLSX.utils.aoa_to_sheet([headers, ...deptRows]);
                XLSX.utils.book_append_sheet(wb, ws, dept.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '') || 'Unassigned');
            });
        }

        XLSX.writeFile(wb, `Loans_Report.xlsx`);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div style={{ flex: '1 1 auto' }}>
                    <h1>Loan Management</h1>
                    <p>Manage employee loans, EMI deductions, overrides, and restructures</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="form-control" style={{ width: 170 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                        <option value="">All Departments</option>
                        {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                    </select>
                    <select className="form-control" style={{ width: 140 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                        <option value="">All Months</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'short' })}</option>)}
                    </select>
                    <YearSelectDropdown value={filterYear} onChange={setFilterYear} years={years} setShowYearModal={setShowYearModal} />
                    <button className="btn btn-secondary" onClick={handleExportExcel} title="Download Excel">
                        <HiOutlineDownload /> Export
                    </button>
                    <button className="btn btn-primary" onClick={openModal}><HiOutlinePlus /> Add Loan</button>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 20, flexWrap: 'wrap', gap: '4px' }}>
                <button className={`tab ${activeTab === 'outstanding' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('outstanding')}>Outstanding Loans</button>
                <button className={`tab ${activeTab === 'cleared' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('cleared')}>Cleared / Cancelled</button>
                <button className={`tab ${activeTab === 'requests' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('requests')}>Loan Requests</button>
            </div>



            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                {loading ? <div style={{ padding: 20 }}>Loading...</div> : (
                    <table style={{ width: '100%', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Loan Amount</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Outstanding Amount</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Disbursal Info</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>EMI Amount</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Remaining EMI Terms</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>EMI Deduction Starts</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? <tr><td colSpan="9" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No loans found in this category</td></tr> : filtered.map(l => {
                                const remainingTerms = l.repaymentTerms - (l.recoveryHistory?.length || 0);
                                const monthName = new Date(0, l.emiStartMonth - 1).toLocaleString('default', { month: 'short' });
                                const activeMode = l.disbursalMode || l.preferredPaymentMethod || 'Payroll System';
                                const isPayrollMode = activeMode === 'Payroll System';
                                let disbursalDate;
                                if (l.status === 'Pending') {
                                    disbursalDate = 'Requested via ' + (l.preferredPaymentMethod || 'Payroll System');
                                } else if (l.status === 'Offered') {
                                    disbursalDate = isPayrollMode ? `Offered for ${new Date(0, (l.disbursalPayrollMonth || l.expectedMonth) - 1).toLocaleString('default', { month: 'short' })} ${l.disbursalPayrollYear || l.expectedYear}` : `Offered via ${activeMode}`;
                                } else if (isPayrollMode) {
                                    disbursalDate = `For ${new Date(0, (l.disbursalPayrollMonth || l.expectedMonth) - 1).toLocaleString('default', { month: 'short' })} ${l.disbursalPayrollYear || l.expectedYear}`;
                                } else {
                                    disbursalDate = new Date(Math.max(new Date(l.createdAt), ...(l.history || []).map(h => new Date(h.updatedAt || Date.now())))).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                                }

                                const disbursalMode = l.status === 'Pending' ? `Awaiting Review (${l.preferredPaymentMethod || 'Payroll'})` : activeMode;

                                return (
                                    <tr key={l._id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ color: '#4f46e5', fontWeight: 500, fontSize: '14px' }}>{l.employee?.firstName} {l.employee?.lastName}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{l.employee?.employeeCode}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {l.amount.toLocaleString('en-IN')}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{l.loanCategory}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {l.outstandingAmount.toLocaleString('en-IN')}</div>
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>
                                            {l.interestType === 'Reducing Balance' && l.interestRate > 0
                                                ? `(${l.interestRate}% p.a. Reducing)`
                                                : l.interestType === 'Flat Interest' && l.interestRate > 0
                                                    ? `(${l.interestRate}% Flat Interest)`
                                                    : '(Without Interest)'}
                                            {l.rejectionReason && (
                                                <div style={{ color: '#ef4444', marginTop: 4, fontSize: 11 }}>Reason: {l.rejectionReason}</div>
                                            )}
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ color: '#334155', fontWeight: 500 }}>{disbursalMode}</div>
                                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>{disbursalDate}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b' }}>
                                            INR {l.emiAmount.toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 500, color: '#1e293b' }}>{remainingTerms}</div>
                                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>out of {l.repaymentTerms}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>
                                            {monthName} {l.emiStartYear}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {(() => {
                                                let displayText = l.status;
                                                let textColor = '#64748b';
                                                let extraBadge = null;
                                                if (l.status === 'Pending') { displayText = 'Pending Review'; textColor = '#d97706'; }
                                                else if (l.status === 'Offered') { displayText = '📩 Offer Sent'; textColor = '#7c3aed'; }
                                                else if (l.status === 'Approved') { displayText = 'Approved (Ready)'; textColor = '#2563eb'; }
                                                else if (l.status === 'Closed') {
                                                    const settlementRecords = (l.recoveryHistory || []).filter(r => r.overrideType === 'FullSettlement' || r.overrideType === 'PartialSettlement');
                                                    const totalSettled = settlementRecords.reduce((sum, r) => sum + (r.amountDeducted || 0), 0);
                                                    const lastSettlement = settlementRecords.length > 0 ? settlementRecords[settlementRecords.length - 1] : null;
                                                    const lastDate = lastSettlement?.settlementDate ? new Date(lastSettlement.settlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                                                    const isFullySettled = (l.recoveryHistory || []).some(r => r.overrideType === 'FullSettlement');
                                                    displayText = isFullySettled ? '✅ Fully Settled' : '✅ Closed';
                                                    textColor = '#059669';
                                                    extraBadge = (
                                                        <div style={{ marginTop: 4 }}>
                                                            {totalSettled > 0 && (
                                                                <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600, background: '#d1fae5', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>
                                                                    INR {totalSettled.toLocaleString('en-IN')} settled
                                                                </div>
                                                            )}
                                                            {lastDate && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: 2 }}>on {lastDate}</div>}
                                                        </div>
                                                    );
                                                }
                                                else if (l.status === 'Rejected by Employee') { displayText = 'Rejected by Employee'; textColor = '#ef4444'; }
                                                else if (l.status === 'Rejected by Admin') { displayText = 'Rejected by Admin'; textColor = '#dc2626'; }
                                                else if (l.status === 'Cancelled by Admin') { displayText = 'Cancelled by Admin'; textColor = '#64748b'; }
                                                else if (l.status === 'Cancelled') {
                                                    const isEmp = (l.history || []).some(h => (h.remark && h.remark.toLowerCase().includes('employee')) || h.status === 'Rejected by Employee');
                                                    if (isEmp) { displayText = 'Rejected by Employee'; textColor = '#ef4444'; }
                                                    else { displayText = 'Cancelled by Admin'; textColor = '#64748b'; }
                                                }
                                                else if (l.status === 'Rejected') {
                                                    displayText = 'Rejected by Admin'; textColor = '#dc2626';
                                                }
                                                else {
                                                    const hasDeductions = l.outstandingAmount < l.totalRepayment;
                                                    if (!hasDeductions) { displayText = 'Not Started'; textColor = '#10b981'; }
                                                    else { displayText = 'In Progress'; textColor = '#3b82f6'; }
                                                }
                                                return (
                                                    <div>
                                                        <span style={{ color: textColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>{displayText}</span>
                                                        {extraBadge}
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {l.status === 'Pending' && (
                                                <button className="btn btn-primary btn-sm" onClick={() => handleReviewLoan(l)} style={{ fontSize: '12px', padding: '6px 14px' }}>Review</button>
                                            )}
                                            {l.status === 'Offered' && (
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleReviewLoan(l)} style={{ fontSize: '12px', padding: '4px 10px' }} title="Edit terms of this offer">Edit Offer</button>
                                                    <span style={{ color: '#7c3aed', fontSize: '12px', fontWeight: 500 }}>Awaiting Employee</span>
                                                </div>
                                            )}
                                            {l.status === 'Approved' && (
                                                <button className="btn btn-primary btn-sm" onClick={() => handleApproveDisbursal(l)} style={{ fontSize: '12px', padding: '6px 14px' }}>Disburse</button>
                                            )}
                                            {['In Progress'].includes(l.status) && (
                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleViewLoanHistory(l)} style={{ color: '#6366f1', padding: '4px 10px', fontSize: '12px' }}>History</button>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleSettleOrCloseLoan(l)} style={{ color: '#0284c7', padding: '4px 10px', fontSize: '12px' }}>Settle / Close</button>
                                                </div>
                                            )}
                                            {['Closed', 'Cancelled', 'Cancelled by Admin', 'Rejected', 'Rejected by Admin', 'Rejected by Employee'].includes(l.status) && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewLoanHistory(l)} style={{ color: '#6366f1', padding: '4px 10px', fontSize: '12px' }}>View History</button>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2>Add New Loan</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Filter by Department</label>
                                        <select className="form-control" value={selectedDept} onChange={e => {
                                            setSelectedDept(e.target.value);
                                            setFormData({ ...formData, employee: '' });
                                        }}>
                                            <option value="">All Departments</option>
                                            {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ marginBottom: 4 }}>Employee</label>
                                        <EmployeeSelect
                                            employees={filteredEmployees}
                                            value={formData.employee}
                                            onChange={(val) => setFormData({ ...formData, employee: val })}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Loan Category</label>
                                        <select className="form-control" value={formData.loanCategory} onChange={e => setFormData({ ...formData, loanCategory: e.target.value })}>
                                            <option>Personal Loan</option><option>Home Loan</option><option>Emergency Loan</option><option value="Other">Other</option>
                                        </select>
                                        {formData.loanCategory === 'Other' && (
                                            <input type="text" className="form-control" style={{ marginTop: 8 }} placeholder="Specify custom loan category..." required value={formData.otherLoanCategory || ''} onChange={e => setFormData({ ...formData, otherLoanCategory: e.target.value })} />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Principal Amount (₹)</label>
                                        <input type="number" min="1" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Interest Type</label>
                                        <select className="form-control" value={formData.interestType} onChange={e => {
                                            const val = e.target.value;
                                            setFormData({ ...formData, interestType: val, interestRate: val === 'No Interest' ? 0 : formData.interestRate });
                                        }}>
                                            <option>No Interest</option><option>Reducing Balance</option>
                                        </select>
                                    </div>
                                    {formData.interestType !== 'No Interest' && (
                                        <div className="form-group">
                                            <label className="form-label">Annual Interest Rate (%)</label>
                                            <input type="number" min="0" step="0.1" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" value={formData.interestRate} onChange={e => setFormData({ ...formData, interestRate: e.target.value === '' ? '' : Number(e.target.value) })} />
                                        </div>
                                    )}
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Payment Mode</label>
                                        <select className="form-control" value={formData.disbursalMode || 'Payroll System'} onChange={e => setFormData({ ...formData, disbursalMode: e.target.value, preferredPaymentMethod: e.target.value })}>
                                            <option value="Payroll System">Payroll System (With Salary)</option>
                                            <option value="Cash">Cash</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="Bank Transfer">Direct Bank Transfer</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Repayment Tenure (Months)</label>
                                        <input type="number" className="form-control" required min="1" max="120" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={formData.repaymentTerms} onChange={e => setFormData({ ...formData, repaymentTerms: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">EMI Start Month</label>
                                        <select className="form-control" required value={formData.emiStartMonth} onChange={e => setFormData({ ...formData, emiStartMonth: Number(e.target.value) })}>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">EMI Start Year</label>
                                        <input type="number" min="2020" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={formData.emiStartYear} onChange={e => setFormData({ ...formData, emiStartYear: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                {(formData.disbursalMode || 'Payroll System') === 'Payroll System' && (
                                    <div className="form-group">
                                        <label className="form-label">Expected Month (Payroll Month)</label>
                                        <input
                                            type="month"
                                            className="form-control"
                                            required
                                            value={`${formData.expectedYear}-${String(formData.expectedMonth).padStart(2, '0')}`}
                                            onChange={e => {
                                                if (e.target.value) {
                                                    const [y, m] = e.target.value.split('-');
                                                    setFormData({ ...formData, expectedYear: Number(y), expectedMonth: Number(m) });
                                                }
                                            }}
                                        />
                                    </div>
                                )}

                                {demo.total > 0 && (
                                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: 16, borderRadius: 8, marginTop: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ color: '#0369a1' }}>Total Repayment:</span>
                                            <strong style={{ color: '#0369a1', fontSize: 16 }}>₹{demo.total.toLocaleString('en-IN')}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#0369a1' }}>Monthly EMI:</span>
                                            <strong style={{ color: '#ef4444', fontSize: 16 }}>₹{demo.emi.toLocaleString('en-IN')}</strong>
                                        </div>
                                        <p style={{ fontSize: 11, color: '#0284c7', marginTop: 12, fontStyle: 'italic' }}>* Final loan approval decision, including loan amount and tenure, will be taken by the approver.</p>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Submit Loan Details</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <YearManagerModal showYearModal={showYearModal} setShowYearModal={setShowYearModal} years={years} fetchYears={fetchYears} />
        </div>
    );
}
