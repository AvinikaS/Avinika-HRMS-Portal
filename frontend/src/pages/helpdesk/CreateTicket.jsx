import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { HiOutlineArrowLeft, HiOutlineUpload, HiOutlineX, HiOutlinePaperClip } from 'react-icons/hi';

const PRIORITY_OPTIONS = [
    { value: 'LOW', label: 'Low (General query)' },
    { value: 'MEDIUM', label: 'Medium (Within few days)' },
    { value: 'HIGH', label: 'High (Within 24 hrs)' },
    { value: 'URGENT', label: 'Urgent (Critical)' }
];

export default function CreateTicket() {
    const navigate = useNavigate();
    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        subject: '',
        categoryId: '',
        description: '',
        priority: 'MEDIUM'
    });
    const [attachments, setAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [removingIndex, setRemovingIndex] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    useEffect(() => {
        api.get('/helpdesk/categories').then(({ data }) => {
            if (data.success) setCategories(data.data);
        }).catch(() => { });
    }, []);

    const validate = () => {
        const e = {};
        if (!form.categoryId) e.categoryId = 'Category is required.';
        if (!form.subject.trim()) e.subject = 'Subject is required.';
        if (form.subject.trim().length < 10) e.subject = 'Subject must be at least 10 characters.';
        if (!form.description.trim()) e.description = 'Description is required.';
        if (form.description.trim().length < 20) e.description = 'Please describe your issue in at least 20 characters.';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleFileUpload = async (files) => {
        setUploading(true);
        try {
            const { uploadToCloudinary } = await import('../../utils/cloudinaryUpload');
            const results = await Promise.all(Array.from(files).map(f =>
                uploadToCloudinary(f, 'hrms/helpdesk').then(r => ({
                    fileName: f.name,
                    fileUrl: r.url,
                    fileType: f.type,
                    fileSize: r.size,
                    publicId: r.publicId
                }))
            ));
            setAttachments(prev => [...prev, ...results]);
        } catch (err) {
            toast.error('File upload failed: ' + (err.message || 'Unknown error'));
        }
        setUploading(false);
    };

    const removeAttachment = async (idx, publicId) => {
        setRemovingIndex(idx);
        try {
            if (publicId) {
                await api.delete('/upload/file', { data: { publicId } });
            }
            setAttachments(prev => prev.filter((_, i) => i !== idx));
            toast.success('Attachment removed.');
        } catch (err) {
            toast.error('Failed to remove attachment from server.');
        }
        setRemovingIndex(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            const payload = {
                subject: form.subject.trim(),
                categoryId: form.categoryId || undefined,
                description: form.description.trim(),
                priority: form.priority,
                attachments
            };
            const { data } = await api.post('/helpdesk/tickets', payload);
            if (data.success) {
                toast.success(`Ticket ${data.data.ticketNumber} raised successfully!`);
                navigate('/helpdesk');
            } else {
                toast.error(data.message || 'Failed to create ticket.');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create ticket.');
        }
        setSubmitting(false);
    };

    const charLeft = 2000 - form.description.length;

    return (
        <div className="animate-fadeIn" style={{ maxWidth: 760, margin: '0 auto' }}>
            <div className="page-header">
                <div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/helpdesk')} style={{ marginBottom: 12 }}>
                        <HiOutlineArrowLeft /> Back to My Tickets
                    </button>
                    <h1>Raise a Support Ticket</h1>
                    <p>Describe your issue and our HR team will get back to you.</p>
                </div>
            </div>

            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ padding: 0 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 20 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Category <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <select
                                    className={`form-control ${errors.categoryId ? 'border-danger' : ''}`}
                                    value={form.categoryId}
                                    onChange={e => setForm({ ...form, categoryId: e.target.value })}
                                    style={errors.categoryId ? { borderColor: 'var(--danger)' } : {}}
                                >
                                    <option value="">-- Select Category --</option>
                                    {categories.map(c => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>
                                {errors.categoryId && <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>{errors.categoryId}</div>}
                            </div>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">Priority <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <select
                                    className="form-control"
                                    value={form.priority}
                                    onChange={e => setForm({ ...form, priority: e.target.value })}
                                >
                                    {PRIORITY_OPTIONS.map(p => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input
                                className={`form-control ${errors.subject ? 'border-danger' : ''}`}
                                placeholder="Short summary (e.g. Leave issue)"
                                value={form.subject}
                                maxLength={200}
                                onChange={e => setForm({ ...form, subject: e.target.value })}
                                style={errors.subject ? { borderColor: 'var(--danger)' } : {}}
                            />
                            {errors.subject && <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>{errors.subject}</div>}
                        </div>

                        <div className="form-group">
                            <label className="form-label">
                                Description <span style={{ color: 'var(--danger)' }}>*</span>
                                <span style={{ float: 'right', fontWeight: 400, color: charLeft < 100 ? 'var(--danger)' : 'var(--text-tertiary)', fontSize: 11 }}>
                                    {charLeft} characters remaining
                                </span>
                            </label>
                            <textarea
                                className={`form-control ${errors.description ? 'border-danger' : ''}`}
                                placeholder="Please provide as much detail as possible — include dates, amounts, names, or any steps to reproduce the issue."
                                value={form.description}
                                maxLength={2000}
                                rows={7}
                                onChange={e => setForm({ ...form, description: e.target.value })}
                                style={{ resize: 'vertical', ...(errors.description ? { borderColor: 'var(--danger)' } : {}) }}
                            />
                            {errors.description && <div style={{ color: 'var(--danger)', fontSize: 11, marginTop: 4 }}>{errors.description}</div>}
                        </div>

                        {/* Attachments */}
                        <div className="form-group" style={{ marginBottom: 8 }}>
                            <label className="form-label">Attachments <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(Optional)</span></label>
                            <label htmlFor="hd-file-upload" style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
                                border: '1.5px dashed var(--border-color)', borderRadius: 6, cursor: uploading ? 'not-allowed' : 'pointer',
                                color: 'var(--text-secondary)', fontSize: 13, transition: 'all 0.2s',
                                background: uploading ? 'var(--bg-tertiary)' : 'transparent'
                            }}>
                                <HiOutlinePaperClip />
                                {uploading ? 'Uploading...' : 'Attach files (PDF, Image, Doc)'}
                                <input
                                    id="hd-file-upload"
                                    type="file"
                                    multiple
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                                    style={{ display: 'none' }}
                                    disabled={uploading}
                                    onChange={e => handleFileUpload(e.target.files)}
                                />
                            </label>

                            {attachments.length > 0 && (
                                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                    {attachments.map((a, i) => (
                                        <div key={i} style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            background: 'var(--primary-50)', borderRadius: 6,
                                            padding: '4px 10px', fontSize: 12, color: 'var(--primary-dark)'
                                        }}>
                                            <HiOutlineUpload size={12} />
                                            <a href={a.fileUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {a.fileName}
                                            </a>
                                            <button type="button" onClick={() => removeAttachment(i, a.publicId)} disabled={removingIndex === i} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}>
                                                {removingIndex === i ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <HiOutlineX size={12} />}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Info Box */}
                        <div style={{
                            background: 'var(--primary-50)', borderRadius: 8, padding: '12px 16px',
                            fontSize: 12, color: 'var(--primary-dark)', border: '1px solid var(--primary-100)'
                        }}>
                            <strong>💡 Tip:</strong> Include specific dates, employee codes, amounts, and any relevant screenshots to help HR resolve your issue faster.
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', padding: '20px 0 0', borderTop: '1px solid var(--border-color)', marginTop: 24 }}>
                        <button type="button" className="btn btn-secondary" onClick={() => navigate('/helpdesk')} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting || uploading}>
                            {submitting ? 'Submitting...' : '🎫 Submit Ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
