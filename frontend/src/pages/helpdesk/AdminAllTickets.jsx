import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { HiOutlineRefresh, HiOutlineSearch, HiOutlineFilter } from 'react-icons/hi';

const STATUS_LABELS = {
    OPEN: { label: 'Open', badge: 'badge-info' },
    ASSIGNED: { label: 'Assigned', badge: 'badge-primary' },
    IN_PROGRESS: { label: 'In Progress', badge: 'badge-warning' },
    WAITING_FOR_EMPLOYEE: { label: 'Waiting for Employee', badge: 'badge-warning' },
    RESOLVED: { label: 'Resolved', badge: 'badge-success' },
    CLOSED: { label: 'Closed', badge: 'badge-neutral' },
    REOPENED: { label: 'Reopened', badge: 'badge-danger' }
};

const PRIORITY_LABELS = {
    LOW: { label: 'Low', color: '#64748b' },
    MEDIUM: { label: 'Medium', color: '#f59e0b' },
    HIGH: { label: 'High', color: '#ef4444' },
    URGENT: { label: 'Urgent', color: '#dc2626' }
};

export default function AdminAllTickets() {
    const navigate = useNavigate();
    const location = useLocation();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [viewTicketInfo, setViewTicketInfo] = useState(null);
    const LIMIT = 10;

    // Parse initial query params from URL
    const qs = new URLSearchParams(location.search);
    const [filters, setFilters] = useState({
        status: qs.get('status') || '',
        priority: qs.get('priority') || '',
        categoryId: '',
        assignedTo: '',
        search: '',
        dateFrom: '',
        dateTo: ''
    });
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [categories, setCategories] = useState([]);
    const [hrUsers, setHRUsers] = useState([]);

    useEffect(() => {
        api.get('/helpdesk/admin/categories').then(({ data }) => { if (data.success) setCategories(data.data); }).catch(() => { });
        api.get('/helpdesk/admin/hr-users').then(({ data }) => { if (data.success) setHRUsers(data.data); }).catch(() => { });
    }, []);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            let finalStatus = filters.status;
            if (!finalStatus) {
                if (activeTab === 'ACTIVE') finalStatus = ''; // Show everything
                else if (activeTab === 'CLOSED') finalStatus = 'RESOLVED,CLOSED';
            }

            const params = new URLSearchParams({ page, limit: LIMIT });
            if (finalStatus) params.set('status', finalStatus);
            if (filters.priority) params.set('priority', filters.priority);
            if (filters.categoryId) params.set('categoryId', filters.categoryId);
            if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
            if (filters.search) params.set('search', filters.search);
            if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
            if (filters.dateTo) params.set('dateTo', filters.dateTo);
            const { data } = await api.get(`/helpdesk/admin/tickets?${params}`);
            if (data.success) {
                setTickets(data.data);
                setTotal(data.total);
            }
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchTickets(); }, [filters, page, activeTab]);

    const handleFilterChange = (key, val) => {
        setFilters(prev => ({ ...prev, [key]: val }));
        setPage(1);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>All Helpdesk Tickets</h1>
                    <p>Manage and respond to all employee support requests</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchTickets}><HiOutlineRefresh /> Refresh</button>
                    <button className="btn btn-secondary" onClick={() => navigate('/admin/helpdesk')}>← Dashboard</button>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: 20, padding: '16px 20px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 min(100%, 250px)' }}>
                        <HiOutlineSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                        <input
                            className="form-control"
                            placeholder="Search ticket #, subject, employee..."
                            value={filters.search}
                            onChange={e => handleFilterChange('search', e.target.value)}
                            style={{ paddingLeft: 32 }}
                        />
                    </div>
                    <select className="form-control" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} style={{ flex: '1 1 130px' }}>
                        <option value="">All Status</option>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select className="form-control" value={filters.priority} onChange={e => handleFilterChange('priority', e.target.value)} style={{ flex: '1 1 130px' }}>
                        <option value="">All Priority</option>
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <select className="form-control" value={filters.categoryId} onChange={e => handleFilterChange('categoryId', e.target.value)} style={{ flex: '1 1 130px' }}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <select className="form-control" value={filters.assignedTo} onChange={e => handleFilterChange('assignedTo', e.target.value)} style={{ flex: '1 1 130px' }}>
                        <option value="">All Assignees</option>
                        {hrUsers.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', flex: '1 1 100%' }}>
                        <input type="date" className="form-control" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} style={{ width: '100%', minWidth: 0, paddingLeft: 8, paddingRight: 8 }} />
                        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>to</span>
                        <input type="date" className="form-control" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} style={{ width: '100%', minWidth: 0, paddingLeft: 8, paddingRight: 8 }} />
                    </div>
                    <button className="btn btn-secondary btn-sm" style={{ flex: '1 1 100px', padding: '10px 16px', height: '100%' }} onClick={() => { setFilters({ status: '', priority: '', categoryId: '', assignedTo: '', search: '', dateFrom: '', dateTo: '' }); setPage(1); setActiveTab('ACTIVE'); }}>
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                {/* Tabs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0 16px' }}>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'ACTIVE' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'ACTIVE' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('ACTIVE'); setPage(1); setFilters({ ...filters, status: '' }); }}
                    >
                        All Tickets
                    </button>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'CLOSED' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'CLOSED' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('CLOSED'); setPage(1); setFilters({ ...filters, status: '' }); }}
                    >
                        All Resolved/Closed Tickets
                    </button>
                </div>

                <div className="table-header" style={{ padding: '16px 20px', borderBottom: 'none' }}>
                    <h3 style={{ fontSize: 14 }}>
                        {loading ? 'Loading...' : `${total} ticket${total !== 1 ? 's' : ''} found`}
                    </h3>
                </div>

                {loading ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading tickets...
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎫</div>
                        <h3>No tickets found</h3>
                        <p>Try adjusting your filters</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket No.</th>
                                    <th style={{ textAlign: 'center' }}>Sub/Desc</th>
                                    <th>Employee</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Assigned To</th>
                                    <th>Created</th>
                                    <th>Updated</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map(t => (
                                    <tr key={t._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/helpdesk/tickets/${t._id}`)}>
                                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{t.ticketNumber}</td>
                                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                            <button className="btn btn-sm btn-secondary" onClick={() => setViewTicketInfo(t)} title="View Subject & Description">View</button>
                                        </td>
                                        <td style={{ fontSize: 12 }}>
                                            <div style={{ fontWeight: 600 }}>{t.employeeId?.firstName} {t.employeeId?.lastName}</div>
                                            <div style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>{t.employeeId?.employeeCode}</div>
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.categoryId?.name || '-'}</td>
                                        <td>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: PRIORITY_LABELS[t.priority]?.color }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_LABELS[t.priority]?.color, display: 'inline-block' }} />
                                                {PRIORITY_LABELS[t.priority]?.label || t.priority}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${STATUS_LABELS[t.status]?.badge || 'badge-neutral'}`} style={{ fontSize: 10 }}>
                                                {STATUS_LABELS[t.status]?.label || t.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {t.assignedToName || <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}
                                        </td>
                                        <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                            {new Date(t.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <button className="btn btn-sm btn-primary" onClick={() => navigate(`/admin/helpdesk/tickets/${t._id}`)}>
                                                Open
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {total > LIMIT && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', borderTop: '1px solid var(--border-light)', fontSize: 13 }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>Showing {tickets.length} of {total} tickets</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
                            <span style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>Page {page} / {Math.ceil(total / LIMIT)}</span>
                            <button className="btn btn-sm btn-secondary" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick View Modal */}
            {viewTicketInfo && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setViewTicketInfo(null)}>
                    <div style={{
                        background: 'var(--bg-primary)', padding: 24, borderRadius: 12,
                        width: '90%', maxWidth: 500, boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Ticket Information</h3>
                            <button onClick={() => setViewTicketInfo(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-tertiary)' }}>✕</button>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>SUBJECT</div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{viewTicketInfo.subject}</div>
                        </div>
                        <div style={{ marginBottom: 24 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: 4 }}>DESCRIPTION</div>
                            <div style={{
                                fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)',
                                padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto'
                            }}>
                                {viewTicketInfo.description}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <button className="btn btn-primary btn-sm" onClick={() => {
                                setViewTicketInfo(null);
                                navigate(`/admin/helpdesk/tickets/${viewTicketInfo._id}`);
                            }}>View Full Conversation</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
