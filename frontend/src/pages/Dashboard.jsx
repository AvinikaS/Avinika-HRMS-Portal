import { useState, useEffect } from 'react';
import api from '../utils/api';
import { HiOutlineUserGroup, HiOutlineClock, HiOutlineCalendar, HiOutlineBriefcase, HiOutlineChartBar, HiOutlineCurrencyDollar, HiOutlineSun } from 'react-icons/hi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, holidayRes] = await Promise.all([
                    api.get('/dashboard'),
                    api.get('/holidays/upcoming')
                ]);
                setStats(statsRes.data.data);
                setHolidays(holidayRes.data.data || []);
            } catch (err) {
                console.error('Dashboard fetch failed:', err);
                setStats({
                    totalEmployees: 0, activeEmployees: 0, todayPresent: 0,
                    pendingLeaves: 0, openPositions: 0, totalCandidates: 0,
                    departmentStats: [], recentJoining: [], attendanceTrend: [], birthdaysToday: []
                });
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = (stats?.attendanceTrend || []).map(t => ({
        name: monthNames[t._id.month],
        attendance: t.count
    }));

    const deptData = (stats?.departmentStats || []).map(d => ({
        name: d._id, value: d.count
    }));

    const attendanceRate = stats?.activeEmployees > 0 ? Math.round((stats.todayPresent / stats.activeEmployees) * 100) : 0;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Welcome back! Here's your HR overview</p>
                </div>
            </div>

            <div className="stat-grid">
                <div className="stat-card purple">
                    <div className="stat-icon purple"><HiOutlineUserGroup /></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Employees</div>
                        <div className="stat-value">{stats?.totalEmployees || 0}</div>
                        <div className="stat-change positive">{stats?.activeEmployees || 0} active</div>
                    </div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon green"><HiOutlineClock /></div>
                    <div className="stat-content">
                        <div className="stat-label">Today's Attendance</div>
                        <div className="stat-value">{stats?.todayPresent || 0}</div>
                        <div className="stat-change positive">{attendanceRate}% present</div>
                    </div>
                </div>
                <div className="stat-card orange">
                    <div className="stat-icon orange"><HiOutlineCalendar /></div>
                    <div className="stat-content">
                        <div className="stat-label">Pending Leaves</div>
                        <div className="stat-value">{stats?.pendingLeaves || 0}</div>
                        <div className="stat-change negative">Requires attention</div>
                    </div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon blue"><HiOutlineBriefcase /></div>
                    <div className="stat-content">
                        <div className="stat-label">Open Positions</div>
                        <div className="stat-value">{stats?.openPositions || 0}</div>
                        <div className="stat-change positive">{stats?.totalCandidates || 0} candidates</div>
                    </div>
                </div>
            </div>

            <div className="charts-grid">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Attendance Trend</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                            <Bar dataKey="attendance" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                            <defs>
                                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" />
                                    <stop offset="100%" stopColor="#818cf8" />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Department Distribution</h3>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                            <Pie data={deptData} cx="50%" cy="50%" outerRadius={100} innerRadius={50} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} style={{ fontSize: 11 }}>
                                {deptData.map((entry, index) => (
                                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="grid-3">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Recent Joinings</h3>
                    </div>
                    {(stats?.recentJoining || []).map((emp, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < stats.recentJoining.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                            <div className="avatar" style={{ background: COLORS[i % COLORS.length] }}>
                                {emp.firstName?.charAt(0)}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{emp.firstName} {emp.lastName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{emp.department}</div>
                            </div>
                            <span className="badge badge-success">New</span>
                        </div>
                    ))}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">🎉 Birthdays Today</h3>
                    </div>
                    {(!stats?.birthdaysToday || stats.birthdaysToday.length === 0) ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
                            <div style={{ fontSize: 40, opacity: 0.2, marginBottom: 12 }}>🎂</div>
                            <p>No birthdays today</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {stats.birthdaysToday.map((emp, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < stats.birthdaysToday.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    {emp.profileImage ? (
                                        <img src={emp.profileImage} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div className="avatar" style={{ background: COLORS[i % COLORS.length] }}>{emp.firstName?.charAt(0)}</div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{emp.firstName} {emp.lastName}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{emp.department}</div>
                                    </div>
                                    <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#d97706' }}>Today!</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Upcoming Holidays</h3>
                    </div>
                    {holidays.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-tertiary)' }}>
                            <HiOutlineSun size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
                            <p>No upcoming holidays</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                            {holidays.map((h, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 12, padding: 12,
                                    background: 'var(--bg-primary)', borderRadius: 10, border: '1px solid var(--border-color)'
                                }}>
                                    <div style={{ width: 40, height: 40, background: 'var(--primary-gradient)', borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                        <span style={{ fontSize: 14, fontWeight: 800 }}>{new Date(h.date).getDate()}</span>
                                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>{new Date(h.date).toLocaleDateString('default', { month: 'short' })}</span>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{h.name}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{new Date(h.date).toLocaleDateString('default', { weekday: 'long' })}</div>
                                    </div>
                                    <span className={`badge ${h.type === 'Public' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{h.type}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
