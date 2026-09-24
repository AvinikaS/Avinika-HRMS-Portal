import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { HiOutlineTicket, HiOutlineExclamationCircle, HiOutlineCheckCircle, HiOutlineClock, HiOutlinePlus, HiOutlineRefresh } from 'react-icons/hi';

const STATUS_LABELS = {
    OPEN: { label: 'Open', badge: 'badge-info' },
    ASSIGNED: { label: 'Assigned', badge: 'badge-primary' },
    IN_PROGRESS: { label: 'In Progress', badge: 'badge-warning' },
    WAITING_FOR_EMPLOYEE: { label: 'Waiting for You', badge: 'badge-warning' },
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

export default function MyHelpdesk() {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({ total: 0, open: 0, inProgress: 0, waitingForMe: 0, resolved: 0, closed: 0 });
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [activeTab, setActiveTab] = useState('ACTIVE');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [viewTicketInfo, setViewTicketInfo] = useState(null);
    const LIMIT = 8;

    const fetchSummary = async () => {
        try {
            const { data } = await api.get('/helpdesk/tickets/my/summary');
            if (data.success) setSummary(data.data);
        } catch { }
    };

    const fetchTickets = async () => {
        setLoading(true);
        try {
            let finalStatus = statusFilter;
            if (!finalStatus) {
                if (activeTab === 'ACTIVE') finalStatus = ''; // Show everything
                else if (activeTab === 'CLOSED') finalStatus = 'RESOLVED,CLOSED';
            }

            const params = new URLSearchParams({ page, limit: LIMIT });
            if (finalStatus) params.set('status', finalStatus);
            if (search) params.set('search', search);
            const { data } = await api.get(`/helpdesk/tickets/my?${params}`);
            if (data.success) {
                setTickets(data.data);
                setTotal(data.total);
            }
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchSummary(); }, []);
    useEffect(() => { fetchTickets(); }, [statusFilter, search, page, activeTab]);

    const statCards = [
        { label: 'Total Tickets', value: summary.total, icon: HiOutlineTicket, color: 'purple' },
        { label: 'Open', value: summary.open, icon: HiOutlineClock, color: 'blue' },
        { label: 'In Progress', value: summary.inProgress, icon: HiOutlineExclamationCircle, color: 'orange' },
        { label: 'Waiting for You', value: summary.waitingForMe, icon: HiOutlineExclamationCircle, color: 'red' },
        { label: 'Resolved', value: summary.resolved, icon: HiOutlineCheckCircle, color: 'green' },
        { label: 'Closed', value: summary.closed, icon: HiOutlineCheckCircle, color: 'cyan' }
    ];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>My Helpdesk Tickets</h1>
                    <p>Track your HR support requests and their status</p>
                </div>
                <button className="btn btn-primary" onClick={() => navigate('/helpdesk/create')}>
                    <HiOutlinePlus /> Raise New Ticket
                </button>
            </div>

            {/* Summary Cards */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: 28 }}>
                {statCards.map((s) => (
                    <div key={s.label} className={`stat-card ${s.color}`} style={{ cursor: s.label !== 'Total Tickets' ? 'pointer' : 'default' }}
                        onClick={() => {
                            if (s.label === 'Open') setStatusFilter('OPEN');
                            else if (s.label === 'In Progress') setStatusFilter('IN_PROGRESS');
                            else if (s.label === 'Waiting for You') setStatusFilter('WAITING_FOR_EMPLOYEE');
                            else if (s.label === 'Resolved') setStatusFilter('RESOLVED');
                            else if (s.label === 'Closed') setStatusFilter('CLOSED');
                        }}>
                        <div className={`stat-icon ${s.color}`}><s.icon /></div>
                        <div className="stat-content">
                            <div className="stat-label">{s.label}</div>
                            <div className="stat-value">{s.value}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tickets Table */}
            <div className="card" style={{ padding: 0 }}>
                {/* Tabs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', padding: '0 16px' }}>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'ACTIVE' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'ACTIVE' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('ACTIVE'); setPage(1); setStatusFilter(''); }}
                    >
                        All Tickets
                    </button>
                    <button
                        style={{ padding: '16px 20px', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: activeTab === 'CLOSED' ? 'var(--primary)' : 'var(--text-secondary)', borderBottom: activeTab === 'CLOSED' ? '2px solid var(--primary)' : '2px solid transparent', transition: 'all 0.2s' }}
                        onClick={() => { setActiveTab('CLOSED'); setPage(1); setStatusFilter(''); }}
                    >
                        All Resolved/Closed Tickets
                    </button>
                </div>

                <div className="table-header" style={{ padding: '16px 20px', borderBottom: 'none' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700 }}>My Tickets</h3>
                    <div className="table-actions" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', width: '100%', marginTop: 8 }}>
                        <input
                            className="form-control"
                            placeholder="Search by ticket or subject..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            style={{ width: '100%' }}
                        />
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
                            <select className="form-control" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ padding: '8px 32px 8px 12px', fontSize: 13, minWidth: 140, maxWidth: 180, flex: 1 }}>
                                <option value="">All Status</option>
                                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0 16px' }} onClick={fetchTickets}><HiOutlineRefresh size={18} /></button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }} />
                        Loading tickets...
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎫</div>
                        <h3>No tickets found</h3>
                        <p>Raise a new ticket to get help from HR team</p>
                        <button className="btn btn-primary" onClick={() => navigate('/helpdesk/create')} style={{ marginTop: 16 }}>
                            <HiOutlinePlus /> Raise New Ticket
                        </button>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Ticket No.</th>
                                    <th style={{ textAlign: 'center' }}>Sub/Desc</th>
                                    <th>Category</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Raised On</th>
                                    <th>Updated</th>
                                    <th style={{ textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tickets.map(t => (
                                    <tr key={t._id}>
                                        <td style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12 }}>{t.ticketNumber}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn btn-sm btn-secondary" onClick={() => setViewTicketInfo(t)} title="View Subject & Description">View</button>
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t.categoryId?.name || '-'}</td>
                                        <td>
                                            <span style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                                fontSize: 12, fontWeight: 600,
                                                color: PRIORITY_LABELS[t.priority]?.color || 'inherit'
                                            }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: PRIORITY_LABELS[t.priority]?.color, display: 'inline-block' }} />
                                                {PRIORITY_LABELS[t.priority]?.label || t.priority}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${STATUS_LABELS[t.status]?.badge || 'badge-neutral'}`} style={{ fontSize: 11 }}>
                                                {STATUS_LABELS[t.status]?.label || t.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                            {new Date(t.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/helpdesk/tickets/${t._id}`)}>
                                                View
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
                            <button className="btn btn-sm btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
                            <span style={{ alignSelf: 'center', color: 'var(--text-secondary)' }}>Page {page} of {Math.ceil(total / LIMIT)}</span>
                            <button className="btn btn-sm btn-secondary" disabled={page * LIMIT >= total} onClick={() => setPage(page + 1)}>Next</button>
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
                                navigate(`/helpdesk/tickets/${viewTicketInfo._id}`);
                            }}>View Full Conversation</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
