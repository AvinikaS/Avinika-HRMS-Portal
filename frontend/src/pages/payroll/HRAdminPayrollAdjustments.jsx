import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import {
    HiOutlineCurrencyDollar, HiOutlinePlus, HiOutlineFilter,
    HiOutlineCheckCircle, HiOutlineXCircle, HiOutlineRefresh
} from 'react-icons/hi';

export default function HRAdminPayrollAdjustments() {
    const [adjustments, setAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Modal state for manual adjustment
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [creating, setCreating] = useState(false);

    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [form, setForm] = useState({
        employeeId: '',
        adjustmentType: 'ATTENDANCE_ARREAR',
        direction: 'CREDIT',
        amount: '',
        originalPayrollMonth: currentMonthStr,
        adjustmentPayrollMonth: currentMonthStr,
        reason: '',
        comment: '',
        payslipLabel: ''
    });

    const fetchAdjustments = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hradmin/payroll-adjustments', {
                params: { page, limit: 15, status: statusFilter, adjustmentType: typeFilter }
            });
            if (res.data.success) {
                setAdjustments(res.data.data);
                setTotalPages(res.data.pages || 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to fetch adjustments');
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees?limit=200');
            if (res.data.success) {
                setEmployees(res.data.data || res.data.employees || []);
            }
        } catch (err) {
            console.error('Failed to load employee list', err);
        }
    };

    useEffect(() => {
        fetchAdjustments();
    }, [page, statusFilter, typeFilter]);

    useEffect(() => {
        if (showCreateModal && employees.length === 0) {
            fetchEmployees();
        }
    }, [showCreateModal]);

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!form.employeeId || !form.amount || !form.reason || !form.originalPayrollMonth || !form.adjustmentPayrollMonth) {
            return toast.error('Please fill in all required fields');
        }

        setCreating(true);
        try {
            const res = await api.post('/hradmin/payroll-adjustments/manual', form);
            if (res.data.success) {
                toast.success(res.data.message);
                setShowCreateModal(false);
                setForm({
                    employeeId: '',
                    adjustmentType: 'ATTENDANCE_ARREAR',
                    direction: 'CREDIT',
                    amount: '',
                    originalPayrollMonth: currentMonthStr,
                    adjustmentPayrollMonth: currentMonthStr,
                    reason: '',
                    comment: '',
                    payslipLabel: ''
                });
                fetchAdjustments();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create adjustment');
        } finally {
            setCreating(false);
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await api.post(`/hradmin/payroll-adjustments/${id}/approve`);
            if (res.data.success) {
                toast.success(res.data.message);
                fetchAdjustments();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Approval failed');
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            const res = await api.post(`/hradmin/payroll-adjustments/${id}/reject`, { reason });
            if (res.data.success) {
                toast.success('Adjustment rejected');
                fetchAdjustments();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rejection failed');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_HR_APPROVAL':
                return <span className="badge" style={{ background: '#2563eb', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Pending HR</span>;
            case 'PENDING_SUPERADMIN_APPROVAL':
                return <span className="badge" style={{ background: '#7c3aed', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Pending SuperAdmin (&gt;₹5k)</span>;
            case 'APPROVED':
                return <span className="badge" style={{ background: '#16a34a', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Approved</span>;
            case 'APPLIED':
                return <span className="badge" style={{ background: '#0d9488', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Applied to Payroll</span>;
            case 'REJECTED':
                return <span className="badge" style={{ background: '#dc2626', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Rejected</span>;
            default:
                return <span className="badge">{status}</span>;
        }
    };

    return (
        <div className="page-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                        Payroll Adjustments & Arrears
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
                        Manage attendance arrears, salary adjustments, and overpayment recoveries across payroll months
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#3b82f6', color: '#fff', padding: '10px 18px', borderRadius: '8px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                >
                    <HiOutlinePlus size={18} /> New Manual Adjustment
                </button>
            </div>

            {/* Filters */}
            <div className="card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px', marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '180px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Status</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                        <option value="">All Statuses</option>
                        <option value="PENDING_HR_APPROVAL">Pending HR Approval</option>
                        <option value="PENDING_SUPERADMIN_APPROVAL">Pending SuperAdmin Approval</option>
                        <option value="APPROVED">Approved</option>
                        <option value="APPLIED">Applied</option>
                        <option value="REJECTED">Rejected</option>
                    </select>
                </div>

                <div style={{ minWidth: '180px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>Adjustment Type</label>
                    <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                        <option value="">All Types</option>
                        <option value="ATTENDANCE_ARREAR">Attendance Arrear</option>
                        <option value="SALARY_ARREAR">Salary Arrear</option>
                        <option value="OVERPAYMENT_RECOVERY">Overpayment Recovery</option>
                        <option value="PAYROLL_CORRECTION">Payroll Correction</option>
                        <option value="LEAVE_ADJUSTMENT">Leave Adjustment</option>
                        <option value="BONUS_ADJUSTMENT">Bonus Adjustment</option>
                    </select>
                </div>

                <div style={{ marginLeft: 'auto', marginTop: '16px' }}>
                    <button onClick={fetchAdjustments} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>
                        <HiOutlineRefresh size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading adjustments...</div>
                ) : adjustments.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No adjustments found.</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                                    <th style={{ padding: '12px 16px' }}>Adj No</th>
                                    <th style={{ padding: '12px 16px' }}>Employee</th>
                                    <th style={{ padding: '12px 16px' }}>Type</th>
                                    <th style={{ padding: '12px 16px' }}>Direction</th>
                                    <th style={{ padding: '12px 16px' }}>Amount</th>
                                    <th style={{ padding: '12px 16px' }}>Affected Month</th>
                                    <th style={{ padding: '12px 16px' }}>Apply Month</th>
                                    <th style={{ padding: '12px 16px' }}>Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {adjustments.map(adj => (
                                    <tr key={adj._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#3b82f6' }}>{adj.adjustmentNumber}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{adj.employeeId?.firstName} {adj.employeeId?.lastName}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{adj.employeeId?.employeeCode}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#475569' }}>{adj.adjustmentType?.replace(/_/g, ' ')}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ fontWeight: '700', color: adj.direction === 'CREDIT' ? '#16a34a' : '#dc2626' }}>
                                                {adj.direction}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#1e293b' }}>₹{Number(adj.amount).toLocaleString('en-IN')}</td>
                                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{adj.originalPayrollMonth}</td>
                                        <td style={{ padding: '12px 16px', color: '#64748b' }}>{adj.adjustmentPayrollMonth}</td>
                                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(adj.status)}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            {adj.status === 'PENDING_HR_APPROVAL' && (
                                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => handleApprove(adj._id)} className="btn btn-sm btn-success" style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px' }}>
                                                        Approve
                                                    </button>
                                                    <button onClick={() => handleReject(adj._id)} className="btn btn-sm btn-danger" style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px' }}>
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create Manual Adjustment Modal */}
            {showCreateModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '550px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>Create Manual Payroll Adjustment</h3>

                        <form onSubmit={handleCreateSubmit}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Select Employee *</label>
                                <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                                    <option value="">-- Choose Employee --</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.employeeCode}) - {emp.department}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Adjustment Type *</label>
                                    <select value={form.adjustmentType} onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                                        <option value="ATTENDANCE_ARREAR">Attendance Arrear</option>
                                        <option value="SALARY_ARREAR">Salary Arrear</option>
                                        <option value="OVERPAYMENT_RECOVERY">Overpayment Recovery</option>
                                        <option value="PAYROLL_CORRECTION">Payroll Correction</option>
                                        <option value="LEAVE_ADJUSTMENT">Leave Adjustment</option>
                                        <option value="BONUS_ADJUSTMENT">Bonus Adjustment</option>
                                        <option value="OTHER_ADJUSTMENT">Other Adjustment</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Direction *</label>
                                    <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}>
                                        <option value="CREDIT">CREDIT (Add to salary)</option>
                                        <option value="DEBIT">DEBIT (Deduct/Recover)</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Amount (₹) *</label>
                                <input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 2500" required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                                {Number(form.amount) > 5000 && (
                                    <p style={{ fontSize: '11px', color: '#7c3aed', margin: '4px 0 0 0', fontWeight: '600' }}>
                                        ℹ️ Note: Amounts &gt; ₹5,000 require final approval from Super Admin.
                                    </p>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Original Month (YYYY-MM) *</label>
                                    <input type="text" placeholder="2026-09" value={form.originalPayrollMonth} onChange={(e) => setForm({ ...form, originalPayrollMonth: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Adjustment Apply Month (YYYY-MM) *</label>
                                    <input type="text" placeholder="2026-10" value={form.adjustmentPayrollMonth} onChange={(e) => setForm({ ...form, adjustmentPayrollMonth: e.target.value })} required style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                                </div>
                            </div>

                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Reason *</label>
                                <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Approved leave balance correction arrear" required style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Payslip Display Label (Optional)</label>
                                <input type="text" value={form.payslipLabel} onChange={(e) => setForm({ ...form, payslipLabel: e.target.value })} placeholder="e.g. Attendance Arrear – September 2026" style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }} />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-outline" style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Cancel</button>
                                <button type="submit" disabled={creating} className="btn btn-primary" style={{ padding: '8px 18px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                    {creating ? 'Submitting...' : 'Submit for Approval'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
