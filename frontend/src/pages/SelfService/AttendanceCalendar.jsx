import { HiOutlineChevronLeft, HiOutlineChevronRight } from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AttendanceCalendar({ month, year, records, holidays = [], onMonthChange }) {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getStatus = (day) => {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = records.find(r => {
            const rDate = new Date(r.date);
            const rDateStr = `${rDate.getFullYear()}-${String(rDate.getMonth() + 1).padStart(2, '0')}-${String(rDate.getDate()).padStart(2, '0')}`;
            return rDateStr === dateStr;
        });

        const cellDate = new Date(year, month - 1, day);
        const isSunday = cellDate.getDay() === 0;
        const isHoliday = (holidays || []).find(h => {
            const hDate = new Date(h.date);
            return `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, '0')}-${String(hDate.getDate()).padStart(2, '0')}` === dateStr;
        });

        if (isHoliday) return 'Holiday';
        if (isSunday) return 'Weekly Off';
        if (record) return record.status;

        if (cellDate < today) return 'Absent'; // Default for past days if no record
        return null;
    };

    const getStatusClass = (status) => {
        const map = {
            'Present': 'status-present',
            'Late': 'status-late',
            'Half-Day': 'status-halfday',
            'Absent': 'status-absent',
            'On Leave': 'status-leave',
            'Holiday': 'status-holiday',
            'Weekly Off': 'status-weeklyoff'
        };
        return map[status] || '';
    };

    const calendarDays = [];
    for (let i = 0; i < firstDay; i++) calendarDays.push(null);
    for (let i = 1; i <= daysInMonth; i++) calendarDays.push(i);

    const handlePrev = () => {
        if (month === 1) onMonthChange(12, year - 1);
        else onMonthChange(month - 1, year);
    };

    const handleNext = () => {
        if (month === 12) onMonthChange(1, year + 1);
        else onMonthChange(month + 1, year);
    };

    return (
        <div className="calendar-card">
            <div className="calendar-header">
                <h3>{MONTHS[month - 1]} {year}</h3>
                <div className="calendar-nav">
                    <button className="btn btn-icon btn-secondary" onClick={handlePrev}><HiOutlineChevronLeft /></button>
                    <button className="btn btn-icon btn-secondary" onClick={handleNext}><HiOutlineChevronRight /></button>
                </div>
            </div>

            <div className="calendar-grid">
                {DAYS.map(d => <div key={d} className="calendar-day-label">{d}</div>)}
                {calendarDays.map((day, i) => {
                    const status = day ? getStatus(day) : null;
                    const isToday = day && new Date(year, month - 1, day).toDateString() === new Date().toDateString();

                    return (
                        <div key={i} className={`calendar-cell ${day ? '' : 'empty'} ${getStatusClass(status)} ${isToday ? 'today' : ''}`}>
                            {day && (
                                <>
                                    <span className="day-num">{day}</span>
                                    {status && <div className="status-dot"></div>}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="calendar-legend">
                <div className="legend-item"><span className="dot present"></span> Present</div>
                <div className="legend-item"><span className="dot late"></span> Late/Half-Day</div>
                <div className="legend-item"><span className="dot absent"></span> Absent</div>
                <div className="legend-item"><span className="dot leave"></span> Leave</div>
                <div className="legend-item"><span className="dot holiday"></span> Holiday</div>
                <div className="legend-item"><span className="dot weeklyoff"></span> Weekly Off</div>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .calendar-card { background: var(--bg-secondary); border-radius: 16px; padding: 24px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-color); }
                .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .calendar-header h3 { margin: 0; font-size: 1.25rem; font-weight: 700; color: var(--text-primary); }
                .calendar-nav { display: flex; gap: 8px; }
                
                .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; }
                .calendar-day-label { text-align: center; font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); padding: 8px 0; text-transform: uppercase; letter-spacing: 0.05em; }
                
                .calendar-cell { aspect-ratio: 1; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; font-weight: 600; font-size: 0.95rem; color: var(--text-secondary); transition: all 0.2s; background: var(--bg-primary); border: 1px solid var(--border-color); }
                .calendar-cell.empty { background: transparent; border: none; }
                .calendar-cell.today { border: 2px solid var(--primary); color: var(--primary); }
                
                .day-num { transform: translateY(-3px); }
                
                .status-dot { width: 6px; height: 6px; border-radius: 50%; position: absolute; bottom: 4px; }
                
                .status-present { background: rgba(34, 197, 94, 0.1); color: #16a34a; border-color: rgba(34, 197, 94, 0.2); }
                .status-present .status-dot { background: #22c55e; }
                
                .status-late, .status-halfday { background: rgba(234, 179, 8, 0.1); color: #ca8a04; border-color: rgba(234, 179, 8, 0.2); }
                .status-late .status-dot, .status-halfday .status-dot { background: #eab308; }
                
                .status-absent { background: rgba(239, 68, 68, 0.08); color: #dc2626; border-color: rgba(239, 68, 68, 0.15); }
                .status-absent .status-dot { background: #ef4444; }
                
                .status-leave { background: rgba(59, 130, 246, 0.1); color: #2563eb; border-color: rgba(59, 130, 246, 0.2); }
                .status-leave .status-dot { background: #3b82f6; }

                .status-holiday { background: rgba(139, 92, 246, 0.1); color: #7c3aed; border-color: rgba(139, 92, 246, 0.2); }
                .status-holiday .status-dot { background: #8b5cf6; }

                .status-weeklyoff { background: rgba(100, 116, 139, 0.1); color: #475569; border-color: rgba(100, 116, 139, 0.2); }
                .status-weeklyoff .status-dot { background: #64748b; }
                
                .calendar-legend { display: flex; gap: 20px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-color); flex-wrap: wrap; }
                .legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: var(--text-secondary); font-weight: 500; }
                .dot { width: 12px; height: 12px; border-radius: 50%; }
                .dot.present { background: #22c55e; }
                .dot.late { background: #eab308; }
                .dot.absent { background: #ef4444; }
                .dot.leave { background: #3b82f6; }
                .dot.holiday { background: #8b5cf6; }
                .dot.weeklyoff { background: #64748b; }

                @media (max-width: 480px) {
                    .calendar-cell { font-size: 0.85rem; border-radius: 8px; }
                    .day-num { transform: translateY(-4px); }
                    .status-dot { width: 5px; height: 5px; bottom: 3px; }
                    .calendar-card { padding: 16px; border-radius: 12px; }
                    .calendar-grid { gap: 6px; }
                }
            ` }} />
        </div>
    );
}
