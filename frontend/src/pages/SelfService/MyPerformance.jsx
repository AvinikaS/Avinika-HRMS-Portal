import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { HiOutlineX, HiOutlineCheck } from 'react-icons/hi';

const STATUSES = ['Draft', 'Self Review', 'Manager Review', 'Completed'];
const STATUS_COLORS = { Draft: '#94a3b8', 'Self Review': '#6366f1', 'Manager Review': '#f59e0b', Completed: '#10b981' };
const RATING_LABELS = ['', 'Needs Improvement', 'Below Expectations', 'Meets Expectations', 'Exceeds Expectations', 'Outstanding'];

const StarRating = ({ value, onChange, readonly, size = 22 }) => (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map(star => (
            <span key={star} onClick={() => !readonly && onChange?.(star)}
                style={{ fontSize: size, cursor: readonly ? 'default' : 'pointer', color: star <= value ? '#f59e0b' : '#334155', transition: 'color .15s' }}>★</span>
        ))}
        {value > 0 && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>{RATING_LABELS[value]}</span>}
    </div>
);

export default function MyPerformance() {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [editing, setEditing] = useState(false);
    const [selfComments, setSelfComments] = useState('');
    const [goals, setGoals] = useState([]);

    useEffect(() => {
        api.get('/performance/my')
            .then(r => setReviews(r.data.data || []))
            .catch(() => setReviews([]))
            .finally(() => setLoading(false));
    }, []);

    const openReview = (r) => {
        setSelected(r);
        setSelfComments(r.selfComments || '');
        setGoals((r.goals || []).map(g => ({ ...g })));
        setEditing(false);
    };

    const handleSave = async () => {
        try {
            await api.put(`/performance/${selected._id}`, { selfComments, goals });
            const { data } = await api.get('/performance/my');
            setReviews(data.data || []);
            const updated = (data.data || []).find(r => r._id === selected._id);
            if (updated) setSelected(updated);
            setEditing(false);
        } catch (err) { toast.error(err.response?.data?.message || 'Error saving'); }
    };

    const updateGoal = (idx, field, value) => {
        const updated = [...goals];
        updated[idx] = { ...updated[idx], [field]: value };
        setGoals(updated);
    };

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header"><div><h1>My Performance</h1><p>View your performance reviews, goals, and self-assessments</p></div></div>

            {reviews.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon">📊</div>
                        <h3>No performance reviews</h3>
                        <p>Your performance reviews will appear here once initiated by your manager</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 14 }}>
                    {reviews.map(r => (
                        <div key={r._id} className="card" style={{ padding: '18px 22px', cursor: 'pointer', transition: 'all .2s' }} onClick={() => openReview(r)}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>{r.reviewPeriod} {r.year}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                                        Reviewer: {r.reviewer?.firstName} {r.reviewer?.lastName} · {r.goals?.length || 0} goals
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <StarRating value={r.overallRating || 0} readonly size={16} />
                                    </div>
                                    <span className="badge" style={{ background: STATUS_COLORS[r.status] + '20', color: STATUS_COLORS[r.status], fontWeight: 600, fontSize: 12 }}>{r.status}</span>
                                </div>
                            </div>
                            {r.status === 'Self Review' && (
                                <div style={{ marginTop: 10, padding: '8px 12px', background: '#6366f110', borderRadius: 8, fontSize: 12, color: '#6366f1', fontWeight: 600 }}>
                                    📝 Action Required: Complete your self-assessment
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ============ REVIEW DETAIL MODAL ============ */}
            {selected && (
                <div className="modal-overlay" onClick={() => { setSelected(null); setEditing(false); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
                        <div className="modal-header">
                            <h2>{selected.reviewPeriod} {selected.year} Review</h2>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {selected.status === 'Self Review' && !editing && (
                                    <button className="btn btn-sm btn-primary" onClick={() => setEditing(true)}>📝 Self Assess</button>
                                )}
                                <button className="btn btn-icon btn-secondary" onClick={() => { setSelected(null); setEditing(false); }}><HiOutlineX /></button>
                            </div>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

                            {/* Status Bar */}
                            <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg-hover)', borderRadius: 10, overflow: 'hidden' }}>
                                {STATUSES.map((s, i) => {
                                    const isActive = s === selected.status;
                                    const isPast = STATUSES.indexOf(s) < STATUSES.indexOf(selected.status);
                                    return (
                                        <div key={s} style={{
                                            flex: 1, padding: '10px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                                            background: isActive ? STATUS_COLORS[s] : isPast ? STATUS_COLORS[s] + '30' : 'transparent',
                                            color: isActive ? '#fff' : isPast ? STATUS_COLORS[s] : 'var(--text-secondary)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
                                        }}>
                                            {isPast ? '✓' : isActive ? '●' : i + 1} {s}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Overall Rating */}
                            <div style={{ marginBottom: 20, padding: '14px 18px', background: 'var(--bg-hover)', borderRadius: 12 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Overall Rating</div>
                                <StarRating value={selected.overallRating || 0} readonly size={26} />
                            </div>

                            {/* Goals */}
                            <h3 style={{ fontSize: 15, marginBottom: 10 }}>🎯 Goals & KRAs</h3>
                            {(editing ? goals : selected.goals || []).map((goal, idx) => (
                                <div key={idx} style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{goal.title}</div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <span className="badge badge-neutral">{goal.weightage}%</span>
                                            <span className="badge" style={{
                                                background: goal.status === 'Completed' ? '#10b98120' : goal.status === 'In Progress' ? '#f59e0b20' : '#94a3b820',
                                                color: goal.status === 'Completed' ? '#10b981' : goal.status === 'In Progress' ? '#f59e0b' : '#94a3b8'
                                            }}>{goal.status}</span>
                                        </div>
                                    </div>
                                    {goal.description && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{goal.description}</p>}

                                    <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                                        <div>
                                            <span style={{ fontWeight: 600 }}>Self Rating: </span>
                                            {editing ? (
                                                <StarRating value={goal.selfRating || 0} onChange={v => updateGoal(idx, 'selfRating', v)} size={16} />
                                            ) : (
                                                <StarRating value={goal.selfRating || 0} readonly size={14} />
                                            )}
                                        </div>
                                        <div>
                                            <span style={{ fontWeight: 600 }}>Manager Rating: </span>
                                            <StarRating value={goal.managerRating || 0} readonly size={14} />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Comments */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginTop: 16 }}>
                                <div>
                                    <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>💬 My Self Assessment</label>
                                    {editing ? (
                                        <textarea className="form-control" rows={4} value={selfComments} onChange={e => setSelfComments(e.target.value)} placeholder="Describe your achievements, challenges, and growth areas..." />
                                    ) : (
                                        <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)', minHeight: 80 }}>
                                            {selected.selfComments || <em>No self assessment yet</em>}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="form-label" style={{ fontSize: 13, fontWeight: 700 }}>👔 Manager Feedback</label>
                                    <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 12, fontSize: 13, color: 'var(--text-secondary)', minHeight: 80 }}>
                                        {selected.reviewerComments || <em>Pending manager review</em>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {editing && (
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={handleSave}><HiOutlineCheck /> Save Self Assessment</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
