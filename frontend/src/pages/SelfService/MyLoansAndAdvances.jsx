import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { HiOutlineCash, HiOutlinePlus, HiOutlineX, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

export default function MyLoansAndAdvances() {
    const { isExEmployee } = useAuth();
    const [loans, setLoans] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('loans'); // 'loans' or 'advances'

    const [showLoanModal, setShowLoanModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [editLoanId, setEditLoanId] = useState(null);
    const [editAdvanceId, setEditAdvanceId] = useState(null);

    const [loanForm, setLoanForm] = useState({
        loanCategory: 'Personal Loan', otherLoanCategory: '', amount: '',
        expectedMonth: new Date().getMonth() + 1, expectedYear: new Date().getFullYear(),
        emiStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
        emiStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
        repaymentTerms: 12, reason: '', preferredPaymentMethod: 'Payroll System'
    });

    const [advanceForm, setAdvanceForm] = useState({
        amount: '', requestMonth: new Date().getMonth() + 1, requestYear: new Date().getFullYear(),
        recoveryStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
        recoveryStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
        recoveryDuration: 1, reason: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const [loanRes, advRes] = await Promise.all([
                api.get('/loans'),
                api.get('/advances')
            ]);
            setLoans(loanRes.data.data || []);
            setAdvances(advRes.data.data || []);
        } catch (err) {
            toast.error('Failed to load financial records');
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const calculateDemoEmi = () => {
        if (!loanForm.amount || !loanForm.repaymentTerms) return { total: 0, emi: 0 };
        let total = Number(loanForm.amount);
        return { total, emi: Math.ceil(total / Number(loanForm.repaymentTerms)) };
    };
    const demoLoan = calculateDemoEmi();

    const submitLoan = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...loanForm };
            if (payload.loanCategory === 'Other' && payload.otherLoanCategory) {
                payload.loanCategory = payload.otherLoanCategory;
            }
            if (editLoanId) {
                await api.put(`/loans/${editLoanId}`, payload);
                toast.success('Loan Request Updated');
            } else {
                await api.post('/loans', payload);
                toast.success('Loan Request Submitted');
            }
            setShowLoanModal(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error occurred'); }
    };

    const submitAdvance = async (e) => {
        e.preventDefault();
        try {
            if (editAdvanceId) {
                await api.put(`/advances/${editAdvanceId}`, advanceForm);
                toast.success('Advance Salary Request Updated');
            } else {
                await api.post('/advances', advanceForm);
                toast.success('Advance Salary Request Submitted');
            }
            setShowAdvanceModal(false);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error occurred'); }
    };

    const deleteLoan = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Loan Request?',
            text: 'Are you sure you want to cancel and delete this loan request?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: '<span style="color: #475569; font-weight: 600;">Cancel</span>',
            reverseButtons: true
        });
        if (!result.isConfirmed) return;
        try {
            await api.delete(`/loans/${id}`);
            toast.success('Loan request deleted');
            fetchData();
        } catch (err) { toast.error('Failed to delete'); }
    };

    const deleteAdvance = async (id) => {
        const result = await Swal.fire({
            title: 'Delete Advance Request?',
            text: 'Are you sure you want to cancel and delete this advance request?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: '<span style="color: #475569; font-weight: 600;">Cancel</span>',
            reverseButtons: true
        });
        if (!result.isConfirmed) return;
        try {
            await api.delete(`/advances/${id}`);
            toast.success('Advance request deleted');
            fetchData();
        } catch (err) { toast.error('Failed to delete'); }
    };

    const openLoanModal = (loan = null) => {
        if (loan) {
            setEditLoanId(loan._id);
            setLoanForm({
                loanCategory: ['Personal Loan', 'Home Loan', 'Car Loan'].includes(loan.loanCategory) ? loan.loanCategory : 'Other',
                otherLoanCategory: !['Personal Loan', 'Home Loan', 'Car Loan'].includes(loan.loanCategory) ? loan.loanCategory : '',
                amount: loan.amount, expectedMonth: loan.expectedMonth, expectedYear: loan.expectedYear,
                emiStartMonth: loan.emiStartMonth, emiStartYear: loan.emiStartYear, repaymentTerms: loan.repaymentTerms,
                reason: loan.reason || '', preferredPaymentMethod: loan.preferredPaymentMethod || 'Payroll System'
            });
        } else {
            setEditLoanId(null);
            setLoanForm({
                loanCategory: 'Personal Loan', otherLoanCategory: '', amount: '',
                expectedMonth: new Date().getMonth() + 1, expectedYear: new Date().getFullYear(),
                emiStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
                emiStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
                repaymentTerms: 12, reason: '', preferredPaymentMethod: 'Payroll System'
            });
        }
        setShowLoanModal(true);
    };

    const openAdvanceModal = (adv = null) => {
        if (adv) {
            setEditAdvanceId(adv._id);
            setAdvanceForm({
                amount: adv.amount, requestMonth: adv.requestMonth, requestYear: adv.requestYear,
                recoveryStartMonth: adv.recoveryStartMonth, recoveryStartYear: adv.recoveryStartYear,
                recoveryDuration: adv.recoveryDuration, reason: adv.reason || ''
            });
        } else {
            setEditAdvanceId(null);
            setAdvanceForm({
                amount: '', requestMonth: new Date().getMonth() + 1, requestYear: new Date().getFullYear(),
                recoveryStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
                recoveryStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
                recoveryDuration: 1, reason: ''
            });
        }
        setShowAdvanceModal(true);
    };

    const handleViewLoanHistory = (loan) => {
        const recoveryItems = [...(loan.recoveryHistory || [])]
            .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
            .map(r => {
            const typeLabel = r.overrideType === 'FullSettlement' ? '✅ Full Settlement' : r.overrideType === 'PartialSettlement' ? '💳 Partial Settlement' : '📅 Monthly EMI Deduction';
            const modeLabel = r.paymentMode || 'Payroll System';
            const dateStr = r.settlementDate
                ? new Date(r.settlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : `${new Date(0, r.month - 1).toLocaleString('default', { month: 'short' })} ${r.year}`;
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
                            <div style="font-weight:700;color:#1e293b;font-size:14px;">${loan.loanCategory}</div>
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
                                    <th style="padding:8px 10px;text-align:right;">Amount</th>
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

    const processedLoans = loans.map(l => ({
        ...l,
        status: (['Approved', 'In Progress', 'Disbursed'].includes(l.status) && l.outstandingAmount <= 0) ? 'Closed' : l.status
    }));

    const processedAdvances = advances.map(a => ({
        ...a,
        status: (['Approved', 'Recovering'].includes(a.status) && a.outstandingAmount <= 0) ? 'Recovered' : a.status
    }));

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Loans & Advances</h1>
                    <p>Track your active loans and advance salary requests</p>
                </div>
                {!isExEmployee && (
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-secondary" onClick={() => openAdvanceModal()}><HiOutlinePlus /> Request Advance</button>
                        <button className="btn btn-primary" onClick={() => openLoanModal()}><HiOutlinePlus /> Request Loan</button>
                    </div>
                )}
            </div>

            <div className="tabs" style={{ marginBottom: 20 }}>
                <button className={`tab ${activeTab === 'loans' ? 'active' : ''}`} onClick={() => setActiveTab('loans')}>My Loans</button>
                <button className={`tab ${activeTab === 'advances' ? 'active' : ''}`} onClick={() => setActiveTab('advances')}>My Advances</button>
            </div>

            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                {loading ? <div style={{ padding: 20 }}>Loading...</div> : (
                    activeTab === 'loans' ? (
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
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
                                {processedLoans.length === 0 ? <tr><td colSpan="8" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No loans requested</td></tr> : processedLoans.map(l => {
                                    const remainingTerms = l.repaymentTerms - (l.recoveryHistory?.length || 0);
                                    const monthName = new Date(0, l.emiStartMonth - 1).toLocaleString('default', { month: 'short' });
                                    const activeMode = l.disbursalMode || l.preferredPaymentMethod || 'Payroll System';
                                    const isPayrollMode = activeMode === 'Payroll System';
                                    let disbursalDate;
                                    if (l.status === 'Pending') {
                                        disbursalDate = 'Requested via ' + (l.preferredPaymentMethod || 'Payroll System');
                                    } else if (isPayrollMode) {
                                        disbursalDate = `For ${new Date(0, (l.disbursalPayrollMonth || l.expectedMonth) - 1).toLocaleString('default', { month: 'short' })} ${l.disbursalPayrollYear || l.expectedYear}`;
                                    } else {
                                        disbursalDate = new Date(Math.max(new Date(l.createdAt), ...l.history.map(h => new Date(h.updatedAt)))).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                                    }
                                    const disbursalModeLabel = l.status === 'Pending' ? `Awaiting Review (${l.preferredPaymentMethod || 'Payroll'})` : activeMode;

                                    return (
                                        <tr key={l._id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {l.amount.toLocaleString('en-IN')}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{l.loanCategory}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ color: '#1e293b', fontWeight: 600 }}>INR {l.outstandingAmount.toLocaleString('en-IN')}</div>
                                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: 2 }}>
                                                    {l.status === 'Offered'
                                                        ? <span style={{ color: '#7c3aed', fontWeight: 600 }}>Offer: {l.interestType === 'No Interest' ? 'No Interest' : `${l.interestRate}% p.a. ${l.interestType}`}</span>
                                                        : l.interestType === 'Reducing Balance' && l.interestRate > 0
                                                            ? `(${l.interestRate}% p.a. Reducing)`
                                                            : l.interestType === 'Flat Interest' && l.interestRate > 0
                                                                ? `(${l.interestRate}% Flat Interest)`
                                                                : '(Without Interest)'}
                                                    {l.rejectionReason && (
                                                        <div style={{ color: '#ef4444', marginTop: 4 }}>Reason: {l.rejectionReason}</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ color: '#334155', fontWeight: 500 }}>{disbursalModeLabel}</div>
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
                                                    if (l.status === 'Pending') { displayText = 'Pending Review'; textColor = '#d97706'; }
                                                    else if (l.status === 'Offered') { displayText = '📩 Offer Received'; textColor = '#7c3aed'; }
                                                    else if (l.status === 'Rejected by Employee') { displayText = 'Offer Rejected by You'; textColor = '#ef4444'; }
                                                    else if (l.status === 'Rejected by Admin' || l.status === 'Rejected') { displayText = 'Rejected by Admin'; textColor = '#dc2626'; }
                                                    else if (l.status === 'Cancelled by Admin') { displayText = 'Cancelled by Admin'; textColor = '#64748b'; }
                                                    else if (l.status === 'Cancelled') {
                                                        const isEmp = (l.history || []).some(h => (h.remark && h.remark.toLowerCase().includes('employee')) || h.status === 'Rejected by Employee');
                                                        if (isEmp) { displayText = 'Offer Rejected by You'; textColor = '#ef4444'; }
                                                        else { displayText = 'Cancelled by Admin'; textColor = '#64748b'; }
                                                    }
                                                    else if (['Closed'].includes(l.status)) {
                                                        const settlementRecords = (l.recoveryHistory || []).filter(r => r.overrideType === 'FullSettlement' || r.overrideType === 'PartialSettlement');
                                                        const totalSettled = settlementRecords.reduce((sum, r) => sum + (r.amountDeducted || 0), 0);
                                                        const lastSettlement = settlementRecords.length > 0 ? settlementRecords[settlementRecords.length - 1] : null;
                                                        const lastDate = lastSettlement?.settlementDate ? new Date(lastSettlement.settlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                                                        const isFullySettled = (l.recoveryHistory || []).some(r => r.overrideType === 'FullSettlement');
                                                        displayText = isFullySettled ? '✅ Fully Settled' : '✅ Closed';
                                                        textColor = '#059669';
                                                    }
                                                    else {
                                                        const hasDeductions = l.outstandingAmount < l.totalRepayment;
                                                        if (!hasDeductions) { displayText = 'Not Started'; textColor = '#10b981'; }
                                                        else { displayText = 'In Progress'; textColor = '#3b82f6'; }
                                                    }
                                                    return (
                                                        <div>
                                                            <span style={{ color: textColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>{displayText}</span>
                                                            {['Closed'].includes(l.status) && (() => {
                                                                const settlementRecords = (l.recoveryHistory || []).filter(r => r.overrideType === 'FullSettlement' || r.overrideType === 'PartialSettlement');
                                                                const totalSettled = settlementRecords.reduce((sum, r) => sum + (r.amountDeducted || 0), 0);
                                                                const lastSettlement = settlementRecords.length > 0 ? settlementRecords[settlementRecords.length - 1] : null;
                                                                const lastDate = lastSettlement?.settlementDate ? new Date(lastSettlement.settlementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
                                                                return totalSettled > 0 ? (
                                                                    <div style={{ marginTop: 4 }}>
                                                                        <div style={{ fontSize: '11px', color: '#065f46', fontWeight: 600, background: '#d1fae5', borderRadius: 4, padding: '2px 6px', display: 'inline-block' }}>INR {totalSettled.toLocaleString('en-IN')} settled</div>
                                                                        {lastDate && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: 2 }}>on {lastDate}</div>}
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                {isExEmployee ? (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleViewLoanHistory(l)} style={{ color: '#6366f1', padding: '4px 12px', fontSize: '12px' }}>📜 View History</button>
                                                ) : l.status === 'Pending' ? (
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                        <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#3b82f6' }} onClick={() => openLoanModal(l)} title="Edit"><HiOutlinePencil /></button>
                                                        <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteLoan(l._id)} title="Delete"><HiOutlineTrash /></button>
                                                    </div>
                                                ) : l.status === 'Offered' ? (
                                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                        <button className="btn btn-primary btn-sm" style={{ fontSize: '11px', padding: '5px 10px', background: '#10b981' }} onClick={async () => {
                                                            const res = await Swal.fire({ title: 'Accept Loan Offer?', text: `EMI: ₹${l.emiAmount?.toLocaleString('en-IN')}/mo for ${l.repaymentTerms} months`, icon: 'question', showCancelButton: true, confirmButtonText: 'Yes, Accept', confirmButtonColor: '#10b981' });
                                                            if (res.isConfirmed) { await api.put(`/loans/${l._id}/status`, { status: 'Approved' }); toast.success('Offer accepted!'); fetchData(); }
                                                        }}>✅ Accept</button>
                                                        <button className="btn btn-secondary btn-sm" style={{ fontSize: '11px', padding: '5px 10px', color: '#ef4444' }} onClick={async () => {
                                                            const res = await Swal.fire({ title: 'Reject Loan Offer?', text: 'Are you sure you want to reject this offer?', icon: 'warning', showCancelButton: true, confirmButtonText: 'Yes, Reject', confirmButtonColor: '#ef4444' });
                                                            if (res.isConfirmed) { await api.put(`/loans/${l._id}/status`, { status: 'Cancelled' }); toast.info('Offer rejected'); fetchData(); }
                                                        }}>❌ Reject</button>
                                                    </div>
                                                ) : (
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleViewLoanHistory(l)} style={{ color: '#6366f1', padding: '4px 12px', fontSize: '12px' }}>📜 View History</button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 16px', fontWeight: 600 }}>Advance Amount</th>
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
                                {processedAdvances.length === 0 ? <tr><td colSpan="8" style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No advance requested</td></tr> : processedAdvances.map(a => {
                                    const remainingTerms = a.outstandingAmount > 0 ? Math.ceil(a.outstandingAmount / a.installmentAmount) : 0;
                                    const monthName = new Date(0, a.recoveryStartMonth - 1).toLocaleString('default', { month: 'short' });
                                    const isPayrollMode = ['Payroll System'].includes(a.disbursalMode) || !a.disbursalMode;
                                    let disbursalDate;
                                    if (a.status === 'Pending') {
                                        disbursalDate = 'Initial Pending';
                                    } else if (isPayrollMode) {
                                        disbursalDate = `For ${new Date(0, a.requestMonth - 1).toLocaleString('default', { month: 'short' })} ${a.requestYear}`;
                                    } else {
                                        disbursalDate = new Date(Math.max(new Date(a.createdAt), ...a.history.map(h => new Date(h.updatedAt)))).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                                    }
                                    const disbursalMode = a.status === 'Pending' ? 'Awaiting Approval' : (isPayrollMode ? 'Payroll System' : a.disbursalMode);

                                    return (
                                        <tr key={a._id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {a.amount.toLocaleString('en-IN')}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ color: '#1e293b', fontWeight: 600 }}>INR {a.outstandingAmount.toLocaleString('en-IN')}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ color: '#334155', fontWeight: 500 }}>{disbursalMode}</div>
                                                <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>{disbursalDate}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b' }}>
                                                INR {a.installmentAmount.toLocaleString('en-IN')}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: 500, color: '#1e293b' }}>{remainingTerms}</div>
                                                <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>out of {a.recoveryDuration}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>
                                                {monthName} {a.recoveryStartYear}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {(() => {
                                                    let displayText = a.status;
                                                    let textColor = '#64748b';
                                                    if (a.status === 'Pending') { displayText = 'Pending Review'; textColor = '#d97706'; }
                                                    else if (['Recovered', 'Rejected'].includes(a.status)) { displayText = a.status; textColor = '#64748b'; }
                                                    else {
                                                        const hasDeductions = a.outstandingAmount < a.amount;
                                                        if (!hasDeductions) { displayText = 'Not Started'; textColor = '#10b981'; }
                                                        else { displayText = 'In Progress'; textColor = '#3b82f6'; }
                                                    }
                                                    return <span style={{ color: textColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>{displayText}</span>;
                                                })()}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                {a.status === 'Pending' && !isExEmployee ? (
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                        <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#3b82f6' }} onClick={() => openAdvanceModal(a)} title="Edit"><HiOutlinePencil /></button>
                                                        <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteAdvance(a._id)} title="Delete"><HiOutlineTrash /></button>
                                                    </div>
                                                ) : <span style={{ color: '#cbd5e1', fontSize: '12px' }}>-</span>}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )
                )}
            </div>

            {/* Loan Request Modal */}
            {showLoanModal && (
                <div className="modal-overlay" onClick={() => setShowLoanModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2>{editLoanId ? 'Edit Loan Request' : 'Request Loan'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowLoanModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={submitLoan}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Loan Category</label>
                                        <select className="form-control" value={loanForm.loanCategory} onChange={e => setLoanForm({ ...loanForm, loanCategory: e.target.value })}>
                                            <option>Personal Loan</option><option>Home Loan</option><option>Emergency Loan</option><option value="Other">Other</option>
                                        </select>
                                        {loanForm.loanCategory === 'Other' && (
                                            <input type="text" className="form-control" style={{ marginTop: 8 }} placeholder="Specify custom loan category..." required value={loanForm.otherLoanCategory || ''} onChange={e => setLoanForm({ ...loanForm, otherLoanCategory: e.target.value })} />
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Principal Amount (₹)</label>
                                        <input type="number" min="1" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={loanForm.amount} onChange={e => setLoanForm({ ...loanForm, amount: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                {/* Interest fields removed — Admin will set interest after approval */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Payment Mode Requested</label>
                                        <select className="form-control" required value={loanForm.preferredPaymentMethod} onChange={e => setLoanForm({ ...loanForm, preferredPaymentMethod: e.target.value })}>
                                            <option value="Payroll System">Payroll System (With Salary)</option>
                                            <option value="Cash">Cash</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="Bank Transfer">Direct Bank Transfer</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Repayment Tenure (Months)</label>
                                        <input type="number" className="form-control" required min="1" max="120" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={loanForm.repaymentTerms} onChange={e => setLoanForm({ ...loanForm, repaymentTerms: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">EMI Start Month</label>
                                        <select className="form-control" required value={loanForm.emiStartMonth} onChange={e => setLoanForm({ ...loanForm, emiStartMonth: Number(e.target.value) })}>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">EMI Start Year</label>
                                        <input type="number" min="2020" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={loanForm.emiStartYear} onChange={e => setLoanForm({ ...loanForm, emiStartYear: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                {loanForm.preferredPaymentMethod === 'Payroll System' && (
                                    <div className="form-group">
                                        <label className="form-label">Expected Payroll Month</label>
                                        <input type="month" className="form-control" required value={`${loanForm.expectedYear}-${String(loanForm.expectedMonth).padStart(2, '0')}`} onChange={e => {
                                            if (e.target.value) {
                                                const [y, m] = e.target.value.split('-');
                                                setLoanForm({ ...loanForm, expectedYear: Number(y), expectedMonth: Number(m) });
                                            }
                                        }} />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <textarea className="form-control" required value={loanForm.reason} onChange={e => setLoanForm({ ...loanForm, reason: e.target.value })} />
                                </div>
                                {demoLoan.total > 0 && (
                                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: 16, borderRadius: 8, marginTop: 12 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                            <span style={{ color: '#0369a1' }}>Total Repayment:</span>
                                            <strong style={{ color: '#0369a1', fontSize: 16 }}>₹{demoLoan.total.toLocaleString('en-IN')}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#0369a1' }}>Monthly EMI:</span>
                                            <strong style={{ color: '#ef4444', fontSize: 16 }}>₹{demoLoan.emi.toLocaleString('en-IN')}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowLoanModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Advance Request Modal */}
            {showAdvanceModal && (
                <div className="modal-overlay" onClick={() => setShowAdvanceModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                        <div className="modal-header">
                            <h2>{editAdvanceId ? 'Edit Advance Salary Request' : 'Request Advance Salary'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowAdvanceModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={submitAdvance}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Advance Amount (₹)</label>
                                        <input type="number" min="1" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Recovery Duration (Months)</label>
                                        <input type="number" min="1" max="12" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={advanceForm.recoveryDuration} onChange={e => setAdvanceForm({ ...advanceForm, recoveryDuration: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Recovery Start Month</label>
                                        <select className="form-control" required value={advanceForm.recoveryStartMonth} onChange={e => setAdvanceForm({ ...advanceForm, recoveryStartMonth: Number(e.target.value) })}>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Recovery Start Year</label>
                                        <input type="number" min="2020" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={advanceForm.recoveryStartYear} onChange={e => setAdvanceForm({ ...advanceForm, recoveryStartYear: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Expected Payroll Month</label>
                                        <input type="month" className="form-control" required value={`${advanceForm.requestYear}-${String(advanceForm.requestMonth).padStart(2, '0')}`} onChange={e => {
                                            if (e.target.value) {
                                                const [y, m] = e.target.value.split('-');
                                                setAdvanceForm({ ...advanceForm, requestYear: Number(y), requestMonth: Number(m) });
                                            }
                                        }} />
                                    </div>
                                    <div className="form-group">
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <textarea className="form-control" required value={advanceForm.reason} onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })} />
                                </div>
                                {advanceForm.amount && advanceForm.recoveryDuration && (
                                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #e2e8f0', fontSize: 13 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Advance Amount:</span> <strong>₹{Number(advanceForm.amount).toLocaleString('en-IN')}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Monthly Recovered EMI:</span> <strong style={{ color: '#ef4444' }}>₹{Math.ceil(Number(advanceForm.amount) / advanceForm.recoveryDuration).toLocaleString('en-IN')} /mo</strong></div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAdvanceModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
