import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import {
    HiOutlineCurrencyRupee, HiOutlineClipboardList, HiOutlineCheckCircle,
    HiOutlineXCircle, HiOutlineClock, HiOutlineRefresh, HiOutlineExclamationCircle, HiOutlineCash
} from 'react-icons/hi';

const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_LABELS = {
    DRAFT: { label: 'Draft', badge: 'badge-neutral' },
    SUBMITTED: { label: 'Submitted', badge: 'badge-info' },
    HR_APPROVED: { label: 'HR Approved', badge: 'badge-primary' },
    SUPER_ADMIN_APPROVED: { label: 'Fully Approved', badge: 'badge-primary' },
    CORRECTION_REQUIRED: { label: 'Correction Required', badge: 'badge-warning' },
    REJECTED: { label: 'Rejected', badge: 'badge-danger' },
    PAYMENT_PENDING: { label: 'Payment Pending', badge: 'badge-warning' },
    PAID: { label: 'Paid', badge: 'badge-success' },
    CANCELLED: { label: 'Cancelled', badge: 'badge-neutral' }
};

export default function SuperAdminExpenseDashboard() {
    const navigate = useNavigate();
    const [dashData, setDashData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDash = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/expenses/superadmin/dashboard');
            if (data.success) setDashData(data.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchDash(); }, []);

    const statCards = dashData ? [
        { label: 'Total Claims', value: dashData.total, icon: HiOutlineClipboardList, color: 'purple', path: '/superadmin/expenses/all' },
        { label: 'Pending HR Review', value: dashData.SUBMITTED, icon: HiOutlineClock, color: 'blue', path: '/admin/expenses/pending' },
        { label: 'Pending My Review', value: dashData.HR_APPROVED, icon: HiOutlineExclamationCircle, color: 'orange', path: '/superadmin/expenses/pending' },
        { label: 'Correction Required', value: dashData.CORRECTION_REQUIRED, icon: HiOutlineExclamationCircle, color: 'amber' },
        { label: 'Payment Pending', value: dashData.PAYMENT_PENDING, icon: HiOutlineClock, color: 'orange', path: '/superadmin/expenses/all?status=PAYMENT_PENDING' },
        { label: 'Paid', value: dashData.PAID, icon: HiOutlineCheckCircle, color: 'green', path: '/superadmin/expenses/all?status=PAID' },
        { label: 'Rejected', value: dashData.REJECTED, icon: HiOutlineXCircle, color: 'red' },
        { label: 'Cancelled', value: dashData.CANCELLED, icon: HiOutlineXCircle, color: 'gray' },
    ] : [];

    const amountCards = dashData ? [
        { label: 'Total Claimed', value: formatCurrency(dashData.totalAmountClaimed), icon: HiOutlineCash, color: 'purple' },
        { label: 'Total Approved', value: formatCurrency(dashData.totalAmountApproved), icon: HiOutlineCheckCircle, color: 'green' },
        { label: 'Total Paid', value: formatCurrency(dashData.totalAmountPaid), icon: HiOutlineCurrencyRupee, color: 'cyan' },
        { label: 'Pending Reimbursement', value: formatCurrency(dashData.pendingReimbursementAmount), icon: HiOutlineClock, color: 'orange' },
    ] : [];

    return (
        <div className="animate-fadeIn">
            <style>
                {`
                    .sa-stat-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 16px;
                        margin-bottom: 24px;
                    }
                    .sa-stat-grid-amount {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 16px;
                        margin-bottom: 28px;
                    }
                    .sa-bottom-grid {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 20px;
                    }
                    @media (max-width: 1024px) {
                        .sa-stat-grid, .sa-stat-grid-amount { grid-template-columns: repeat(3, 1fr); }
                    }
                    @media (max-width: 768px) {
                        .sa-stat-grid, .sa-stat-grid-amount { grid-template-columns: repeat(2, 1fr); }
                        .sa-bottom-grid { grid-template-columns: 1fr; }
                    }
                    @media (max-width: 480px) {
                        .sa-stat-grid { grid-template-columns: repeat(2, 1fr); }
                        .sa-stat-grid-amount { grid-template-columns: 1fr; } /* 1 per row on mobile to fit long text */
                        .sa-bottom-grid { grid-template-columns: 1fr; }
                    }
                `}
            </style>
            <div className="page-header">
                <div>
                    <h1>Expense Management Dashboard</h1>
                    <p>Overview of all expense claims across the organization</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchDash}><HiOutlineRefresh /></button>
                    <button className="btn btn-primary" onClick={() => navigate('/superadmin/expenses/all')}>All Expenses</button>
                </div>
            </div>

            {/* Status Cards */}
            <div className="sa-stat-grid">
                {loading ? Array(8).fill(0).map((_, i) => (
                    <div key={i} className="stat-card" style={{ opacity: 0.4 }}>
                        <div className="stat-content"><div className="stat-label">Loading...</div><div className="stat-value">—</div></div>
                    </div>
                )) : statCards.map(s => (
                    <div key={s.label} className={`stat-card ${s.color}`} style={{ cursor: s.path ? 'pointer' : 'default' }}
                        onClick={() => s.path && navigate(s.path)}>
                        <div className={`stat-icon ${s.color}`}><s.icon /></div>
                        <div className="stat-content">
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-value">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Amount Cards */}
            <div className="sa-stat-grid-amount">
                {loading ? Array(4).fill(0).map((_, i) => (
                    <div key={i} className="stat-card" style={{ opacity: 0.4 }}>
                        <div className="stat-content"><div className="stat-label">Loading...</div><div className="stat-value">—</div></div>
                    </div>
                )) : amountCards.map(s => (
                    <div key={s.label} className={`stat-card ${s.color}`}>
                        <div className={`stat-icon ${s.color}`}><s.icon /></div>
                        <div className="stat-content">
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-value" style={{ fontSize: 18 }}>{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="sa-bottom-grid">
                {/* Pending Approvals */}
                <div className="card" style={{ padding: 0, minWidth: 0 }}>
                    <div className="table-header" style={{ padding: '16px 20px' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>⏳ Pending My Approval ({dashData?.HR_APPROVED || 0})</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/superadmin/expenses/pending')}>View All</button>
                    </div>
                    {loading ? (
                        <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : (dashData?.pendingApprovals?.length === 0) ? (
                        <div className="empty-state" style={{ padding: 32 }}><p style={{ margin: 0 }}>No claims pending your approval. 🎉</p></div>
                    ) : (
                        <div>
                            <table>
                                <thead>
                                    <tr><th>Claim</th><th>Employee</th><th>Amount</th><th>Date</th></tr>
                                </thead>
                                <tbody>
                                    {dashData?.pendingApprovals?.map(c => (
                                        <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/superadmin/expenses/${c._id}`)}>
                                            <td><strong style={{ fontSize: 12, color: 'var(--primary)' }}>{c.claimNumber}</strong></td>
                                            <td>
                                                <div style={{ fontSize: 13 }}>{c.employeeId?.firstName} {c.employeeId?.lastName}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.employeeId?.department}</div>
                                            </td>
                                            <td><strong>{formatCurrency(c.amountClaimed)}</strong></td>
                                            <td>{formatDate(c.expenseDate)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* By Category */}
                <div className="card" style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>📊 Claims by Category</h3>
                    {loading ? (
                        <div style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                    ) : (dashData?.byCategory?.length === 0) ? (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No data yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {dashData?.byCategory?.slice(0, 8).map(cat => (
                                <div key={cat._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.category}</span>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(cat.amount)}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{cat.count} claim{cat.count !== 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Claims */}
                <div className="card" style={{ padding: 0, gridColumn: '1 / -1', minWidth: 0 }}>
                    <div className="table-header" style={{ padding: '16px 20px' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Claims</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/superadmin/expenses/all')}>View All</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr><th>Claim</th><th>Employee</th><th>Category</th><th>Amount</th><th>Status</th><th>Date</th></tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>Loading...</td></tr>
                                ) : dashData?.recentClaims?.map(c => (
                                    <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/superadmin/expenses/${c._id}`)}>
                                        <td><strong style={{ fontSize: 12, color: 'var(--primary)' }}>{c.claimNumber}</strong></td>
                                        <td>
                                            <div style={{ fontSize: 13 }}>{c.employeeId?.firstName} {c.employeeId?.lastName}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.employeeId?.employeeCode}</div>
                                        </td>
                                        <td>{c.categoryId?.name}</td>
                                        <td><strong>{formatCurrency(c.amountClaimed)}</strong></td>
                                        <td><span className={`badge ${STATUS_LABELS[c.status]?.badge || 'badge-neutral'}`}>{STATUS_LABELS[c.status]?.label || c.status}</span></td>
                                        <td>{formatDate(c.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
