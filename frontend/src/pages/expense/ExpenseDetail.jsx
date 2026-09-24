import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import {
    HiOutlineArrowLeft, HiOutlineDocumentText, HiOutlineCheckCircle,
    HiOutlineXCircle, HiOutlineClock, HiOutlineRefresh, HiOutlineUpload, HiOutlineX, HiOutlinePaperClip, HiOutlineExclamationCircle
} from 'react-icons/hi';

const STATUS_LABELS = {
    DRAFT: { label: 'Draft', badge: 'badge-neutral' },
    SUBMITTED: { label: 'Submitted', badge: 'badge-info' },
    HR_APPROVED: { label: 'HR Approved', badge: 'badge-primary' },
    SUPER_ADMIN_APPROVED: { label: 'Fully Approved', badge: 'badge-primary' },
    CORRECTION_REQUIRED: { label: 'Correction Required', badge: 'badge-warning' },
    REJECTED: { label: 'Rejected', badge: 'badge-danger' },
    PAYMENT_PENDING: { label: 'Payment Pending', badge: 'badge-warning' },
    PAID: { label: 'Paid ✓', badge: 'badge-success' },
    CANCELLED: { label: 'Cancelled', badge: 'badge-neutral' }
};

const ACTION_LABELS = {
    CREATED: 'Claim Created', SUBMITTED: 'Claim Submitted', HR_APPROVED: 'HR Admin Approved',
    SUPER_ADMIN_APPROVED: 'Super Admin Approved', CORRECTION_REQUESTED: 'Correction Requested',
    RESUBMITTED: 'Resubmitted', REJECTED: 'Rejected', PAYMENT_INITIATED: 'Payment Initiated',
    PAID: 'Payment Confirmed', CANCELLED: 'Claim Cancelled', AMOUNT_CHANGED: 'Amount Adjusted',
    STATUS_CHANGED: 'Details Updated'
};

const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

