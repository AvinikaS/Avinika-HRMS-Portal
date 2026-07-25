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
        else if (activeTab === 'requests') { if (!['Pending', 'Approved', 'Rejected'].includes(l.status)) return false; }
        else if (activeTab === 'cleared') { if (!['Closed', 'Cancelled'].includes(l.status)) return false; }

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

    const handleApprove = async (id) => {
        const { value: mode, isConfirmed } = await Swal.fire({
            title: 'Select Disbursal Mode',
            input: 'select',
            inputOptions: { 'Payroll System': 'Via Payroll System', 'Outside Payroll': 'Outside Payroll', 'Bank Transfer': 'Bank Transfer', 'Cash': 'Cash' },
            showCancelButton: true,
            confirmButtonText: 'Approve & Release'
        });
        if (isConfirmed && mode) {
            updateStatus(id, 'In Progress', mode);
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
        let total = Number(formData.amount);
        if (formData.interestType === 'Flat Interest') total += (total * (Number(formData.interestRate) / 100));
        return { total, emi: Math.ceil(total / Number(formData.repaymentTerms)) };
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
                                const isPayrollMode = ['Payroll System'].includes(l.disbursalMode) || !l.disbursalMode;
                                let disbursalDate;
                                if (l.status === 'Pending') {
                                    disbursalDate = 'Initial Pending';
                                } else if (isPayrollMode) {
                                    disbursalDate = `For ${new Date(0, l.expectedMonth - 1).toLocaleString('default', { month: 'short' })} ${l.expectedYear}`;
                                } else {
                                    disbursalDate = new Date(Math.max(new Date(l.createdAt), ...l.history.map(h => new Date(h.updatedAt)))).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                                }

                                const disbursalMode = l.status === 'Pending' ? 'Awaiting Approval' : (isPayrollMode ? 'Payroll System' : l.disbursalMode);

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
                                                {l.interestType === 'Flat Interest' && l.interestRate > 0
                                                    ? `(With ${l.interestRate}% Interest)`
                                                    : '(Without Interest)'}
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
                                                if (l.status === 'Pending') { displayText = 'Pending Review'; textColor = '#d97706'; }
                                                else if (['Closed', 'Cancelled', 'Rejected'].includes(l.status)) { displayText = l.status; textColor = '#64748b'; }
                                                else {
                                                    const hasDeductions = l.outstandingAmount < l.totalRepayment;
                                                    if (!hasDeductions) { displayText = 'Not Started'; textColor = '#10b981'; }
                                                    else { displayText = 'In Progress'; textColor = '#3b82f6'; }
                                                }
                                                return <span style={{ color: textColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>{displayText}</span>;
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {l.status === 'Pending' && (
                                                <>
                                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleApprove(l._id)} style={{ color: '#10b981', marginRight: 4 }} title="Approve"><HiOutlineCheckCircle /></button>
                                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={() => updateStatus(l._id, 'Rejected')} style={{ color: '#ef4444' }} title="Reject"><HiOutlineBan /></button>
                                                </>
                                            )}
                                            {['Approved', 'In Progress'].includes(l.status) && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => updateStatus(l._id, 'Cancelled')} style={{ color: '#ef4444', padding: '4px 10px', fontSize: '12px' }}>Cancel</button>
                                            )}
                                            {['Closed', 'Cancelled', 'Rejected'].includes(l.status) && <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>}
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
                                            <option>No Interest</option><option>Flat Interest</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Interest % (if Flat)</label>
                                        <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" disabled={formData.interestType === 'No Interest'} readOnly={formData.interestType === 'No Interest'} value={formData.interestType === 'No Interest' ? '' : formData.interestRate} onChange={e => {
                                            if (formData.interestType === 'No Interest') return;
                                            setFormData({ ...formData, interestRate: e.target.value === '' ? '' : Number(e.target.value) })
                                        }} />
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
                                <div className="form-row">
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
                                    <div className="form-group">
                                        <label className="form-label">Repayment Tenure (Months)</label>
                                        <input type="number" className="form-control" required min="1" max="120" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={formData.repaymentTerms} onChange={e => setFormData({ ...formData, repaymentTerms: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>

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
