import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../../utils/api';
import { uploadToCloudinary } from '../../../utils/cloudinaryUpload';
import {
    HiOutlineArrowLeft, HiOutlineDocumentText, HiOutlineCheckCircle,
    HiOutlineXCircle, HiOutlineClock, HiOutlineRefresh, HiOutlinePaperClip, HiOutlineX, HiOutlineExclamationCircle
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
    CREATED: 'Claim Created', SUBMITTED: 'Submitted', HR_APPROVED: 'HR Admin Approved',
    SUPER_ADMIN_APPROVED: 'Super Admin Approved', CORRECTION_REQUESTED: 'Correction Requested',
    RESUBMITTED: 'Resubmitted', REJECTED: 'Rejected', PAYMENT_INITIATED: 'Payment Initiated',
    PAID: 'Paid', CANCELLED: 'Cancelled', AMOUNT_CHANGED: 'Amount Adjusted', STATUS_CHANGED: 'Updated'
};

const formatCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export default function SuperAdminExpenseDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [claim, setClaim] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Approval panel
    const [approvedAmount, setApprovedAmount] = useState('');
    const [approveComment, setApproveComment] = useState('');
    const [actionReason, setActionReason] = useState('');
    const [actionAttachments, setActionAttachments] = useState([]);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [removingIndex, setRemovingIndex] = useState(null);
    const [actioning, setActioning] = useState(false);
    const [showActionType, setShowActionType] = useState(null); // 'reject' | 'correction'

    // Payment panel
    const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
    const [payrollMonth, setPayrollMonth] = useState('');
    const [transactionRef, setTransactionRef] = useState('');
    const [payRemarks, setPayRemarks] = useState('');
    const [paidAmount, setPaidAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [initiating, setInitiating] = useState(false);
    const [confirming, setConfirming] = useState(false);

    const [paymentAttachments, setPaymentAttachments] = useState([]);
    const [uploadingPaymentAttachment, setUploadingPaymentAttachment] = useState(false);
    const [removingPaymentIndex, setRemovingPaymentIndex] = useState(null);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/expenses/superadmin/${id}`);
            if (data.success) {
                setClaim(data.data);
                setHistory(data.history || []);
                setApprovedAmount(data.data.amountClaimed?.toString() || '');
                setPaidAmount(data.data.amountApproved?.toString() || '');
            }
        } catch { toast.error('Failed to load claim.'); }
        setLoading(false);
    };

    useEffect(() => { fetchDetail(); }, [id]);

    const handleApprove = async () => {
        if (!approvedAmount || Number(approvedAmount) <= 0) { toast.error('Enter a valid approved amount.'); return; }
        setActioning(true);
        try {
            const { data } = await api.post(`/expenses/${id}/superadmin/approve`, { approvedAmount: Number(approvedAmount), comment: approveComment });
            if (data.success) { toast.success('Claim approved!'); fetchDetail(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
        setActioning(false);
    };

    const handleReject = async () => {
        if (!actionReason.trim()) { toast.error('Rejection reason is required.'); return; }
        setActioning(true);
        try {
            const payload = { reason: actionReason };
            if (actionAttachments.length > 0) payload.attachments = actionAttachments;
            const { data } = await api.post(`/expenses/${id}/superadmin/reject`, payload);
            if (data.success) { toast.success('Claim rejected.'); setShowActionType(null); setActionAttachments([]); fetchDetail(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
        setActioning(false);
    };

    const handleCorrection = async () => {
        if (!actionReason.trim()) { toast.error('Correction reason is required.'); return; }
        setActioning(true);
        try {
            const payload = { reason: actionReason };
            if (actionAttachments.length > 0) payload.attachments = actionAttachments;
            const { data } = await api.post(`/expenses/${id}/superadmin/correction`, payload);
            if (data.success) { toast.success('Correction requested.'); setShowActionType(null); setActionAttachments([]); fetchDetail(); }
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

    const handlePaymentFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploadingPaymentAttachment(true);
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
                setPaymentAttachments(prev => [...prev, ...newAttachments]);
            }
        } catch (err) { toast.error('Upload failed'); }
        setUploadingPaymentAttachment(false);
    };

    const removePaymentAttachment = async (index) => {
        setRemovingPaymentIndex(index);
        const attachment = paymentAttachments[index];
        try {
            if (attachment.publicId) {
                await api.delete('/upload/file', { data: { publicId: attachment.publicId } });
            }
            setPaymentAttachments(prev => prev.filter((_, i) => i !== index));
            toast.success('File removed');
        } catch (err) {
            toast.error('Failed to remove file from server.');
        }
        setRemovingPaymentIndex(null);
    };

    const handleInitiatePayment = async () => {
        setInitiating(true);
        try {
            const payload = { method: payMethod, remarks: payRemarks };
            if (payMethod === 'PAYROLL') payload.payrollMonth = payrollMonth;
            if (payMethod !== 'PAYROLL' && paymentAttachments.length > 0) payload.attachments = paymentAttachments;
            const { data } = await api.post(`/expenses/${id}/payment/initiate`, payload);
            if (data.success) { toast.success('Payment initiated!'); fetchDetail(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
        setInitiating(false);
    };

    const handleConfirmPayment = async () => {
        setConfirming(true);
        try {
            const { data } = await api.post(`/expenses/${id}/payment/confirm`, {
                paidAmount: Number(paidAmount) || claim.amountApproved,
                paymentDate,
                transactionReference: transactionRef,
                remarks: payRemarks
            });
            if (data.success) { toast.success('Payment confirmed!'); fetchDetail(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
        setConfirming(false);
    };

    if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
    if (!claim) return <div className="empty-state"><h3>Claim not found</h3></div>;

    const isHRApproved = claim.status === 'HR_APPROVED';
    const isSAApproved = claim.status === 'SUPER_ADMIN_APPROVED';
    const isPaymentPending = claim.status === 'PAYMENT_PENDING';
    const isPaid = claim.status === 'PAID';

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)}><HiOutlineArrowLeft /></button>
                    <div>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {claim.claimNumber}
                            <span className={`badge ${STATUS_LABELS[claim.status]?.badge || 'badge-neutral'}`} style={{ fontSize: 12 }}>
                                {STATUS_LABELS[claim.status]?.label || claim.status}
                            </span>
                        </h1>
                        <p>{claim.employeeId?.firstName} {claim.employeeId?.lastName} · {claim.employeeId?.department} · {claim.categoryId?.name}</p>
                    </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={fetchDetail}><HiOutlineRefresh /></button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                {/* Left: Claim Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 min(100%, 500px)' }}>
                    {/* Claim Info */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Claim Details</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                            {[
                                ['Employee', `${claim.employeeId?.firstName} ${claim.employeeId?.lastName}`],
                                ['Emp Code', claim.employeeId?.employeeCode],
                                ['Department', claim.employeeId?.department],
                                ['Designation', claim.employeeId?.designation],
                                ['Category', claim.categoryId?.name === 'Other' && claim.customCategoryName ? `Other (${claim.customCategoryName})` : claim.categoryId?.name],
                                ['Expense Date', formatDate(claim.expenseDate) + (claim.expenseEndDate ? ' to ' + formatDate(claim.expenseEndDate) : '')],
                                ['Amount Claimed', formatCurrency(claim.amountClaimed)],
                                ['Amount Approved', formatCurrency(claim.amountApproved)],
                                ['Vendor', claim.vendor],
                                ['Location', claim.location],
                                ['Business Purpose', claim.businessPurpose],
                                ['Currency', claim.currency],
                                ['Submitted', formatDateTime(claim.submittedAt)],
                                ['Resolved', formatDateTime(claim.resolvedAt)],
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

                    {/* Payment Info (if paid) */}
                    {(isPaymentPending || isPaid) && claim.payment && (
                        <div className="card" style={{ background: isPaid ? 'rgba(16,185,129,0.05)' : undefined, border: isPaid ? '1px solid rgba(16,185,129,0.3)' : undefined }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Payment Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                                {[
                                    ['Method', claim.payment?.method?.replace('_', ' ')],
                                    ['Paid Amount', formatCurrency(claim.payment?.paidAmount)],
                                    ['Payment Date', formatDate(claim.payment?.paymentDate)],
                                    ['Transaction Ref', claim.payment?.transactionReference],
                                    ['Payroll Month', claim.payment?.payrollMonth],
                                    ['Remarks', claim.payment?.remarks],
                                ].filter(([, v]) => v).map(([label, value]) => (
                                    <div key={label}>
                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)', marginTop: 2 }}>{value || '—'}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* History Timeline */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Activity Timeline</h3>
                        <div>
                            {history.map((h, i) => (
                                <div key={h._id} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                                    <div style={{ flexShrink: 0, width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', marginTop: 4, zIndex: 1 }} />
                                    {i < history.length - 1 && (
                                        <div style={{ position: 'absolute', left: 4, top: 14, bottom: 0, width: 2, background: 'var(--border-color)' }} />
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{ACTION_LABELS[h.action] || h.action}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatDateTime(h.createdAt)}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {h.performedBy?.email} {h.performedByRole && <span style={{ fontSize: 11, padding: '1px 6px', background: 'var(--bg-secondary)', borderRadius: 4 }}>{h.performedByRole}</span>}
                                        </div>
                                        {h.comment && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: 4 }}>"{h.comment}"</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Actions & History */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 340px', maxWidth: '100%' }}>
                    {/* Approval Status */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Approval Status</h3>
                        {/* Step 1 HR */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {['HR_APPROVED', 'SUPER_ADMIN_APPROVED', 'PAYMENT_PENDING', 'PAID'].includes(claim.status) ? 
                                    <HiOutlineCheckCircle size={18} style={{ color: 'var(--success)' }} /> : 
                                 claim.status === 'REJECTED' && claim.hrAdminId && !claim.superAdminId ? 
                                    <HiOutlineXCircle size={18} style={{ color: 'var(--danger)' }} /> : 
                                 claim.status === 'CORRECTION_REQUIRED' ? 
                                    <HiOutlineExclamationCircle size={18} style={{ color: 'var(--warning)' }} /> : 
                                    <HiOutlineClock size={18} style={{ color: 'var(--text-tertiary)' }} />}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Step 1: HR Admin</span>
                            </div>
                            {claim.hrAdminReviewedAt && (
                                <div style={{ paddingLeft: 26, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {claim.hrAdminName || 'HR Admin'} · {formatDate(claim.hrAdminReviewedAt)}
                                    {claim.hrAdminComment && <div style={{ fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: 2 }}>"{claim.hrAdminComment}"</div>}
                                </div>
                            )}
                        </div>
                        {/* Step 2 SA */}
                        <div style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {['SUPER_ADMIN_APPROVED', 'PAYMENT_PENDING', 'PAID'].includes(claim.status) ? 
                                    <HiOutlineCheckCircle size={18} style={{ color: 'var(--success)' }} /> : 
                                 (claim.status === 'REJECTED' && claim.superAdminId ? 
                                    <HiOutlineXCircle size={18} style={{ color: 'var(--danger)' }} /> : 
                                    <HiOutlineClock size={18} style={{ color: 'var(--text-tertiary)' }} />)}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Step 2: Super Admin</span>
                            </div>
                            {claim.superAdminReviewedAt && (
                                <div style={{ paddingLeft: 26, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    {claim.superAdminName || 'Super Admin'} · {formatDate(claim.superAdminReviewedAt)}
                                    {claim.amountApproved != null && <div style={{ fontWeight: 700, color: 'var(--success)' }}>Approved: {formatCurrency(claim.amountApproved)}</div>}
                                    {claim.superAdminComment && <div style={{ fontStyle: 'italic', color: 'var(--text-tertiary)', marginTop: 2 }}>"{claim.superAdminComment}"</div>}
                                </div>
                            )}
                        </div>
                        {/* Step 3 Payment */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                {isPaid ? <HiOutlineCheckCircle size={18} style={{ color: 'var(--success)' }} /> : <HiOutlineClock size={18} style={{ color: 'var(--text-tertiary)' }} />}
                                <span style={{ fontSize: 13, fontWeight: 600 }}>Step 3: Payment</span>
                            </div>
                            {claim.payment?.method && (
                                <div style={{ paddingLeft: 26, fontSize: 12, color: 'var(--text-secondary)' }}>
                                    Method: {claim.payment.method.replace('_', ' ')}
                                    {claim.payment.paidAmount && <div style={{ fontWeight: 700, color: 'var(--success)' }}>Paid: {formatCurrency(claim.payment.paidAmount)}</div>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* HR Approved — Super Admin can approve/reject/correct */}
                    {isHRApproved && (
                        <div className="card" style={{ border: '2px solid var(--primary)' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--primary)' }}>⚡ Requires Your Action</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Claimed: <strong>{formatCurrency(claim.amountClaimed)}</strong>
                            </p>

                            {!showActionType ? (
                                <>
                                    <div className="form-group">
                                        <label className="form-label">Approved Amount (₹) *</label>
                                        <input type="number" className="form-control" value={approvedAmount} min={1} max={claim.amountClaimed}
                                            onChange={e => setApprovedAmount(e.target.value)} />
                                        {approvedAmount && Number(approvedAmount) !== claim.amountClaimed && (
                                            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                                                ⚠ Different from claimed amount — comment required
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Comment {Number(approvedAmount) !== claim.amountClaimed ? '* (required)' : '(optional)'}</label>
                                        <textarea className="form-control" rows={2} value={approveComment}
                                            onChange={e => setApproveComment(e.target.value)} style={{ resize: 'vertical' }} />
                                    </div>
                                    <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handleApprove} disabled={actioning}>
                                        {actioning ? 'Processing...' : '✓ Approve Claim'}
                                    </button>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => { setShowActionType('reject'); setActionReason(''); setActionAttachments([]); }}>
                                            ✕ Reject
                                        </button>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setShowActionType('correction'); setActionReason(''); setActionAttachments([]); }}>
                                            ⚠ Correct
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ background: showActionType === 'reject' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                                        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px', color: showActionType === 'reject' ? '#7f1d1d' : '#92400e' }}>
                                            {showActionType === 'reject' ? '✕ Reject Claim' : '⚠ Request Correction'}
                                        </p>
                                        <textarea className="form-control" rows={3} value={actionReason}
                                            onChange={e => setActionReason(e.target.value)}
                                            placeholder={showActionType === 'reject' ? 'Rejection reason...' : 'What needs to be corrected?'}
                                            style={{ resize: 'vertical' }} />
                                            
                                        <div style={{ marginTop: 12 }}>
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
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => setShowActionType(null)} disabled={actioning}>Back</button>
                                        <button
                                            className={`btn btn-sm ${showActionType === 'reject' ? 'btn-danger' : 'btn-secondary'}`}
                                            style={{ flex: 1 }}
                                            onClick={showActionType === 'reject' ? handleReject : handleCorrection}
                                            disabled={actioning}>
                                            {actioning ? '...' : showActionType === 'reject' ? 'Confirm Reject' : 'Send Correction'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* SUPER_ADMIN_APPROVED — Initiate Payment */}
                    {isSAApproved && (
                        <div className="card" style={{ border: '2px solid var(--success)' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--success)' }}>💰 Initiate Payment</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Approved Amount: <strong>{formatCurrency(claim.amountApproved)}</strong>
                            </p>

                            <div className="form-group">
                                <label className="form-label">Payment Method *</label>
                                <select className="form-control" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                                    <option value="BANK_TRANSFER">Bank Transfer</option>
                                    <option value="PAYROLL">Add to Payroll</option>
                                    <option value="CASH">Cash</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            {payMethod === 'PAYROLL' && (
                                <div className="form-group">
                                    <label className="form-label">Payroll Month * (YYYY-MM)</label>
                                    <input type="month" className="form-control" value={payrollMonth}
                                        onChange={e => setPayrollMonth(e.target.value)} />
                                    {payrollMonth && (
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, padding: '8px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 6 }}>
                                            This will add <strong>{formatCurrency(claim.amountApproved)}</strong> as reimbursement in{' '}
                                            <strong>{monthNames[parseInt(payrollMonth.split('-')[1]) - 1]} {payrollMonth.split('-')[0]}</strong> payroll.
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Remarks</label>
                                <input type="text" className="form-control" value={payRemarks} onChange={e => setPayRemarks(e.target.value)} placeholder="Optional remarks..." />
                            </div>

                            {payMethod !== 'PAYROLL' && (
                                <div style={{ marginBottom: 16 }}>
                                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Attachments (Optional)</p>
                                    
                                    {paymentAttachments.length > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                                            {paymentAttachments.map((att, idx) => (
                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                                                    <HiOutlinePaperClip size={16} />
                                                    <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.fileName}</span>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => removePaymentAttachment(idx)} 
                                                        disabled={removingPaymentIndex === idx}
                                                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                                                    >
                                                        {removingPaymentIndex === idx ? <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <HiOutlineX size={14} />}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    <label className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        {uploadingPaymentAttachment ? 'Uploading...' : <><HiOutlinePaperClip /> Attach Proof</>}
                                        <input type="file" multiple style={{ display: 'none' }} accept="image/*,.pdf" onChange={handlePaymentFileUpload} disabled={uploadingPaymentAttachment} />
                                    </label>
                                </div>
                            )}

                            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleInitiatePayment} disabled={initiating || (payMethod === 'PAYROLL' && !payrollMonth)}>
                                {initiating ? 'Initiating...' : 'Initiate Payment'}
                            </button>
                        </div>
                    )}

                    {/* PAYMENT_PENDING — Confirm Payment */}
                    {isPaymentPending && (
                        <div className="card" style={{ border: '2px solid #f59e0b' }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: '#92400e' }}>✅ Confirm Payment</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                Method: <strong>{claim.payment?.method?.replace('_', ' ')}</strong>
                                {claim.payment?.payrollMonth && ` · Payroll Month: ${claim.payment.payrollMonth}`}
                            </p>

                            {claim.payment?.method === 'PAYROLL' && (
                                <div style={{ background: 'rgba(99,102,241,0.08)', padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
                                    Confirming will add <strong>{formatCurrency(claim.amountApproved)}</strong> to payroll for <strong>{claim.payment.payrollMonth}</strong>.
                                </div>
                            )}

                            <div className="form-group">
                                <label className="form-label">Paid Amount</label>
                                <input type="number" className="form-control" value={paidAmount}
                                    onChange={e => setPaidAmount(e.target.value)} min={1} disabled={claim.payment?.method === 'PAYROLL'} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Payment Date</label>
                                <input type="date" className="form-control" value={paymentDate}
                                    onChange={e => setPaymentDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Transaction Reference</label>
                                <input type="text" className="form-control" value={transactionRef}
                                    onChange={e => setTransactionRef(e.target.value)} placeholder="UTR / Ref number..." />
                            </div>

                            <button className="btn btn-primary" style={{ width: '100%', background: 'var(--success)' }} onClick={handleConfirmPayment} disabled={confirming}>
                                {confirming ? 'Confirming...' : '✓ Confirm Payment'}
                            </button>
                        </div>
                    )}

                    {/* Paid — read only */}
                    {isPaid && (
                        <div className="card" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid var(--success)' }}>
                            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--success)', margin: '0 0 4px' }}>✅ Claim Fully Processed</p>
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                                Amount {formatCurrency(claim.payment?.paidAmount)} paid via {claim.payment?.method?.replace('_', ' ')}.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
