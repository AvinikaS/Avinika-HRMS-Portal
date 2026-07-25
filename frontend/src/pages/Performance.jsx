import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import EmployeeSelect from '../components/EmployeeSelect';
import { HiOutlinePlus, HiOutlineX, HiOutlinePencil, HiOutlineEye, HiOutlineCheck, HiOutlineChevronRight, HiOutlineCog, HiOutlineTrash } from 'react-icons/hi';

const PERIODS = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)', 'H1 (Jan-Jun)', 'H2 (Jul-Dec)', 'Annual'];
const STATUSES = ['Draft', 'Self Review', 'Manager Review', 'Completed'];
const STATUS_COLORS = { Draft: '#94a3b8', 'Self Review': '#6366f1', 'Manager Review': '#f59e0b', Completed: '#10b981' };
const RATING_LABELS = ['', 'Needs Improvement', 'Below Expectations', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];

export default function Performance() {
    const [reviews, setReviews] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedReview, setSelectedReview] = useState(null);
    const [editing, setEditing] = useState(false);
    const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
    const [statusFilter, setStatusFilter] = useState('');
    const [years, setYears] = useState([]);
    const [showYearModal, setShowYearModal] = useState(false);
    const [yearForm, setYearForm] = useState({ year: '' });
    const [editingYear, setEditingYear] = useState(null);
    const [yearLoading, setYearLoading] = useState(false);

    const [selectedDept, setSelectedDept] = useState('');
    const [isBulk, setIsBulk] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);

    const [form, setForm] = useState({
        employee: '', reviewPeriod: 'Annual', year: new Date().getFullYear(),
        goals: [{ title: '', description: '', weightage: 100, selfRating: 0, managerRating: 0, status: 'Not Started' }],
        overallRating: 0, selfComments: '', reviewerComments: '', status: 'Draft'
    });

    const fetchData = async () => {
        try {
            const [revRes, empRes] = await Promise.all([
                api.get('/performance', { params: { year: yearFilter } }),
                api.get('/employees')
            ]);
            setReviews(revRes.data.data || []);
            setEmployees(empRes.data.data || []);
        } catch { }
        setLoading(false);
    };

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/performance-years');
            const yearsList = data.data || [];
            setYears(yearsList);
            if (yearsList.length > 0 && !yearsList.some(y => y.year === yearFilter)) {
                setYearFilter(yearsList[0].year);
            }
        } catch { }
    };

    useEffect(() => { fetchYears(); }, []);
    useEffect(() => { fetchData(); }, [yearFilter]);

    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
    const filteredEmployees = selectedDept ? employees.filter(e => e.department === selectedDept) : employees;

    // ---- Create Review ----
    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            if (isBulk) {
                if (selectedEmployees.length === 0) return toast.error('Please select at least one employee');
                const reqs = selectedEmployees.map(empId => api.post('/performance', { ...form, employee: empId }));
                await Promise.all(reqs);
                toast.success(`Created ${selectedEmployees.length} reviews`);
            } else {
                if (!form.employee) return toast.error('Please select an employee');
                await api.post('/performance', form);
                toast.success('Performance review created');
            }
            setShowCreateModal(false);
            resetForm();
            setSelectedEmployees([]);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error creating review'); }
    };

    // ---- Update Review ----
    const handleUpdate = async () => {
        try {
            await api.put(`/performance/${selectedReview._id}`, form);
            setEditing(false);
            fetchData();
            // Refresh detail
            const { data } = await api.get(`/performance/${selectedReview._id}`);
            setSelectedReview(data.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Error updating review'); }
    };

    // ---- Workflow Transition ----
    const advanceStatus = async (review) => {
        const idx = STATUSES.indexOf(review.status);
        if (idx >= STATUSES.length - 1) return;
        const nextStatus = STATUSES[idx + 1];
        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: `Move review to "${nextStatus}"?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
        if (!_swalRes.isConfirmed) return;
        try {
            await api.put(`/performance/${review._id}`, { status: nextStatus });
            fetchData();
            if (selectedReview?._id === review._id) {
                setSelectedReview({ ...selectedReview, status: nextStatus });
            }
        } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const resetForm = () => setForm({
        employee: '', reviewPeriod: 'Annual', year: new Date().getFullYear(),
        goals: [{ title: '', description: '', weightage: 100, selfRating: 0, managerRating: 0, status: 'Not Started' }],
        overallRating: 0, selfComments: '', reviewerComments: '', status: 'Draft'
    });

    const openDetail = (review) => {
        setSelectedReview(review);
        setForm({
            employee: review.employee?._id || '',
            reviewPeriod: review.reviewPeriod,
            year: review.year,
            goals: review.goals || [],
            overallRating: review.overallRating || 0,
            selfComments: review.selfComments || '',
            reviewerComments: review.reviewerComments || '',
            status: review.status
        });
        setEditing(false);
        setShowDetailModal(true);
    };

    // ---- Goal Helpers ----
    const addGoal = () => setForm({ ...form, goals: [...form.goals, { title: '', description: '', weightage: 0, selfRating: 0, managerRating: 0, status: 'Not Started' }] });
    const removeGoal = (idx) => setForm({ ...form, goals: form.goals.filter((_, i) => i !== idx) });
    const updateGoal = (idx, field, value) => {
        const goals = [...form.goals];
        goals[idx] = { ...goals[idx], [field]: value };
        setForm({ ...form, goals });
    };

    // ---- Star Rating Component ----
    const StarRating = ({ value, onChange, readonly, size = 22 }) => (
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {[1, 2, 3, 4, 5].map(star => (
                <span key={star} onClick={() => !readonly && onChange(star)}
                    style={{ fontSize: size, cursor: readonly ? 'default' : 'pointer', color: star <= value ? '#f59e0b' : '#334155', transition: 'color .15s' }}>★</span>
            ))}
            {value > 0 && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{RATING_LABELS[value]}</span>}
        </div>
    );

    // ---- Stats ----
    const stats = {
        total: reviews.length,
        draft: reviews.filter(r => r.status === 'Draft').length,
        inProgress: reviews.filter(r => r.status === 'Self Review' || r.status === 'Manager Review').length,
        completed: reviews.filter(r => r.status === 'Completed').length,
        avgRating: reviews.filter(r => r.overallRating).length > 0
            ? (reviews.reduce((s, r) => s + (r.overallRating || 0), 0) / reviews.filter(r => r.overallRating).length).toFixed(1) : '—'
    };

    const filtered = statusFilter ? reviews.filter(r => r.status === statusFilter) : reviews;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Performance Reviews</h1><p>Manage employee performance reviews, goals, and ratings</p></div>
                <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }}><HiOutlinePlus /> New Review</button>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                    { label: 'Total Reviews', value: stats.total, icon: '📊', color: '#6366f1' },
                    { label: 'Draft', value: stats.draft, icon: '📝', color: '#94a3b8' },
                    { label: 'In Progress', value: stats.inProgress, icon: '⏳', color: '#f59e0b' },
                    { label: 'Completed', value: stats.completed, icon: '✅', color: '#10b981' },
                    { label: 'Avg Rating', value: stats.avgRating, icon: '⭐', color: '#f59e0b' }
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ fontSize: 28 }}>{s.icon}</div>
                        <div><div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</div></div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <select className="form-control" style={{ width: 120 }} value={yearFilter} onChange={e => setYearFilter(+e.target.value)}>
                        {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                    </select>
                    <button className="btn btn-icon btn-secondary" onClick={() => setShowYearModal(true)} title="Manage Years">
                        <HiOutlineCog />
                    </button>
                </div>
                <select className="form-control" style={{ minWidth: 160, flex: 1, maxWidth: 'max-content' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                    <option value="">All Statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{filtered.length} review{filtered.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Reviews Table */}
            <div className="table-container">
                <div className="table-header"><h3>Performance Reviews — {yearFilter}</h3></div>
                {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead><tr><th>Employee</th><th>Department</th><th>Period</th><th>Goals</th><th>Rating</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan="7"><div className="empty-state"><div className="empty-icon">📊</div><h3>No performance reviews</h3><p>Click "New Review" to create your first review</p></div></td></tr>
                                ) : filtered.map(r => (
                                    <tr key={r._id}>
                                        <td style={{ fontWeight: 600 }}>{r.employee?.firstName} {r.employee?.lastName}<br /><span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{r.employee?.employeeCode}</span></td>
                                        <td>{r.employee?.department}</td>
                                        <td>{r.reviewPeriod}</td>
                                        <td><span className="badge badge-neutral">{r.goals?.length || 0} goals</span></td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                <span style={{ color: '#f59e0b', fontSize: 15 }}>{'★'.repeat(r.overallRating || 0)}{'☆'.repeat(5 - (r.overallRating || 0))}</span>
                                                {r.overallRating > 0 && <span style={{ fontSize: 12, fontWeight: 700 }}>{r.overallRating}/5</span>}
                                            </div>
                                        </td>
                                        <td><span className="badge" style={{ background: STATUS_COLORS[r.status] + '20', color: STATUS_COLORS[r.status], fontWeight: 600 }}>{r.status}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-sm btn-secondary" onClick={() => openDetail(r)} title="View"><HiOutlineEye /></button>
                                                {r.status !== 'Completed' && (
                                                    <button className="btn btn-sm btn-primary" onClick={() => advanceStatus(r)} title={`Move to ${STATUSES[STATUSES.indexOf(r.status) + 1]}`}>
                                                        <HiOutlineChevronRight />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ============ CREATE REVIEW MODAL ============ */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header"><h2>📊 New Performance Review</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowCreateModal(false)}><HiOutlineX /></button></div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Filter by Department</label>
                                        <select className="form-control" value={selectedDept} onChange={e => {
                                            setSelectedDept(e.target.value);
                                            setForm({ ...form, employee: '' });
                                            setSelectedEmployees([]);
                                        }}>
                                            <option value="">All Departments</option>
                                            {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 2 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <label className="form-label" style={{ margin: 0 }}>Employee *</label>
                                            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#4f46e5' }}>
                                                <input type="checkbox" checked={isBulk} onChange={e => setIsBulk(e.target.checked)} />
                                                Bulk Select Mode
                                            </label>
                                        </div>
                                        {isBulk ? (
                                            <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                                                <div style={{ display: 'flex', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
                                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedEmployees(filteredEmployees.map(e => e._id))}>Select All</button>
                                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedEmployees([])}>Clear</button>
                                                    <span style={{ fontSize: 12, marginLeft: 'auto', alignSelf: 'center', color: '#64748b' }}>{selectedEmployees.length} selected</span>
                                                </div>
                                                {filteredEmployees.map(e => (
                                                    <label key={e._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 13 }}>
                                                        <input type="checkbox" checked={selectedEmployees.includes(e._id)} onChange={(evt) => {
                                                            if (evt.target.checked) setSelectedEmployees([...selectedEmployees, e._id]);
                                                            else setSelectedEmployees(selectedEmployees.filter(id => id !== e._id));
                                                        }} />
                                                        {e.firstName} {e.lastName} ({e.employeeCode})
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmployeeSelect
                                                employees={filteredEmployees}
                                                value={form.employee}
                                                onChange={val => setForm({ ...form, employee: val })}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="form-row" style={{ marginTop: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Period</label>
                                        <select className="form-control" value={form.reviewPeriod} onChange={e => setForm({ ...form, reviewPeriod: e.target.value })}>
                                            {PERIODS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Year</label>
                                        <select className="form-control" value={form.year} onChange={e => setForm({ ...form, year: +e.target.value })}>
                                            {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Goals */}
                                <div style={{ marginTop: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <label className="form-label" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>🎯 Goals & KRAs</label>
                                        <button type="button" className="btn btn-sm btn-secondary" onClick={addGoal}><HiOutlinePlus /> Add Goal</button>
                                    </div>
                                    {form.goals.map((goal, idx) => (
                                        <div key={idx} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, paddingRight: 36, marginBottom: 10, position: 'relative' }}>
                                            {form.goals.length > 1 && (
                                                <button type="button" onClick={() => removeGoal(idx)} style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#f1f5f9', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                                            )}
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: 2 }}><input className="form-control" placeholder="Goal title *" required value={goal.title} onChange={e => updateGoal(idx, 'title', e.target.value)} /></div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <input className="form-control" type="number" placeholder="Weightage %" min={0} max={100} value={goal.weightage} onChange={e => updateGoal(idx, 'weightage', +e.target.value)} />
                                                </div>
                                                <div className="form-group" style={{ flex: 1 }}>
                                                    <select className="form-control" value={goal.status} onChange={e => updateGoal(idx, 'status', e.target.value)}>
                                                        <option>Not Started</option><option>In Progress</option><option>Completed</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ marginTop: 6 }}>
                                                <textarea className="form-control" rows={2} placeholder="Goal description (optional)" value={goal.description} onChange={e => updateGoal(idx, 'description', e.target.value)} />
                                            </div>
                                        </div>
                                    ))}
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Total Weightage: <strong style={{ color: form.goals.reduce((s, g) => s + (g.weightage || 0), 0) === 100 ? '#10b981' : '#ef4444' }}>{form.goals.reduce((s, g) => s + (g.weightage || 0), 0)}%</strong> (should be 100%)
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create Review</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ DETAIL / EDIT REVIEW MODAL ============ */}
            {showDetailModal && selectedReview && (
                <div className="modal-overlay" onClick={() => { setShowDetailModal(false); setEditing(false); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 750 }}>
                        <div className="modal-header">
                            <h2>
                                {selectedReview.employee?.firstName} {selectedReview.employee?.lastName} — {selectedReview.reviewPeriod} {selectedReview.year}
                            </h2>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {selectedReview.status !== 'Completed' && !editing && (
                                    <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}><HiOutlinePencil /> Edit</button>
                                )}
                                <button className="btn btn-icon btn-secondary" onClick={() => { setShowDetailModal(false); setEditing(false); }}><HiOutlineX /></button>
                            </div>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

                            {/* Status Workflow Bar */}
                            <div style={{ display: 'flex', gap: 0, marginBottom: 24, background: 'var(--bg-hover)', borderRadius: 10, overflow: 'hidden' }}>
                                {STATUSES.map((s, i) => {
                                    const isActive = s === selectedReview.status;
                                    const isPast = STATUSES.indexOf(s) < STATUSES.indexOf(selectedReview.status);
                                    return (
                                        <div key={s} style={{
                                            flex: 1, padding: '10px 8px', textAlign: 'center', fontSize: 12, fontWeight: 700,
                                            background: isActive ? STATUS_COLORS[s] : isPast ? STATUS_COLORS[s] + '30' : 'transparent',
                                            color: isActive ? '#fff' : isPast ? STATUS_COLORS[s] : 'var(--text-secondary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                        }}>
                                            {isPast ? '✓' : isActive ? '●' : `${i + 1}`} {s}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Overall Rating */}
                            <div style={{ marginBottom: 20, padding: '16px 20px', background: 'var(--bg-hover)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Overall Rating</div>
                                    {editing ? (
                                        <StarRating value={form.overallRating} onChange={v => setForm({ ...form, overallRating: v })} size={28} />
                                    ) : (
                                        <StarRating value={selectedReview.overallRating || 0} readonly size={28} />
                                    )}
                                </div>
                                {selectedReview.status !== 'Completed' && (
                                    <button className="btn btn-sm btn-primary" onClick={() => advanceStatus(selectedReview)}>
                                        Move to → {STATUSES[STATUSES.indexOf(selectedReview.status) + 1]}
                                    </button>
                                )}
                            </div>

                            {/* Goals */}
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                    <h3 style={{ fontSize: 15, margin: 0 }}>🎯 Goals & KRAs</h3>
                                    {editing && <button type="button" className="btn btn-sm btn-secondary" onClick={addGoal}><HiOutlinePlus /> Add</button>}
                                </div>
                                {(editing ? form.goals : selectedReview.goals || []).map((goal, idx) => (
                                    <div key={idx} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 16, paddingRight: editing ? 40 : 16, marginBottom: 10, position: 'relative' }}>
                                        {editing && form.goals.length > 1 && (
                                            <button type="button" onClick={() => removeGoal(idx)} style={{ position: 'absolute', top: 12, right: 12, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#f1f5f9', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13 }}>✕</button>
                                        )}
                                        {editing ? (
                                            <>
                                                <div className="form-row" style={{ marginBottom: 8 }}>
                                                    <div className="form-group" style={{ flex: 2 }}><input className="form-control" value={goal.title} onChange={e => updateGoal(idx, 'title', e.target.value)} placeholder="Goal title" /></div>
                                                    <div className="form-group" style={{ flex: 1 }}><input className="form-control" type="number" value={goal.weightage} onChange={e => updateGoal(idx, 'weightage', +e.target.value)} placeholder="Weight %" /></div>
                                                    <div className="form-group" style={{ flex: 1 }}>
                                                        <select className="form-control" value={goal.status} onChange={e => updateGoal(idx, 'status', e.target.value)}>
                                                            <option>Not Started</option><option>In Progress</option><option>Completed</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="form-row">
                                                    <div className="form-group"><label className="form-label" style={{ fontSize: 11 }}>Self Rating</label><StarRating value={goal.selfRating} onChange={v => updateGoal(idx, 'selfRating', v)} size={18} /></div>
                                                    <div className="form-group"><label className="form-label" style={{ fontSize: 11 }}>Manager Rating</label><StarRating value={goal.managerRating} onChange={v => updateGoal(idx, 'managerRating', v)} size={18} /></div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14 }}>{goal.title}</div>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <span className="badge badge-neutral">{goal.weightage}%</span>
                                                        <span className="badge" style={{
                                                            background: goal.status === 'Completed' ? '#10b98120' : goal.status === 'In Progress' ? '#f59e0b20' : '#94a3b820',
                                                            color: goal.status === 'Completed' ? '#10b981' : goal.status === 'In Progress' ? '#f59e0b' : '#94a3b8'
                                                        }}>{goal.status}</span>
                                                    </div>
                                                </div>
                                                {goal.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{goal.description}</p>}
                                                <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                                                    <div>Self: <StarRating value={goal.selfRating || 0} readonly size={14} /></div>
                                                    <div>Manager: <StarRating value={goal.managerRating || 0} readonly size={14} /></div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Comments */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>💬 Employee Self Assessment</label>
                                    {editing ? (
                                        <textarea className="form-control" rows={4} value={form.selfComments} onChange={e => setForm({ ...form, selfComments: e.target.value })} placeholder="Employee's self assessment..." />
                                    ) : (
                                        <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)', minHeight: 80 }}>
                                            {selectedReview.selfComments || <em>No comments yet</em>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>👔 Manager Comments</label>
                                    {editing ? (
                                        <textarea className="form-control" rows={4} value={form.reviewerComments} onChange={e => setForm({ ...form, reviewerComments: e.target.value })} placeholder="Manager's feedback and recommendations..." />
                                    ) : (
                                        <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)', minHeight: 80 }}>
                                            {selectedReview.reviewerComments || <em>No comments yet</em>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {editing && (
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                                <button type="button" className="btn btn-primary" onClick={handleUpdate}><HiOutlineCheck /> Save Changes</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Year Management Modal */}
            {showYearModal && (
                <div className="modal-overlay" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Manage Performance Years</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setYearLoading(true);
                                try {
                                    if (editingYear) {
                                        await api.put(`/performance-years/${editingYear._id}`, yearForm);
                                    } else {
                                        await api.post('/performance-years', yearForm);
                                    }
                                    setYearForm({ year: '' });
                                    setEditingYear(null);
                                    fetchYears();
                                } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
                                setYearLoading(false);
                            }} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Year (YYYY)</label>
                                    <input type="number" className="form-control" value={yearForm.year} onChange={e => setYearForm({ year: e.target.value })} required placeholder="e.g. 2025" min="2000" max="2100" />
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button type="submit" className="btn btn-primary" disabled={yearLoading} style={{ flex: 1 }}>
                                        {editingYear ? 'Update Year' : 'Add Year'}
                                    </button>
                                    {editingYear && (
                                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingYear(null); setYearForm({ year: '' }); }}>Cancel</button>
                                    )}
                                </div>
                            </form>

                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: 10, fontSize: 12 }}>Year</th>
                                            <th style={{ padding: 10, fontSize: 12, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {years.length === 0 ? (
                                            <tr><td colSpan="2" style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No years added yet.</td></tr>
                                        ) : years.map(y => (
                                            <tr key={y._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: 10, fontWeight: 600 }}>{y.year}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingYear(y); setYearForm({ year: y.year }); }} style={{ marginRight: 6, fontSize: 10 }}>
                                                        <HiOutlinePencil size={12} style={{ marginRight: 4 }} /> Edit
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: `Delete ${y.year} year?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
                                                        if (!_swalRes.isConfirmed) return;
                                                        try { await api.delete(`/performance-years/${y._id}`); fetchYears(); } catch { }
                                                    }} style={{ color: '#ef4444', fontSize: 10 }}>
                                                        <HiOutlineTrash size={12} style={{ marginRight: 4 }} /> Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
