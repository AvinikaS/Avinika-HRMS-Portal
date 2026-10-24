import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineArrowLeft, HiOutlinePaperClip, HiOutlineX, HiOutlineStar,
    HiOutlineRefresh, HiOutlineCheck, HiOutlineChevronDown,
    HiOutlinePencil, HiOutlineTrash
} from 'react-icons/hi';

const STATUS_LABELS = {
    OPEN: { label: 'Open', badge: 'badge-info' },
    ASSIGNED: { label: 'Assigned', badge: 'badge-primary' },
    IN_PROGRESS: { label: 'In Progress', badge: 'badge-warning' },
    WAITING_FOR_EMPLOYEE: { label: 'Waiting for You', badge: 'badge-warning' },
    RESOLVED: { label: 'Resolved', badge: 'badge-success' },
    CLOSED: { label: 'Closed', badge: 'badge-neutral' },
    REOPENED: { label: 'Reopened', badge: 'badge-danger' }
};

const PRIORITY_LABELS = {
    LOW: { label: 'Low', color: '#64748b' },
    MEDIUM: { label: 'Medium', color: '#f59e0b' },
    HIGH: { label: 'High', color: '#ef4444' },
    URGENT: { label: 'Urgent', color: '#dc2626' }
};

function StarRating({ value, onChange }) {
    const [hover, setHover] = useState(0);
    return (
        <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map(s => (
                <button key={s} type="button"
                    onMouseEnter={() => setHover(s)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(s)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                    <HiOutlineStar size={28} fill={(hover || value) >= s ? '#f59e0b' : 'none'}
                        style={{ color: (hover || value) >= s ? '#f59e0b' : '#cbd5e1', transition: 'color 0.15s' }} />
                </button>
            ))}
        </div>
    );
}

