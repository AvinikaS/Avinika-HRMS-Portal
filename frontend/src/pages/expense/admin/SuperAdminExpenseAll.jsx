import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../../utils/api';
import { HiOutlineSearch, HiOutlineRefresh, HiOutlineDocumentText } from 'react-icons/hi';

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

const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SuperAdminExpenseAll() {
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);

    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [categories, setCategories] = useState([]);
    const [activeTab, setActiveTab] = useState(location.pathname.includes('pending') ? 'PENDING_SA' : 'ALL');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [years, setYears] = useState([]);
    const LIMIT = 10;

    const fetchClaims = async () => {
        setLoading(true);
        try {
            let url, params;
            if (activeTab === 'PENDING_SA') {
                params = new URLSearchParams({ page, limit: LIMIT });
                if (search) params.set('search', search);
                if (categoryFilter) params.set('categoryId', categoryFilter);
                url = `/expenses/superadmin/pending?${params}`;
            } else {
                params = new URLSearchParams({ page, limit: LIMIT });
                if (search) params.set('search', search);
                if (statusFilter) params.set('status', statusFilter);
                if (categoryFilter) params.set('categoryId', categoryFilter);
                url = `/expenses/superadmin/all?${params}`;
            }

            if (year || month) {
                let y = year || new Date().getFullYear();
                if (month) {
                    params.set('dateFrom', `${y}-${month.toString().padStart(2, '0')}-01`);
                    const lastDay = new Date(y, month, 0).getDate();
                    params.set('dateTo', `${y}-${month.toString().padStart(2, '0')}-${lastDay}`);
                } else {
                    params.set('dateFrom', `${y}-01-01`);
                    params.set('dateTo', `${y}-12-31`);
                }
            }

            const { data } = await api.get(url);
            if (data.success) { setClaims(data.data); setTotal(data.total); }
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        api.get('/expenses/categories').then(({ data }) => { if (data.success) setCategories(data.data); }).catch(() => { });
        api.get('/payroll-years').then(({ data }) => { if (data.success) setYears(data.data || []); }).catch(() => { });
    }, []);

    useEffect(() => {
        if (location.pathname.includes('pending')) {
            setActiveTab('PENDING_SA');
        } else {
            setActiveTab('ALL');
        }
    }, [location.pathname]);

    useEffect(() => { fetchClaims(); }, [page, search, statusFilter, categoryFilter, activeTab, month, year]);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>{activeTab === 'PENDING_SA' ? 'Pending My Approval' : 'All Expense Claims'}</h1>
                    <p>{activeTab === 'PENDING_SA' ? 'Review claims that are waiting for your final approval' : 'View and manage all expense claims across the organization'}</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchClaims}><HiOutlineRefresh /></button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 0 200px' }}>
                        <HiOutlineSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input className="form-control" placeholder="Search employee, claim #, description..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 32 }} />
                    </div>
                    {activeTab === 'PENDING_SA' ? (
                        <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                            <option value="">All Status</option>
                            <option value="PENDING">HR Approved</option>
                            <option value="CORRECTION_REQUIRED">Correction Required</option>
                        </select>
                    ) : (
                        <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                            <option value="">All Status</option>
                            <option value="SUPER_ADMIN_APPROVED">Fully Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="PAYMENT_PENDING">Payment Pending</option>
                            <option value="PAID">Paid</option>
                        </select>
                    )}
                    <select className="form-control" value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <select className="form-control" value={month} onChange={e => { setMonth(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                        <option value="">All Months</option>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="form-control" value={year} onChange={e => { setYear(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                        <option value="">All Years</option>
                        {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                        {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                    </select>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); setMonth(''); setYear(''); setPage(1); }}>Clear</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="card" style={{ padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0 16px' }}>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'PENDING_SA' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'PENDING_SA' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { navigate('/superadmin/expenses/pending'); setStatusFilter(''); setPage(1); }}
                    >
                        Pending My Approval
                    </button>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'ALL' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'ALL' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { navigate('/superadmin/expenses/all'); setStatusFilter(''); setPage(1); }}
                    >
                        All Expenses
                    </button>
                </div>

                <div className="table-header" style={{ padding: '16px 20px', borderBottom: 'none' }}>
                    <h3 style={{ fontSize: 14 }}>{loading ? 'Loading...' : `${total} claim${total !== 1 ? 's' : ''} found`}</h3>
                </div>

                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading...</div>
                ) : claims.length === 0 ? (
                    <div className="empty-state" style={{ padding: 48 }}>
                        <div className="empty-icon">💸</div>
                        <h3>No claims found</h3>
                        <p>Try adjusting your filters.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Claim No.</th>
                                    <th>Employee</th>
                                    <th>Category</th>
                                    <th>Claimed</th>
                                    <th>Approved</th>
                                    <th>Expense Date</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {claims.map(c => (
                                    <tr key={c._id}>
                                        <td><strong style={{ color: 'var(--primary)', fontSize: 13 }}>{c.claimNumber}</strong></td>
                                        <td>
                                            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.employeeId?.firstName} {c.employeeId?.lastName}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{c.employeeId?.employeeCode} · {c.employeeId?.department}</div>
                                        </td>
                                        <td>
                                            {c.categoryId?.name}
                                            {c.categoryId?.name === 'Other' && c.customCategoryName && (
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>({c.customCategoryName})</div>
                                            )}
                                        </td>
                                        <td><strong>{formatCurrency(c.amountClaimed)}</strong></td>
                                        <td style={{ color: c.amountApproved != null ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                            {c.amountApproved != null ? formatCurrency(c.amountApproved) : '—'}
                                        </td>
                                        <td>{formatDate(c.expenseDate)}{c.expenseEndDate ? ' to ' + formatDate(c.expenseEndDate) : ''}</td>
                                        <td><span className={`badge ${STATUS_LABELS[c.status]?.badge || 'badge-neutral'}`}>{STATUS_LABELS[c.status]?.label || c.status}</span></td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/superadmin/expenses/${c._id}`)}>
                                                <HiOutlineDocumentText style={{ marginRight: 4 }} /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 20px' }}>
                        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                        <span style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>Page {page} of {totalPages}</span>
                        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
