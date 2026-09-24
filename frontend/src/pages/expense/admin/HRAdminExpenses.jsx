import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../utils/api';
import { HiOutlineSearch, HiOutlineRefresh, HiOutlineDocumentText } from 'react-icons/hi';

const STATUS_LABELS = {
    SUBMITTED: { label: 'Submitted', badge: 'badge-info' },
    HR_APPROVED: { label: 'HR Approved', badge: 'badge-primary' },
    SUPER_ADMIN_APPROVED: { label: 'Fully Approved', badge: 'badge-primary' },
    CORRECTION_REQUIRED: { label: 'Correction Required', badge: 'badge-warning' },
    REJECTED: { label: 'Rejected', badge: 'badge-danger' },
    PAYMENT_PENDING: { label: 'Payment Pending', badge: 'badge-warning' },
    PAID: { label: 'Paid', badge: 'badge-success' }
};

const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function HRAdminExpenses() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('PENDING');
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [categories, setCategories] = useState([]);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [years, setYears] = useState([]);
    const LIMIT = 10;

    const fetchClaims = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: LIMIT });
            if (search) params.set('search', search);
            if (categoryFilter) params.set('categoryId', categoryFilter);
            if (activeTab === 'HISTORY' && statusFilter) params.set('status', statusFilter);
            if (activeTab === 'PENDING' && statusFilter) params.set('status', statusFilter);

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

            const url = activeTab === 'PENDING'
                ? `/expenses/hradmin/pending?${params}`
                : `/expenses/hradmin/history?${params}`;

            const { data } = await api.get(url);
            if (data.success) { setClaims(data.data); setTotal(data.total); }
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        api.get('/expenses/categories').then(({ data }) => { if (data.success) setCategories(data.data); }).catch(() => { });
        api.get('/payroll-years').then(({ data }) => { if (data.success) setYears(data.data || []); }).catch(() => { });
    }, []);

    useEffect(() => { fetchClaims(); }, [activeTab, page, search, categoryFilter, statusFilter, month, year]);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Expense Approvals</h1>
                    <p>Review and process employee expense reimbursement requests</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchClaims}><HiOutlineRefresh /></button>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 0 200px' }}>
                        <HiOutlineSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input className="form-control" placeholder="Search by employee or claim #..." value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }} style={{ paddingLeft: 32 }} />
                    </div>
                    {activeTab === 'PENDING' && (
                        <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                            <option value="">All Status</option>
                            <option value="PENDING">Pending Approvals</option>
                            <option value="CORRECTION_REQUIRED">Correction Required</option>
                        </select>
                    )}
                    {activeTab === 'HISTORY' && (
                        <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 'auto' }}>
                            <option value="">All Status</option>
                            <option value="HR_APPROVED">HR Approved</option>
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
                    <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); setMonth(''); setYear(''); setPage(1); }}>Clear</button>
                </div>
            </div>

            {/* Tabs + Table */}
            <div className="card" style={{ padding: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0 16px' }}>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'PENDING' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'PENDING' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('PENDING'); setPage(1); }}
                    >
                        Pending Approvals
                    </button>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'HISTORY' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'HISTORY' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('HISTORY'); setPage(1); }}
                    >
                        History
                    </button>
                </div>

                <div className="table-header" style={{ padding: '16px 20px', borderBottom: 'none' }}>
                    <h3 style={{ fontSize: 14 }}>{loading ? 'Loading...' : `${total} claim${total !== 1 ? 's' : ''}`}</h3>
                </div>

                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading...
                    </div>
                ) : claims.length === 0 ? (
                    <div className="empty-state" style={{ padding: 48 }}>
                        <div className="empty-icon">✅</div>
                        <h3>{activeTab === 'PENDING' ? 'No pending approvals' : 'No history yet'}</h3>
                        <p>{activeTab === 'PENDING' ? 'All submitted claims have been reviewed.' : 'No actions taken yet.'}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Claim No.</th>
                                    <th>Employee</th>
                                    <th>Category</th>
                                    <th>Amount</th>
                                    <th>Expense Date</th>
                                    <th>Submitted</th>
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
                                        <td>{formatDate(c.expenseDate)}{c.expenseEndDate ? ' to ' + formatDate(c.expenseEndDate) : ''}</td>
                                        <td>{formatDate(c.submittedAt)}</td>
                                        <td>
                                            <span className={`badge ${STATUS_LABELS[c.status]?.badge || 'badge-neutral'}`}>
                                                {STATUS_LABELS[c.status]?.label || c.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/admin/expenses/${c._id}`)}>
                                                    <HiOutlineDocumentText style={{ marginRight: 4 }} /> View
                                                </button>
                                            </div>
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
                        <span style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
                        <button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}