export default function TicketDetail() {
    const { isExEmployee } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [replyAttachments, setReplyAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [sending, setSending] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [showReopen, setShowReopen] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [reopenReason, setReopenReason] = useState('');
    const [submittingAction, setSubmittingAction] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [removingAttachmentIdx, setRemovingAttachmentIdx] = useState(null);
    const [categories, setCategories] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ subject: '', categoryId: '', priority: '', description: '' });
    const messagesEndRef = useRef(null);

    const fetchTicket = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/helpdesk/tickets/${id}`);
            if (data.success) {
                setTicket(data.data);
                setMessages(data.messages || []);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load ticket.');
        }
        setLoading(false);
    };

    useEffect(() => { fetchTicket(); }, [id]);
    useEffect(() => { fetchTicket(); }, [id]);
    useEffect(() => {
        api.get('/helpdesk/categories').then(({ data }) => {
            if (data.success) setCategories(data.data);
        }).catch(() => { });
    }, []);
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleReplyAttach = async (files) => {
        setUploading(true);
        try {
            const { uploadToCloudinary } = await import('../../utils/cloudinaryUpload');
            const results = await Promise.all(Array.from(files).map(f =>
                uploadToCloudinary(f, 'hrms/helpdesk').then(r => ({
                    fileName: f.name, fileUrl: r.url, fileType: f.type, fileSize: r.size, publicId: r.publicId
                }))
            ));
            setReplyAttachments(prev => [...prev, ...results]);
        } catch (err) {
            toast.error('Attachment upload failed.');
        }
        setUploading(false);
    };

    const removeAttachment = async (idx, publicId) => {
        setRemovingAttachmentIdx(idx);
        try {
            if (publicId) {
                await api.delete('/upload/file', { data: { publicId } });
            }
            setReplyAttachments(prev => prev.filter((_, i) => i !== idx));
            toast.success('Attachment removed.');
        } catch (err) {
            toast.error('Failed to remove attachment from server.');
        }
        setRemovingAttachmentIdx(null);
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!reply.trim()) return toast.error('Please type a message.');
        setSending(true);
        try {
            const { data } = await api.post(`/helpdesk/tickets/${id}/reply`, {
                message: reply.trim(),
                attachments: replyAttachments
            });
            if (data.success) {
                setReply('');
                setReplyAttachments([]);
                fetchTicket();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send reply.');
        }
        setSending(false);
    };

    const handleClose = async () => {
        setSubmittingAction(true);
        try {
            const { data } = await api.post(`/helpdesk/tickets/${id}/close`);
            if (data.success) { toast.success('Ticket closed.'); fetchTicket(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to close ticket.'); }
        setSubmittingAction(false);
    };

    const handleReopen = async () => {
        if (!reopenReason.trim()) return toast.error('Please provide a reason for reopening.');
        setSubmittingAction(true);
        try {
            const { data } = await api.post(`/helpdesk/tickets/${id}/reopen`, { reason: reopenReason.trim() });
            if (data.success) { toast.success('Ticket reopened.'); setShowReopen(false); setReopenReason(''); fetchTicket(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to reopen ticket.'); }
        setSubmittingAction(false);
    };

    const handleEditClick = () => {
        setEditForm({
            subject: ticket.subject,
            categoryId: ticket.categoryId?._id || '',
            priority: ticket.priority,
            description: ticket.description
        });
        setIsEditing(true);
    };

    const handleUpdateTicket = async (e) => {
        e.preventDefault();
        if (!editForm.subject.trim() || !editForm.description.trim()) return toast.error('Subject and description are required.');
        setSubmittingAction(true);
        try {
            const { data } = await api.put(`/helpdesk/tickets/${id}`, editForm);
            if (data.success) {
                toast.success('Ticket updated successfully!');
                setIsEditing(false);
                fetchTicket();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update ticket.');
        }
        setSubmittingAction(false);
    };

    const handleDeleteTicket = async () => {
        setSubmittingAction(true);
        try {
            const { data } = await api.delete(`/helpdesk/tickets/${id}`);
            if (data.success) {
                toast.success('Ticket deleted successfully!');
                navigate('/helpdesk');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete ticket.');
            setSubmittingAction(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleFeedback = async (e) => {
        e.preventDefault();
        if (!feedbackRating) return toast.error('Please select a rating.');
        setSubmittingAction(true);
        try {
            const { data } = await api.post(`/helpdesk/tickets/${id}/feedback`, { rating: feedbackRating, comment: feedbackComment });
            if (data.success) { toast.success('Feedback submitted. Thank you!'); setShowFeedback(false); fetchTicket(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit feedback.'); }
        setSubmittingAction(false);
    };

    if (loading) return (
        <div className="animate-fadeIn" style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading ticket...
        </div>
    );

    if (!ticket) return (
        <div className="animate-fadeIn">
            <div className="empty-state">
                <div className="empty-icon">❌</div>
                <h3>Ticket not found</h3>
                <button className="btn btn-primary" onClick={() => navigate('/helpdesk')}>Back to My Tickets</button>
            </div>
        </div>
    );

    const canReply = !['CLOSED'].includes(ticket.status) && !isExEmployee;
    const canClose = ticket.status === 'RESOLVED' && !isExEmployee;
    const canReopen = ticket.status === 'RESOLVED' && !isExEmployee;
    const canFeedback = ['RESOLVED', 'CLOSED'].includes(ticket.status) && !ticket.feedback?.rating && !isExEmployee;
    const canEditDelete = ticket.status === 'OPEN' && !ticket.assignedToName && !isExEmployee;

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 900, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/helpdesk')} style={{ marginBottom: 12 }}>
                    <HiOutlineArrowLeft /> Back to My Tickets
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{ticket.ticketNumber}</span>
                            <span className={`badge ${STATUS_LABELS[ticket.status]?.badge || 'badge-neutral'}`} style={{ fontSize: 11 }}>
                                {STATUS_LABELS[ticket.status]?.label || ticket.status}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: PRIORITY_LABELS[ticket.priority]?.color }}>
                                ● {PRIORITY_LABELS[ticket.priority]?.label} Priority
                            </span>
                        </div>
                        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ticket.subject}</h1>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                            Category: {ticket.categoryId?.name || 'Uncategorized'} &nbsp;·&nbsp;
                            Raised on {new Date(ticket.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            {ticket.assignedToName && <>&nbsp;·&nbsp; Assigned to: {ticket.assignedToName}</>}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-sm btn-secondary" onClick={fetchTicket}><HiOutlineRefresh /></button>
                        {canEditDelete && <button className="btn btn-sm btn-secondary" onClick={handleEditClick} disabled={submittingAction}><HiOutlinePencil /> Edit</button>}
                        {canEditDelete && <button className="btn btn-sm btn-danger" onClick={() => setShowDeleteConfirm(true)} disabled={submittingAction}><HiOutlineTrash /> Delete</button>}
                        {canClose && <button className="btn btn-sm btn-success" onClick={handleClose} disabled={submittingAction}>✓ Mark Resolved</button>}
                        {canReopen && <button className="btn btn-sm btn-warning" onClick={() => setShowReopen(!showReopen)} disabled={submittingAction}>↩ Reopen</button>}
                        {canFeedback && <button className="btn btn-sm btn-primary" onClick={() => setShowFeedback(!showFeedback)}><HiOutlineStar /> Give Feedback</button>}
                    </div>
                </div>
            </div>

            {/* Edit panel */}
            {isEditing && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Edit Ticket</h4>
                    <form onSubmit={handleUpdateTicket}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 10 }}>
                            <select className="form-control" value={editForm.categoryId} onChange={e => setEditForm({ ...editForm, categoryId: e.target.value })}>
                                <option value="">-- Select Category --</option>
                                {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                            <select className="form-control" value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: e.target.value })}>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="URGENT">Urgent</option>
                            </select>
                        </div>
                        <input className="form-control" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })} style={{ marginBottom: 10 }} placeholder="Subject" />
                        <textarea className="form-control" rows={4} value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} style={{ marginBottom: 10 }} placeholder="Description" />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={submittingAction}>Save Changes</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Resolved Feedback Banner */}
            {ticket.status === 'RESOLVED' && !ticket.feedback?.rating && (
                <div style={{
                    background: 'linear-gradient(135deg, #d1fae5, #ecfdf5)', border: '1px solid #6ee7b7',
                    borderRadius: 10, padding: '12px 20px', marginBottom: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                }}>
                    <div style={{ fontSize: 13, color: '#065f46', fontWeight: 600 }}>
                        ✅ HR has marked this ticket as Resolved. Please confirm if the issue is fixed or reopen.
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-sm btn-success" onClick={handleClose} disabled={submittingAction}><HiOutlineCheck /> Confirm &amp; Close</button>
                    </div>
                </div>
            )}

            {/* Feedback banner if already submitted */}
            {ticket.feedback?.rating && (
                <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '12px 20px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
                    ⭐ Feedback submitted — Rating: {ticket.feedback.rating}/5 {ticket.feedback.comment && `· "${ticket.feedback.comment}"`}
                </div>
            )}

            {/* Reopen panel */}
            {showReopen && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Reopen Ticket — Provide Reason</h4>
                    <textarea className="form-control" rows={3} placeholder="Why are you reopening this ticket? What issue persists?"
                        value={reopenReason} onChange={e => setReopenReason(e.target.value)} style={{ marginBottom: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-warning btn-sm" onClick={handleReopen} disabled={submittingAction}>↩ Confirm Reopen</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowReopen(false)}>Cancel</button>
                    </div>
                </div>
            )}

            {/* Feedback panel */}
            {showFeedback && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Rate HR Support</h4>
                    <form onSubmit={handleFeedback}>
                        <StarRating value={feedbackRating} onChange={setFeedbackRating} />
                        <textarea className="form-control" rows={2} placeholder="Any comments? (optional)"
                            value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} style={{ marginTop: 10 }} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                            <button type="submit" className="btn btn-primary btn-sm" disabled={submittingAction || !feedbackRating}>Submit Feedback</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFeedback(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Conversation Thread */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: 14, background: 'var(--bg-tertiary)' }}>
                    Conversation Thread
                </div>

                <div style={{ maxHeight: 480, overflowY: 'auto', padding: '0 0 8px' }}>
                    {/* Initial Description as First Message */}
                    <div style={{
                        padding: '16px 24px',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        borderBottom: '1px solid var(--border-light)'
                    }}>
                        <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'row-reverse', gap: 12, alignItems: 'flex-start' }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                background: 'var(--primary-gradient)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: 13
                            }}>
                                Y
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textAlign: 'right' }}>
                                    You (Initial Ticket) · {new Date(ticket.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                <div style={{
                                    background: 'var(--primary-50)',
                                    border: '1px solid var(--primary-100)',
                                    borderRadius: '12px 2px 12px 12px',
                                    padding: '10px 14px', fontSize: 13.5, lineHeight: 1.6,
                                    color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                }}>
                                    {ticket.description}
                                </div>
                                {ticket.attachments && ticket.attachments.length > 0 && (
                                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                                        {ticket.attachments.map((a, ai) => (
                                            <a key={`init-att-${ai}`} href={a.fileUrl} target="_blank" rel="noreferrer"
                                                style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                📎 {a.fileName}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {messages.length === 0 ? (
                        <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                            No messages yet. HR team will respond shortly.
                        </div>
                    ) : (
                        messages.map((m, i) => {
                            if (m.messageType === 'SYSTEM_EVENT') {
                                return (
                                    <div key={m._id || i} style={{ textAlign: 'center', padding: '8px 24px', fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        <span style={{ background: 'var(--bg-tertiary)', padding: '2px 12px', borderRadius: 20 }}>
                                            🔔 {m.message} · {new Date(m.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            }
                            const isEmployee = m.senderRole === 'EMPLOYEE';
                            return (
                                <div key={m._id || i} style={{
                                    padding: '16px 24px',
                                    display: 'flex',
                                    justifyContent: isEmployee ? 'flex-end' : 'flex-start',
                                    borderBottom: '1px solid var(--border-light)'
                                }}>
                                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: isEmployee ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                            background: isEmployee ? 'var(--primary-gradient)' : 'linear-gradient(135deg,#10b981,#059669)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: 13
                                        }}>
                                            {isEmployee ? 'Y' : 'HR'}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, textAlign: isEmployee ? 'right' : 'left' }}>
                                                {isEmployee ? 'You' : 'HR Support'} · {new Date(m.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div style={{
                                                background: isEmployee ? 'var(--primary-50)' : '#f1f5f9',
                                                border: `1px solid ${isEmployee ? 'var(--primary-100)' : 'var(--border-color)'}`,
                                                borderRadius: isEmployee ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
                                                padding: '10px 14px', fontSize: 13.5, lineHeight: 1.6,
                                                color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                            }}>
                                                {m.message}
                                            </div>
                                            {m.attachments && m.attachments.length > 0 && (
                                                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: isEmployee ? 'flex-end' : 'flex-start' }}>
                                                    {m.attachments.map((a, ai) => (
                                                        <a key={ai} href={a.fileUrl} target="_blank" rel="noreferrer"
                                                            style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                            📎 {a.fileName}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Reply box */}
                {canReply ? (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                        <form onSubmit={handleSendReply}>
                            <textarea
                                className="form-control"
                                rows={3}
                                placeholder="Type your reply here..."
                                value={reply}
                                onChange={e => setReply(e.target.value)}
                                style={{ marginBottom: 10, resize: 'vertical' }}
                            />
                            {replyAttachments.length > 0 && (
                                <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {replyAttachments.map((a, i) => (
                                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: 'var(--primary-dark)' }}>
                                            📎 {a.fileName}
                                            <button type="button" onClick={() => removeAttachment(i, a.publicId)}
                                                disabled={removingAttachmentIdx === i}
                                                style={{ background: 'none', border: 'none', cursor: removingAttachmentIdx === i ? 'not-allowed' : 'pointer', color: 'var(--danger)', display: 'flex' }}>
                                                {removingAttachmentIdx === i ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> : <HiOutlineX size={10} />}
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <HiOutlinePaperClip />
                                    {uploading ? 'Uploading...' : 'Attach files'}
                                    <input type="file" multiple style={{ display: 'none' }} disabled={uploading}
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                        onChange={e => handleReplyAttach(e.target.files)} />
                                </label>
                                <button type="submit" className="btn btn-primary" disabled={sending || uploading}>
                                    {sending ? 'Sending...' : '➤ Send Reply'}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div style={{ padding: '14px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13, borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                        This ticket is <strong>closed</strong>. You cannot reply.
                    </div>
                )}
            </div>
            {showDeleteConfirm && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }} onClick={() => setShowDeleteConfirm(false)}>
                    <div style={{
                        background: 'var(--bg-primary)', padding: 24, borderRadius: 12,
                        width: '90%', maxWidth: 400, boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Delete Ticket</h3>
                        <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--text-secondary)' }}>
                            Are you sure you want to delete this ticket? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={submittingAction}>Cancel</button>
                            <button className="btn btn-danger" onClick={handleDeleteTicket} disabled={submittingAction}>
                                {submittingAction ? 'Deleting...' : 'Delete Ticket'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
