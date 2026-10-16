import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { HiOutlinePlus, HiOutlineX } from 'react-icons/hi';

const LEAVE_TYPES = ['Casual', 'Sick', 'Earned', 'Unpaid', 'Other'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MyLeaves() {
    const [leaves, setLeaves] = useState([]);
    const [balance, setBalance] = useState({});
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");
    const [years, setYears] = useState([]);
    const [form, setForm] = useState({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
    const [typeFilter, setTypeFilter] = useState("");

    const [balanceHistory, setBalanceHistory] = useState([]);
    const [historyTab, setHistoryTab] = useState('requests');
    const [isMultiDay, setIsMultiDay] = useState(false);

    const fetchInitial = async () => {
        try {
            const [balRes, yearsRes] = await Promise.all([
                api.get('/leaves/balance'),
                api.get('/payroll-years')
            ]);
            setBalance(balRes.data.data || {});
            const yearsList = yearsRes.data.data || [];
            setYears(yearsList);
            fetchBalanceHistory();
        } catch { }
        setLoading(false);
    };

    const fetchBalanceHistory = async () => {
        try {
            const { data } = await api.get('/leaves/balance-history');
            setBalanceHistory(data.data || []);
        } catch { }
    };

    const fetchFilteredLeaves = async () => {
        setDataLoading(true);
        try {
            const { data } = await api.get('/leaves/my', { params: { month, year } });
            setLeaves(data.data || []);
        } catch { setLeaves([]); }
        setDataLoading(false);
    };

    useEffect(() => { fetchInitial(); }, []);
    useEffect(() => { fetchFilteredLeaves(); }, [month, year]);

    const handleApply = async (e) => {
        e.preventDefault();
        const payload = { ...form };
        if (!isMultiDay) {
            payload.endDate = payload.startDate;
        }
        try {
            await api.post('/leaves', payload);
            setShowModal(false);
            setForm({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
            setIsMultiDay(false);
            fetchFilteredLeaves();
            // Refresh balance
            const balRes = await api.get('/leaves/balance');
            setBalance(balRes.data.data || {});
            toast.success("Leave applied successfully!");
        } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const statusBadge = (s) => {
        const map = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger', Cancelled: 'badge-neutral' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    const typeBadge = (t) => {
        const map = { Casual: 'badge-info', Sick: 'badge-danger', Earned: 'badge-success', Unpaid: 'badge-neutral', Maternity: 'badge-primary', Paternity: 'badge-primary', Other: 'badge-primary' };
        return <span className={`badge ${map[t] || 'badge-neutral'}`}>{t}</span>;
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const filteredLeaves = leaves.filter(l => !typeFilter || l.leaveType === typeFilter);

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <style>{`
                .leaves-header-actions {
                    display: flex; gap: 10px; align-items: center; flex-wrap: wrap; flex: 1 1 auto; justify-content: flex-end;
                }
                @media (max-width: 768px) {
                    .leaves-header-actions { justify-content: center; }
                }
            `}</style>
            <div className="page-header" style={{ flexWrap: 'wrap', gap: 16 }}>
                <div><h1>My Leaves</h1><p>Apply for leave and view your balance</p></div>
                <div className="leaves-header-actions">
                    <select
                        className="form-control"
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        style={{ flex: '1 1 auto', minWidth: 110, maxWidth: 160 }}
                    >
                        <option value="">All Types</option>
                        <option value="Sick">Sick Leave</option>
                        <option value="Unpaid">Unpaid Leave</option>
                        <option value="Earned">Earned Leave</option>
                        <option value="Casual">Casual Leave</option>
                        <option value="Other">Other Leave</option>
                    </select>
                    <select className="form-control" value={month} onChange={e => setMonth(e.target.value)} style={{ flex: '1 1 auto', minWidth: 100, maxWidth: 140 }}>
                        <option value="">All Months</option>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="form-control" value={year} onChange={e => setYear(e.target.value)} style={{ flex: '1 1 auto', minWidth: 90, maxWidth: 120 }}>
                        <option value="">All Years</option>
                        {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                        {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                    </select>
                    <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><HiOutlinePlus /> Apply Leave</button>
                </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                {[
                    { label: 'Casual Leave', val: balance.casual ?? 12, color: 'blue' },
                    { label: 'Sick Leave', val: balance.sick ?? 12, color: 'red' },
                    { label: 'Earned Leave', val: balance.earned ?? 15, color: 'green' },
                    { label: 'Other Leave', val: balance.other ?? 0, color: 'purple' },
                ].map(b => (
                    <div key={b.label} className={`stat-card ${b.color}`}>
                        <div className="stat-content">
                            <div className="stat-label">{b.label}</div>
                            <div className="stat-value">{b.val}</div>
                            <div className="stat-change">days remaining</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="table-container">
                <div className="table-header" style={{ display: 'flex', gap: 24, alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 0, flexWrap: 'nowrap', overflowX: 'auto' }}>
                    <h3
                        onClick={() => setHistoryTab('requests')}
                        style={{
                            cursor: 'pointer',
                            paddingBottom: 12,
                            marginBottom: -1,
                            borderBottom: historyTab === 'requests' ? '3px solid var(--primary)' : '3px solid transparent',
                            color: historyTab === 'requests' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            fontWeight: 700,
                            fontSize: 14,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Leave Applications
                    </h3>
                    <h3
                        onClick={() => setHistoryTab('adjustments')}
                        style={{
                            cursor: 'pointer',
                            paddingBottom: 12,
                            marginBottom: -1,
                            borderBottom: historyTab === 'adjustments' ? '3px solid var(--primary)' : '3px solid transparent',
                            color: historyTab === 'adjustments' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            fontWeight: 700,
                            fontSize: 14,
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Balance Adjustment Log
                    </h3>
                </div>
                <div style={{ position: 'relative', overflowX: 'auto' }}>
                    {dataLoading && (
                        <div style={{
                            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                            borderRadius: 12, backdropFilter: 'blur(1px)'
                        }}>
                            <div className="spinner" style={{ width: 30, height: 30 }}></div>
                        </div>
                    )}
                    <table>
                        {historyTab === 'requests' ? (
                            <>
                                <thead><tr><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead>
                                <tbody>
                                    {filteredLeaves.map(l => (
                                        <tr key={l._id}>
                                            <td>{typeBadge(l.leaveType)}</td>
                                            <td>{formatDate(l.startDate)}</td>
                                            <td>{formatDate(l.endDate)}</td>
                                            <td style={{ fontWeight: 700 }}>{l.totalDays}</td>
                                            <td>
                                                {l.reason ? (
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: '11px', padding: '3px 10px', color: '#4f46e5', fontWeight: 600 }}
                                                        onClick={() => Swal.fire({
                                                            title: 'Leave Reason',
                                                            html: `<div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:13px;color:#334155;line-height:1.6;">${l.reason.replace(/\n/g, '<br/>')}</div>`,
                                                            confirmButtonText: 'Close'
                                                        })}
                                                    >
                                                        View
                                                    </button>
                                                ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                                            </td>
                                            <td>
                                                {statusBadge(l.status)}
                                                {l.status === 'Rejected' && l.approverComments && (
                                                    <div style={{ marginTop: 4 }}>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            style={{ fontSize: '10px', padding: '2px 8px', color: '#dc2626', fontWeight: 600 }}
                                                            onClick={() => Swal.fire({
                                                                title: 'Rejection Reason',
                                                                html: `<div style="text-align:left;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:14px;font-size:13px;color:#991b1b;line-height:1.6;">${l.approverComments.replace(/\n/g, '<br/>')}</div>`,
                                                                confirmButtonText: 'Close'
                                                            })}
                                                        >
                                                            View Reason
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredLeaves.length === 0 && <tr><td colSpan="6"><div className="empty-state"><h3>No leave records found for this period</h3></div></td></tr>}
                                </tbody>
                            </>
                        ) : (
                            <>
                                <thead><tr><th>Date</th><th>Leave Type</th><th>Operation</th><th>Amount</th><th>Old Balance</th><th>New Balance</th><th>Action By</th></tr></thead>
                                <tbody>
                                    {balanceHistory.map(h => (
                                        <tr key={h._id}>
                                            <td>{formatDate(h.createdAt)}</td>
                                            <td>{typeBadge(h.leaveType)}</td>
                                            <td>
                                                <span className={`badge ${h.operation === 'add' ? 'badge-success' : 'badge-neutral'}`}>
                                                    {h.operation === 'add' ? 'Add/Deduct' : 'Override Set'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: 700, color: h.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                {h.amount >= 0 ? `+${h.amount}` : h.amount} days
                                            </td>
                                            <td>{h.beforeBalance} days</td>
                                            <td style={{ fontWeight: 700 }}>{h.afterBalance} days</td>
                                            <td>
                                                <span style={{ fontSize: 13, fontWeight: 500 }}>
                                                    {h.adjustedBy?.role === 'SuperAdmin' ? 'Super Admin' : (h.adjustedBy?.role || 'Admin')}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {balanceHistory.length === 0 && <tr><td colSpan="7"><div className="empty-state"><h3>No adjustments recorded yet</h3></div></td></tr>}
                                </tbody>
                            </>
                        )}
                    </table>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Apply for Leave</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}><HiOutlineX /></button></div>
                        <form onSubmit={handleApply}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Leave Type</label>
                                    <select className="form-control" value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })}>
                                        {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        <input
                                            type="checkbox"
                                            checked={isMultiDay}
                                            onChange={e => {
                                                setIsMultiDay(e.target.checked);
                                                if (!e.target.checked) {
                                                    setForm(prev => ({ ...prev, endDate: prev.startDate }));
                                                }
                                            }}
                                        />
                                        Multiple Days / Multi-Day Leave
                                    </label>
                                </div>
                                {isMultiDay ? (
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Start Date</label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={form.startDate}
                                                min={new Date().toISOString().split('T')[0]}
                                                onChange={e => setForm({ ...form, startDate: e.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">End Date</label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                value={form.endDate}
                                                min={form.startDate || new Date().toISOString().split('T')[0]}
                                                onChange={e => setForm({ ...form, endDate: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">Date</label>
                                        <input
                                            type="date"
                                            className="form-control"
                                            value={form.startDate}
                                            min={new Date().toISOString().split('T')[0]}
                                            onChange={e => setForm({ ...form, startDate: e.target.value, endDate: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}
                                <div className="form-group"><label className="form-label">Reason</label><textarea className="form-control" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Submit</button></div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
