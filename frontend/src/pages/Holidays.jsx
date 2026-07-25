import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineSearch, HiOutlineChevronLeft, HiOutlineChevronRight, HiOutlineRefresh, HiOutlineDownload } from 'react-icons/hi';

// ── Constants ────────────────────────────────────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TYPE_META = {
    Public: { bg: '#FFF0ED', color: '#B03510', border: '#FFC8BA', label: 'Public' },
    Government: { bg: '#FFF8E6', color: '#8F5E00', border: '#FFE5A1', label: 'Government' },
    Company: { bg: '#F2F1FF', color: '#4A3AFF', border: '#D6D4FF', label: 'Company' },
};

const YEARS = [2024, 2025, 2026, 2027, 2028];

export default function Holidays() {
    const [holidays, setHolidays] = useState([]);
    const [loading, setLoading] = useState(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());
    const [tab, setTab] = useState('monthly');
    const [filling, setFilling] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState(null);
    const [isRange, setIsRange] = useState(false);
    const [form, setForm] = useState({ name: '', date: '', endDate: '', type: 'Public', description: '' });
    const todayStr = new Date().toISOString().split('T')[0];
    const [submitting, setSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [ftType, setFtType] = useState('');
    const [ftSrc, setFtSrc] = useState('');

    const fetchHolidays = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/holidays', { params: { year } });
            setHolidays(data.data || []);
        } catch (err) {
            console.error('Error fetching holidays:', err);
        }
        setLoading(false);
    }, [year]);

    useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

    // ── Helpers ───────────────────────────────────────────────
    const monthHols = holidays
        .filter(h => { const d = new Date(h.date); return d.getFullYear() === year && d.getMonth() === month; })
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const calCells = () => {
        const fd = new Date(year, month, 1).getDay();
        const dim = new Date(year, month + 1, 0).getDate();
        const cells = Array(fd).fill(null);
        for (let d = 1; d <= dim; d++) cells.push(d);
        return cells;
    };

    const holsForDay = (d) => {
        if (!d) return [];
        return holidays.filter(h => {
            const hDate = new Date(h.date);
            return hDate.getDate() === d &&
                hDate.getMonth() === month &&
                hDate.getFullYear() === year;
        });
    };

    const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

    const filtered = holidays
        .filter(h => h.name.toLowerCase().includes(search.toLowerCase()))
        .filter(h => !ftType || h.type === ftType)
        .filter(h => !ftSrc || (ftSrc === 'auto' ? h.source === 'auto' : h.source !== 'auto'))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const stats = [
        { n: holidays.length, l: `Total (${year})` },
        { n: monthHols.length, l: `${MONTHS[month].slice(0, 3)} Month` },
        { n: holidays.filter(h => h.type === 'Public').length, l: 'Public' },
        { n: holidays.filter(h => h.source === 'auto').length, l: 'From Calendarific' },
    ];

    // ── Auto-fill ─────────────────────────────────────────────
    const handleAutoFill = async () => {
        setFilling(true);
        try {
            const { data } = await api.post('/holidays/auto-fill', { year });
            toast.success(data.message || 'Auto-fill complete!');
            fetchHolidays();
        } catch (e) {
            toast.error(e.response?.data?.message || 'Auto-fill failed. Check API key in .env');
        } finally { setFilling(false); }
    };

    // ── Modal helpers ─────────────────────────────────────────
    const openAdd = () => { setForm({ name: '', date: '', type: 'Public', description: '' }); setEditingHoliday(null); setShowModal(true); };
    const openEdit = (h) => { setForm({ name: h.name, date: h.date.split('T')[0], type: h.type, description: h.description || '' }); setEditingHoliday(h); setShowModal(true); };
    const closeModal = () => {
        setShowModal(false);
        setEditingHoliday(null);
        setIsRange(false);
        setForm({ name: '', date: '', endDate: '', type: 'Public', description: '' });
    };

    // ── Save ──────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) { toast.error('Holiday name is required'); return; }
        if (!form.date) { toast.error('Start date is required'); return; }
        if (isRange && !form.endDate) { toast.error('End date is required'); return; }

        setSubmitting(true);
        try {
            if (editingHoliday) {
                await api.put(`/holidays/${editingHoliday._id}`, form);
                toast.success('Holiday updated!');
            } else {
                if (isRange && form.endDate) {
                    const start = new Date(form.date);
                    const end = new Date(form.endDate);
                    if (end < start) { toast.error('End date cannot be before start date'); setSubmitting(false); return; }

                    const dates = [];
                    let curr = new Date(start);
                    while (curr <= end) {
                        dates.push(new Date(curr).toISOString().split('T')[0]);
                        curr.setDate(curr.getDate() + 1);
                    }

                    await Promise.all(dates.map(date =>
                        api.post('/holidays', { ...form, date })
                    ));
                    toast.success(`${dates.length} holidays created!`);
                } else {
                    await api.post('/holidays', form);
                    toast.success('Holiday created!');
                }
            }
            closeModal();
            fetchHolidays();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed');
        }
        setSubmitting(false);
    };

    // ── Delete ────────────────────────────────────────────────
    const handleDelete = async (h) => {
        const result = await Swal.fire({
            title: 'Delete Holiday?',
            html: `Are you sure you want to delete <strong>"${h.name}"</strong>?<br/><small style="color:#888">This may affect payroll for ${new Date(h.date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}.</small>`,
            icon: 'warning', showCancelButton: true, confirmButtonColor: '#e53e3e', cancelButtonColor: '#6C63FF', confirmButtonText: 'Delete'
        });
        if (!result.isConfirmed) return;
        try {
            await api.delete(`/holidays/${h._id}`);
            toast.success('Holiday deleted');
            fetchHolidays();
        } catch (err) { toast.error('Delete failed'); }
    };

    // ─────────────────────────────────────────────────────────
    return (
        <div className="animate-fadeIn hm-wrap">
            {/* Header */}
            <div className="hm-header">
                <div>
                    <h1 className="hm-title">Holiday Management</h1>
                    <p className="hm-sub">Manage public and company holidays · Powered by Calendarific</p>
                </div>
                <button className="btn btn-primary" onClick={openAdd}><HiOutlinePlus /> Add Holiday</button>
            </div>

            {/* Controls */}
            <div className="hm-controls">
                <div className="hm-year-select-wrapper">
                    <label className="hm-year-label">Year:</label>
                    <input
                        type="number"
                        className="hm-year-input"
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        min="2000"
                        max="2100"
                    />
                </div>

                <button className="btn-autofill" onClick={handleAutoFill} disabled={filling}>
                    {filling
                        ? <><HiOutlineRefresh className="spin-icon" /> Fetching from Calendarific...</>
                        : <><HiOutlineDownload /> Auto-fill {year} Holidays</>}
                </button>

                <div className="hm-view-tabs">
                    {['monthly', 'yearly', 'manage'].map(t => (
                        <button key={t} className={`hm-vtab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="hm-stats">
                {stats.map((s, i) => (
                    <div key={i} className="hm-stat-card">
                        <div className="hm-stat-n">{s.n}</div>
                        <div className="hm-stat-l">{s.l}</div>
                    </div>
                ))}
            </div>

            {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                <>
                    {/* ═══ TAB: MONTHLY ══════════════════════════════════ */}
                    {tab === 'monthly' && (
                        <div className="hm-monthly">
                            {/* Calendar */}
                            <div className="hm-cal-area">
                                <div className="hm-cal-nav">
                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}><HiOutlineChevronLeft /></button>
                                    <span className="hm-cal-nav-title">{MONTHS[month]} {year}</span>
                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}><HiOutlineChevronRight /></button>
                                </div>
                                <div className="hm-wday-row">
                                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="hm-wday">{d}</div>)}
                                </div>
                                <div className="hm-day-grid">
                                    {calCells().map((d, i) => {
                                        const dayHols = holsForDay(d);
                                        const hasHols = dayHols.length > 0;
                                        // Pick the primary type for cell color
                                        const primaryHol = dayHols[0];
                                        const tm = primaryHol ? (TYPE_META[primaryHol.type] || TYPE_META[primaryHol.type.charAt(0).toUpperCase() + primaryHol.type.slice(1).toLowerCase()] || TYPE_META.Public) : null;
                                        const dow = d ? new Date(year, month, d).getDay() : -1;
                                        const isSunday = dow === 0;
                                        return (
                                            <div key={i}
                                                className={`hm-day-cell${!d ? ' hm-empty' : ''}${hasHols ? ` hm-h-cell hm-cell-${primaryHol.type.toLowerCase()}` : ''}${!hasHols && isToday(d) ? ' hm-cell-today' : ''}${!hasHols && isSunday ? ' hm-cell-sunday' : ''}`}
                                                style={{ overflow: 'hidden' }}
                                                title={dayHols.map(h => h.name).join(' & ')}
                                                onClick={() => hasHols && openEdit(primaryHol)}
                                            >
                                                <span className="hm-day-n" style={
                                                    hasHols ? { color: tm.color, fontWeight: 600 } :
                                                        isToday(d) ? { color: '#0C447C', fontWeight: 700 } :
                                                            isSunday ? { color: '#3B6D11' } : {}
                                                }>{d || ''}</span>
                                                {dayHols.map(h => (
                                                    <div key={h._id} style={{
                                                        marginTop: 2, padding: '1px 5px', borderRadius: 4,
                                                        background: (TYPE_META[h.type] || TYPE_META[h.type.charAt(0).toUpperCase() + h.type.slice(1).toLowerCase()] || TYPE_META.Public).color,
                                                        color: 'white',
                                                        fontSize: 9, fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                                        maxWidth: '100%', textAlign: 'center'
                                                    }}>
                                                        {h.name}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="hm-sidebar">
                                <div className="hm-sb-head">
                                    <span>{MONTHS[month]} Holidays</span>
                                    <span className="hm-sb-cnt">{monthHols.length} total</span>
                                </div>
                                <div className="hm-sb-list">
                                    {monthHols.length === 0
                                        ? <div className="empty-state" style={{ padding: '2rem 1rem' }}><div className="empty-icon">🏖️</div><p>No holidays this month</p></div>
                                        : monthHols.map(h => {
                                            const tm = TYPE_META[h.type] || TYPE_META.Public;
                                            const d = new Date(h.date);
                                            return (
                                                <div key={h._id} className="hm-sb-item">
                                                    <span className="hm-sb-badge" style={{ background: tm.bg, color: tm.color }}>
                                                        {MONTHS[d.getMonth()].slice(0, 3)}<br />{String(d.getDate()).padStart(2, '0')}
                                                    </span>
                                                    <div className="hm-sb-info">
                                                        <div className="hm-sb-name">
                                                            {h.name}
                                                        </div>
                                                        <div className="hm-sb-dt">{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                                                    </div>
                                                    <div className="hm-sb-acts">
                                                        <button className="btn btn-icon btn-secondary btn-sm" onClick={() => openEdit(h)} title="Edit"><HiOutlinePencil /></button>
                                                        <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleDelete(h)} title="Delete"><HiOutlineTrash /></button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }
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
                                        Weekly Off
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ TAB: YEARLY ═══════════════════════════════════ */}
                    {tab === 'yearly' && (
                        <div className="hm-yr-grid">
                            {Array.from({ length: 12 }, (_, m) => {
                                const fd = new Date(year, m, 1).getDay();
                                const dim = new Date(year, m + 1, 0).getDate();
                                const mHols = holidays.filter(h => { const d = new Date(h.date); return d.getMonth() === m && d.getFullYear() === year; });
                                return (
                                    <div key={m} className="hm-mini-cal" onClick={() => { setMonth(m); setTab('monthly'); }} style={{ cursor: 'pointer' }}>
                                        <div className="hm-mini-title">
                                            {MONTHS[m].slice(0, 3)}
                                            {mHols.length > 0 && <span className="hm-mini-cnt"> ({mHols.length})</span>}
                                        </div>
                                        <div className="hm-mini-wds">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <div key={i} className="hm-mwd">{x}</div>)}</div>
                                        <div className="hm-mini-days">
                                            {Array(fd).fill(null).map((_, i) => <div key={'e' + i} />)}
                                            {Array.from({ length: dim }, (_, i) => {
                                                const d = i + 1;
                                                const ds = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                                const hol = holidays.find(h => h.date.split('T')[0] === ds);
                                                const dow = new Date(year, m, d).getDay();
                                                const tm = hol ? (TYPE_META[hol.type] || TYPE_META.Public) : null;
                                                return (
                                                    <div key={d} className="hm-mday"
                                                        style={hol ? { background: tm.bg, color: tm.color, fontWeight: 600, borderRadius: 3 } : dow === 0 || dow === 6 ? { color: '#3B6D11' } : {}}
                                                        title={hol?.name}>
                                                        {d}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ═══ TAB: MANAGE ═══════════════════════════════════ */}
                    {tab === 'manage' && (
                        <div>
                            <div className="hm-manage-bar">
                                <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                                    <HiOutlineSearch style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
                                    <input className="form-control" style={{ paddingLeft: 32 }} placeholder="Search holidays..." value={search} onChange={e => setSearch(e.target.value)} />
                                </div>
                                <select className="form-control" style={{ width: 'auto' }} value={ftType} onChange={e => setFtType(e.target.value)}>
                                    <option value="">All Types</option>
                                    <option value="Public">Public</option>
                                    <option value="Government">Government</option>
                                    <option value="Company">Company</option>
                                </select>
                                <select className="form-control" style={{ width: 'auto' }} value={ftSrc} onChange={e => setFtSrc(e.target.value)}>
                                    <option value="">All Sources</option>
                                    <option value="auto">Calendarific (Auto)</option>
                                    <option value="manual">HR (Manual)</option>
                                </select>
                            </div>
                            <div className="table-container">
                                <div style={{ overflowX: 'auto' }}>
                                    <table>
                                        <thead>
                                            <tr><th>Date</th><th>Holiday Name</th><th>Type</th><th>Source</th><th>Description</th><th>Actions</th></tr>
                                        </thead>
                                        <tbody>
                                            {filtered.length === 0
                                                ? <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">🔍</div><p>No holidays found</p></div></td></tr>
                                                : filtered.map(h => {
                                                    const tm = TYPE_META[h.type] || TYPE_META.Public;
                                                    return (
                                                        <tr key={h._id}>
                                                            <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(h.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                                            <td><strong>{h.name}</strong>{h.source === 'auto' && <span className="hm-auto-tag" style={{ marginLeft: 6 }}>Auto</span>}</td>
                                                            <td><span className="badge" style={{ background: tm.bg, color: tm.color, border: `1px solid ${tm.border}` }}>{tm.label}</span></td>
                                                            <td style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{h.source === 'auto' ? 'Calendarific' : 'Manual'}</td>
                                                            <td style={{ color: 'var(--text-tertiary)', fontSize: 13, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.description || '—'}</td>
                                                            <td>
                                                                <div style={{ display: 'flex', gap: 6 }}>
                                                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={() => openEdit(h)}><HiOutlinePencil /></button>
                                                                    <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleDelete(h)}><HiOutlineTrash /></button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══ ADD / EDIT MODAL ══════════════════════════════ */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={closeModal}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Holiday Name *</label>
                                    <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Diwali" />
                                </div>
                                <div className="form-group" style={{ marginBottom: 15 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                                        <input type="checkbox" checked={isRange} onChange={e => setIsRange(e.target.checked)} disabled={!!editingHoliday} />
                                        Multiple Days / Date Range
                                    </label>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: isRange ? '1fr 1fr' : '1fr', gap: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">{isRange ? 'Start Date *' : 'Date *'}</label>
                                        <input type="date" className="form-control" value={form.date} min={todayStr} onChange={e => setForm({ ...form, date: e.target.value })} required />
                                    </div>
                                    {isRange && (
                                        <div className="form-group">
                                            <label className="form-label">End Date *</label>
                                            <input type="date" className="form-control" value={form.endDate} min={form.date} onChange={e => setForm({ ...form, endDate: e.target.value })} required />
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type *</label>
                                    <select className="form-control" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                                        <option value="Public">Public (Mandatory Off)</option>
                                        <option value="Government">Government (State/Central)</option>
                                        <option value="Company">Company Holiday</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea className="form-control" rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details about the holiday..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Create Holiday'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
