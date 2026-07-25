import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { HiOutlineCalendar, HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TYPE_META = {
    Public: { bg: '#FFF0ED', color: '#B03510', border: '#FFC8BA', label: 'Public' },
    Government: { bg: '#FFF8E6', color: '#8F5E00', border: '#FFE5A1', label: 'Government' },
    Company: { bg: '#F2F1FF', color: '#4A3AFF', border: '#D6D4FF', label: 'Company' },
};

const YEARS = [2024, 2025, 2026, 2027, 2028];

export default function HolidayCalendar() {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [tab, setTab] = useState('calendar');
    const [viewHol, setViewHol] = useState(null);

    useEffect(() => {
        const fetchHolidays = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('/holidays/employee', { params: { year: currentYear } });
                setHolidays(data.data?.holidays || []);
            } catch (err) {
                // Fallback to old endpoint
                try {
                    const { data } = await api.get('/holidays', { params: { year: currentYear } });
                    setHolidays(data.data || []);
                } catch (e) {
                    console.error('Error fetching holidays:', e);
                }
            }
            setLoading(false);
        };
        fetchHolidays();
    }, [currentYear]);

    const today = new Date(); today.setHours(0, 0, 0, 0);

    const nextMonth = () => {
        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(prev => prev + 1); }
        else { setCurrentMonth(prev => prev + 1); }
    };

    const prevMonth = () => {
        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(prev => prev - 1); }
        else { setCurrentMonth(prev => prev - 1); }
    };

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    const getHolidaysForDay = (day) => {
        if (!day) return [];
        return holidays.filter(h => {
            const hDate = new Date(h.date);
            return hDate.getDate() === day &&
                hDate.getMonth() === currentMonth &&
                hDate.getFullYear() === currentYear;
        });
    };

    const upcoming = holidays.filter(h => new Date(h.date).setHours(0, 0, 0, 0) >= today.getTime()).sort((a, b) => new Date(a.date) - new Date(b.date));
    const next = upcoming[0];
    const daysLeft = next ? Math.round((new Date(next.date).setHours(0, 0, 0, 0) - today.getTime()) / 86400000) : null;

    const monthHols = holidays
        .filter(h => { const d = new Date(h.date); return d.getFullYear() === currentYear && d.getMonth() === currentMonth; })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    return (
        <div className="animate-fadeIn hm-wrap">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <h1>Holiday Calendar {currentYear}</h1>
                    <p>Your company holidays for this year</p>
                </div>
                <div className="hm-year-select-wrapper">
                    <label className="hm-year-label">Year:</label>
                    <input
                        type="number"
                        className="hm-year-input"
                        value={currentYear}
                        onChange={e => setCurrentYear(Number(e.target.value))}
                        min="2000"
                        max="2100"
                    />
                </div>
            </div>

            {/* Stats */}
            <div className="hm-stats">
                <div className="hm-stat-card"><div className="hm-stat-n">{holidays.length}</div><div className="hm-stat-l">Total Holidays</div></div>
                <div className="hm-stat-card"><div className="hm-stat-n">{upcoming.length}</div><div className="hm-stat-l">Remaining</div></div>
                <div className="hm-stat-card"><div className="hm-stat-n">{monthHols.length}</div><div className="hm-stat-l">{MONTHS[currentMonth].slice(0, 3)} Holidays</div></div>
            </div>

            {/* Next holiday banner */}
            {next && (
                <div className="hm-next-banner">
                    <HiOutlineCalendar style={{ fontSize: 18 }} /> Next Holiday: <strong>{next.name}</strong> —&nbsp;
                    {new Date(next.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    {daysLeft === 0 ? ' (Today!)' : daysLeft === 1 ? ' (Tomorrow!)' : `  (${daysLeft} days away)`}
                </div>
            )}

            {/* Tabs */}
            <div className="hm-view-tabs" style={{ marginBottom: '1rem' }}>
                <button className={`hm-vtab${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>Calendar View</button>
                <button className={`hm-vtab${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>List View</button>
            </div>

            {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                <>
                    {/* Calendar View */}
                    {tab === 'calendar' && (
                        <div className="hm-monthly">
                            <div className="hm-cal-area">
                                <div className="hm-cal-nav">
                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={prevMonth}><HiOutlineChevronLeft /></button>
                                    <span className="hm-cal-nav-title">{MONTHS[currentMonth]} {currentYear}</span>
                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={nextMonth}><HiOutlineChevronRight /></button>
                                </div>
                                <div className="hm-wday-row">
                                    {DAYS.map(d => <div key={d} className="hm-wday">{d}</div>)}
                                </div>
                                <div className="hm-day-grid">
                                    {calendarDays.map((day, i) => {
                                        const dayHols = getHolidaysForDay(day);
                                        const hasHols = dayHols.length > 0;
                                        const primaryHol = dayHols[0];
                                        const tm = primaryHol ? (TYPE_META[primaryHol.type] || TYPE_META[primaryHol.type.charAt(0).toUpperCase() + primaryHol.type.slice(1).toLowerCase()] || TYPE_META.Public) : null;
                                        const isSunday = day && new Date(currentYear, currentMonth, day).getDay() === 0;
                                        const isToday = day && today.toDateString() === new Date(currentYear, currentMonth, day).toDateString();

                                        return (
                                            <div key={i}
                                                className={`hm-day-cell${!day ? ' hm-empty' : ''}${hasHols ? ` hm-h-cell hm-cell-${primaryHol.type.toLowerCase()}` : ''}${!hasHols && isToday ? ' hm-cell-today' : ''}${!hasHols && isSunday ? ' hm-cell-sunday' : ''}`}
                                                style={{ overflow: 'hidden', cursor: hasHols ? 'pointer' : 'default' }}
                                                title={dayHols.map(h => h.name).join(' & ')}
                                                onClick={() => hasHols && setViewHol(dayHols[0])}
                                            >
                                                {day && (
                                                    <>
                                                        <span className="hm-day-n" style={
                                                            hasHols ? { color: tm.color, fontWeight: 600 } :
                                                                isToday ? { color: '#0C447C', fontWeight: 700 } :
                                                                    isSunday ? { color: 'var(--danger)' } : {}
                                                        }>{day}</span>
                                                        {dayHols.map(h => (
                                                            <div key={h._id}
                                                                onClick={() => setViewHol(h)}
                                                                style={{
                                                                    marginTop: 2, padding: '1px 5px', borderRadius: 4,
                                                                    background: (TYPE_META[h.type] || TYPE_META.Public).color, color: 'white',
                                                                    fontSize: 9, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                                                    maxWidth: '100%', textAlign: 'center', cursor: 'pointer'
                                                                }}>
                                                                {h.name}
                                                            </div>
                                                        ))}
                                                        {isSunday && !hasHols && <div className="hm-weekly-off" style={{ fontSize: 9, color: 'var(--danger)', fontStyle: 'italic', marginTop: 2 }}>Weekly Off</div>}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="hm-sidebar">
                                <div className="hm-sb-head">
                                    <span>{MONTHS[currentMonth]} Holidays</span>
                                    <span className="hm-sb-cnt">{monthHols.length} total</span>
                                </div>

                                <div className="hm-sb-list">
                                    {monthHols.map(h => {
                                        const d = new Date(h.date);
                                        const tm = TYPE_META[h.type] || TYPE_META.Public;

                                        return (
                                            <div key={h._id} className="hm-sb-item" onClick={() => setViewHol(h)} style={{ cursor: 'pointer' }}>
                                                <div className="hm-sb-badge" style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}` }}>
                                                    <div style={{ fontSize: 13, fontWeight: 700 }}>{d.getDate()}</div>
                                                    <div style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>{d.toLocaleDateString('en-IN', { month: 'short' })}</div>
                                                </div>
                                                <div className="hm-sb-info">
                                                    <div className="hm-sb-name">{h.name}</div>
                                                    <div className="hm-sb-dt">{d.toLocaleDateString('en-IN', { weekday: 'long' })}</div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {monthHols.length === 0 && (
                                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                            <div style={{ fontSize: 32, marginBottom: '0.5rem', opacity: 0.3 }}>🏖️</div>
                                            <div style={{ fontSize: 13 }}>No holidays in {MONTHS[currentMonth]}</div>
                                        </div>
                                    )}
                                </div>

                                <div className="hm-sb-legend">
                                    {Object.entries(TYPE_META).map(([k, v]) => (
                                        <div key={k} className="hm-leg-row">
                                            <span className="hm-leg-dot" style={{ background: v.bg, border: `1px solid ${v.border}` }} />
                                            {v.label}
                                        </div>
                                    ))}
                                    <div className="hm-leg-row">
                                        <span className="hm-leg-dot" style={{ background: 'rgba(234,243,222,0.6)', border: '1px solid #97C459' }} />
                                        Weekly Off (Sunday)
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* List View */}
                    {tab === 'list' && (
                        <div className="table-container" style={{ marginTop: '1rem' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Holiday</th>
                                            <th>Type</th>
                                            <th>Day</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {holidays.map(h => {
                                            const d = new Date(h.date);
                                            const past = d < new Date().setHours(0, 0, 0, 0);
                                            const tm = TYPE_META[h.type] || TYPE_META.Public;
                                            return (
                                                <tr key={h._id} onClick={() => setViewHol(h)} style={{ ...(past ? { opacity: 0.7 } : {}), cursor: 'pointer' }}>
                                                    <td style={{ fontWeight: 600 }}>{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                    <td><strong>{h.name}</strong></td>
                                                    <td>
                                                        <span className="badge" style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}` }}>
                                                            {tm.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: 'var(--text-tertiary)' }}>{d.toLocaleDateString('en-IN', { weekday: 'long' })}</td>
                                                </tr>
                                            );
                                        })}
                                        {holidays.length === 0 && (
                                            <tr>
                                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                                                    No holidays found for this year.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* View Modal */}
            {viewHol && (
                <div className="hm-modal-overlay" onClick={() => setViewHol(null)}>
                    <div className="hm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="hm-modal-head">
                            <h3>Holiday Details</h3>
                            <button className="hm-modal-close" onClick={() => setViewHol(null)}>&times;</button>
                        </div>
                        <div className="hm-modal-body">
                            <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', alignItems: 'center' }}>
                                <div style={{
                                    padding: '12px 18px', borderRadius: '14px', textAlign: 'center',
                                    background: (TYPE_META[viewHol.type] || TYPE_META.Public).bg,
                                    color: (TYPE_META[viewHol.type] || TYPE_META.Public).color,
                                    border: `1px solid ${(TYPE_META[viewHol.type] || TYPE_META.Public).border}`,
                                    minWidth: '70px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ fontSize: 26, fontWeight: 900 }}>{new Date(viewHol.date).getDate()}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase' }}>{new Date(viewHol.date).toLocaleDateString('en-IN', { month: 'short' })}</div>
                                </div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>{viewHol.name}</h2>
                                    <div style={{ fontSize: 15, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                        {new Date(viewHol.date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric' })}
                                    </div>
                                </div>
                            </div>

                            <div style={{ background: 'var(--bg-secondary)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                <div style={{ marginBottom: '15px' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Holiday Type</div>
                                    <span className="badge" style={{
                                        padding: '5px 12px', borderRadius: '20px', fontSize: 12,
                                        background: (TYPE_META[viewHol.type] || TYPE_META.Public).bg,
                                        color: (TYPE_META[viewHol.type] || TYPE_META.Public).color,
                                        border: `1px solid ${(TYPE_META[viewHol.type] || TYPE_META.Public).border}`
                                    }}>{viewHol.type}</span>
                                </div>

                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>About This Holiday</div>
                                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                        {viewHol.description || 'No additional description available for this holiday.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="hm-modal-foot" style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setViewHol(null)} style={{ padding: '8px 24px', borderRadius: '8px' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
