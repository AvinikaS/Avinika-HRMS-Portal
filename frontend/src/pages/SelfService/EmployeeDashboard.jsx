import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineClock, HiOutlineCalendar, HiOutlineCurrencyDollar, HiOutlineClipboardCheck, HiOutlineDocumentText, HiOutlineUser, HiOutlineX, HiOutlineSun, HiOutlineSupport, HiOutlineCash } from 'react-icons/hi';
import SmartAttendance from './SmartAttendance';

export default function EmployeeDashboard() {
    const { user, isExEmployee } = useAuth();
    const navigate = useNavigate();
    const [todayStatus, setTodayStatus] = useState(null);
    const [leaveBalance, setLeaveBalance] = useState(null);
    const [recentPayslips, setRecentPayslips] = useState([]);
    const [upcomingHolidays, setUpcomingHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [time, setTime] = useState(new Date());
    const [showSmartModal, setShowSmartModal] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const loadData = async () => {
        try {
            if (isExEmployee) {
                // Ex-employees only load payslips
                const payRes = await api.get('/payroll/my').catch(() => ({ data: { data: [] } }));
                setRecentPayslips((payRes.data.data || []).slice(0, 5));
            } else {
                const [attRes, leaveRes, payRes, holidayRes] = await Promise.all([
                    api.get('/attendance/today').catch(() => ({ data: { data: null } })),
                    api.get('/leaves/balance').catch(() => ({ data: { data: {} } })),
                    api.get('/payroll/my').catch(() => ({ data: { data: [] } })),
                    api.get('/holidays/upcoming').catch(() => ({ data: { data: [] } })),
                ]);
                setTodayStatus(attRes.data.data);
                setLeaveBalance(leaveRes.data.data);
                setRecentPayslips((payRes.data.data || []).slice(0, 3));
                setUpcomingHolidays(holidayRes.data.data || []);
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [isExEmployee]);

    const handleCheckIn = () => {
        setShowSmartModal(true);
    };

    const handleCheckOut = async () => {
        try {
            const { data } = await api.post('/attendance/checkout');
            setTodayStatus(data.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Check-out failed'); }
    };

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    const userName = user?.employeeId?.firstName || user?.email?.split('@')[0] || 'Employee';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    if (isExEmployee) {
        return (
            <div className="animate-fadeIn">
                <div className="page-header" style={{ marginBottom: 20 }}>
                    <div>
                        <h1>Welcome, {userName}! 👋</h1>
                        <p>Ex-Employee Portal • Access your offboarding records & payslips</p>
                    </div>
                </div>

                {/* Ex-Employee Status Notice Banner */}
                <div style={{
                    padding: '20px 24px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    marginBottom: 24,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap'
                }}>
                    <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: '#dc2626',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0
                    }}>
                        📋
                    </div>
                    <div style={{ flex: 1, minWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#991b1b' }}>Ex-Employee Access Mode</h3>
                            <span style={{ background: '#dc2626', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                                Terminated / Ex-Employee
                            </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                            Your offboarding process is complete. You have secure access to view and download your <strong>Full & Final Settlement (F&F)</strong> statement, <strong>Relieving Letter</strong>, <strong>Experience Certificate</strong>, and past <strong>Payslips</strong>.
                        </p>
                    </div>
                </div>

                {/* Quick Access Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                    <div
                        onClick={() => navigate('/resignation')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #6366f1' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#6366f118', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', fontSize: 20 }}>
                                <HiOutlineDocumentText />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Exit Documents</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            Download F&F Letter, Relieving Letter & Experience Certificate.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-payslips')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #10b981' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: 20 }}>
                                <HiOutlineCurrencyDollar />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>My Payslips</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View and download monthly payslips in Excel and PDF.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-attendance')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #3b82f6' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3b82f618', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', fontSize: 20 }}>
                                <HiOutlineClock />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Attendance History</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View attendance calendar and past working logs.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-leaves')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #f59e0b' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f59e0b18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', fontSize: 20 }}>
                                <HiOutlineCalendar />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Leave History</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            Check past leave records, approvals, and balance history.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-loans')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #8b5cf6' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#8b5cf618', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6', fontSize: 20 }}>
                                <HiOutlineCurrencyDollar />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Loans & Advances</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            Review loans, EMI deductions, and full settlement trails.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/payroll/tax')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #14b8a6' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#14b8a618', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#14b8a6', fontSize: 20 }}>
                                <HiOutlineDocumentText />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Tax & TDS Summary</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View income tax declarations, regime, and TDS deductions.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-performance')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #d946ef' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#d946ef18', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d946ef', fontSize: 20 }}>
                                <HiOutlineClipboardCheck />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Performance Reviews</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View historical performance appraisals and ratings.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/helpdesk')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #0284c7' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#0284c718', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', fontSize: 20 }}>
                                <HiOutlineSupport />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>HR Helpdesk</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View your past support requests and conversation history.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/expenses')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #84cc16' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#84cc1618', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#84cc16', fontSize: 20 }}>
                                <HiOutlineCash />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Expense History</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View submitted reimbursement claims and payment statuses.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-documents')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #06b6d4' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#06b6d418', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#06b6d4', fontSize: 20 }}>
                                <HiOutlineDocumentText />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>My Documents</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            Access your personal records, ID proofs, and Form 16.
                        </p>
                    </div>

                    <div
                        onClick={() => navigate('/my-profile')}
                        className="card"
                        style={{ padding: 20, cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid #ec4899' }}
                        onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ec489918', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899', fontSize: 20 }}>
                                <HiOutlineUser />
                            </div>
                            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>My Profile</h4>
                        </div>
                        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
                            View your employment profile and service history.
                        </p>
                    </div>
                </div>

                {/* Recent Payslips Section */}
                <div className="card" style={{ maxWidth: 700 }}>
                    <div className="card-header">
                        <h3 className="card-title">Recent Payslips</h3>
                        <button className="btn btn-sm btn-outline" onClick={() => navigate('/my-payslips')}>View All Payslips</button>
                    </div>
                    <div style={{ padding: '0 20px 20px' }}>
                        {recentPayslips.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
                                <HiOutlineCurrencyDollar size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                                <p style={{ fontSize: 13, margin: 0 }}>No payslips generated yet</p>
                            </div>
                        ) : (
                            recentPayslips.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: i < recentPayslips.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 14 }}>{monthNames[p.month - 1]} {p.year}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Net Salary: ₹{(p.netSalary || 0).toLocaleString('en-IN')}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span className={`badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span>
                                        <button className="btn btn-sm btn-secondary" onClick={() => navigate('/my-payslips')}>View</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    }

    const quickLinks = [
        { icon: <HiOutlineClock />, label: 'My Attendance', path: '/my-attendance', color: '#4f46e5' },
        { icon: <HiOutlineCalendar />, label: 'My Leaves', path: '/my-leaves', color: '#10b981' },
        { icon: <HiOutlineCurrencyDollar />, label: 'My Payslips', path: '/my-payslips', color: '#f59e0b' },
        { icon: <HiOutlineClipboardCheck />, label: 'Performance', path: '/my-performance', color: '#8b5cf6' },
        { icon: <HiOutlineDocumentText />, label: 'Documents', path: '/my-documents', color: '#06b6d4' },
        { icon: <HiOutlineUser />, label: 'My Profile', path: '/my-profile', color: '#ec4899' },
    ];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Welcome, {userName}! 👋</h1>
                    <p>{time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <div className="grid-2" style={{ marginBottom: 24 }}>
                {/* Check-in Card */}
                <div className="checkin-card">
                    <div style={{ fontSize: 14, opacity: 0.8 }}>
                        {todayStatus?.checkIn ? (todayStatus.checkOut ? '✅ Shift Complete' : '🟢 Currently Working') : '⏰ Mark Attendance'}
                    </div>
                    <div className="time">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    <div className="date">{time.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                    {!todayStatus?.checkIn ? (
                        <button className="checkin-btn" onClick={handleCheckIn}>Check In</button>
                    ) : !todayStatus?.checkOut ? (
                        <button className="checkin-btn checked-in" onClick={handleCheckOut}>Check Out</button>
                    ) : (
                        <div style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>
                            {todayStatus.totalHours}h worked • In: {new Date(todayStatus.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} → Out: {new Date(todayStatus.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}
                </div>

                {/* Leave Balance Card */}
                <div className="card">
                    <div className="card-header"><h3 className="card-title">Leave Balance</h3></div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                        {[
                            { label: 'Casual', value: leaveBalance?.casual ?? 0, color: '#4f46e5' },
                            { label: 'Sick', value: leaveBalance?.sick ?? 0, color: '#10b981' },
                            { label: 'Earned', value: leaveBalance?.earned ?? 0, color: '#f59e0b' },
                            { label: 'Other', value: leaveBalance?.other ?? 0, color: '#8b5cf6' },
                        ].map((lb, i) => (
                            <div key={i} style={{ textAlign: 'center', padding: 16, borderRadius: 10, background: `${lb.color}08`, border: `1px solid ${lb.color}20` }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: lb.color }}>{lb.value}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>{lb.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Links */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header"><h3 className="card-title">Quick Access</h3></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                    {quickLinks.map((link, i) => (
                        <div key={i} onClick={() => navigate(link.path)} style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                            padding: 18, borderRadius: 10, border: '1px solid var(--border-color)',
                            cursor: 'pointer', transition: 'all 0.2s', textAlign: 'center'
                        }}
                            onMouseOver={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                            onMouseOut={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}>
                            <div style={{ width: 42, height: 42, borderRadius: 10, background: `${link.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: link.color, fontSize: 20 }}>
                                {link.icon}
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{link.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Lower Grid: Payslips & Holidays */}
            <div className="grid-2">
                {/* Recent Payslips */}
                {recentPayslips.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <h3 className="card-title">Recent Payslips</h3>
                            <button className="btn btn-sm btn-outline" onClick={() => navigate('/my-payslips')}>View All</button>
                        </div>
                        <div style={{ padding: '0 20px 20px' }}>
                            {recentPayslips.map((p, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < recentPayslips.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{monthNames[p.month - 1]} {p.year}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Net: ₹{(p.netSalary || 0).toLocaleString('en-IN')}</div>
                                    </div>
                                    <span className={`badge ${p.status === 'Paid' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Upcoming Holidays */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Upcoming Holidays</h3>
                        <button className="btn btn-sm btn-outline" onClick={() => navigate('/my-attendance')}>Full Calendar</button>
                    </div>
                    <div style={{ padding: '0 20px 20px' }}>
                        {upcomingHolidays.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)' }}>
                                <HiOutlineSun size={32} style={{ opacity: 0.2, marginBottom: 8 }} />
                                <p style={{ fontSize: 13 }}>No upcoming holidays</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: 12 }}>
                                {upcomingHolidays.map((h, i) => (
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
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Smart Attendance Modal */}
            {showSmartModal && (
                <div className="modal-overlay" onClick={() => setShowSmartModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, background: 'transparent' }}>
                        <div style={{ position: 'absolute', right: -40, top: 0 }}>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowSmartModal(false)} style={{ color: '#fff' }}><HiOutlineX /></button>
                        </div>
                        <SmartAttendance onComplete={(data) => {
                            setTodayStatus(data);
                            setShowSmartModal(false);
                            loadData();
                        }} />
                    </div>
                </div>
            )}
        </div>
    );
}
