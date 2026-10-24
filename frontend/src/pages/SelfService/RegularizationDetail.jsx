import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import {
    HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineXCircle,
    HiOutlineExclamationCircle, HiOutlinePaperClip, HiOutlineCloudUpload, HiOutlineTrash, HiOutlineX,
    HiOutlineUser
} from 'react-icons/hi';

export default function RegularizationDetail() {
    const { isExEmployee } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const handleBack = () => {
        const fromTab = location.state?.fromTab;
        if (fromTab === 'history') {
            navigate('/my-regularizations?tab=history');
        } else if (fromTab === 'pending') {
            navigate('/my-regularizations');
        } else {
            navigate(-1);
        }
    };

    const [record, setRecord] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Response state for INFORMATION_REQUIRED
    const [replyComment, setReplyComment] = useState('');
    const [replyAttachments, setReplyAttachments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [deletingIndex, setDeletingIndex] = useState(null);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance/regularization/${id}`);
            if (res.data.success) {
                setRecord(res.data.data);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load regularization details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const sigRes = await api.post('/upload/signature', { folder: 'hrms/regularizations' });
            if (!sigRes.data.success) throw new Error('Signature error');
            const { signature, timestamp, folder, cloudName, apiKey } = sigRes.data.data;

            const formData = new FormData();
            formData.append('file', file);
            formData.append('signature', signature);
            formData.append('timestamp', timestamp);
            formData.append('folder', folder);
            formData.append('api_key', apiKey);

            const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
            const uploadRes = await fetch(uploadUrl, { method: 'POST', body: formData });
            const uploadData = await uploadRes.json();

            if (uploadData.secure_url) {
                setReplyAttachments(prev => [...prev, {
                    fileName: file.name,
                    fileUrl: uploadData.secure_url,
                    publicId: uploadData.public_id,
                    fileType: file.type,
                    fileSize: file.size,
                    uploadedAt: new Date()
                }]);
                toast.success('Proof uploaded');
            }
        } catch (err) {
            toast.error(err.message || 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const removeReplyAttachment = async (index) => {
        setDeletingIndex(index);
        const target = replyAttachments[index];
        if (target && target.publicId) {
            try {
                await api.delete('/upload/file', { data: { publicId: target.publicId } });
                toast.success('File removed');
            } catch (err) {
                console.error('Failed to delete file:', err);
                toast.error('Failed to remove file');
            }
        }
        setReplyAttachments(prev => prev.filter((_, i) => i !== index));
        setDeletingIndex(null);
    };

    const handleRespond = async () => {
        if (!replyComment || replyComment.trim() === '') {
            return toast.error('Please enter a response message');
        }
        setActionLoading(true);
        try {
            const res = await api.post(`/attendance/regularization/${id}/respond`, {
                comment: replyComment,
                attachments: replyAttachments
            });
            if (res.data.success) {
                toast.success(res.data.message);
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit response');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        const result = await Swal.fire({
            title: 'Cancel Request',
            text: 'Are you sure you want to cancel this regularization request?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Cancel Request',
            cancelButtonText: 'Keep Request'
        });

        if (!result.isConfirmed) return;

        setActionLoading(true);
        try {
            const res = await api.post(`/attendance/regularization/${id}/cancel`);
            if (res.data.success) {
                toast.success('Request cancelled');
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to cancel request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitDraft = async () => {
        setActionLoading(true);
        try {
            const res = await api.post(`/attendance/regularization/${id}/submit`);
            if (res.data.success) {
                toast.success('Submitted for HR Review');
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit draft');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading request details...</div>;
    if (!record) return <div style={{ padding: '40px', textAlign: 'center' }}>Request not found.</div>;

    const emp = (typeof record.employeeId === 'object' && record.employeeId !== null) ? record.employeeId : {};

    return (
        <div className="page-container" style={{ maxWidth: '900px', margin: '0 auto', width: '100%' }}>
            <style>{`
                .reg-detail-header-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 24px;
                    margin-bottom: 24px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: 16px;
                }
                .reg-detail-actions {
                    display: flex;
                    gap: 10px;
                }
                .att-evidence-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                }
                .att-evidence-item {
                    background: #ffffff;
                    padding: 8px 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    min-width: 0;
                }
                .att-evidence-label {
                    font-size: 11px;
                    font-weight: 600;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin-bottom: 3px;
                    white-space: normal;
                    word-break: break-word;
                    line-height: 1.25;
                }
                .att-evidence-value {
                    font-size: 13px;
                    font-weight: 700;
                    color: #1e293b;
                    word-break: break-word;
                    line-height: 1.3;
                }
                .att-evidence-full {
                    grid-column: 1 / -1;
                }
                @media (max-width: 640px) {
                    .reg-detail-header-card {
                        padding: 16px !important;
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 14px !important;
                    }
                    .reg-detail-actions {
                        width: 100% !important;
                        flex-direction: column !important;
                    }
                    .reg-detail-actions button {
                        width: 100% !important;
                    }
                    .att-evidence-grid {
                        gap: 6px !important;
                    }
                    .att-evidence-item {
                        padding: 6px 10px !important;
                    }
                    .att-evidence-label {
                        font-size: 10px !important;
                        white-space: normal !important;
                        word-break: break-word !important;
                        line-height: 1.2 !important;
                    }
                    .att-evidence-value {
                        font-size: 12px !important;
                    }
                }
            `}</style>
            <button
                onClick={handleBack}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '16px', fontSize: '14px', fontWeight: '500' }}
            >
                <HiOutlineArrowLeft size={18} /> Back to Requests
            </button>

            {/* Header Card */}
            <div className="card reg-detail-header-card">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                            {record.regularizationNumber || 'AR-DRAFT'}
                        </h1>
                        <span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            background: record.status === 'APPROVED' ? '#dcfce7' : record.status === 'REJECTED' ? '#fee2e2' : record.status === 'INFORMATION_REQUIRED' ? '#fef3c7' : '#eff6ff',
                            color: record.status === 'APPROVED' ? '#16a34a' : record.status === 'REJECTED' ? '#dc2626' : record.status === 'INFORMATION_REQUIRED' ? '#d97706' : '#2563eb'
                        }}>
                            {record.status}
                        </span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                        Attendance Date: <b>{new Date(record.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</b>
                    </p>
                </div>

                {/* Actions */}
                <div className="reg-detail-actions">
                    {!isExEmployee && (
                        <>
                            {record.status === 'DRAFT' && (
                                <>
                                    <button onClick={handleSubmitDraft} disabled={actionLoading} className="btn btn-primary" style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', borderRadius: '6px', border: 'none' }}>
                                        Submit to HR
                                    </button>
                                    <button onClick={handleCancel} disabled={actionLoading} className="btn btn-danger" style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', borderRadius: '6px', border: 'none' }}>
                                        Cancel Request
                                    </button>
                                </>
                            )}
                            {record.status === 'PENDING_HR_REVIEW' && (
                                <button onClick={handleCancel} disabled={actionLoading} className="btn btn-outline-danger" style={{ padding: '8px 16px', border: '1px solid #dc2626', color: '#dc2626', borderRadius: '6px', background: '#fff' }}>
                                    Cancel Request
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Payroll Adjustment Scheduled Banner (for Processed Months) */}
            {record.status === 'APPROVED' && (record.payrollStatus === 'PAYROLL_PROCESSED' || record.payrollAdjustmentId) && (
                <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
                    border: '1px solid #bbf7d0',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '24px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px'
                }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: '#dcfce7',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        flexShrink: 0
                    }}>
                        💰
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#14532d' }}>
                                Payroll Adjustment Scheduled (Attendance Arrear)
                            </h4>
                            <span style={{ background: '#16a34a', color: '#fff', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>
                                Next Payslip
                            </span>
                        </div>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#166534', lineHeight: '1.5' }}>
                            Since payroll for <b>{new Date(record.attendanceDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b> was already processed prior to approval, an Attendance Arrear credit of <b>₹{record.payrollAdjustmentId?.amount || '1,211.50'}</b> will be added to your upcoming <b>{record.payrollAdjustmentId?.adjustmentPayrollMonth ? new Date(record.payrollAdjustmentId.adjustmentPayrollMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'October 2026'}</b> payslip.
                        </p>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155' }}>
                            <span style={{ color: '#64748b' }}>Payslip Line Item Label:</span>
                            <b style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                                "{record.payrollAdjustmentId?.payslipLabel || `Attendance Arrear – ${new Date(record.attendanceDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}"
                            </b>
                        </div>
                    </div>
                </div>
            )}

            {/* Employee & Request Info Card (Same as Admin) */}
            <div className="card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <HiOutlineUser color="#3b82f6" /> Employee & Request Info
                </h3>

                {emp && (emp.firstName || emp.employeeCode) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
                        {(emp.profileImage || emp.userId?.profileImage) ? (
                            <img
                                src={emp.profileImage || emp.userId?.profileImage}
                                alt="Profile"
                                style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', flexShrink: 0 }}
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null}
                        <div style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            background: '#eff6ff',
                            display: (emp.profileImage || emp.userId?.profileImage) ? 'none' : 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            color: '#3b82f6',
                            fontSize: '18px',
                            flexShrink: 0
                        }}>
                            {emp.firstName ? emp.firstName[0] : 'E'}
                        </div>
                        <div>
                            <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>
                                {emp.firstName} {emp.lastName}
                            </div>
                            <div style={{ fontSize: '13px', color: '#64748b' }}>
                                {emp.employeeCode} {emp.department ? `| ${emp.department}` : ''} {emp.designation ? `| ${emp.designation}` : ''}
                            </div>
                        </div>
                    </div>
                )}

                <div className="att-evidence-grid" style={{ marginBottom: '16px' }}>
                    <div className="att-evidence-item">
                        <span className="att-evidence-label">Reg Number</span>
                        <span className="att-evidence-value" style={{ color: '#3b82f6' }}>{record.regularizationNumber || 'AR-DRAFT'}</span>
                    </div>
                    <div className="att-evidence-item">
                        <span className="att-evidence-label">Status</span>
                        <span className="att-evidence-value" style={{ fontWeight: '700' }}>{record.status}</span>
                    </div>
                    <div className="att-evidence-item">
                        <span className="att-evidence-label">Attendance Date</span>
                        <span className="att-evidence-value">{new Date(record.attendanceDate).toLocaleDateString('en-IN')}</span>
                    </div>
                    <div className="att-evidence-item">
                        <span className="att-evidence-label">Attendance Type</span>
                        <span className="att-evidence-value">{record.attendanceType}</span>
                    </div>
                    <div className="att-evidence-item">
                        <span className="att-evidence-label">Requested Check-In</span>
                        <span className="att-evidence-value">{record.requestedCheckIn}</span>
                    </div>
                    <div className="att-evidence-item">
                        <span className="att-evidence-label">Requested Check-Out</span>
                        <span className="att-evidence-value">{record.requestedCheckOut}</span>
                    </div>
                    <div className="att-evidence-item att-evidence-full">
                        <span className="att-evidence-label">Reason Category</span>
                        <span className="att-evidence-value">{record.reason?.replace(/_/g, ' ')}</span>
                    </div>
                    {record.submittedAt && (
                        <div className="att-evidence-item">
                            <span className="att-evidence-label">Submitted On</span>
                            <span className="att-evidence-value">{new Date(record.submittedAt).toLocaleDateString('en-IN')}</span>
                        </div>
                    )}
                    {record.payrollStatus && (
                        <div className="att-evidence-item">
                            <span className="att-evidence-label">Payroll Impact</span>
                            <span className="att-evidence-value" style={{ color: record.payrollStatus === 'PAYROLL_PROCESSED' ? '#d97706' : '#16a34a' }}>{record.payrollStatus}</span>
                        </div>
                    )}
                </div>

                {record.comment && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Employee Comment:</div>
                        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #f1f5f9', fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                            {record.comment}
                        </div>
                    </div>
                )}

                {record.attachments && record.attachments.length > 0 && (
                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '8px' }}>Uploaded Proofs:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {record.attachments.map((att, index) => (
                                <a key={index} href={att.fileUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: '#eff6ff', borderRadius: '6px', color: '#2563eb', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                                    <HiOutlinePaperClip size={16} /> {att.fileName}
                                </a>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Information Required Response Section */}
            {record.status === 'INFORMATION_REQUIRED' && !isExEmployee && (
                <div className="card" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: '700', fontSize: '16px', marginBottom: '8px' }}>
                        <HiOutlineExclamationCircle size={22} /> HR Requested Additional Information
                    </div>
                    <p style={{ fontSize: '14px', color: '#92400e', marginBottom: '16px', background: '#fef3c7', padding: '12px', borderRadius: '6px' }}>
                        <b>HR Note:</b> {record.informationRequestNote || 'Please provide additional clarification.'}
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '6px' }}>
                            Your Response / Clarification
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Type your response to HR..."
                            value={replyComment}
                            onChange={(e) => setReplyComment(e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fcd34d', fontSize: '14px' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <input type="file" id="reply-file" onChange={handleFileUpload} style={{ display: 'none' }} />
                            <label htmlFor="reply-file" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#b45309', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                                <HiOutlineCloudUpload size={18} /> {uploading ? 'Uploading...' : 'Attach Proof Document'}
                            </label>
                            {replyAttachments.length > 0 && (
                                <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {replyAttachments.map((att, index) => (
                                        <div key={index} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '12px', color: '#92400e' }}>
                                            <HiOutlinePaperClip size={14} />
                                            <a href={att.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#b45309', fontWeight: '600', textDecoration: 'none' }}>
                                                {att.fileName}
                                            </a>
                                            <button
                                                type="button"
                                                onClick={() => removeReplyAttachment(index)}
                                                disabled={deletingIndex === index}
                                                style={{ border: 'none', background: 'none', color: '#dc2626', cursor: deletingIndex === index ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                title="Remove file"
                                            >
                                                {deletingIndex === index ? (
                                                    <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                                                ) : (
                                                    <HiOutlineX size={16} />
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleRespond}
                            disabled={actionLoading}
                            className="btn btn-warning"
                            style={{ padding: '8px 18px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600' }}
                        >
                            Submit Response to HR
                        </button>
                    </div>
                </div>
            )}

            {/* Status Timeline Card */}
            <div className="card" style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>
                    Approval Timeline {record.auditLogs?.length ? `(${record.auditLogs.length} events)` : ''}
                </h3>

                {record.auditLogs && record.auditLogs.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #cbd5e1' }}>
                        {record.auditLogs.map((log, i) => {
                            const action = log.action;
                            const actorName = log.performedBy
                                ? (log.performedBy.employeeId ? `${log.performedBy.employeeId.firstName} ${log.performedBy.employeeId.lastName}` : (log.performedBy.email || 'User'))
                                : (log.performedByRole || log.source || 'User');
                            const actorRole = log.performedByRole || log.performedBy?.role || log.source || '';

                            let title = 'Activity Event';
                            let dotColor = '#3b82f6';
                            let bg = '#f8fafc';
                            let borderColor = '#e2e8f0';
                            let textColor = '#334155';

                            if (action === 'REGULARIZATION_DRAFT_CREATED') {
                                title = 'Saved as Draft';
                                dotColor = '#94a3b8';
                            } else if (action === 'REGULARIZATION_SUBMITTED') {
                                title = 'Submitted to HR';
                                dotColor = '#3b82f6';
                            } else if (action === 'REGULARIZATION_INFO_REQUIRED') {
                                title = 'HR Requested Information';
                                dotColor = '#d97706';
                                bg = '#fffbeb';
                                borderColor = '#fde68a';
                                textColor = '#92400e';
                            } else if (action === 'REGULARIZATION_RESUBMITTED') {
                                title = 'Employee Clarification / Response';
                                dotColor = '#2563eb';
                                bg = '#eff6ff';
                                borderColor = '#bfdbfe';
                                textColor = '#1e40af';
                            } else if (action === 'REGULARIZATION_APPROVED') {
                                title = 'Approved by HR';
                                dotColor = '#16a34a';
                                bg = '#f0fdf4';
                                borderColor = '#bbf7d0';
                                textColor = '#14532d';
                            } else if (action === 'REGULARIZATION_REJECTED') {
                                title = 'Rejected by HR';
                                dotColor = '#dc2626';
                                bg = '#fef2f2';
                                borderColor = '#fecaca';
                                textColor = '#991b1b';
                            } else if (action === 'REGULARIZATION_CANCELLED') {
                                title = 'Cancelled by Employee';
                                dotColor = '#64748b';
                            } else if (action === 'ADMIN_CORRECTION') {
                                title = 'SuperAdmin Override';
                                dotColor = '#7c3aed';
                                bg = '#f5f3ff';
                                borderColor = '#ddd6fe';
                                textColor = '#5b21b6';
                            }

                            return (
                                <div key={i} style={{ position: 'relative' }}>
                                    {/* Timeline Dot */}
                                    <div style={{
                                        position: 'absolute',
                                        left: '-31px',
                                        top: '4px',
                                        width: '14px',
                                        height: '14px',
                                        borderRadius: '50%',
                                        background: dotColor,
                                        border: '3px solid #fff',
                                        boxShadow: '0 0 0 1px #cbd5e1'
                                    }} />

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                                        <div>
                                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>{title}</span>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '1px' }}>
                                                {actorName} {actorRole && <span style={{ opacity: 0.8 }}>({actorRole})</span>}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>
                                            {log.timestamp ? new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                        </div>
                                    </div>

                                    {log.reason && (
                                        <div style={{
                                            marginTop: '6px',
                                            background: bg,
                                            border: `1px solid ${borderColor}`,
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            color: textColor,
                                            fontStyle: 'italic',
                                            whiteSpace: 'pre-wrap'
                                        }}>
                                            "{log.reason}"
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #cbd5e1' }}>
                        {/* Fallback Single View */}
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '-31px', top: '0', width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6', border: '3px solid #fff' }} />
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>Request Filed</div>
                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                {record.submittedAt ? new Date(record.submittedAt).toLocaleString('en-IN') : 'Saved as Draft'}
                            </div>
                        </div>

                        <div style={{ position: 'relative' }}>
                            <div style={{
                                position: 'absolute',
                                left: '-31px',
                                top: '0',
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                background: record.status === 'APPROVED' ? '#16a34a' : record.status === 'REJECTED' ? '#dc2626' : '#cbd5e1',
                                border: '3px solid #fff'
                            }} />
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>HR Admin Review</div>
                            <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
                                {record.status === 'APPROVED' ? (
                                    <span style={{ color: '#16a34a', fontWeight: '600' }}>✅ Approved by HR ({record.hrAdminId?.firstName || 'HR Admin'})</span>
                                ) : record.status === 'REJECTED' ? (
                                    <span style={{ color: '#dc2626', fontWeight: '600' }}>❌ Rejected by HR</span>
                                ) : (
                                    <span style={{ color: '#d97706', fontWeight: '600' }}>Pending Review</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
