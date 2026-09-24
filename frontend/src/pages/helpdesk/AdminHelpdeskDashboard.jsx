import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import {
    HiOutlineTicket, HiOutlineClock, HiOutlineExclamationCircle, HiOutlineCheckCircle,
    HiOutlineFire, HiOutlineRefresh, HiOutlineChartBar
} from 'react-icons/hi';

const PRIORITY_COLORS = { LOW: '#64748b', MEDIUM: '#f59e0b', HIGH: '#ef4444', URGENT: '#dc2626' };

function StatCard({ label, value, icon: Icon, color, onClick }) {
    return (
        <div className={`stat-card ${color}`} onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            <div className={`stat-icon ${color}`}><Icon /></div>
            <div className="stat-content">
                <div className="stat-label">{label}</div>
                <div className="stat-value">{value}</div>
            </div>
        </div>
    );
}

export default function AdminHelpdeskDashboard() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchDashboard = async () => {
        setLoading(true);
        try {
            const { data: res } = await api.get('/helpdesk/admin/dashboard');
            if (res.success) setData(res.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchDashboard(); }, []);

    if (loading) return (
        <div className="animate-fadeIn" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading dashboard...
        </div>
    );

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Helpdesk Dashboard</h1>
                    <p>Overview of all HR support tickets and team performance</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={fetchDashboard}><HiOutlineRefresh /> Refresh</button>
                    <button className="btn btn-primary" onClick={() => navigate('/admin/helpdesk/tickets')}>View All Tickets</button>
                </div>
            </div>

            {/* Main Stats */}
            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', marginBottom: 24 }}>
                <StatCard label="Total Tickets" value={data?.total || 0} icon={HiOutlineTicket} color="purple" onClick={() => navigate('/admin/helpdesk/tickets')} />
                <StatCard label="Open" value={data?.open || 0} icon={HiOutlineClock} color="blue" onClick={() => navigate('/admin/helpdesk/tickets?status=OPEN')} />
                <StatCard label="In Progress" value={data?.inProgress || 0} icon={HiOutlineChartBar} color="orange" onClick={() => navigate('/admin/helpdesk/tickets?status=IN_PROGRESS')} />
                <StatCard label="Waiting for Employee" value={data?.waitingForEmployee || 0} icon={HiOutlineClock} color="cyan" onClick={() => navigate('/admin/helpdesk/tickets?status=WAITING_FOR_EMPLOYEE')} />
                <StatCard label="Resolved" value={data?.resolved || 0} icon={HiOutlineCheckCircle} color="green" onClick={() => navigate('/admin/helpdesk/tickets?status=RESOLVED')} />
                <StatCard label="Urgent &amp; Open" value={data?.urgent || 0} icon={HiOutlineFire} color="red" onClick={() => navigate('/admin/helpdesk/tickets?priority=URGENT')} />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginBottom: 24 }}>
                {/* Tickets by Category */}
                <div className="card" style={{ flex: '2 1 min(100%, 500px)' }}>
                    <div className="card-header">
                        <div className="card-title">📋 Tickets by Category</div>
                    </div>
                    {(data?.byCategory || []).length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 32 }}>No data</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.byCategory.slice(0, 8).map((c, i) => {
                                const max = data.byCategory[0]?.count || 1;
                                const pct = Math.round((c.count / max) * 100);
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{ width: 130, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {c.category}
                                        </div>
                                        <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary-gradient)', borderRadius: 6, transition: 'width 0.4s' }} />
                                        </div>
                                        <div style={{ width: 28, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{c.count}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Tickets by Priority */}
                <div className="card" style={{ flex: '1 1 min(100%, 280px)' }}>
                    <div className="card-header"><div className="card-title">🎯 By Priority</div></div>
                    {(data?.byPriority || []).length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 32 }}>No data</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {data.byPriority.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 13, fontWeight: 600, color: PRIORITY_COLORS[p.priority] || 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_COLORS[p.priority], display: 'inline-block' }} />
                                        {p.priority}
                                    </span>
                                    <span style={{ fontWeight: 800, fontSize: 18 }}>{p.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
                {/* Urgent Open Tickets */}
                <div className="card" style={{ flex: '1 1 min(100%, 300px)' }}>
                    <div className="card-header">
                        <div className="card-title">🔥 Urgent Open Tickets</div>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/admin/helpdesk/tickets?priority=URGENT')}>View All</button>
                    </div>
                    {(data?.urgentOpenTickets || []).length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 24 }}>No urgent tickets 🎉</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.urgentOpenTickets.map(t => (
                                <div key={t._id} onClick={() => navigate(`/admin/helpdesk/tickets/${t._id}`)}
                                    style={{ padding: '10px 14px', background: '#fff5f5', borderRadius: 8, cursor: 'pointer', border: '1px solid #fecaca', transition: 'all 0.2s' }}>
                                    <div style={{ fontWeight: 700, fontSize: 12, color: '#dc2626' }}>{t.ticketNumber}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2 }}>{t.subject}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        {t.employeeId?.firstName} {t.employeeId?.lastName} · {new Date(t.createdAt).toLocaleDateString('en-IN')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Tickets */}
                <div className="card" style={{ flex: '1 1 min(100%, 300px)' }}>
                    <div className="card-header">
                        <div className="card-title">🕐 Recent Tickets</div>
                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/admin/helpdesk/tickets')}>View All</button>
                    </div>
                    {(data?.recentTickets || []).length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, padding: 24 }}>No tickets yet</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {data.recentTickets.map(t => (
                                <div key={t._id} onClick={() => navigate(`/admin/helpdesk/tickets/${t._id}`)}
                                    style={{ padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border-light)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--primary)' }}>{t.ticketNumber}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(t.createdAt).toLocaleDateString('en-IN')}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        {t.employeeId?.firstName} {t.employeeId?.lastName}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Assignee Workload */}
                {(data?.byAssignee || []).length > 0 && (
                    <div className="card" style={{ width: '100%' }}>
                        <div className="card-header"><div className="card-title">👥 HR Assignee Workload</div></div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {data.byAssignee.map((a, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-tertiary)', padding: '10px 16px', borderRadius: 8 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                                        {a.assignee.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>{a.assignee}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{a.count} ticket{a.count !== 1 ? 's' : ''}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
