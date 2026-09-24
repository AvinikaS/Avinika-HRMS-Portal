import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../utils/api';
import { uploadToCloudinary } from '../../../utils/cloudinaryUpload';
import { HiOutlineArrowLeft, HiOutlineDocumentText, HiOutlineCheckCircle, HiOutlineClock, HiOutlineRefresh, HiOutlinePaperClip, HiOutlineX } from 'react-icons/hi';

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
    CREATED: 'Claim Created', SUBMITTED: 'Submitted', HR_APPROVED: 'HR Admin Approved',
    SUPER_ADMIN_APPROVED: 'Super Admin Approved', CORRECTION_REQUESTED: 'Correction Requested',
    RESUBMITTED: 'Resubmitted', REJECTED: 'Rejected', PAYMENT_INITIATED: 'Payment Initiated',
    PAID: 'Paid', CANCELLED: 'Cancelled', AMOUNT_CHANGED: 'Amount Adjusted', STATUS_CHANGED: 'Updated'
};

const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function HRAdminExpenseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [claim, setClaim] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionModal, setActionModal] = useState(null);
    const [actionComment, setActionComment] = useState('');
    const [actionReason, setActionReason] = useState('');
    const [actionAttachments, setActionAttachments] = useState([]);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [removingIndex, setRemovingIndex] = useState(null);
    const [actioning, setActioning] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/expenses/hradmin/${id}`);
            if (data.success) { setClaim(data.data); setHistory(data.history || []); }
        } catch { toast.error('Failed to load claim.'); }
        setLoading(false);
    };

    useEffect(() => { fetchDetail(); }, [id]);

    const handleApprove = async () => {
        setActioning(true);
        try {
            const { data } = await api.post(`/expenses/${id}/hradmin/approve`, { comment: actionComment });
            if (data.success) { toast.success('Claim approved!'); setActionModal(null); fetchDetail(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
        setActioning(false);
    };

    const handleAction = async () => {
        if (!actionReason.trim()) { toast.error('Reason is required.'); return; }
        setActioning(true);
        try {
            const url = actionModal === 'reject' ? `/expenses/${id}/hradmin/reject` : `/expenses/${id}/hradmin/correction`;
            const payload = { reason: actionReason };
            if (actionAttachments.length > 0) payload.attachments = actionAttachments;
            const { data } = await api.post(url, payload);
            if (data.success) { toast.success(actionModal === 'reject' ? 'Claim rejected.' : 'Correction requested.'); setActionModal(null); setActionAttachments([]); fetchDetail(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
        setActioning(false);
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploadingAttachment(true);
        try {
            const uploadPromises = files.map(file => uploadToCloudinary(file, 'hrms/expenses'));
            const results = await Promise.all(uploadPromises);
            const successfulUploads = results.filter(r => r !== null);
            if (successfulUploads.length > 0) {
                const newAttachments = successfulUploads.map((res, i) => ({
                    fileName: files[i].name,
                    fileUrl: res.url,
                    publicId: res.publicId,
                    fileType: files[i].type,
                    fileSize: res.size
                }));
                setActionAttachments(prev => [...prev, ...newAttachments]);
            }
        } catch (err) { toast.error('Upload failed'); }
        setUploadingAttachment(false);
    };

    const removeAttachment = async (index) => {
        setRemovingIndex(index);
        const attachment = actionAttachments[index];
        try {
            if (attachment.publicId) {
                await api.delete('/upload/file', { data: { publicId: attachment.publicId } });
            }
            setActionAttachments(prev => prev.filter((_, i) => i !== index));
            toast.success('File removed');
        } catch (err) {
            toast.error('Failed to remove file from server.');
        }
        setRemovingIndex(null);
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
    if (!claim) return <div className="empty-state"><h3>Claim not found</h3></div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/expenses/pending')}><HiOutlineArrowLeft /></button>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {claim.claimNumber}
                            <span className={`badge ${STATUS_LABELS[claim.status]?.badge || 'badge-neutral'}`} style={{ fontSize: 12 }}>
                                {STATUS_LABELS[claim.status]?.label || claim.status}
                            </span>
                        </h1>
                        <p>{claim.employeeId?.firstName} {claim.employeeId?.lastName} · {claim.employeeId?.department}</p>
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchDetail}><HiOutlineRefresh /></button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 min(100%, 500px)' }}>
                    {/* Claim Details */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Claim Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px 24px' }}>
                            {[
                                ['Employee', `${claim.employeeId?.firstName} ${claim.employeeId?.lastName}`],
                                ['Emp Code', claim.employeeId?.employeeCode],
                                ['Department', claim.employeeId?.department],
                                ['Designation', claim.employeeId?.designation],
                                ['Category', claim.categoryId?.name === 'Other' && claim.customCategoryName ? `Other (${claim.customCategoryName})` : claim.categoryId?.name],
                                ['Expense Date', formatDate(claim.expenseDate) + (claim.expenseEndDate ? ' to ' + formatDate(claim.expenseEndDate) : '')],
                                ['Amount Claimed', formatCurrency(claim.amountClaimed)],
                                ['Vendor', claim.vendor],
                                ['Location', claim.location],
                                ['Business Purpose', claim.businessPurpose],
                                ['Submitted', formatDateTime(claim.submittedAt)],
                            ].map(([label, value]) => (
                                <div key={label}>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                                    <div style={{ fontSize: 14, marginTop: 2 }}>{value || '—'}</div>
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>Description</div>
                                <div style={{ fontSize: 14, marginTop: 2, lineHeight: 1.6 }}>{claim.description}</div>
                            </div>
                        </div>
                    </div>

                    {/* Receipt */}
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
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8 }}>
                                            <HiOutlineDocumentText size={24} style={{ color: 'var(--primary)' }} />
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{r.fileName}</div>
                                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{(r.fileSize / 1024).toFixed(1)} KB</div>
                                            </div>
                                            <a href={r.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">View ↗</a>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* History */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Activity Timeline</h3>
                        {history.map((h, i) => (
                            <div key={h._id} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                <div style={{ flexShrink: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', marginTop: 4, zIndex: 1 }} />
                                {i < history.length - 1 && <div style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 2, background: 'var(--border-color)' }} />}
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{ACTION_LABELS[h.action] || h.action}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDateTime(h.createdAt)}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{h.performedBy?.email}</div>
                                    {h.comment && <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: 4 }}>"{h.comment}"</div>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Actions */}
                <div style={{ flex: '1 1 340px', maxWidth: '100%' }}>
                    {claim.status === 'SUBMITTED' ? (
                        <div className="card" style={{ border: '2px solid var(--primary)' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--primary)' }}>⚡ Your Action Required</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Claim amount: <strong>{formatCurrency(claim.amountClaimed)}</strong></p>

                            {!actionModal ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <button className="btn btn-primary" onClick={() => { setActionModal('approve'); setActionComment(''); setActionAttachments([]); }}>✓ Approve</button>
                                    <button className="btn btn-danger" onClick={() => { setActionModal('reject'); setActionReason(''); setActionAttachments([]); }}>✕ Reject</button>
                                    <button className="btn btn-secondary" onClick={() => { setActionModal('correction'); setActionReason(''); setActionAttachments([]); }}>⚠ Request Correction</button>
                                </div>
                            ) : (
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                                        {actionModal === 'approve' ? 'Approve with Comment' : actionModal === 'reject' ? 'Rejection Reason *' : 'Correction Reason *'}
                                    </p>
                                    <textarea className="form-control" rows={3} value={actionModal === 'approve' ? actionComment : actionReason}
                                        onChange={e => actionModal === 'approve' ? setActionComment(e.target.value) : setActionReason(e.target.value)}
                                        placeholder={actionModal === 'approve' ? 'Optional comment...' : 'Required...'}
                                        style={{ resize: 'vertical', marginBottom: 12 }} />
                                    
                                    {actionModal !== 'approve' && (
                                        <div style={{ marginBottom: 16 }}>
                                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Attachments (Optional)</p>
                                            
                                            {actionAttachments.length > 0 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                                    {actionAttachments.map((att, idx) => (
                                                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                                                            <HiOutlinePaperClip size={16} />
                                                            <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.fileName}</span>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => removeAttachment(idx)} 
                                                                disabled={removingIndex === idx}
                                                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                            >
                                                                {removingIndex === idx ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <HiOutlineX size={14} />}
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                            
                                            <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                {uploadingAttachment ? 'Uploading...' : <><HiOutlinePaperClip /> Attach Proof</>}
                                                <input type="file" multiple style={{ display: 'none' }} accept="image/*,.pdf" onChange={handleFileUpload} disabled={uploadingAttachment} />
                                            </label>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setActionModal(null)} disabled={actioning}>Back</button>
                                        <button
                                            className={`btn btn-sm ${actionModal === 'approve' ? 'btn-primary' : actionModal === 'reject' ? 'btn-danger' : 'btn-secondary'}`}
                                            style={{ flex: 1 }}
                                            onClick={actionModal === 'approve' ? handleApprove : handleAction}
                                            disabled={actioning}>
                                            {actioning ? '...' : 'Confirm'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="card">
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Status</h3>
                            <span className={`badge ${STATUS_LABELS[claim.status]?.badge || 'badge-neutral'}`}>
                                {STATUS_LABELS[claim.status]?.label || claim.status}
                            </span>
                            {claim.rejectionReason && (
                                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, fontSize: 13, color: '#7f1d1d' }}>
                                    Rejected: {claim.rejectionReason}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
