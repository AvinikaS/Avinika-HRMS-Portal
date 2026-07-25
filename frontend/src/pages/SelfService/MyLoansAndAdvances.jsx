import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { HiOutlineCash, HiOutlinePlus, HiOutlineX, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

export default function MyLoansAndAdvances() {
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
        repaymentTerms: 12, interestType: 'No Interest', interestRate: 0, reason: ''
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
        if (loanForm.interestType === 'Flat Interest') total += (total * (Number(loanForm.interestRate) / 100));
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
        if (!window.confirm('Are you sure you want to cancel and delete this loan request?')) return;
        try {
            await api.delete(`/loans/${id}`);
            toast.success('Loan request deleted');
            fetchData();
        } catch (err) { toast.error('Failed to delete'); }
    };

    const deleteAdvance = async (id) => {
        if (!window.confirm('Are you sure you want to cancel and delete this advance request?')) return;
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
                interestType: loan.interestType, interestRate: loan.interestRate || 0, reason: loan.reason || ''
            });
        } else {
            setEditLoanId(null);
            setLoanForm({
                loanCategory: 'Personal Loan', otherLoanCategory: '', amount: '',
                expectedMonth: new Date().getMonth() + 1, expectedYear: new Date().getFullYear(),
                emiStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2,
                emiStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(),
                repaymentTerms: 12, interestType: 'No Interest', interestRate: 0, reason: ''
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
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => openAdvanceModal()}><HiOutlinePlus /> Request Advance</button>
                    <button className="btn btn-primary" onClick={() => openLoanModal()}><HiOutlinePlus /> Request Loan</button>
                </div>
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
                                                <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {l.amount.toLocaleString('en-IN')}</div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{l.loanCategory}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ color: '#1e293b', fontWeight: 600 }}>INR {l.outstandingAmount.toLocaleString('en-IN')}</div>
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
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                {l.status === 'Pending' ? (
                                                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                                        <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#3b82f6' }} onClick={() => openLoanModal(l)} title="Edit"><HiOutlinePencil /></button>
                                                        <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => deleteLoan(l._id)} title="Delete"><HiOutlineTrash /></button>
                                                    </div>
                                                ) : <span style={{ color: '#cbd5e1', fontSize: '12px' }}>-</span>}
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
                                                {a.status === 'Pending' ? (
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
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Interest Type</label>
                                        <select className="form-control" value={loanForm.interestType} onChange={e => {
                                            const val = e.target.value;
                                            setLoanForm({ ...loanForm, interestType: val, interestRate: val === 'No Interest' ? 0 : loanForm.interestRate });
                                        }}>
                                            <option>No Interest</option><option>Flat Interest</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Interest % (if Flat)</label>
                                        <input type="number" min="0" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" disabled={loanForm.interestType === 'No Interest'} readOnly={loanForm.interestType === 'No Interest'} value={loanForm.interestType === 'No Interest' ? '' : loanForm.interestRate} onChange={e => {
                                            if (loanForm.interestType === 'No Interest') return;
                                            setLoanForm({ ...loanForm, interestRate: e.target.value === '' ? '' : Number(e.target.value) })
                                        }} />
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
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Expected Payroll Month</label>
                                        <input type="month" className="form-control" required value={`${loanForm.expectedYear}-${String(loanForm.expectedMonth).padStart(2, '0')}`} onChange={e => {
                                            if (e.target.value) {
                                                const [y, m] = e.target.value.split('-');
                                                setLoanForm({ ...loanForm, expectedYear: Number(y), expectedMonth: Number(m) });
                                            }
                                        }} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Repayment Tenure (Months)</label>
                                        <input type="number" className="form-control" required min="1" max="120" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} value={loanForm.repaymentTerms} onChange={e => setLoanForm({ ...loanForm, repaymentTerms: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
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
