import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineCurrencyRupee, HiOutlineClipboardList, HiOutlineCheckCircle,
    HiOutlineXCircle, HiOutlineClock, HiOutlinePlus, HiOutlineRefresh,
    HiOutlineCash, HiOutlineChartBar, HiOutlineExclamationCircle
} from 'react-icons/hi';

const STATUS_LABELS = {
    DRAFT: { label: 'Draft', badge: 'badge-neutral' },
    SUBMITTED: { label: 'Submitted', badge: 'badge-info' },
    HR_APPROVED: { label: 'HR Approved', badge: 'badge-primary' },
    SUPER_ADMIN_APPROVED: { label: 'Approved', badge: 'badge-primary' },
    CORRECTION_REQUIRED: { label: 'Correction Required', badge: 'badge-warning' },
    REJECTED: { label: 'Rejected', badge: 'badge-danger' },
    PAYMENT_PENDING: { label: 'Payment Pending', badge: 'badge-warning' },
    PAID: { label: 'Paid', badge: 'badge-success' },
    CANCELLED: { label: 'Cancelled', badge: 'badge-neutral' }
};

const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '—';
    return `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function ExpenseDashboard() {
    const { isExEmployee } = useAuth();
    const navigate = useNavigate();
    const [summary, setSummary] = useState({
        total: 0, draft: 0, submitted: 0, hrApproved: 0, superAdminApproved: 0,
        correctionRequired: 0, rejected: 0, paymentPending: 0, paid: 0, cancelled: 0,
        totalAmountClaimed: 0, totalAmountApproved: 0, totalAmountPaid: 0
    });
    const [recentClaims, setRecentClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [noProfile, setNoProfile] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        setNoProfile(false);
        try {
            const [summRes, claimsRes] = await Promise.all([
                api.get('/expenses/my/summary'),
                api.get('/expenses/my?limit=5&page=1')
            ]);
            if (summRes.data.success) setSummary(summRes.data.data);
            if (claimsRes.data.success) setRecentClaims(claimsRes.data.data);
        } catch (err) {
            if (err.response?.status === 400 && err.response?.data?.message?.includes('Employee profile not found')) {
                setNoProfile(true);
            }
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    const statCards = [
        { label: 'Total Claims', value: summary.total, icon: HiOutlineClipboardList, color: 'purple' },
        { label: 'Pending Review', value: summary.submitted + summary.hrApproved, icon: HiOutlineClock, color: 'blue' },
        { label: 'Approved', value: summary.superAdminApproved + summary.paymentPending, icon: HiOutlineCheckCircle, color: 'green' },
        { label: 'Paid', value: summary.paid, icon: HiOutlineCash, color: 'cyan' },
        { label: 'Correction Needed', value: summary.correctionRequired, icon: HiOutlineExclamationCircle, color: 'orange' },
        { label: 'Rejected', value: summary.rejected, icon: HiOutlineXCircle, color: 'red' },
    ];

    const amountCards = [
        { label: 'Total Claimed', value: formatCurrency(summary.totalAmountClaimed), icon: HiOutlineChartBar, color: 'purple' },
        { label: 'Total Approved', value: formatCurrency(summary.totalAmountApproved), icon: HiOutlineCheckCircle, color: 'green' },
        { label: 'Total Paid', value: formatCurrency(summary.totalAmountPaid), icon: HiOutlineCurrencyRupee, color: 'cyan' },
    ];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Expense & Reimbursement</h1>
                    <p>Submit and track your expense claims</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchData}><HiOutlineRefresh /></button>
                    {!isExEmployee && (
                        <button className="btn btn-primary" onClick={() => navigate('/expenses/create')} disabled={noProfile} style={noProfile ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                            <HiOutlinePlus /> New Expense Claim
                        </button>
                    )}
                </div>
            </div>

            {/* Status Summary Cards */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 20 }}>
                {statCards.map(s => (
                    <div key={s.label} className={`stat-card ${s.color}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/expenses/my')}>
                        <div className={`stat-icon ${s.color}`}><s.icon /></div>
                        <div className="stat-content">
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-value">{loading ? '...' : s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Amount Summary Cards */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 28 }}>
                {amountCards.map(s => (
                    <div key={s.label} className={`stat-card ${s.color}`}>
                        <div className={`stat-icon ${s.color}`}><s.icon /></div>
                        <div className="stat-content">
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-value" style={{ fontSize: 20 }}>{loading ? '...' : s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Claims */}
            <div className="card" style={{ padding: 0 }}>
                <div className="table-header" style={{ padding: '16px 20px' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>Recent Claims</h3>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/expenses/my')}>View All</button>
                </div>

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 12px' }} /> Loading...
                    </div>
                ) : noProfile ? (
                    <div className="empty-state" style={{ padding: 48, background: 'var(--bg-warning-light)', border: '1px solid var(--warning)', borderRadius: 8, margin: 16 }}>
                        <div className="empty-icon" style={{ color: 'var(--warning)' }}>⚠️</div>
                        <h3 style={{ color: 'var(--warning-dark)' }}>No Employee Profile Found</h3>
                        <p style={{ color: 'var(--warning-dark)' }}>Your user account is not linked to an Employee profile. You cannot submit expense claims.</p>
                    </div>
                ) : recentClaims.length === 0 ? (
                    <div className="empty-state" style={{ padding: 48 }}>
                        <div className="empty-icon">💸</div>
                        <h3>No expense claims yet</h3>
                        <p>{isExEmployee ? 'No expense claims recorded.' : "You haven't submitted any expense claims yet."}</p>
                        {!isExEmployee && (
                            <button className="btn btn-primary" onClick={() => navigate('/expenses/create')} style={{ marginTop: 16 }}>
                                <HiOutlinePlus /> Raise New Expense Claim
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Claim No.</th>
                                    <th>Date</th>
                                    <th>Category</th>
                                    <th>Amount</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentClaims.map(c => (
                                    <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/expenses/${c._id}`)}>
                                        <td><strong style={{ color: 'var(--primary)', fontSize: 13 }}>{c.claimNumber}</strong></td>
                                        <td>{formatDate(c.expenseDate)}</td>
                                        <td>
                                            {c.categoryId?.name || '—'}
                                            {c.categoryId?.name === 'Other' && c.customCategoryName && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.customCategoryName})</div>
                                            )}
                                        </td>
                                        <td><strong>{formatCurrency(c.amountClaimed)}</strong></td>
                                        <td>
                                            <span className={`badge ${STATUS_LABELS[c.status]?.badge || 'badge-neutral'}`}>
                                                {STATUS_LABELS[c.status]?.label || c.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
