import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import {
    HiOutlineArrowLeft, HiOutlinePaperClip, HiOutlineX, HiOutlineRefresh,
    HiOutlineUser, HiOutlineTag, HiOutlineLightningBolt
} from 'react-icons/hi';

const STATUS_LABELS = {
    OPEN: { label: 'Open', badge: 'badge-info' },
    ASSIGNED: { label: 'Assigned', badge: 'badge-primary' },
    IN_PROGRESS: { label: 'In Progress', badge: 'badge-warning' },
    WAITING_FOR_EMPLOYEE: { label: 'Waiting for Employee', badge: 'badge-warning' },
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

const STATUS_TRANSITIONS = {
    OPEN: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    ASSIGNED: ['IN_PROGRESS', 'WAITING_FOR_EMPLOYEE', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['WAITING_FOR_EMPLOYEE', 'RESOLVED', 'CLOSED'],
    WAITING_FOR_EMPLOYEE: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    RESOLVED: ['CLOSED', 'REOPENED'],
    CLOSED: [],
    REOPENED: ['IN_PROGRESS', 'ASSIGNED']
};

export default function AdminTicketDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hrUsers, setHRUsers] = useState([]);
    const [categories, setCategories] = useState([]);

    // Action states
    const [replyText, setReplyText] = useState('');
    const [internalNote, setInternalNote] = useState('');
    const [replyAttachments, setReplyAttachments] = useState([]);
    const [noteAttachments, setNoteAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [sendingReply, setSendingReply] = useState(false);
    const [sendingNote, setSendingNote] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [updatingPriority, setUpdatingPriority] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [removingAttachmentIdx, setRemovingAttachmentIdx] = useState(null);

    const [activeTab, setActiveTab] = useState('reply'); // reply | note
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState('');
    const messagesEndRef = useRef(null);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [ticketRes, hrUsersRes, catRes] = await Promise.all([
                api.get(`/helpdesk/admin/tickets/${id}`),
                api.get('/helpdesk/admin/hr-users'),
                api.get('/helpdesk/admin/categories')
            ]);
            if (ticketRes.data.success) {
                setTicket(ticketRes.data.data);
                setMessages(ticketRes.data.messages || []);
                setSelectedStatus(ticketRes.data.data.status);
                setSelectedAssignee(ticketRes.data.data.assignedTo?._id || ticketRes.data.data.assignedTo || '');
            }
            if (hrUsersRes.data.success) setHRUsers(hrUsersRes.data.data);
            if (catRes.data.success) setCategories(catRes.data.data);
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to load ticket.'); }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, [id]);
    useEffect(() => { if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const handleFileUpload = async (files, setFn) => {
        setUploading(true);
        try {
            const { uploadToCloudinary } = await import('../../utils/cloudinaryUpload');
            const results = await Promise.all(Array.from(files).map(f =>
                uploadToCloudinary(f, 'hrms/helpdesk').then(r => ({ fileName: f.name, fileUrl: r.url, fileType: f.type, fileSize: r.size, publicId: r.publicId }))
            ));
            setFn(prev => [...prev, ...results]);
        } catch (err) { toast.error('Upload failed.'); }
        setUploading(false);
    };

    const removeAttachment = async (idx, publicId, setFn) => {
        setRemovingAttachmentIdx(idx);
        try {
            if (publicId) await api.delete('/upload/file', { data: { publicId } });
            setFn(prev => prev.filter((_, i) => i !== idx));
            toast.success('Attachment removed.');
        } catch (err) { toast.error('Failed to remove attachment.'); }
        setRemovingAttachmentIdx(null);
    };

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim()) return toast.error('Please type a reply message.');
        setSendingReply(true);
        try {
            const { data } = await api.post(`/helpdesk/admin/tickets/${id}/reply`, { message: replyText.trim(), attachments: replyAttachments });
            if (data.success) { setReplyText(''); setReplyAttachments([]); fetchAll(); toast.success('Reply sent.'); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to send reply.'); }
        setSendingReply(false);
    };

    const handleSendNote = async (e) => {
        e.preventDefault();
        if (!internalNote.trim()) return toast.error('Please type a note.');
        setSendingNote(true);
        try {
            const { data } = await api.post(`/helpdesk/admin/tickets/${id}/internal-note`, { message: internalNote.trim(), attachments: noteAttachments });
            if (data.success) { setInternalNote(''); setNoteAttachments([]); fetchAll(); toast.success('Internal note added.'); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to add note.'); }
        setSendingNote(false);
    };

    const handleUpdateStatus = async () => {
        if (!selectedStatus || selectedStatus === ticket.status) return toast.info('Please select a different status.');
        setUpdatingStatus(true);
        try {
            const { data } = await api.patch(`/helpdesk/admin/tickets/${id}/status`, { status: selectedStatus });
            if (data.success) { toast.success(`Status updated to ${selectedStatus}`); fetchAll(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status.'); }
        setUpdatingStatus(false);
    };

    const handleUpdatePriority = async (priority) => {
        setUpdatingPriority(true);
        try {
            const { data } = await api.patch(`/helpdesk/admin/tickets/${id}/priority`, { priority });
            if (data.success) { toast.success(`Priority set to ${priority}`); fetchAll(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update priority.'); }
        setUpdatingPriority(false);
    };

    const handleAssign = async () => {
        if (!selectedAssignee) return toast.error('Please select an HR user to assign.');
        setAssigning(true);
        try {
            const { data } = await api.patch(`/helpdesk/admin/tickets/${id}/assign`, { assignedTo: selectedAssignee });
            if (data.success) { toast.success('Ticket assigned successfully.'); fetchAll(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to assign ticket.'); }
        setAssigning(false);
    };

    if (loading) return (
        <div className="animate-fadeIn" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} /> Loading...
        </div>
    );

    if (!ticket) return (
        <div className="animate-fadeIn">
            <div className="empty-state"><div className="empty-icon">❌</div><h3>Ticket not found</h3>
                <button className="btn btn-primary" onClick={() => navigate('/admin/helpdesk/tickets')}>Back</button></div>
        </div>
    );

    const allowedTransitions = STATUS_TRANSITIONS[ticket.status] || [];

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 1100, margin: '0 auto' }}>
            {/* Top bar */}
            <div style={{ marginBottom: 20 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/helpdesk/tickets')} style={{ marginBottom: 12 }}>
                    <HiOutlineArrowLeft /> Back to All Tickets
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
                            {ticket.categoryId?.name || 'Uncategorized'} &nbsp;·&nbsp; Raised on {new Date(ticket.createdAt).toLocaleString('en-IN')}
                        </div>
                    </div>
                    <button className="btn btn-sm btn-secondary" onClick={fetchAll}><HiOutlineRefresh /></button>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                {/* LEFT — Conversation */}
                <div style={{ flex: '1 1 min(100%, 500px)' }}>
                    {/* Messages */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)', fontWeight: 700, fontSize: 14, background: 'var(--bg-tertiary)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>Conversation Thread</span>
                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 400 }}>{messages.length} message{messages.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            {/* Initial Description as First Message */}
                            <div style={{ padding: '14px 20px', background: 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ maxWidth: '80%', order: 0, textAlign: 'left' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-start' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{ticket.employeeId?.firstName} {ticket.employeeId?.lastName} (Initial Ticket)</span>
                                            <span>·</span>
                                            <span>{new Date(ticket.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div style={{
                                            background: '#f1f5f9', border: '1px solid var(--border-color)', borderRadius: '2px 12px 12px 12px',
                                            padding: '10px 14px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                        }}>
                                            {ticket.description}
                                        </div>
                                        {ticket.attachments && ticket.attachments.length > 0 && (
                                            <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-start' }}>
                                                {ticket.attachments.map((a, ai) => (
                                                    <a key={`init-att-${ai}`} href={a.fileUrl} target="_blank" rel="noreferrer"
                                                        style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                        📎 {a.fileName}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{
                                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                        background: 'linear-gradient(135deg,#64748b,#475569)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white', fontWeight: 700, fontSize: 12, order: 1
                                    }}>
                                        E
                                    </div>
                                </div>
                            </div>

                            {messages.map((m, i) => {
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
                                const isInternalNote = m.messageType === 'INTERNAL_NOTE';

                                return (
                                    <div key={m._id || i} style={{
                                        padding: '14px 20px',
                                        background: isInternalNote ? '#fffbeb' : 'transparent',
                                        borderBottom: '1px solid var(--border-light)',
                                        borderLeft: isInternalNote ? '3px solid #f59e0b' : 'none'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: isEmployee ? 'flex-start' : 'flex-end', gap: 12, alignItems: 'flex-start' }}>
                                            <div style={{ maxWidth: '80%', order: isEmployee ? 0 : 1, textAlign: isEmployee ? 'left' : 'right' }}>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: isEmployee ? 'flex-start' : 'flex-end' }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{m.senderName || (isEmployee ? 'Employee' : 'HR')}</span>
                                                    <span>·</span>
                                                    <span>{new Date(m.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                                    {isInternalNote && <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>🔒 Internal Note</span>}
                                                </div>
                                                <div style={{
                                                    background: isEmployee ? '#f1f5f9' : (isInternalNote ? '#fef9c3' : 'var(--primary-50)'),
                                                    border: `1px solid ${isEmployee ? 'var(--border-color)' : (isInternalNote ? '#fde68a' : 'var(--primary-100)')}`,
                                                    borderRadius: isEmployee ? '2px 12px 12px 12px' : '12px 2px 12px 12px',
                                                    padding: '10px 14px', fontSize: 13.5, lineHeight: 1.6,
                                                    color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                                }}>
                                                    {m.message}
                                                </div>
                                                {m.attachments && m.attachments.length > 0 && (
                                                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: isEmployee ? 'flex-start' : 'flex-end' }}>
                                                        {m.attachments.map((a, ai) => (
                                                            <a key={ai} href={a.fileUrl} target="_blank" rel="noreferrer"
                                                                style={{ fontSize: 11, color: 'var(--primary)', background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                                📎 {a.fileName}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Avatar */}
                                            <div style={{
                                                width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                                                background: isEmployee ? 'linear-gradient(135deg,#64748b,#475569)' : (isInternalNote ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'var(--primary-gradient)'),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: 'white', fontWeight: 700, fontSize: 12, order: isEmployee ? 1 : 0
                                            }}>
                                                {isEmployee ? 'E' : 'HR'}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Reply/Note Input */}
                        {ticket.status !== 'CLOSED' && (
                            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}>
                                {/* Tab */}
                                <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '2px solid var(--border-color)' }}>
                                    {['reply', 'note'].map(tab => (
                                        <button key={tab} type="button"
                                            onClick={() => setActiveTab(tab)}
                                            style={{
                                                padding: '8px 16px', fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer', background: 'none',
                                                borderBottom: `2px solid ${activeTab === tab ? 'var(--primary)' : 'transparent'}`,
                                                color: activeTab === tab ? 'var(--primary)' : 'var(--text-tertiary)',
                                                marginBottom: -2
                                            }}>
                                            {tab === 'reply' ? '📨 Reply to Employee' : '🔒 Internal Note'}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === 'reply' ? (
                                    <form onSubmit={handleSendReply}>
                                        <textarea className="form-control" rows={3} placeholder="Write a reply to the employee..."
                                            value={replyText} onChange={e => setReplyText(e.target.value)} style={{ marginBottom: 10, resize: 'vertical' }} />
                                        {replyAttachments.length > 0 && (
                                            <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                {replyAttachments.map((a, i) => (
                                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--primary-50)', padding: '2px 8px', borderRadius: 4, fontSize: 11, color: 'var(--primary-dark)' }}>
                                                        📎 {a.fileName}
                                                        <button type="button" onClick={() => removeAttachment(i, a.publicId, setReplyAttachments)} disabled={removingAttachmentIdx === i} style={{ background: 'none', border: 'none', cursor: removingAttachmentIdx === i ? 'not-allowed' : 'pointer', color: 'var(--danger)', display: 'flex' }}>
                                                            {removingAttachmentIdx === i ? <span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> : <HiOutlineX size={10} />}
                                                        </button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <label style={{ cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <HiOutlinePaperClip /> {uploading ? 'Uploading...' : 'Attach'}
                                                <input type="file" multiple style={{ display: 'none' }} disabled={uploading} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                    onChange={e => handleFileUpload(e.target.files, setReplyAttachments)} />
                                            </label>
                                            <button type="submit" className="btn btn-primary" disabled={sendingReply || uploading}>
                                                {sendingReply ? 'Sending...' : '➤ Send Reply'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <form onSubmit={handleSendNote}>
                                        <textarea className="form-control" rows={3} placeholder="Add an internal note (not visible to employee)..."
                                            value={internalNote} onChange={e => setInternalNote(e.target.value)} style={{ marginBottom: 10, resize: 'vertical', borderColor: '#f59e0b' }} />
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <button type="submit" className="btn btn-warning" disabled={sendingNote}>
                                                {sendingNote ? 'Saving...' : '🔒 Add Internal Note'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT — Admin Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 320px', maxWidth: '100%' }}>
                    {/* Employee Info */}
                    <div className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <HiOutlineUser /> Employee Info
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                            <div style={{ fontWeight: 700 }}>{ticket.employeeId?.firstName} {ticket.employeeId?.lastName}</div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{ticket.employeeId?.employeeCode}</div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{ticket.employeeId?.department}</div>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{ticket.employeeId?.designation}</div>
                        </div>
                    </div>

                    {/* Priority Control */}
                    <div className="card" style={{ padding: '16px 18px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <HiOutlineTag /> Priority
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (
                                <button key={p} type="button" disabled={updatingPriority}
                                    onClick={() => handleUpdatePriority(p)}
                                    className={`btn btn-sm ${ticket.priority === p ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: 11, color: ticket.priority === p ? 'white' : PRIORITY_LABELS[p]?.color, borderColor: ticket.priority !== p ? PRIORITY_LABELS[p]?.color : undefined }}>
                                    {PRIORITY_LABELS[p]?.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Assign */}
                    <div className="card" style={{ padding: '16px 18px', opacity: ticket.assignedTo ? 0.7 : 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <HiOutlineUser /> Assign To
                        </div>
                        {ticket.assignedToName && (
                            <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)', background: 'var(--primary-50)', padding: '4px 10px', borderRadius: 6 }}>
                                Currently: <strong>{ticket.assignedToName}</strong>
                            </div>
                        )}
                        <select className="form-control" value={selectedAssignee} onChange={e => setSelectedAssignee(e.target.value)} style={{ marginBottom: 10, fontSize: 13, cursor: ticket.assignedTo ? 'not-allowed' : 'pointer' }} disabled={!!ticket.assignedTo}>
                            <option value="">-- Select HR User --</option>
                            {hrUsers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                        </select>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', cursor: ticket.assignedTo ? 'not-allowed' : 'pointer' }} onClick={handleAssign} disabled={assigning || !selectedAssignee || !!ticket.assignedTo}>
                            {assigning ? 'Assigning...' : (ticket.assignedTo ? 'Already Assigned' : 'Assign Ticket')}
                        </button>
                    </div>

                    {/* Status Control */}
                    <div className="card" style={{ padding: '16px 18px', opacity: !ticket.assignedTo ? 0.7 : 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <HiOutlineLightningBolt /> Update Status
                        </div>
                        {!ticket.assignedTo && (
                            <div style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 10, fontWeight: 600 }}>
                                ⚠️ Please assign the ticket first to update status.
                            </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                            {allowedTransitions.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No more transitions available.</div>
                            ) : allowedTransitions.map(s => (
                                <button key={s} type="button"
                                    disabled={!ticket.assignedTo}
                                    onClick={() => { setSelectedStatus(s); }}
                                    className={`btn btn-sm ${selectedStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ fontSize: 11, cursor: !ticket.assignedTo ? 'not-allowed' : 'pointer' }}>
                                    {STATUS_LABELS[s]?.label || s}
                                </button>
                            ))}
                        </div>
                        {allowedTransitions.length > 0 && (
                            <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
                                onClick={handleUpdateStatus} disabled={!ticket.assignedTo || updatingStatus || selectedStatus === ticket.status}>
                                {updatingStatus ? 'Updating...' : 'Update Status'}
                            </button>
                        )}
                    </div>

                    {/* Ticket Meta */}
                    <div className="card" style={{ padding: '14px 18px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                        <div style={{ lineHeight: 2 }}>
                            <div><strong>Created:</strong> {new Date(ticket.createdAt).toLocaleString('en-IN')}</div>
                            <div><strong>Updated:</strong> {new Date(ticket.updatedAt).toLocaleString('en-IN')}</div>
                            {ticket.resolvedAt && <div><strong>Resolved:</strong> {new Date(ticket.resolvedAt).toLocaleString('en-IN')}</div>}
                            {ticket.closedAt && <div><strong>Closed:</strong> {new Date(ticket.closedAt).toLocaleString('en-IN')}</div>}
                            {ticket.assignedByName && <div><strong>Assigned by:</strong> {ticket.assignedByName}</div>}
                            {ticket.feedback?.rating && (
                                <div><strong>Feedback:</strong> {'⭐'.repeat(ticket.feedback.rating)} ({ticket.feedback.rating}/5)</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