export default function ExpenseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const fileInputRef = useRef();

    const [claim, setClaim] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCancel, setShowCancel] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Edit mode
    const [editMode, setEditMode] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [categories, setCategories] = useState([]);
    const [editReceipts, setEditReceipts] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [removingIndex, setRemovingIndex] = useState(null);
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [isMultiDay, setIsMultiDay] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/expenses/${id}`);
            if (data.success) {
                setClaim(data.data);
                setHistory(data.history || []);
                setEditForm({
                    categoryId: data.data.categoryId?._id || '',
                    expenseDate: data.data.expenseDate ? data.data.expenseDate.split('T')[0] : '',
                    expenseEndDate: data.data.expenseEndDate ? data.data.expenseEndDate.split('T')[0] : '',
                    amountClaimed: data.data.amountClaimed,
                    description: data.data.description || '',
                    vendor: data.data.vendor || '',
                    location: data.data.location || '',
                    businessPurpose: data.data.businessPurpose || '',
                    notes: data.data.notes || '',
                    customCategoryName: data.data.customCategoryName || ''
                });
                setIsMultiDay(!!data.data.expenseEndDate);
                setEditReceipts(data.data.receipts?.length ? data.data.receipts : (data.data.receipt ? [data.data.receipt] : []));
            }
        } catch (err) {
            toast.error('Failed to load claim details.');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchDetail();
        api.get('/expenses/categories').then(({ data }) => { if (data.success) setCategories(data.data); }).catch(() => { });
    }, [id]);

    const handleCancel = async () => {
        setCancelling(true);
        try {
            const { data } = await api.post(`/expenses/${id}/cancel`);
            if (data.success) { toast.success('Claim cancelled.'); fetchDetail(); setShowCancel(false); }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to cancel claim.');
        }
        setCancelling(false);
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const { data } = await api.delete(`/expenses/${id}`);
            if (data.success) { 
                toast.success('Claim deleted successfully.'); 
                navigate('/expenses/my'); 
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete claim.');
        }
        setDeleting(false);
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        try {
            const payload = { ...editForm, expenseEndDate: isMultiDay ? editForm.expenseEndDate : null, amountClaimed: Number(editForm.amountClaimed), receipts: editReceipts };
            const { data } = await api.put(`/expenses/${id}`, payload);
            if (data.success) { toast.success('Claim updated!'); setEditMode(false); fetchDetail(); }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Update failed.');
        }
        setSaving(false);
    };

    const handleResubmit = async () => {
        setSubmitting(true);
        try {
            const payload = { ...editForm, expenseEndDate: isMultiDay ? editForm.expenseEndDate : null, amountClaimed: Number(editForm.amountClaimed), receipts: editReceipts };
            const { data } = await api.post(`/expenses/${id}/resubmit`, payload);
            if (data.success) {
                toast.success('Claim resubmitted successfully!');
                setEditMode(false);
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Resubmit failed.');
        }
        setSubmitting(false);
    };

    const uploadToCloudinary = async (file) => {
        try {
            const { data: sigData } = await api.post('/upload/signature', { folder: 'hrms/expenses' });
            const { signature, timestamp, folder, cloudName, apiKey } = sigData.data;
            const fd = new FormData();
            fd.append('file', file);
            fd.append('api_key', apiKey);
            fd.append('timestamp', timestamp);
            fd.append('signature', signature);
            fd.append('folder', folder);
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: fd });
            const result = await response.json();
            if (result.error) throw new Error(result.error.message);
            return { fileName: file.name, fileUrl: result.secure_url, publicId: result.public_id, fileType: file.type, fileSize: file.size, uploadedAt: new Date().toISOString() };
        } catch (err) {
            toast.error(`Failed to upload ${file.name}: ` + err.message);
            return null;
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const validFiles = files.filter(file => {
            if (!ALLOWED_TYPES.includes(file.type)) { toast.error(`${file.name}: Only PDF, JPG, PNG allowed.`); return false; }
            if (file.size > MAX_FILE_SIZE) { toast.error(`${file.name}: File must be under 5MB.`); return false; }
            return true;
        });

        if (!validFiles.length) return;

        setUploadingFile(true);
        const uploadPromises = validFiles.map(file => uploadToCloudinary(file));
        const results = await Promise.all(uploadPromises);
        
        const successfulUploads = results.filter(r => r !== null);
        if (successfulUploads.length > 0) {
            setEditReceipts(prev => [...prev, ...successfulUploads]);
            toast.success(`${successfulUploads.length} receipt(s) uploaded successfully!`);
        }
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveReceipt = async (index, publicId) => {
        setRemovingIndex(index);
        try {
            if (publicId) {
                await api.delete('/upload/file', { data: { publicId } });
            }
            setEditReceipts(prev => prev.filter((_, i) => i !== index));
            toast.success('Receipt removed.');
        } catch (err) {
            toast.error('Failed to remove receipt from server.');
        }
        setRemovingIndex(null);
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
    if (!claim) return <div className="empty-state"><h3>Claim not found</h3></div>;

    const canEdit = ['DRAFT', 'SUBMITTED', 'CORRECTION_REQUIRED'].includes(claim.status);
    const canSubmitDraft = claim.status === 'DRAFT';
    const canCancel = ['DRAFT', 'SUBMITTED'].includes(claim.status);
    const isCorrectionRequired = claim.status === 'CORRECTION_REQUIRED';

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/expenses/my')}><HiOutlineArrowLeft /></button>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {claim.claimNumber}
                            <span className={`badge ${STATUS_LABELS[claim.status]?.badge || 'badge-neutral'}`} style={{ fontSize: 12 }}>
                                {STATUS_LABELS[claim.status]?.label || claim.status}
                            </span>
                        </h1>
                        <p>{claim.categoryId?.name} · {formatDate(claim.expenseDate)}</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchDetail}><HiOutlineRefresh /></button>
                    {canEdit && !editMode && (
                        <button className="btn btn-secondary" onClick={() => setEditMode(true)}>Edit</button>
                    )}
                    {canCancel && (
                        <>
                            <button className="btn btn-danger" onClick={() => setShowCancel(true)}>Cancel Claim</button>
                            <button className="btn btn-danger" onClick={() => setShowDelete(true)}>Delete</button>
                        </>
                    )}
                </div>
            </div>

            {/* Correction Required Alert */}
            {isCorrectionRequired && (
                <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#92400e', fontSize: 14 }}>⚠ Correction Required</p>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350f' }}>{claim.correctionReason}</p>
                    {claim.correctionAttachments?.length > 0 && (
                        <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {claim.correctionAttachments.map((att, i) => (
                                <a key={i} href={att.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                    <HiOutlinePaperClip /> {att.fileName || `Attachment ${i + 1}`}
                                </a>
                            ))}
                        </div>
                    )}
                    {!editMode && (
                        <button className="btn btn-primary btn-sm" onClick={() => setEditMode(true)}>
                            Edit and Resubmit
                        </button>
                    )}
                </div>
            )}

            {/* Rejection Alert */}
            {claim.status === 'REJECTED' && (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#7f1d1d', fontSize: 14 }}>✕ Claim Rejected</p>
                    <p style={{ margin: '0 0 12px', fontSize: 13, color: '#991b1b' }}>Reason: {claim.rejectionReason}</p>
                    {claim.rejectionAttachments?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {claim.rejectionAttachments.map((att, i) => (
                                <a key={i} href={att.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                    <HiOutlinePaperClip /> {att.fileName || `Attachment ${i + 1}`}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                {/* Left: Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 min(100%, 500px)' }}>
                    {/* Claim Details */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                            Claim Details
                            {editMode && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--primary)', marginLeft: 8 }}>— Edit Mode</span>}
                        </h3>

                        {editMode ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                                {/* Multiple Days Checkbox */}
                                <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: -8 }}>
                                    <input
                                        type="checkbox"
                                        id="isMultiDayEdit"
                                        checked={isMultiDay}
                                        onChange={(e) => {
                                            setIsMultiDay(e.target.checked);
                                            if (!e.target.checked) setEditForm(f => ({ ...f, expenseEndDate: '' }));
                                        }}
                                        style={{ width: 16, height: 16, cursor: 'pointer' }}
                                    />
                                    <label htmlFor="isMultiDayEdit" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>Multiple Days / Multi-Day Expense</label>
                                </div>

                                <div className="form-group" style={!isMultiDay ? { gridColumn: '1 / -1' } : {}}>
                                    <label className="form-label">{isMultiDay ? 'From Date *' : 'Expense Date *'}</label>
                                    <input type="date" className="form-control" value={editForm.expenseDate}
                                        onChange={e => setEditForm(f => ({ ...f, expenseDate: e.target.value }))} />
                                </div>
                                {isMultiDay && (
                                    <div className="form-group">
                                        <label className="form-label">To Date (Optional)</label>
                                        <input type="date" className="form-control" value={editForm.expenseEndDate || ''} min={editForm.expenseDate}
                                            onChange={e => setEditForm(f => ({ ...f, expenseEndDate: e.target.value }))} />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Category *</label>
                                    <select className="form-control" value={editForm.categoryId} onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}>
                                        <option value="">Select</option>
                                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                                    </select>
                                </div>
                                {categories.find(c => c._id === editForm.categoryId)?.name === 'Other' && (
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Specify Expense Category *</label>
                                        <input type="text" className="form-control" value={editForm.customCategoryName}
                                            onChange={e => setEditForm(f => ({ ...f, customCategoryName: e.target.value }))}
                                            placeholder="e.g. Software Subscription" />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Amount (₹) *</label>
                                    <input type="number" className="form-control" value={editForm.amountClaimed} min={1}
                                        onChange={e => setEditForm(f => ({ ...f, amountClaimed: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Vendor</label>
                                    <input type="text" className="form-control" value={editForm.vendor}
                                        onChange={e => setEditForm(f => ({ ...f, vendor: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input type="text" className="form-control" value={editForm.location}
                                        onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Business Purpose</label>
                                    <input type="text" className="form-control" value={editForm.businessPurpose}
                                        onChange={e => setEditForm(f => ({ ...f, businessPurpose: e.target.value }))} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Description *</label>
                                    <textarea className="form-control" value={editForm.description} rows={3} maxLength={2000}
                                        onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
                                </div>
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Notes</label>
                                    <textarea className="form-control" value={editForm.notes} rows={2}
                                        onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                                </div>

                                {/* Edit Receipt */}
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="form-label">Receipts</label>
                                    {editReceipts.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                            {editReceipts.map((r, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                        <HiOutlineDocumentText size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                                        <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.fileName}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                        <a href={r.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--primary)' }}>View</a>
                                                        <button className="btn-icon" onClick={() => handleRemoveReceipt(i, r.publicId)} disabled={removingIndex === i} style={{ color: 'var(--danger)', padding: 2 }}>
                                                            {removingIndex === i ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <HiOutlineX size={16} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed var(--border-color)', borderRadius: 8, padding: '16px', textAlign: 'center', cursor: 'pointer' }}>
                                        {uploadingFile ? <><div className="spinner" style={{ margin: '0 auto 6px' }} /><p style={{ fontSize: 12, margin: 0 }}>Uploading...</p></> :
                                            <><HiOutlineUpload size={20} style={{ color: 'var(--text-tertiary)', marginBottom: 4 }} /><p style={{ fontSize: 12, margin: 0, color: 'var(--text-secondary)' }}>Click to upload {editReceipts.length > 0 ? 'more receipts' : 'receipt'}</p></>}
                                    </div>
                                    <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
                                </div>

                                {/* Edit buttons */}
                                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(false)} disabled={saving || submitting}>Cancel</button>
                                    <button className="btn btn-secondary btn-sm" onClick={handleSaveEdit} disabled={saving || submitting}>
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    {isCorrectionRequired && (
                                        <button className="btn btn-primary btn-sm" onClick={handleResubmit} disabled={saving || submitting}>
                                            {submitting ? 'Submitting...' : 'Save & Resubmit'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px 24px' }}>
                                {[
                                    ['Category', claim.categoryId?.name === 'Other' && claim.customCategoryName ? `Other (${claim.customCategoryName})` : claim.categoryId?.name],
                                    ['Expense Date', formatDate(claim.expenseDate) + (claim.expenseEndDate ? ' to ' + formatDate(claim.expenseEndDate) : '')],
                                    ['Amount Claimed', formatCurrency(claim.amountClaimed)],
                                    ['Amount Approved', formatCurrency(claim.amountApproved)],
                                    ['Vendor', claim.vendor],
                                    ['Location', claim.location],
                                    ['Business Purpose', claim.businessPurpose],
                                    ['Currency', claim.currency],
                                ].map(([label, value]) => (
                                    <div key={label}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 2 }}>{value || '—'}</div>
                                    </div>
                                ))}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</div>
                                    <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.6 }}>{claim.description || '—'}</div>
                                </div>
                                {claim.notes && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notes</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 2 }}>{claim.notes}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Receipt */}
                    {!editMode && (
                        <div className="card">
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Receipts</h3>
                            {(() => {
                                const allReceipts = claim.receipts?.length > 0 ? claim.receipts : (claim.receipt ? [claim.receipt] : []);
                                if (allReceipts.length === 0) {
                                    return <p style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>No receipts uploaded.</p>;
                                }
                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {allReceipts.map((r, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                                                <HiOutlineDocumentText size={24} style={{ color: 'var(--primary)' }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.fileName}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.fileType} · {(r.fileSize / 1024).toFixed(1)} KB</div>
                                                </div>
                                                <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View ↗</a>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* History Timeline */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Activity Timeline</h3>
                        <div style={{ position: 'relative' }}>
                            {history.map((h, i) => (
                                <div key={h._id} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                    <div style={{ flexShrink: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', marginTop: 4, zIndex: 1 }} />
                                    {i < history.length - 1 && (
                                        <div style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 2, background: 'var(--border-color)' }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {ACTION_LABELS[h.action] || h.action}
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                                                {formatDateTime(h.createdAt)}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {h.performedBy?.email} {h.performedByRole && <span style={{ fontSize: 11, padding: '1px 6px', background: 'var(--bg-secondary)', borderRadius: 4 }}>{h.performedByRole}</span>}
                                        </div>
                                        {h.comment && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, fontStyle: 'italic' }}>"{h.comment}"</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Status + Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 340px', maxWidth: '100%' }}>
                    {/* Approval Status */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Approval Status</h3>

                        {/* Step 1 */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {['HR_APPROVED', 'SUPER_ADMIN_APPROVED', 'PAYMENT_PENDING', 'PAID'].includes(claim.status) ? 
                                    <HiOutlineCheckCircle size={18} style={{ color: 'var(--success)' }} /> : 
                                 (claim.status === 'REJECTED' && claim.hrAdminId && !claim.superAdminId ? 
                                    <HiOutlineXCircle size={18} style={{ color: 'var(--danger)' }} /> : 
                                 (claim.status === 'CORRECTION_REQUIRED' ? 
                                    <HiOutlineExclamationCircle size={18} style={{ color: 'var(--warning)' }} /> : 
                                    <HiOutlineClock size={18} style={{ color: 'var(--text-tertiary)' }} />))}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Step 1: HR Admin Review</span>
                            </div>
                            {claim.hrAdminReviewedAt ? (
                                <div style={{ paddingLeft: 26 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{claim.hrAdminName || 'HR Admin'} · {formatDate(claim.hrAdminReviewedAt)}</div>
                                    {claim.hrAdminComment && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 2 }}>"{claim.hrAdminComment}"</div>}
                                </div>
                            ) : (
                                <div style={{ paddingLeft: 26, fontSize: 12, color: 'var(--text-tertiary)' }}>Awaiting HR review</div>
                            )}
                        </div>

                        {/* Step 2 */}
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {['SUPER_ADMIN_APPROVED', 'PAYMENT_PENDING', 'PAID'].includes(claim.status) ? 
                                    <HiOutlineCheckCircle size={18} style={{ color: 'var(--success)' }} /> : 
                                 (claim.status === 'REJECTED' && claim.superAdminId ? 
                                    <HiOutlineXCircle size={18} style={{ color: 'var(--danger)' }} /> : 
                                    <HiOutlineClock size={18} style={{ color: 'var(--text-tertiary)' }} />)}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Step 2: Super Admin Review</span>
                            </div>
                            {claim.superAdminReviewedAt ? (
                                <div style={{ paddingLeft: 26 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{claim.superAdminName || 'Super Admin'} · {formatDate(claim.superAdminReviewedAt)}</div>
                                    {claim.superAdminComment && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 2 }}>"{claim.superAdminComment}"</div>}
                                    {claim.amountApproved != null && (
                                        <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginTop: 2 }}>Approved: {formatCurrency(claim.amountApproved)}</div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ paddingLeft: 26, fontSize: 12, color: 'var(--text-tertiary)' }}>Awaiting Super Admin review</div>
                            )}
                        </div>

                        {/* Step 3: Payment */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {claim.status === 'PAID' ? <HiOutlineCheckCircle size={18} style={{ color: 'var(--success)' }} /> : <HiOutlineClock size={18} style={{ color: 'var(--text-tertiary)' }} />}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Step 3: Payment</span>
                            </div>
                            {claim.payment?.method ? (
                                <div style={{ paddingLeft: 26 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        Method: <strong>{claim.payment.method.replace('_', ' ')}</strong>
                                    </div>
                                    {claim.payment.paymentDate && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Date: {formatDate(claim.payment.paymentDate)}</div>}
                                    {claim.payment.transactionReference && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ref: {claim.payment.transactionReference}</div>}
                                    {claim.payment.paidAmount && <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Paid: {formatCurrency(claim.payment.paidAmount)}</div>}
                                    {claim.payment.payrollMonth && (() => {
                                        const [y, m] = claim.payment.payrollMonth.split('-');
                                        const monthName = new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
                                        return (
                                            <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                                                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>Added to Payroll</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                                                    This amount will be added to your <strong>{monthName}</strong> payroll. Once the payroll is generated, you will see this amount as a reimbursement in your payslip.
                                                </div>
                                            </div>
                                        );
                                    })()}
                                    {claim.payment.paymentAttachments?.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                                            {claim.payment.paymentAttachments.map((att, i) => (
                                                <a key={i} href={att.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                                                    <HiOutlinePaperClip /> {att.fileName || `Payment Proof ${i + 1}`}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div style={{ paddingLeft: 26, fontSize: 12, color: 'var(--text-tertiary)' }}>Payment not yet processed</div>
                            )}
                        </div>
                    </div>

                    {/* Draft: Submit button */}
                    {canSubmitDraft && !editMode && (
                        <div className="card">
                            <button className="btn btn-primary" style={{ width: '100%' }}
                                onClick={async () => {
                                    try {
                                        const { data } = await api.post(`/expenses/${id}/submit`);
                                        if (data.success) { toast.success('Claim submitted!'); fetchDetail(); }
                                    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit.'); }
                                }}>
                                Submit Claim
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Cancel Confirm Modal */}
            {showCancel && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: 400, maxWidth: '90vw' }}>
                        <h3 style={{ marginBottom: 12 }}>Cancel Claim?</h3>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Are you sure you want to cancel claim <strong>{claim.claimNumber}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowCancel(false)} disabled={cancelling}>Go Back</button>
                            <button className="btn btn-danger btn-sm" onClick={handleCancel} disabled={cancelling}>
                                {cancelling ? 'Cancelling...' : 'Yes, Cancel Claim'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {showDelete && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: 400, maxWidth: '90vw' }}>
                        <h3 style={{ marginBottom: 12 }}>Delete Claim?</h3>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Are you sure you want to completely delete claim <strong>{claim.claimNumber}</strong>? This action is permanent.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowDelete(false)} disabled={deleting}>Go Back</button>
                            <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                                {deleting ? 'Deleting...' : 'Yes, Delete Claim'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
