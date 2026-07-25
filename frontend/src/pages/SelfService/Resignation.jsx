import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../../utils/api';
import {
    HiOutlineDocumentText,
    HiCheckCircle,
    HiOutlineInformationCircle,
    HiOutlineDocumentDownload,
    HiOutlineClock,
    HiOutlineHome,
    HiOutlineBan
} from 'react-icons/hi';

export default function Resignation() {
    const [activeTab, setActiveTab] = useState('submit');
    const [resignationDate, setResignationDate] = useState('');
    const [expectedLastWorkingDay, setExpectedLastWorkingDay] = useState('');
    const [exitReason, setExitReason] = useState('');
    const [resignationLetter, setResignationLetter] = useState('');
    const [earlyReleaseRequest, setEarlyReleaseRequest] = useState('');
    const [reportingManager, setReportingManager] = useState('N/A');
    const [submitting, setSubmitting] = useState(false);
    const [myResignation, setMyResignation] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/exit/resignation-status');
            if (data.success) {
                setMyResignation(data);
                setReportingManager(data.reportingManagerName || 'N/A');

                if (data.hasResignation || data.isDraft) {
                    setResignationDate(data.resignationDate ? data.resignationDate.split('T')[0] : '');
                    setExpectedLastWorkingDay(data.lwd ? data.lwd.split('T')[0] : '');
                    setExitReason(data.exitReason || '');
                    setResignationLetter(data.resignationLetter || '');
                    setEarlyReleaseRequest(data.earlyReleaseRequest || '');
                }
            }
        } catch (err) {
            console.error('Error fetching resignation:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    // Active status helper
    const hasRes = myResignation?.hasResignation;
    const isLocked = hasRes && myResignation?.approvalStatus !== 'rejected';
    const isApproved = ['hr_approved', 'management_approved', 'exit_initiated', 'completed'].includes(myResignation?.approvalStatus);
    const checklistProgress = myResignation?.checklistProgress || { cleared: 0, total: 8, items: [] };
    const isChecklistDone = checklistProgress.cleared === checklistProgress.total;
    const isExitCompleted = myResignation?.documentsReady;
    const ffDetails = myResignation?.ffDetails;

    // Helper to calculate pending salary days description
    const getPendingSalarySub = () => {
        if (!myResignation?.lwd) return '';
        const lwdDate = new Date(myResignation.lwd);
        const days = lwdDate.getDate();
        const monthName = lwdDate.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        return ` (${days} days — ${monthName})`;
    };

    // Helper to calculate leave encashment days description
    const getLeaveEncashmentSub = () => {
        const basic = myResignation?.gratuityDetails?.lastDrawnBasic || 0;
        const leaveEncashment = ffDetails?.leaveEncashment || 0;
        const leaveDays = basic > 0 ? Math.round(leaveEncashment / (basic / 26)) : 0;
        return ` (${leaveDays} days earned leave)`;
    };

    // Helper to calculate gratuity duration details
    const getGratuitySub = () => {
        const details = myResignation?.gratuityDetails;
        if (!details) return '';
        const service = details.totalService || '';
        const completedYears = details.completedYearsRounded || 0;
        const isEligible = details.eligibilityStatus === 'eligible';

        const shortService = service
            .replace(/\bYears?\b/g, 'y')
            .replace(/\bMonths?\b/g, 'm')
            .replace(/\bDays?\b/g, 'd')
            .toLowerCase();

        if (!isEligible) {
            return ` — ${shortService} (not eligible)`;
        }
        return ` — ${shortService} (rounded to ${completedYears} years)`;
    };

    // Helper to calculate notice recovery description
    const getNoticeRecoverySub = () => {
        const basic = myResignation?.gratuityDetails?.lastDrawnBasic || 0;
        const noticeRecovery = ffDetails?.noticePeriodRecovery || 0;
        const noticeShortfallDays = basic > 0 ? Math.round(noticeRecovery / (basic / 30)) : 0;
        if (noticeShortfallDays > 0) {
            return ` (shortfall: ${noticeShortfallDays} days)`;
        }
        return ` — fully served`;
    };

    // Resignation date change triggers 30 days auto-calculator
    const handleResignationDateChange = (val) => {
        setResignationDate(val);
        if (val) {
            const d = new Date(val);
            d.setDate(d.getDate() + 30);
            try {
                setExpectedLastWorkingDay(d.toISOString().split('T')[0]);
            } catch (e) {
                console.error(e);
            }
        }
    };

    // Save as draft or Submit
    const handleSubmit = async (e, saveAsDraft = false) => {
        if (e) e.preventDefault();

        if (!saveAsDraft) {
            if (!exitReason) return toast.error('Primary reason for leaving is required');
            if (!resignationDate) return toast.error('Resignation date is required');
            if (!expectedLastWorkingDay) return toast.error('Expected Last Working Day (LWD) is required');

            const resDate = new Date(resignationDate);
            const lwdDate = new Date(expectedLastWorkingDay);
            if (lwdDate < resDate) {
                return toast.error('Expected LWD cannot be before Resignation Date');
            }

            // Exceeds 90 days checking
            const maxLwd = new Date();
            maxLwd.setDate(new Date().getDate() + 90);
            if (lwdDate > maxLwd) {
                return toast.error(`LWD cannot exceed 90 days from today. Latest allowed: ${maxLwd.toLocaleDateString('en-IN')}`);
            }

            if (!resignationLetter || resignationLetter.trim().length < 20) {
                return toast.error('Resignation statement / letter details must be at least 20 characters');
            }
        }

        setSubmitting(true);
        try {
            const { data } = await api.post('/exit/resignation', {
                exitReason,
                resignationDate,
                lwd: expectedLastWorkingDay,
                resignationLetter,
                earlyReleaseRequest,
                isDraft: saveAsDraft
            });
            toast.success(saveAsDraft ? 'Draft saved successfully' : 'Resignation submitted successfully.');
            fetchStatus();
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: saveAsDraft ? 'Draft Save Failed' : 'Submission Failed',
                text: err.response?.data?.message || 'Something went wrong. Please check your inputs.',
                confirmButtonColor: '#4f46e5'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const downloadDoc = async (type) => {
        try {
            toast.info(`Generating ${type} PDF...`);
            const response = await api.get(`/exit/documents/${type}`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = `${type}_document.pdf`;
            link.click();
            toast.success('Downloaded successfully!');
        } catch (err) {
            toast.error('Failed to download document');
        }
    };

    const fm = (num) => num === undefined || num === null ? '₹0' : '₹' + Number(Math.round(num)).toLocaleString('en-IN');
    const fd = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>
                <span className="spinner" style={{ borderLeftColor: '#6C5CE7' }}></span>
                <p style={{ marginTop: '12px' }}>Loading offboarding status...</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '60px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#1F2937' }}>Offboarding & Resignation</h1>
                <p style={{ color: '#6B7280', marginTop: '4px' }}>Manage resignation requests and final clearance documents</p>
            </div>

            {/* HORIZONTAL TABS (IMAGE 0 MATCH) */}
            <div style={{ display: 'flex', borderBottom: '2px solid #E5E7EB', marginBottom: '24px', gap: '24px', flexWrap: 'wrap' }}>
                {(() => {
                    const tabs = ['submit', 'status', 'fnf', 'docs'];
                    if (myResignation?.approvalStatus === 'rejected') {
                        tabs.push('rejected');
                    }
                    return tabs.map(t => {
                        const isActive = activeTab === t;
                        const labels = {
                            submit: 'Submit resignation',
                            status: 'Exit status',
                            fnf: 'F&F settlement',
                            docs: 'Documents',
                            rejected: 'Approval Rejected'
                        };
                        return (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t)}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    padding: '12px 4px',
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    color: isActive ? (t === 'rejected' ? '#EF4444' : '#6C5CE7') : '#4B5563',
                                    borderBottom: isActive ? (t === 'rejected' ? '3px solid #EF4444' : '3px solid #6C5CE7') : '3px solid transparent',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    marginBottom: '-2px'
                                }}
                            >
                                {labels[t]}
                            </button>
                        );
                    });
                })()}
            </div>

            {/* TAB CONTENT PANELS */}
            {activeTab === 'submit' && (
                <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <HiOutlineDocumentText style={{ color: '#6C5CE7', fontSize: '22px' }} />
                        Submit Resignation
                    </h3>

                    {/* Admin Edited Warning */}
                    {myResignation?.adminEdited && (
                        <div style={{
                            background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                            border: '1px solid #FCD34D',
                            borderRadius: '12px',
                            padding: '16px 20px',
                            marginBottom: '20px',
                            boxShadow: '0 2px 4px 0 rgba(251, 191, 36, 0.05)'
                        }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '2px' }}>⚠️</span>
                                <div>
                                    <h5 style={{ margin: 0, color: '#92400E', fontWeight: 700, fontSize: '15px' }}>
                                        Resignation Parameters Adjusted by Admin
                                    </h5>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#B45309', lineHeight: '1.5' }}>
                                        The Admin / HR Department has adjusted your resignation parameters:
                                    </p>
                                    <div style={{
                                        marginTop: '8px',
                                        fontFamily: 'monospace',
                                        fontSize: '12px',
                                        color: '#78350F',
                                        background: 'rgba(255, 255, 255, 0.6)',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        borderLeft: '3px solid #D97706'
                                    }}>
                                        {myResignation.adminEditDetails}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loan outstanding warning */}
                    {myResignation?.totalOutstanding > 0 && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '8px', padding: '14px', marginBottom: '16px', display: 'flex', gap: '10px' }}>
                            <span style={{ color: '#EF4444' }}>⚠️</span>
                            <div>
                                <h5 style={{ margin: 0, color: '#991B1B', fontWeight: 600 }}>Outstanding Loan / Advance Warning</h5>
                                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#B91C1C' }}>
                                    Outstanding loan/advance of <strong>{fm(myResignation.totalOutstanding)}</strong> will be recovered in final F&F settlement.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Rejection Warning */}
                    {myResignation?.approvalStatus === 'rejected' && (
                        <div style={{
                            background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                            border: '1px solid #FCA5A5',
                            borderRadius: '12px',
                            padding: '16px 20px',
                            marginBottom: '20px',
                            boxShadow: '0 2px 4px 0 rgba(239, 68, 68, 0.05)'
                        }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '2px' }}>❌</span>
                                <div>
                                    <h5 style={{ margin: 0, color: '#991B1B', fontWeight: 700, fontSize: '15px' }}>
                                        Resignation Request Rejected
                                    </h5>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#B91C1C', lineHeight: '1.5' }}>
                                        Management/HR has rejected your previous exit request. You can modify your parameters and submit a new resignation request below.
                                    </p>
                                    {myResignation.rejectionReason && (
                                        <div style={{
                                            marginTop: '8px',
                                            fontFamily: 'sans-serif',
                                            fontSize: '13px',
                                            color: '#7F1D1D',
                                            background: 'rgba(255, 255, 255, 0.7)',
                                            padding: '10px 14px',
                                            borderRadius: '6px',
                                            borderLeft: '4.5px solid #EF4444'
                                        }}>
                                            <strong>Reason/Suggestions:</strong> "{myResignation.rejectionReason}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {isLocked && (
                        myResignation?.initiatedBy === 'admin' ? (
                            <div style={{
                                background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                                border: '1px solid #C7D2FE',
                                borderRadius: '12px',
                                padding: '20px',
                                marginBottom: '24px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                            }}>
                                <div className="res-info-wrapper" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: '#4f46e5',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <HiOutlineInformationCircle size={22} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: 0, color: '#312E81', fontSize: '16px', fontWeight: '700' }}>
                                            Resignation Initiated by Admin Department
                                        </h4>
                                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#4338CA', lineHeight: '1.5' }}>
                                            Your exit request has been officially recorded and initiated by the Admin Department. Please find the details of the request below:
                                        </p>
                                        <div style={{
                                            marginTop: '14px',
                                            background: '#FFFFFF',
                                            border: '1px solid #E0E7FF',
                                            borderRadius: '8px',
                                            padding: '12px 16px',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: '12px',
                                            fontSize: '13px'
                                        }}>
                                            <div>
                                                <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exit Reason</strong>
                                                <div style={{ color: '#1F2937', fontWeight: '600', marginTop: '2px', textTransform: 'capitalize' }}>
                                                    {myResignation.exitReason?.replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                            <div>
                                                <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submission Date</strong>
                                                <div style={{ color: '#1F2937', fontWeight: '600', marginTop: '2px' }}>
                                                    {fd(myResignation.resignationDate)}
                                                </div>
                                            </div>
                                            <div>
                                                <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Last Working Day (LWD)</strong>
                                                <div style={{ color: '#1F2937', fontWeight: '600', marginTop: '2px' }}>
                                                    {fd(myResignation.lwd)}
                                                </div>
                                            </div>
                                            {myResignation.remarks && (
                                                <div style={{ gridColumn: '1 / -1' }}>
                                                    <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin Remarks / Notes</strong>
                                                    <div style={{ color: '#4B5563', marginTop: '4px', fontStyle: 'italic', background: '#F9FAFB', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #818CF8' }}>
                                                        "{myResignation.remarks}"
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', borderRadius: '8px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <HiCheckCircle style={{ color: '#10B981', fontSize: '22px' }} />
                                <span style={{ color: '#065F46', fontWeight: 500, fontSize: '14px' }}>
                                    Resignation submitted. Form is now locked.
                                </span>
                            </div>
                        )
                    )}

                    {myResignation?.isDraft && (
                        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '14px', marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span style={{ color: '#D97706', fontSize: '22px' }}>📝</span>
                            <span style={{ color: '#92400E', fontWeight: 600, fontSize: '14px' }}>
                                You have a saved draft resignation request. Please fill in the remaining mandatory fields and click "Initiate Offboarding" to submit it to HR.
                            </span>
                        </div>
                    )}

                    <form onSubmit={(e) => handleSubmit(e, false)}>
                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label">Primary reason for leaving <span style={{ color: '#EF4444' }}>*</span></label>
                            <select
                                className="form-control"
                                required
                                disabled={isLocked}
                                value={exitReason}
                                onChange={e => setExitReason(e.target.value)}
                                style={{ height: '42px', fontSize: '14px' }}
                            >
                                <option value="">-- Select primary reason --</option>
                                <option value="Better opportunity">Better opportunity</option>
                                <option value="Personal reasons">Personal reasons</option>
                                <option value="Higher studies">Higher studies</option>
                                <option value="Relocation">Relocation</option>
                                <option value="Health reasons">Health reasons</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            <div className="form-group" style={{ flex: '1 1 300px' }}>
                                <label className="form-label">Resignation Date <span style={{ color: '#EF4444' }}>*</span></label>
                                <input
                                    type="date"
                                    className="form-control"
                                    required
                                    disabled={isLocked}
                                    value={resignationDate}
                                    onChange={e => handleResignationDateChange(e.target.value)}
                                    style={{ height: '42px' }}
                                />
                            </div>

                            <div className="form-group" style={{ flex: '1 1 300px' }}>
                                <label className="form-label">Expected Last Working Day (LWD) <span style={{ color: '#EF4444' }}>*</span></label>
                                <input
                                    type="date"
                                    className="form-control"
                                    required
                                    disabled={isLocked}
                                    value={expectedLastWorkingDay}
                                    onChange={e => setExpectedLastWorkingDay(e.target.value)}
                                    style={{ height: '42px' }}
                                />
                            </div>
                        </div>

                        {/* Notice info & manager list */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', gap: '8px', background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                                <HiOutlineInformationCircle style={{ fontSize: '18px', flexShrink: 0 }} />
                                <span>Standard notice period policy will apply (30 days). Calculated automatically.</span>
                            </div>

                            <div style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '12px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#4B5563', fontWeight: 600, display: 'block' }}>Reporting Manager:</span>
                                <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{reportingManager}</span>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label">Resignation Statement / Letter Details <span style={{ color: '#EF4444' }}>*</span></label>
                            <textarea
                                className="form-control"
                                required
                                disabled={isLocked}
                                value={resignationLetter}
                                onChange={e => setResignationLetter(e.target.value)}
                                rows={4}
                                placeholder="Explain details regarding resignation..."
                                style={{ fontSize: '14px' }}
                            />
                            {!isLocked && <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Minimum 20 characters.</span>}
                        </div>

                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label className="form-label">Request early release (Optional)</label>
                            <textarea
                                className="form-control"
                                disabled={isLocked}
                                value={earlyReleaseRequest}
                                onChange={e => setEarlyReleaseRequest(e.target.value)}
                                rows={2}
                                placeholder="Explain any request details..."
                                style={{ fontSize: '14px' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                type="submit"
                                className="btn"
                                disabled={isLocked || submitting}
                                style={{ background: '#6C5CE7', color: '#FFFFFF', padding: '9px 18px', fontWeight: 600, borderRadius: '8px', border: 'none', cursor: isLocked ? 'not-allowed' : 'pointer' }}
                            >
                                {submitting ? 'Submitting...' : myResignation?.approvalStatus === 'rejected' ? 'Resubmit Resignation' : 'Initiate Offboarding'}
                            </button>

                            {!isLocked && (
                                <button
                                    type="button"
                                    onClick={() => handleSubmit(null, true)}
                                    disabled={submitting}
                                    style={{ background: '#F3F4F6', color: '#4B5563', border: '1px solid #D1D5DB', padding: '9px 18px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer' }}
                                >
                                    Save as Draft
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {/* EXIT TIMELINE TAB */}
            {activeTab === 'status' && (
                !hasRes ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                        <HiOutlineInformationCircle style={{ fontSize: '48px', color: '#6C5CE7', marginBottom: '12px' }} />
                        <h4 style={{ color: '#1F2937', fontWeight: 600 }}>No Active Exit Request</h4>
                        <p style={{ fontSize: '14px' }}>Please submit your resignation request first to enable tracking.</p>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '24px' }}>Exit Progress status</h3>

                        {myResignation?.initiatedBy === 'admin' && (
                            <div style={{
                                background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                                border: '1px solid #C7D2FE',
                                borderRadius: '12px',
                                padding: '20px',
                                marginBottom: '24px',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)'
                            }}>
                                <div className="res-info-wrapper" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '10px',
                                        background: '#4f46e5',
                                        color: '#fff',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <HiOutlineInformationCircle size={22} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: 0, color: '#312E81', fontSize: '16px', fontWeight: '700' }}>
                                            Resignation Initiated by Admin Department
                                        </h4>
                                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#4338CA', lineHeight: '1.5' }}>
                                            Your exit request has been officially recorded and initiated by the Admin Department. Please find the details of the request below:
                                        </p>
                                        <div style={{
                                            marginTop: '14px',
                                            background: '#FFFFFF',
                                            border: '1px solid #E0E7FF',
                                            borderRadius: '8px',
                                            padding: '12px 16px',
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                            gap: '12px',
                                            fontSize: '13px'
                                        }}>
                                            <div>
                                                <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exit Reason</strong>
                                                <div style={{ color: '#1F2937', fontWeight: '600', marginTop: '2px', textTransform: 'capitalize' }}>
                                                    {myResignation.exitReason?.replace(/_/g, ' ')}
                                                </div>
                                            </div>
                                            <div>
                                                <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Submission Date</strong>
                                                <div style={{ color: '#1F2937', fontWeight: '600', marginTop: '2px' }}>
                                                    {fd(myResignation.resignationDate)}
                                                </div>
                                            </div>
                                            <div>
                                                <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expected Last Working Day (LWD)</strong>
                                                <div style={{ color: '#1F2937', fontWeight: '600', marginTop: '2px' }}>
                                                    {fd(myResignation.lwd)}
                                                </div>
                                            </div>
                                            {myResignation.remarks && (
                                                <div style={{ gridColumn: '1 / -1' }}>
                                                    <strong style={{ color: '#6B7280', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin Remarks / Notes</strong>
                                                    <div style={{ color: '#4B5563', marginTop: '4px', fontStyle: 'italic', background: '#F9FAFB', padding: '8px 12px', borderRadius: '6px', borderLeft: '3px solid #818CF8' }}>
                                                        "{myResignation.remarks}"
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {myResignation?.adminEdited && (
                            <div style={{
                                background: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
                                border: '1px solid #FCD34D',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                marginBottom: '24px',
                                boxShadow: '0 2px 4px 0 rgba(251, 191, 36, 0.05)'
                            }}>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: '20px', lineHeight: 1, marginTop: '2px' }}>⚠️</span>
                                    <div>
                                        <h5 style={{ margin: 0, color: '#92400E', fontWeight: 700, fontSize: '15px' }}>
                                            Resignation Parameters Adjusted by Admin
                                        </h5>
                                        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#B45309', lineHeight: '1.5' }}>
                                            The Admin / HR Department has adjusted your resignation parameters:
                                        </p>
                                        <div style={{
                                            marginTop: '8px',
                                            fontFamily: 'monospace',
                                            fontSize: '12px',
                                            color: '#78350F',
                                            background: 'rgba(255, 255, 255, 0.6)',
                                            padding: '8px 12px',
                                            borderRadius: '6px',
                                            borderLeft: '3px solid #D97706'
                                        }}>
                                            {myResignation.adminEditDetails}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '19px', top: '20px', width: '2px', bottom: '20px', background: '#E5E7EB', zIndex: 1 }} />

                            {/* Step 1: Resignation Submitted */}
                            <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 2, paddingBottom: '20px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#10B981', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>✓</div>
                                <div style={{ paddingTop: '4px' }}>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#1F2937' }}>Resignation submitted</h4>
                                    <span style={{ fontSize: '11px', color: '#9CA3AF' }}>Submitted: {fd(myResignation.resignationDate)}</span>
                                </div>
                            </div>

                            {/* Step 2: HR Approved / Rejected */}
                            {myResignation?.approvalStatus === 'rejected' ? (
                                <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 2, paddingBottom: '20px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EF4444', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>✗</div>
                                    <div style={{ paddingTop: '4px' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#EF4444' }}>Resignation Rejected</h4>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#B91C1C', fontWeight: 500 }}>
                                            Reason: "{myResignation.rejectionReason || 'No feedback provided'}"
                                        </p>
                                        <span style={{ fontSize: '11px', color: '#6B7280', display: 'block', marginTop: '4px' }}>
                                            Modify fields and resubmit your resignation under the "Submit resignation" tab.
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 2, paddingBottom: '20px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isApproved ? '#10B981' : '#F3F4F6', color: isApproved ? '#FFFFFF' : '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>
                                        {isApproved ? '✓' : '2'}
                                    </div>
                                    <div style={{ paddingTop: '4px' }}>
                                        <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: isApproved ? '#1F2937' : '#9CA3AF' }}>HR approved</h4>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: isApproved ? '#4B5563' : '#9CA3AF' }}>
                                            {isApproved ? `Exit Approved. LWD confirmed: ${fd(myResignation.lwd)}` : 'Approval pending'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Checklist Clearance */}
                            <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 2, paddingBottom: '20px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: isChecklistDone ? '#10B981' : isApproved ? '#EEF2FF' : '#F3F4F6',
                                    color: isChecklistDone ? '#FFFFFF' : '#9CA3AF',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                                    flexShrink: 0
                                }}>
                                    {isChecklistDone ? '✓' : '3'}
                                </div>
                                <div style={{ paddingTop: '4px', width: '100%' }}>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: isApproved ? '#1F2937' : '#9CA3AF' }}>Clearance Checklist ({checklistProgress.cleared}/{checklistProgress.total})</h4>

                                    {isApproved && !isChecklistDone && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', background: '#F9FAFB', padding: '12px', borderRadius: '8px', marginTop: '10px' }}>
                                            {checklistProgress.items.map((item, idx) => (
                                                <div key={idx} style={{ fontSize: '12px', color: item.cleared ? '#10B981' : '#6B7280' }}>
                                                    {item.cleared ? '●' : '○'} {item.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Step 4: F&F Calculation */}
                            <div style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 2 }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: myResignation.ffStatus === 'paid' ? '#10B981' : isChecklistDone ? '#EEF2FF' : '#F3F4F6',
                                    color: myResignation.ffStatus === 'paid' ? '#FFFFFF' : '#9CA3AF',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                                    flexShrink: 0
                                }}>
                                    {myResignation.ffStatus === 'paid' ? '✓' : '4'}
                                </div>
                                <div style={{ paddingTop: '4px' }}>
                                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: isChecklistDone ? '#1F2937' : '#9CA3AF' }}>F&F Settlement processing</h4>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* F&F SETTLEMENT TAB */}
            {activeTab === 'fnf' && (
                !hasRes || !isApproved || !isChecklistDone || !ffDetails ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                        <HiOutlineInformationCircle style={{ fontSize: '48px', color: '#6C5CE7', marginBottom: '12px' }} />
                        <h4 style={{ color: '#1F2937', fontWeight: 600 }}>Settlement calculation not ready</h4>
                        <p style={{ fontSize: '14px' }}>Calculations will become available once the clearance checklist is completed by HR.</p>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '20px' }}>Full & Final Settlement details</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', padding: '14px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#6B7280' }}>Total Service</span>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#1F2937' }}>{myResignation.gratuityDetails?.totalService || 'N/A'}</div>
                            </div>
                            <div style={{ background: '#ECFDF5', border: '1px solid #D1FAE5', padding: '14px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#065F46' }}>Gratuity Amount</span>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#10B981' }}>{fm(ffDetails.gratuityAmount)}</div>
                            </div>
                            <div style={{ background: '#EEF2FF', border: '1px solid #D8B4FE', padding: '14px', borderRadius: '8px' }}>
                                <span style={{ fontSize: '12px', color: '#4338CA' }}>Net F&F Payable</span>
                                <div style={{ fontSize: '18px', fontWeight: 700, color: '#6C5CE7' }}>{fm(ffDetails.netPayable)}</div>
                            </div>
                        </div>

                        {/* Breakdown table */}
                        <div style={{ overflowX: 'auto', width: '100%' }}>
                            <table style={{ width: '100%', minWidth: '450px', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '20px' }}>
                                <thead>
                                    <tr style={{ background: '#F3F4F6' }}>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Component</th>
                                        <th style={{ padding: '10px', textAlign: 'right' }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* EARNINGS SECTION */}
                                    <tr style={{ background: '#F9FAFB' }}>
                                        <td colSpan="2" style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', color: '#4B5563', letterSpacing: '0.05em' }}>
                                            EARNINGS
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px' }}>Pending salary{getPendingSalarySub()}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{fm(ffDetails.pendingSalary)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px' }}>Leave encashment{getLeaveEncashmentSub()}</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{fm(ffDetails.leaveEncashment)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px', color: '#10B981' }}>Gratuity{getGratuitySub()}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: '#10B981' }}>{fm(ffDetails.gratuityAmount)}</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px' }}>Other dues</td>
                                        <td style={{ padding: '10px', textAlign: 'right' }}>{fm(ffDetails.otherEarnings || 0)}</td>
                                    </tr>

                                    {/* DEDUCTIONS SECTION */}
                                    <tr style={{ background: '#F9FAFB' }}>
                                        <td colSpan="2" style={{ padding: '8px 10px', fontWeight: 700, fontSize: '11px', color: '#4B5563', letterSpacing: '0.05em', borderTop: '1px solid #E5E7EB' }}>
                                            DEDUCTIONS
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px', color: '#EF4444' }}>Notice period recovery{getNoticeRecoverySub()}</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: '#EF4444' }}>({fm(ffDetails.noticePeriodRecovery)})</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px', color: '#EF4444' }}>Loan recovery outstanding</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: '#EF4444' }}>({fm(ffDetails.loanRecovery)})</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px', paddingLeft: '16px', color: '#EF4444' }}>Advance salary recovery</td>
                                        <td style={{ padding: '10px', textAlign: 'right', color: '#EF4444' }}>({fm(ffDetails.advanceRecovery || 0)})</td>
                                    </tr>

                                    {/* NET SETTLEMENT */}
                                    <tr style={{ fontWeight: 700, borderTop: '2px solid #E5E7EB', background: '#F9FAFB' }}>
                                        <td style={{ padding: '12px' }}>Net settlement payable</td>
                                        <td style={{ padding: '12px', textAlign: 'right', color: '#6C5CE7', fontSize: '16px' }}>{fm(ffDetails.netPayable)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* DOCUMENTS DOWNLOAD TAB */}
            {activeTab === 'docs' && (
                !hasRes || !isExitCompleted ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                        <HiOutlineInformationCircle style={{ fontSize: '48px', color: '#6C5CE7', marginBottom: '12px' }} />
                        <h4 style={{ color: '#1F2937', fontWeight: 600 }}>Exit documents not generated yet</h4>
                        <p style={{ fontSize: '14px' }}>Relieving, experience, and settlement letters will be issued on your Last Working Day.</p>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', marginBottom: '20px' }}>Your Exit Documents</h3>

                        <div style={{ display: 'grid', gap: '12px' }}>
                            {['ff-letter', 'experience-letter', 'relieving-letter', 'gratuity-sheet'].map((type, idx) => {
                                const labels = {
                                    'ff-letter': 'F&F settlement letter',
                                    'experience-letter': 'Experience certificate',
                                    'relieving-letter': 'Official relieving letter',
                                    'gratuity-sheet': 'Gratuity computation sheet'
                                };
                                return (
                                    <div key={idx} style={{ border: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '8px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>{labels[type]}</span>
                                        <button onClick={() => downloadDoc(type)} style={{ background: 'none', border: '1.5px solid #6C5CE7', color: '#6C5CE7', fontWeight: 600, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>
                                            Download PDF
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )
            )}

            {/* APPROVAL REJECTED TAB */}
            {activeTab === 'rejected' && (
                <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid #E5E7EB', background: '#FFFFFF' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
                        border: '1px solid #FCA5A5',
                        borderRadius: '12px',
                        padding: '20px',
                        marginBottom: '24px',
                        boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.05)'
                    }}>
                        <div className="res-info-wrapper" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: '#EF4444',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <HiOutlineBan size={22} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <h4 style={{ margin: 0, color: '#991B1B', fontSize: '16px', fontWeight: '700' }}>
                                    Your Exit Request was Rejected
                                </h4>
                                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#B91C1C', lineHeight: '1.5' }}>
                                    Management has rejected this resignation. Below is the reason/suggestion provided by the reviewers. You are permitted to submit a new resignation request at any time.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '20px', marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#374151', borderBottom: '1px solid #E5E7EB', paddingBottom: '8px' }}>
                            Rejection Feedback & Suggestions
                        </h4>
                        <div style={{
                            padding: '14px',
                            background: '#FFFFFF',
                            border: '1px solid #EF4444',
                            borderRadius: '8px',
                            borderLeft: '5px solid #EF4444',
                            fontStyle: 'italic',
                            color: '#7F1D1D',
                            fontSize: '14px',
                            lineHeight: '1.6'
                        }}>
                            "{myResignation?.rejectionReason || 'No details/remarks provided.'}"
                        </div>
                    </div>

                    <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#374151', borderBottom: '1px solid #E5E7EB', paddingBottom: '8px' }}>
                            Submitted Resignation Details
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '14px', marginBottom: '16px' }}>
                            <div>
                                <span style={{ color: '#6B7280', fontSize: '12px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Exit Category</span>
                                <strong style={{ color: '#1F2937', display: 'block', marginTop: '2px', textTransform: 'capitalize' }}>
                                    {myResignation?.exitReason?.replace(/_/g, ' ')}
                                </strong>
                            </div>
                            <div>
                                <span style={{ color: '#6B7280', fontSize: '12px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Submission Date</span>
                                <strong style={{ color: '#1F2937', display: 'block', marginTop: '2px' }}>
                                    {fd(myResignation?.resignationDate)}
                                </strong>
                            </div>
                            <div>
                                <span style={{ color: '#6B7280', fontSize: '12px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Expected LWD</span>
                                <strong style={{ color: '#1F2937', display: 'block', marginTop: '2px' }}>
                                    {fd(myResignation?.lwd)}
                                </strong>
                            </div>
                        </div>

                        {myResignation?.resignationLetter && (
                            <div style={{ marginTop: '16px' }}>
                                <span style={{ color: '#6B7280', fontSize: '12px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Resignation Letter Body</span>
                                <div style={{
                                    marginTop: '6px',
                                    padding: '12px',
                                    background: '#F9FAFB',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    color: '#4B5563',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.5'
                                }}>
                                    {myResignation.resignationLetter}
                                </div>
                            </div>
                        )}

                        {myResignation?.earlyReleaseRequest && (
                            <div style={{ marginTop: '16px' }}>
                                <span style={{ color: '#6B7280', fontSize: '12px', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Early Release Request Justification</span>
                                <div style={{
                                    marginTop: '6px',
                                    padding: '12px',
                                    background: '#F9FAFB',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '6px',
                                    fontSize: '13px',
                                    color: '#4B5563',
                                    whiteSpace: 'pre-wrap',
                                    lineHeight: '1.5'
                                }}>
                                    {myResignation.earlyReleaseRequest}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
