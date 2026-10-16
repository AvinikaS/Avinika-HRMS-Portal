import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import {
    HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineXCircle,
    HiOutlineInformationCircle, HiOutlinePaperClip, HiOutlineShieldCheck,
    HiOutlineCurrencyDollar, HiOutlineClock, HiOutlineUser, HiOutlineLightningBolt,
    HiOutlineChevronDown, HiOutlineCheck
} from 'react-icons/hi';

export default function HRAdminRegularizationDetail() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'SuperAdmin' || JSON.parse(localStorage.getItem('hrms_user') || '{}').role === 'SuperAdmin';

    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const handleBack = () => {
        const fromTab = location.state?.fromTab;
        const fromSuperAdmin = location.state?.fromSuperAdmin;

        if (fromSuperAdmin) {
            navigate('/superadmin/attendance/regularization' + (fromTab === 'history' ? '?tab=history' : ''));
        } else if (fromTab) {
            navigate('/hradmin/attendance/regularization' + (fromTab === 'history' ? '?tab=history' : ''));
        } else {
            navigate(-1);
        }
    };

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Modals
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overrideAction, setOverrideAction] = useState('APPROVE');
    const [overrideReason, setOverrideReason] = useState('');

    const [selectedAttemptIndex, setSelectedAttemptIndex] = useState(0);
    const [isAttemptDropdownOpen, setIsAttemptDropdownOpen] = useState(false);
    const attemptDropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (attemptDropdownRef.current && !attemptDropdownRef.current.contains(e.target)) {
                setIsAttemptDropdownOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsAttemptDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const [comment, setComment] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [infoNote, setInfoNote] = useState('');

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/hradmin/regularization/${id}`);
            if (res.data.success) {
                setData(res.data);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load investigation details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const handleApprove = async () => {
        setActionLoading(true);
        try {
            const res = await api.post(`/hradmin/regularization/${id}/approve`, { comment });
            if (res.data.success) {
                toast.success(res.data.message);
                setShowApproveModal(false);
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Approval failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason || rejectionReason.trim() === '') {
            return toast.error('Rejection reason is mandatory');
        }
        setActionLoading(true);
        try {
            const res = await api.post(`/hradmin/regularization/${id}/reject`, { reason: rejectionReason });
            if (res.data.success) {
                toast.success('Request rejected');
                setShowRejectModal(false);
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rejection failed');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRequestInfo = async () => {
        if (!infoNote || infoNote.trim() === '') {
            return toast.error('Information request note is required');
        }
        setActionLoading(true);
        try {
            const res = await api.post(`/hradmin/regularization/${id}/request-info`, { note: infoNote });
            if (res.data.success) {
                toast.success('Information request sent to employee');
                setShowInfoModal(false);
                fetchDetail();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to request information');
        } finally {
            setActionLoading(false);
        }
    };

    const handleOpenOverrideModal = () => {
        const curStatus = data?.data?.status;
        if (curStatus === 'APPROVED') {
            setOverrideAction('REJECT');
        } else if (curStatus === 'REJECTED') {
            setOverrideAction('APPROVE');
        } else {
            setOverrideAction('APPROVE');
        }
        setOverrideReason('');
        setShowOverrideModal(true);
    };

    const handleActionChange = (newAction) => {
        const curStatus = data?.data?.status;
        if (curStatus === 'APPROVED' && newAction === 'APPROVE') {
            Swal.fire({
                icon: 'warning',
                title: 'Already Approved!',
                text: 'This regularization request is already Approved. You can only override it to REJECT.',
                confirmButtonColor: '#7c3aed'
            });
            setOverrideAction('REJECT');
            return;
        }
        if (curStatus === 'REJECTED' && newAction === 'REJECT') {
            Swal.fire({
                icon: 'warning',
                title: 'Already Rejected!',
                text: 'This regularization request is already Rejected. You can only override it to APPROVE.',
                confirmButtonColor: '#7c3aed'
            });
            setOverrideAction('APPROVE');
            return;
        }
        setOverrideAction(newAction);
    };

    const handleOverride = async (e) => {
        e.preventDefault();
        const curStatus = data?.data?.status;
        if (curStatus === 'APPROVED' && overrideAction === 'APPROVE') {
            return Swal.fire({
                icon: 'warning',
                title: 'Already Approved!',
                text: 'This regularization request is already Approved. You cannot override-approve an already approved request. Please choose REJECT to revoke it.',
                confirmButtonColor: '#7c3aed'
            });
        }
        if (curStatus === 'REJECTED' && overrideAction === 'REJECT') {
            return Swal.fire({
                icon: 'warning',
                title: 'Already Rejected!',
                text: 'This regularization request is already Rejected. You cannot override-reject an already rejected request. Please choose APPROVE to force approve it.',
                confirmButtonColor: '#7c3aed'
            });
        }

        if (!overrideReason || overrideReason.trim() === '') {
            return toast.error('Mandatory override reason is required');
        }

        setActionLoading(true);
        try {
            const res = await api.post(`/superadmin/regularization/${id}/override`, {
                action: overrideAction,
                reason: overrideReason
            });
            if (res.data.success) {
                toast.success(res.data.message);
                setShowOverrideModal(false);
                setOverrideReason('');
                fetchDetail();
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Override Failed',
                text: err.response?.data?.message || 'Override failed',
                confirmButtonColor: '#7c3aed'
            });
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading investigation details...</div>;
    if (!data || !data.data) return <div style={{ padding: '40px', textAlign: 'center' }}>Request not found.</div>;

    const reg = data.data;
    const evidence = data.attendanceEvidence || {};
    const emp = reg.employeeId || {};
    const attRec = evidence.attendanceRecord;

    return (
        <div className="page-container reg-detail-page-wrapper" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <style>{`
                .reg-detail-page-wrapper {
                    padding: 0;
                }
                .reg-detail-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 24px;
                    align-items: start;
                }
                .reg-detail-sticky-col {
                    position: sticky;
                    top: 24px;
                    align-self: start;
                    max-height: calc(100vh - 48px);
                    overflow-y: auto;
                }
                .reg-detail-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 24px;
                    margin-bottom: 24px;
                }
                .att-evidence-card {
                    background: #f8fafc;
                    border-radius: 10px;
                    padding: 14px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 16px;
                }
                .att-evidence-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 8px;
                }
                .att-evidence-item {
                    background: #ffffff;
                    padding: 8px 10px;
                    border-radius: 6px;
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
                /* Custom Attempt Dropdown styling */
                .attempt-dropdown-container {
                    position: relative;
                    width: 100%;
                }
                .attempt-dropdown-trigger {
                    width: 100%;
                    padding: 8px 12px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    background: #ffffff;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    cursor: pointer;
                    text-align: left;
                    box-sizing: border-box;
                    transition: border-color 0.15s, box-shadow 0.15s;
                    min-height: 38px;
                }
                .attempt-dropdown-trigger:focus,
                .attempt-dropdown-trigger.open {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
                    outline: none;
                }
                .attempt-dropdown-text {
                    flex: 1;
                    font-size: 13px;
                    font-weight: 500;
                    color: #1e293b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: block;
                }
                .attempt-dropdown-menu {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    z-index: 50;
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                    max-height: 260px;
                    overflow-y: auto;
                    box-sizing: border-box;
                }
                .attempt-dropdown-item {
                    padding: 9px 12px;
                    cursor: pointer;
                    font-size: 13px;
                    color: #1e293b;
                    font-weight: 500;
                    border-bottom: 1px solid #f1f5f9;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 8px;
                    transition: background 0.12s ease;
                    box-sizing: border-box;
                }
                .attempt-dropdown-item:last-child {
                    border-bottom: none;
                }
                .attempt-dropdown-item:hover {
                    background: #f8fafc;
                }
                .attempt-dropdown-item.selected {
                    background: #eff6ff;
                    color: #1d4ed8;
                    font-weight: 600;
                }
                .attempt-item-text {
                    flex: 1;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: block;
                }

                /* Responsive <= 900px: Allow multiline text wrapping in dropdown */
                @media (max-width: 900px) {
                    .attempt-dropdown-trigger {
                        white-space: normal !important;
                        height: auto !important;
                        min-height: 40px !important;
                        padding: 8px 10px !important;
                    }
                    .attempt-dropdown-text {
                        white-space: normal !important;
                        word-break: break-word !important;
                        line-height: 1.4 !important;
                        display: block !important;
                        text-overflow: clip !important;
                    }
                    .attempt-dropdown-item {
                        white-space: normal !important;
                        padding: 10px 10px !important;
                        height: auto !important;
                    }
                    .attempt-item-text {
                        white-space: normal !important;
                        word-break: break-word !important;
                        line-height: 1.4 !important;
                        display: block !important;
                        text-overflow: clip !important;
                    }
                }

                @media (max-width: 992px) {
                    .reg-detail-page-wrapper {
                        padding: 0 !important;
                    }
                    .reg-detail-grid {
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                    }
                    .reg-detail-sticky-col {
                        position: static !important;
                        max-height: none !important;
                        overflow-y: visible !important;
                    }
                }
                @media (max-width: 640px) {
                    .reg-detail-card {
                        padding: 14px !important;
                        margin-bottom: 14px !important;
                    }
                    .att-evidence-card {
                        padding: 10px !important;
                    }
                    .att-evidence-grid {
                        gap: 6px !important;
                    }
                    .att-evidence-item {
                        padding: 6px 8px !important;
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
                <HiOutlineArrowLeft size={18} /> Back to Regularization Requests
            </button>

            {/* Top Bar Banner for Payroll Status */}
            <div className="card" style={{
                background: evidence.payrollProcessed ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${evidence.payrollProcessed ? '#fde68a' : '#bbf7d0'}`,
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <HiOutlineCurrencyDollar size={28} color={evidence.payrollProcessed ? '#d97706' : '#16a34a'} />
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: evidence.payrollProcessed ? '#92400e' : '#14532d' }}>
                            Payroll Status for {evidence.payrollMonthStr}: <span style={{ textTransform: 'uppercase' }}>{evidence.payrollStatusText}</span>
                        </div>
                        <div style={{ fontSize: '13px', color: evidence.payrollProcessed ? '#b45309' : '#15803d' }}>
                            {evidence.payrollProcessed
                                ? `⚠️ Payroll for this month is already finalized. Approval will automatically create a Payroll Adjustment credit of ~₹${evidence.estimatedAmount} for next payroll.`
                                : `✅ Payroll is open. Approval will correct the attendance record directly for normal recalculation.`}
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {reg.status === 'PENDING_HR_REVIEW' && (
                        <>
                            <button onClick={() => setShowApproveModal(true)} className="btn btn-success" style={{ background: '#16a34a', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '600' }}>
                                Approve
                            </button>
                            <button onClick={() => setShowInfoModal(true)} className="btn btn-warning" style={{ background: '#d97706', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '600' }}>
                                Request Info
                            </button>
                            <button onClick={() => setShowRejectModal(true)} className="btn btn-danger" style={{ background: '#dc2626', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '600' }}>
                                Reject
                            </button>
                        </>
                    )}
                    {isSuperAdmin && ['APPROVED', 'REJECTED'].includes(reg.status) && (
                        <button onClick={handleOpenOverrideModal} className="btn" style={{ background: '#7c3aed', color: '#fff', padding: '8px 16px', borderRadius: '6px', border: 'none', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                            <HiOutlineLightningBolt size={18} /> SuperAdmin Override
                        </button>
                    )}
                </div>
            </div>

            {/* Payroll Adjustment Scheduled Banner (for Processed Months) */}
            {reg.status === 'APPROVED' && (reg.payrollStatus === 'PAYROLL_PROCESSED' || reg.payrollAdjustmentId) && (
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
                            Since payroll for <b>{new Date(reg.attendanceDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b> was already processed prior to approval, an Attendance Arrear credit of <b>₹{reg.payrollAdjustmentId?.amount || '1,211.50'}</b> has been scheduled for the <b>{reg.payrollAdjustmentId?.adjustmentPayrollMonth ? new Date(reg.payrollAdjustmentId.adjustmentPayrollMonth + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'October 2026'}</b> payslip.
                        </p>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '8px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155' }}>
                            <span style={{ color: '#64748b' }}>Payslip Line Item Label:</span>
                            <b style={{ color: '#0f172a', fontFamily: 'monospace' }}>
                                "{reg.payrollAdjustmentId?.payslipLabel || `Attendance Arrear – ${new Date(reg.attendanceDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`}"
                            </b>
                        </div>
                    </div>
                </div>
            )}

            {/* 2-Column Investigation Layout */}
            <div className="reg-detail-grid">

                {/* Left Column: Request Details (Sticky) */}
                <div className="reg-detail-sticky-col">
                    <div className="card reg-detail-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineUser color="#3b82f6" /> Employee & Request Info
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9', marginBottom: '16px' }}>
                            {(emp.profileImage || emp.userId?.profileImage) ? (
                                <img
                                    src={emp.profileImage || emp.userId?.profileImage}
                                    alt={`${emp.firstName} ${emp.lastName}`}
                                    style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '2px solid #e2e8f0',
                                        flexShrink: 0
                                    }}
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
                                    {emp.employeeCode} | {emp.department} | {emp.designation}
                                </div>
                            </div>
                        </div>

                        <div className="att-evidence-grid" style={{ marginBottom: '16px' }}>
                            <div className="att-evidence-item">
                                <span className="att-evidence-label">Reg Number</span>
                                <span className="att-evidence-value" style={{ color: '#3b82f6' }}>{reg.regularizationNumber}</span>
                            </div>
                            <div className="att-evidence-item">
                                <span className="att-evidence-label">Status</span>
                                <span className="att-evidence-value">{reg.status}</span>
                            </div>
                            <div className="att-evidence-item">
                                <span className="att-evidence-label">Attendance Date</span>
                                <span className="att-evidence-value">{new Date(reg.attendanceDate).toLocaleDateString('en-IN')}</span>
                            </div>
                            <div className="att-evidence-item">
                                <span className="att-evidence-label">Attendance Type</span>
                                <span className="att-evidence-value">{reg.attendanceType}</span>
                            </div>
                            <div className="att-evidence-item">
                                <span className="att-evidence-label">Requested Check-In</span>
                                <span className="att-evidence-value">{reg.requestedCheckIn}</span>
                            </div>
                            <div className="att-evidence-item">
                                <span className="att-evidence-label">Requested Check-Out</span>
                                <span className="att-evidence-value">{reg.requestedCheckOut}</span>
                            </div>
                            <div className="att-evidence-item att-evidence-full">
                                <span className="att-evidence-label">Reason Category</span>
                                <span className="att-evidence-value">{reg.reason?.replace(/_/g, ' ')}</span>
                            </div>
                        </div>

                        {reg.comment && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Employee Comment:</div>
                                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '13px', color: '#334155' }}>
                                    {reg.comment}
                                </div>
                            </div>
                        )}

                        {reg.attachments && reg.attachments.length > 0 && (
                            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px' }}>Uploaded Proofs:</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {reg.attachments.map((att, idx) => (
                                        <a key={idx} href={att.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', padding: '4px 8px', borderRadius: '4px' }}>
                                            <HiOutlinePaperClip size={14} /> {att.fileName}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Attendance Evidence Panel */}
                <div>
                    <div className="card reg-detail-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineShieldCheck color="#16a34a" /> Attendance Evidence Panel
                        </h3>

                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '12px' }}>
                            Attendance investigation — {new Date(reg.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>

                        {attRec ? (
                            <div className="att-evidence-card">
                                <div style={{ fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span>Final Attendance Record</span>
                                    <span style={{
                                        fontSize: '11px',
                                        padding: '2px 8px',
                                        borderRadius: '6px',
                                        fontWeight: '700',
                                        background: attRec.status === 'Absent' ? '#fee2e2' : '#dcfce7',
                                        color: attRec.status === 'Absent' ? '#dc2626' : '#15803d'
                                    }}>
                                        {attRec.status}
                                    </span>
                                </div>
                                <div className="att-evidence-grid">
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">Check-In</span>
                                        <span className="att-evidence-value">{attRec.checkIn ? new Date(attRec.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Not recorded'}</span>
                                    </div>
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">Check-Out</span>
                                        <span className="att-evidence-value">{attRec.checkOut ? new Date(attRec.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Not recorded'}</span>
                                    </div>
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">System Status</span>
                                        <span className="att-evidence-value" style={{ color: attRec.status === 'Absent' ? '#dc2626' : '#16a34a' }}>{attRec.status}</span>
                                    </div>
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">Total Hours</span>
                                        <span className="att-evidence-value">{attRec.totalHours || 0} hrs</span>
                                    </div>
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">Face Verified</span>
                                        <span className="att-evidence-value">{attRec.livenessStatus === 'Passed' ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">GPS Verified</span>
                                        <span className="att-evidence-value">{attRec.latitude ? 'Yes' : 'No'}</span>
                                    </div>
                                    <div className="att-evidence-item">
                                        <span className="att-evidence-label">IP Address</span>
                                        <span className="att-evidence-value">{attRec.ipAddress || 'N/A'}</span>
                                    </div>
                                    <div className="att-evidence-item att-evidence-full">
                                        <span className="att-evidence-label">Notes</span>
                                        <span className="att-evidence-value" style={{ fontWeight: '500', color: '#475569', fontSize: '12px', lineHeight: '1.4' }}>{attRec.notes || 'None'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                                ⚠️ No attendance record found for this date. (System registered employee as ABSENT).
                            </div>
                        )}

                        {/* Check-In Verification Attempt Logs Dropdown */}
                        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                                    Check-In Verification Attempt Logs ({evidence.verificationAttemptLogs?.length || 0})
                                </h4>
                                {evidence.verificationAttemptLogs && evidence.verificationAttemptLogs.length > 0 && (
                                    <span style={{ fontSize: '11px', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                                        Verification Audit
                                    </span>
                                )}
                            </div>

                            {evidence.verificationAttemptLogs && evidence.verificationAttemptLogs.length > 0 ? (
                                <>
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                                            Select Attempt to Inspect:
                                        </label>
                                        <div ref={attemptDropdownRef} className="attempt-dropdown-container">
                                            <button
                                                type="button"
                                                onClick={() => setIsAttemptDropdownOpen(prev => !prev)}
                                                className={`attempt-dropdown-trigger ${isAttemptDropdownOpen ? 'open' : ''}`}
                                            >
                                                <span className="attempt-dropdown-text">
                                                    {evidence.verificationAttemptLogs[selectedAttemptIndex]
                                                        ? `Attempt #${evidence.verificationAttemptLogs.length - selectedAttemptIndex} — ${new Date(evidence.verificationAttemptLogs[selectedAttemptIndex].attemptTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} (${evidence.verificationAttemptLogs[selectedAttemptIndex].statusMessage || evidence.verificationAttemptLogs[selectedAttemptIndex].step || ''})`
                                                        : 'Select Attempt'}
                                                </span>
                                                <HiOutlineChevronDown
                                                    size={16}
                                                    style={{
                                                        color: '#64748b',
                                                        flexShrink: 0,
                                                        transform: isAttemptDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.2s ease'
                                                    }}
                                                />
                                            </button>

                                            {isAttemptDropdownOpen && (
                                                <div className="attempt-dropdown-menu">
                                                    {evidence.verificationAttemptLogs.map((log, idx) => {
                                                        const isSelected = idx === selectedAttemptIndex;
                                                        return (
                                                            <div
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedAttemptIndex(idx);
                                                                    setIsAttemptDropdownOpen(false);
                                                                }}
                                                                className={`attempt-dropdown-item ${isSelected ? 'selected' : ''}`}
                                                            >
                                                                <span className="attempt-item-text">
                                                                    Attempt #{evidence.verificationAttemptLogs.length - idx} — {new Date(log.attemptTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({log.statusMessage || log.step || ''})
                                                                </span>
                                                                {isSelected && (
                                                                    <HiOutlineCheck size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {evidence.verificationAttemptLogs[selectedAttemptIndex] && (
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                                            <div className="att-evidence-grid">
                                                <div className="att-evidence-item" style={{ background: '#ffffff' }}>
                                                    <span className="att-evidence-label">Attempt Time</span>
                                                    <span className="att-evidence-value">{new Date(evidence.verificationAttemptLogs[selectedAttemptIndex].attemptTime).toLocaleTimeString('en-IN')}</span>
                                                </div>
                                                <div className="att-evidence-item" style={{ background: '#ffffff' }}>
                                                    <span className="att-evidence-label">GPS Verified</span>
                                                    <span className="att-evidence-value" style={{ color: evidence.verificationAttemptLogs[selectedAttemptIndex].isLocationAllowed ? '#16a34a' : '#dc2626' }}>
                                                        {evidence.verificationAttemptLogs[selectedAttemptIndex].isLocationAllowed ? 'Yes' : 'No'}
                                                    </span>
                                                </div>
                                                <div className="att-evidence-item" style={{ background: '#ffffff' }}>
                                                    <span className="att-evidence-label">Distance to Office</span>
                                                    <span className="att-evidence-value">{evidence.verificationAttemptLogs[selectedAttemptIndex].distance !== undefined ? `${evidence.verificationAttemptLogs[selectedAttemptIndex].distance}m` : 'N/A'}</span>
                                                </div>
                                                <div className="att-evidence-item" style={{ background: '#ffffff' }}>
                                                    <span className="att-evidence-label">Liveness Status</span>
                                                    <span className="att-evidence-value">{evidence.verificationAttemptLogs[selectedAttemptIndex].livenessStatus || 'Incomplete'}</span>
                                                </div>
                                                <div className="att-evidence-item" style={{ background: '#ffffff' }}>
                                                    <span className="att-evidence-label">Face Score</span>
                                                    <span className="att-evidence-value">{evidence.verificationAttemptLogs[selectedAttemptIndex].faceMatchScore !== undefined ? `${evidence.verificationAttemptLogs[selectedAttemptIndex].faceMatchScore}%` : 'Not verified'}</span>
                                                </div>
                                                <div className="att-evidence-item" style={{ background: '#ffffff' }}>
                                                    <span className="att-evidence-label">IP Address</span>
                                                    <span className="att-evidence-value">{evidence.verificationAttemptLogs[selectedAttemptIndex].ipAddress || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #bbf7d0', color: '#166534', fontWeight: '600', fontSize: '12px' }}>
                                                Result: {evidence.verificationAttemptLogs[selectedAttemptIndex].statusMessage}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                    No check-in verification attempts logged for this date.
                                </div>
                            )}
                        </div>

                        <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '12px', marginBottom: 0 }}>
                            Every location verification click and check-in attempt is permanently logged and timestamped as proof.
                        </p>

                        {/* Activity Timeline Card */}
                        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #e2e8f0' }}>
                            {(() => {
                                const visibleLogs = (evidence.auditLogs || []).filter(l => l.action !== 'REGULARIZATION_DRAFT_CREATED');
                                return (
                                    <>
                                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>
                                            Activity Timeline ({visibleLogs.length} {visibleLogs.length === 1 ? 'event' : 'events'})
                                        </h4>

                                        {visibleLogs.length > 0 ? (
                                            <div style={{ position: 'relative', paddingLeft: '24px', margin: '8px 0' }}>
                                                {/* Vertical line connecting events */}
                                                <div style={{ position: 'absolute', left: '7px', top: '8px', bottom: '8px', width: '2px', background: '#e2e8f0' }} />

                                                {visibleLogs.map((log, i) => {
                                                    const action = log.action;
                                                    const actorName = log.performedBy?.employeeId?.firstName
                                                        ? `${log.performedBy.employeeId.firstName} ${log.performedBy.employeeId.lastName || ''}`.trim()
                                                        : (log.performedBy?.firstName
                                                            ? `${log.performedBy.firstName} ${log.performedBy.lastName || ''}`.trim()
                                                            : (log.performedBy?.email ? log.performedBy.email : (log.performedByRole || log.source || 'User')));
                                                    const actorRole = log.performedByRole || log.performedBy?.role || log.source || '';

                                                    let title = 'Activity Event';
                                                    let dotColor = '#3b82f6';
                                                    let bg = '#f8fafc';
                                                    let borderColor = '#e2e8f0';
                                                    let textColor = '#334155';

                                                    if (action === 'REGULARIZATION_SUBMITTED') {
                                                        title = 'Submitted';
                                                        dotColor = '#3b82f6';
                                                    } else if (action === 'REGULARIZATION_INFO_REQUIRED') {
                                                        title = 'Information Requested';
                                                        dotColor = '#d97706';
                                                        bg = '#fffbeb';
                                                        borderColor = '#fde68a';
                                                        textColor = '#92400e';
                                                    } else if (action === 'REGULARIZATION_RESUBMITTED') {
                                                        title = 'Resubmitted / Info Provided';
                                                        dotColor = '#2563eb';
                                                        bg = '#eff6ff';
                                                        borderColor = '#bfdbfe';
                                                        textColor = '#1e40af';
                                                    } else if (action === 'REGULARIZATION_APPROVED') {
                                                        title = 'HR Admin Approved';
                                                        dotColor = '#16a34a';
                                                        bg = '#f0fdf4';
                                                        borderColor = '#bbf7d0';
                                                        textColor = '#14532d';
                                                    } else if (action === 'REGULARIZATION_REJECTED') {
                                                        title = 'HR Admin Rejected';
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
                                                        <div key={i} style={{ position: 'relative', marginBottom: i === visibleLogs.length - 1 ? 0 : '20px' }}>
                                                            {/* Timeline Dot */}
                                                            <div style={{
                                                                position: 'absolute',
                                                                left: '-24px',
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
                                                                    {new Date(log.timestamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>

                                                            {log.reason && (
                                                                <div style={{
                                                                    marginTop: '6px',
                                                                    background: bg,
                                                                    border: `1px solid ${borderColor}`,
                                                                    padding: '8px 12px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '12px',
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
                                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>No timeline events recorded yet.</div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Approve Modal */}
            {showApproveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '450px', maxWidth: '90%' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>Approve Regularization</h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                            Approving will update the attendance record to {reg.attendanceType === 'HALF_DAY' ? 'Half-Day' : 'Present'}.
                        </p>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Approval Comment (Optional)</label>
                            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Verified attendance proof..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowApproveModal(false)} className="btn btn-outline" style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Cancel</button>
                            <button onClick={handleApprove} disabled={actionLoading} className="btn btn-success" style={{ padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                {actionLoading ? 'Approving...' : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '450px', maxWidth: '90%' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#dc2626', marginBottom: '12px' }}>Reject Regularization</h3>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Rejection Reason (Mandatory) *</label>
                            <textarea rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Specify why this request is rejected..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowRejectModal(false)} className="btn btn-outline" style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Cancel</button>
                            <button onClick={handleReject} disabled={actionLoading} className="btn btn-danger" style={{ padding: '6px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                {actionLoading ? 'Rejecting...' : 'Reject Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Request Info Modal */}
            {showInfoModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '450px', maxWidth: '90%' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#d97706', marginBottom: '12px' }}>Request Additional Information</h3>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Information Request Note *</label>
                            <textarea rows={3} value={infoNote} onChange={(e) => setInfoNote(e.target.value)} placeholder="Please upload swipe log or approval email from manager..." style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button onClick={() => setShowInfoModal(false)} className="btn btn-outline" style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Cancel</button>
                            <button onClick={handleRequestInfo} disabled={actionLoading} className="btn btn-warning" style={{ padding: '6px 16px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                Send Request
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Override Modal */}
            {showOverrideModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', boxSizing: 'border-box' }}>
                    <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed', marginBottom: '12px' }}>
                            ⚡ SuperAdmin Override — {reg?.regularizationNumber}
                        </h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                            Overrides are logged permanently in the attendance audit log with your User ID and reason.
                        </p>

                        {/* Current Status Indicator Banner */}
                        <div style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: reg?.status === 'APPROVED' ? '#f0fdf4' : reg?.status === 'REJECTED' ? '#fef2f2' : '#f8fafc',
                            border: `1px solid ${reg?.status === 'APPROVED' ? '#bbf7d0' : reg?.status === 'REJECTED' ? '#fecaca' : '#e2e8f0'}`,
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            boxSizing: 'border-box'
                        }}>
                            <span style={{ fontSize: '13px', color: '#475569', fontWeight: '500' }}>
                                Current Status:
                            </span>
                            <span style={{
                                padding: '3px 10px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '700',
                                background: reg?.status === 'APPROVED' ? '#dcfce7' : reg?.status === 'REJECTED' ? '#fee2e2' : '#f1f5f9',
                                color: reg?.status === 'APPROVED' ? '#166534' : reg?.status === 'REJECTED' ? '#991b1b' : '#334155'
                            }}>
                                {reg?.status}
                            </span>
                        </div>

                        <form onSubmit={handleOverride}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Override Action *</label>
                                <select
                                    value={overrideAction}
                                    onChange={(e) => handleActionChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        background: '#f8fafc',
                                        fontWeight: '500',
                                        display: 'block'
                                    }}
                                >
                                    {reg?.status === 'APPROVED' ? (
                                        <option value="REJECT">REJECT (Revoke Approval)</option>
                                    ) : (
                                        <option value="APPROVE">APPROVE (Correction)</option>
                                    )}
                                </select>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', display: 'block', marginBottom: '4px' }}>Mandatory Audit Reason *</label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Explain why SuperAdmin override is being executed..."
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        display: 'block',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => setShowOverrideModal(false)} className="btn btn-outline" style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Cancel</button>
                                <button type="submit" disabled={actionLoading} className="btn btn-primary" style={{ padding: '6px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                    {actionLoading ? 'Executing Override...' : 'Execute Override'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
