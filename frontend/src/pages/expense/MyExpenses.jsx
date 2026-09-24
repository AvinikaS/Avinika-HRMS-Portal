import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { HiOutlinePlus, HiOutlineRefresh, HiOutlineSearch } from 'react-icons/hi';

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
    return `₹${Number(amount).toLocaleString('en-IN')}`;
};

const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function MyExpenses() {
    const navigate = useNavigate();
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [noProfile, setNoProfile] = useState(false);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const LIMIT = 10;

    const fetchClaims = async () => {
        setLoading(true);
        setNoProfile(false);
        try {
            const params = new URLSearchParams({ page, limit: LIMIT });

            let finalStatus = statusFilter;
            if (!finalStatus) {
                if (activeTab === 'CLOSED') finalStatus = 'PAID,CANCELLED,REJECTED';
                else if (activeTab === 'ACTIVE') finalStatus = 'DRAFT,SUBMITTED,HR_APPROVED,SUPER_ADMIN_APPROVED,CORRECTION_REQUIRED,PAYMENT_PENDING';
            }
            if (finalStatus) params.set('status', finalStatus);
            if (search) params.set('search', search);
            if (categoryFilter) params.set('categoryId', categoryFilter);

            const { data } = await api.get(`/expenses/my?${params}`);
            if (data.success) { setClaims(data.data); setTotal(data.total); }
        } catch (err) {
            if (err.response?.status === 400 && err.response?.data?.message?.includes('Employee profile not found')) {
                setNoProfile(true);
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        api.get('/expenses/categories').then(({ data }) => { if (data.success) setCategories(data.data); }).catch(() => { });
    }, []);

    useEffect(() => { fetchClaims(); }, [page, activeTab, statusFilter, search, categoryFilter]);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>My Expense Claims</h1>
                    <p>Track your expense submissions and reimbursements</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchClaims}><HiOutlineRefresh /></button>
                    <button className="btn btn-primary" onClick={() => navigate('/expenses/create')} disabled={noProfile} style={noProfile ? { opacity: 0.5, cursor: 'not-allowed' } : {}}>
                        <HiOutlinePlus /> New Claim
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 0 200px' }}>
                        <HiOutlineSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            className="form-control"
                            placeholder="Search by claim # or description..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            style={{ paddingLeft: 32 }}
                        />
                    </div>
                    <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                        <option value="">All Status</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select className="form-control" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setStatusFilter(''); setCategoryFilter(''); setSearch(''); setPage(1); }}>
                        Clear
                    </button>
                </div>
            </div>

            {/* Tabs + Table */}
            <div className="card" style={{ padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0 16px' }}>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'ACTIVE' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'ACTIVE' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('ACTIVE'); setStatusFilter(''); setPage(1); }}
                    >
                        Active Claims
                    </button>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'CLOSED' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'CLOSED' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('CLOSED'); setStatusFilter(''); setPage(1); }}
                    >
                        Paid / Rejected / Cancelled
                    </button>
                </div>

                <div className="table-header" style={{ padding: '16px 20px', borderBottom: 'none' }}>
                    <h3 style={{ fontSize: 14 }}>
                        {loading ? 'Loading...' : `${total} claim${total !== 1 ? 's' : ''} found`}
                    </h3>
                </div>

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading claims...
                    </div>
                ) : noProfile ? (
                    <div className="empty-state" style={{ padding: 48, background: 'var(--bg-warning-light)', border: '1px solid var(--warning)', borderRadius: 8, margin: 16 }}>
                        <div className="empty-icon" style={{ color: 'var(--warning)' }}>⚠️</div>
                        <h3 style={{ color: 'var(--warning-dark)' }}>No Employee Profile Found</h3>
                        <p style={{ color: 'var(--warning-dark)' }}>Your user account is not linked to an Employee profile. You cannot submit expense claims.</p>
                    </div>
                ) : claims.length === 0 ? (
                    <div className="empty-state" style={{ padding: 48 }}>
                        <div className="empty-icon">💸</div>
                        <h3>No claims found</h3>
                        <p>Try adjusting your filters or raise a new claim.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Claim No.</th>
                                    <th>Expense Date</th>
                                    <th>Category</th>
                                    <th>Claimed</th>
                                    <th>Approved</th>
                                    <th>Status</th>
                                    <th>Submitted</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {claims.map(c => (
                                    <tr key={c._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/expenses/${c._id}`)}>
                                        <td><strong style={{ color: 'var(--primary)', fontSize: 13 }}>{c.claimNumber}</strong></td>
                                        <td>{formatDate(c.expenseDate)}{c.expenseEndDate ? ' to ' + formatDate(c.expenseEndDate) : ''}</td>
                                        <td>
                                            {c.categoryId?.name || '—'}
                                            {c.categoryId?.name === 'Other' && c.customCategoryName && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.customCategoryName})</div>
                                            )}
                                        </td>
                                        <td><strong>{formatCurrency(c.amountClaimed)}</strong></td>
                                        <td style={{ color: c.amountApproved != null ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                            {c.amountApproved != null ? formatCurrency(c.amountApproved) : '—'}
                                        </td>
                                        <td>
                                            <span className={`badge ${STATUS_LABELS[c.status]?.badge || 'badge-neutral'}`}>
                                                {STATUS_LABELS[c.status]?.label || c.status}
                                            </span>
                                        </td>
                                        <td>{formatDate(c.submittedAt)}</td>
                                        <td>{formatDate(c.updatedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 20px' }}>
                        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
