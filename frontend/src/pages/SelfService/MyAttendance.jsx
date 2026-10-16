import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import SmartAttendance from './SmartAttendance';
import AttendanceCalendar from './AttendanceCalendar';
import { HiOutlineX, HiOutlineTable, HiOutlineCalendar } from 'react-icons/hi';

export default function MyAttendance() {
    const { user } = useAuth();
    const [todayStatus, setTodayStatus] = useState(null);
    const [records, setRecords] = useState([]);
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [time, setTime] = useState(new Date());
    const [showSmartModal, setShowSmartModal] = useState(false);
    const [view, setView] = useState('table'); // 'table' or 'calendar'
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchRecords = async (m, y) => {
        setDataLoading(true);
        try {
            const [attRes, holRes] = await Promise.all([
                api.get('/attendance/my', { params: { month: m, year: y } }),
                api.get('/holidays', { params: { year: y } })
            ]);
            setRecords(attRes.data.data || []);
            setHolidays(holRes.data.data || []);
        } catch { }
        setDataLoading(false);
    };

    const fetchToday = async () => {
        try {
            const { data } = await api.get('/attendance/today');
            setTodayStatus(data.data);
        } catch { }
    };

    const fetchInitial = async () => {
        setLoading(true);
        await Promise.all([fetchToday(), fetchRecords(month, year)]);
        setLoading(false);
    };

    useEffect(() => { fetchInitial(); }, []);
    
    // Re-fetch only records when month/year changes for calendar
    useEffect(() => {
        if (!loading) fetchRecords(month, year);
    }, [month, year]);

    const handleCheckOut = async () => {
        try { await api.post('/attendance/checkout'); fetchToday(); fetchRecords(month, year); } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const isCheckedIn = todayStatus?.checkIn && !todayStatus?.checkOut;
    const isCheckedOut = todayStatus?.checkOut;

    const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';

    const statusBadge = (s) => {
        const map = { Present: 'badge-success', Absent: 'badge-danger', 'Half-Day': 'badge-warning', Late: 'badge-warning', 'On Leave': 'badge-primary' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header" style={{ marginBottom: 20 }}>
                <div><h1>My Attendance</h1><p>Mark your attendance and view history</p></div>
                <div className="view-toggle">
                    <button className={`btn ${view === 'table' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('table')}>
                        <HiOutlineTable /> Table
                    </button>
                    <button className={`btn ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView('calendar')}>
                        <HiOutlineCalendar /> Calendar
                    </button>
                    <style dangerouslySetInnerHTML={{ __html: '.view-toggle { display: flex; gap: 8px; background: var(--bg-secondary); padding: 4px; border-radius: 12px; border: 1px solid var(--border-color); }' }} />
                </div>
            </div>

            <div className="checkin-card" style={{ marginBottom: 28 }}>
                <div className="date">{time.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                <div className="time">{time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                {isCheckedOut ? (
                    <div style={{ marginTop: 16 }}>
                        <span className="badge badge-success" style={{ fontSize: 14, padding: '8px 20px' }}>✅ Attendance Complete</span>
                        <div style={{ marginTop: 10, opacity: 0.8 }}>
                            Check-in: {formatTime(todayStatus.checkIn)} · Check-out: {formatTime(todayStatus.checkOut)} · {todayStatus.totalHours}h worked
                        </div>
                    </div>
                ) : (
                    <button
                        className={`checkin-btn ${isCheckedIn ? 'checked-in' : ''}`}
                        onClick={isCheckedIn ? handleCheckOut : () => setShowSmartModal(true)}
                    >
                        {isCheckedIn ? '🔴 Check Out' : '🟢 Check In'}
                    </button>
                )}
                {isCheckedIn && <div style={{ marginTop: 10, opacity: 0.7, fontSize: 13 }}>Checked in at {formatTime(todayStatus.checkIn)}</div>}
            </div>

            {showSmartModal && (
                <div className="modal-overlay" onClick={() => setShowSmartModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, background: 'transparent' }}>
                        <div style={{ position: 'absolute', right: -40, top: 0 }}>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowSmartModal(false)} style={{ color: '#fff' }}><HiOutlineX /></button>
                        </div>
                        <SmartAttendance onComplete={(data) => {
                            setTodayStatus(data);
                            setShowSmartModal(false);
                            fetchInitial();
                        }} />
                    </div>
                </div>
            )}

            <div className="animate-slideUp">
                {view === 'calendar' ? (
                    <div style={{ position: 'relative' }}>
                        {dataLoading && (
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(2px)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
                                <div className="spinner"></div>
                            </div>
                        )}
                        <AttendanceCalendar 
                            month={month} 
                            year={year} 
                            records={records} 
                            holidays={holidays}
                            onMonthChange={(m, y) => { setMonth(m); setYear(y); }} 
                        />
                    </div>
                ) : (
                    <div className="table-container">
                        <div className="table-header"><h3>Attendance History</h3></div>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id}>
                                            <td style={{ fontWeight: 600 }}>{new Date(r.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}</td>
                                            <td>{r.status === 'Absent' ? '-' : formatTime(r.checkIn)}</td>
                                            <td>{r.status === 'Absent' ? '-' : formatTime(r.checkOut)}</td>
                                            <td>{r.status === 'Absent' ? '-' : (r.totalHours ? `${r.totalHours}h` : '-')}</td>
                                            <td>{statusBadge(r.status)}</td>
                                        </tr>
                                    ))}
                                    {records.length === 0 && <tr><td colSpan="5"><div className="empty-state"><h3>No attendance records</h3></div></td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
