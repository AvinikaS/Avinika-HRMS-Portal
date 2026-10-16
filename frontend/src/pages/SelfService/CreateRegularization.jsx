import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import {
    HiOutlineArrowLeft,
    HiOutlinePaperClip,
    HiOutlineCloudUpload,
    HiOutlineTrash,
    HiOutlineX,
    HiOutlinePlus,
    HiOutlineCalendar
} from 'react-icons/hi';

export default function CreateRegularization() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deletingIndex, setDeletingIndex] = useState(null);

    const todayStr = new Date().toISOString().split('T')[0];

    const [isMultiDate, setIsMultiDate] = useState(false);
    const [attendanceDates, setAttendanceDates] = useState([todayStr]);
    const [newDateInput, setNewDateInput] = useState(todayStr);

    const [form, setForm] = useState({
        attendanceDate: todayStr,
        requestedCheckIn: '09:30',
        requestedCheckOut: '18:30',
        attendanceType: 'FULL_DAY',
        reason: 'FORGOT_CHECK_IN',
        comment: '',
        attachments: []
    });

    const formatDateDisplay = (dateStr) => {
        if (!dateStr) return '';
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
            return new Date(dateStr).toLocaleDateString('en-IN');
        } catch {
            return dateStr;
        }
    };

    const handleToggleMultiDate = () => {
        const nextState = !isMultiDate;
        setIsMultiDate(nextState);
        if (nextState) {
            // When enabling multi-date mode, make sure current date is in the list
            if (form.attendanceDate && !attendanceDates.includes(form.attendanceDate)) {
                setAttendanceDates([form.attendanceDate]);
            } else if (attendanceDates.length === 0) {
                setAttendanceDates([todayStr]);
            }
            setNewDateInput(todayStr);
        } else {
            // When disabling multi-date mode, reset single date to first chosen date
            if (attendanceDates.length > 0) {
                setForm(prev => ({ ...prev, attendanceDate: attendanceDates[0] }));
            }
        }
    };

    const handleAddDate = () => {
        if (!newDateInput) {
            return toast.warning('Please select a date first');
        }
        if (newDateInput > todayStr) {
            return toast.error('Attendance date cannot be in the future');
        }
        if (attendanceDates.includes(newDateInput)) {
            return toast.warning('This date is already added');
        }
        const updated = [...attendanceDates, newDateInput].sort();
        setAttendanceDates(updated);
        toast.success(`Date ${formatDateDisplay(newDateInput)} added`);
    };

    const handleRemoveDate = (dateToRemove) => {
        if (attendanceDates.length <= 1) {
            return toast.info('At least one date is required');
        }
        setAttendanceDates(prev => prev.filter(d => d !== dateToRemove));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            return toast.error('File size must be under 5MB');
        }

        setUploading(true);
        try {
            // Get upload signature
            const sigRes = await api.post('/upload/signature', { folder: 'hrms/regularizations' });
            if (!sigRes.data.success) throw new Error('Failed to obtain upload signature');

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
                const newAttachment = {
                    fileName: file.name,
                    fileUrl: uploadData.secure_url,
                    publicId: uploadData.public_id,
                    fileType: file.type,
                    fileSize: file.size,
                    uploadedAt: new Date()
                };
                setForm(prev => ({
                    ...prev,
                    attachments: [...prev.attachments, newAttachment]
                }));
                toast.success('File uploaded successfully');
            } else {
                throw new Error(uploadData.error?.message || 'Upload failed');
            }
        } catch (err) {
            toast.error(err.message || 'File upload failed');
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = async (index) => {
        setDeletingIndex(index);
        const target = form.attachments[index];
        if (target && target.publicId) {
            try {
                await api.delete('/upload/file', { data: { publicId: target.publicId } });
                toast.success('File removed');
            } catch (err) {
                console.error('Failed to delete file:', err);
                toast.error('Failed to remove file');
            }
        }
        setForm(prev => ({
            ...prev,
            attachments: prev.attachments.filter((_, i) => i !== index)
        }));
        setDeletingIndex(null);
    };

    const handleSubmit = async (submitImmediately = false) => {
        const datesToSubmit = isMultiDate ? attendanceDates : [form.attendanceDate];

        if (datesToSubmit.length === 0 || !datesToSubmit[0]) {
            return toast.error('Please select at least one attendance date');
        }

        if (!form.requestedCheckIn || !form.requestedCheckOut || !form.reason) {
            return toast.error('Please fill in all required fields');
        }

        setSubmitting(true);
        try {
            const res = await api.post('/attendance/regularization', {
                ...form,
                attendanceDate: datesToSubmit[0],
                attendanceDates: datesToSubmit,
                submitImmediately
            });

            if (res.data.success) {
                toast.success(res.data.message || 'Regularization request created!');
                navigate('/my-regularizations');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <style>{`
                .create-reg-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 28px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .create-reg-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                .create-reg-footer-btns {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 16px;
                    border-top: 1px solid #e2e8f0;
                }
                @media (max-width: 640px) {
                    .create-reg-card {
                        padding: 16px !important;
                    }
                    .create-reg-grid {
                        grid-template-columns: 1fr !important;
                        gap: 14px !important;
                    }
                    .create-reg-footer-btns {
                        flex-direction: column-reverse !important;
                        gap: 10px !important;
                    }
                    .create-reg-footer-btns button {
                        width: 100% !important;
                    }
                }
            `}</style>
            <button
                onClick={() => navigate('/my-regularizations')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', marginBottom: '16px', fontSize: '14px', fontWeight: '500' }}
            >
                <HiOutlineArrowLeft size={18} /> Back to Regularization Requests
            </button>

            <div className="card create-reg-card">
                <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', marginBottom: '8px' }}>
                    New Attendance Regularization Request
                </h1>
                <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
                    Correct missed punch-ins/outs or attendance system logs. HR Admin will review your request.
                </p>

                <div className="create-reg-grid">
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155', margin: 0 }}>
                                {isMultiDate ? 'Attendance Dates' : 'Attendance Date'} <span style={{ color: '#dc2626' }}>*</span>
                            </label>

                            {/* Multi Date Clickable Box */}
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={handleToggleMultiDate}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleToggleMultiDate();
                                    }
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    fontWeight: '600',
                                    color: isMultiDate ? '#2563eb' : '#64748b',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    background: isMultiDate ? '#eff6ff' : '#f8fafc',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    border: `1.5px solid ${isMultiDate ? '#3b82f6' : '#cbd5e1'}`,
                                    transition: 'all 0.15s ease',
                                    boxShadow: isMultiDate ? '0 1px 3px rgba(37, 99, 235, 0.15)' : 'none'
                                }}
                                title="Click to enable or disable multi-date selection"
                            >
                                <input
                                    type="checkbox"
                                    checked={isMultiDate}
                                    readOnly
                                    style={{ cursor: 'pointer', accentColor: '#2563eb', pointerEvents: 'none', width: '13px', height: '13px' }}
                                />
                                <span>Multi Date</span>
                            </div>
                        </div>

                        {/* If Multi Date is NOT clicked: regular single date input (NO plus icon) */}
                        {!isMultiDate ? (
                            <input
                                type="date"
                                max={todayStr}
                                value={form.attendanceDate}
                                onChange={(e) => setForm({ ...form, attendanceDate: e.target.value })}
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                            />
                        ) : (
                            /* If Multi Date IS clicked: date input + plus icon button to add dates */
                            <div>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="date"
                                        max={todayStr}
                                        value={newDateInput}
                                        onChange={(e) => setNewDateInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddDate();
                                            }
                                        }}
                                        style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddDate}
                                        title="Add date"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '9px 14px',
                                            borderRadius: '8px',
                                            background: '#2563eb',
                                            color: '#fff',
                                            border: 'none',
                                            fontWeight: '600',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'background 0.15s ease',
                                            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#1d4ed8'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
                                    >
                                        <HiOutlinePlus size={16} />
                                        <span>Add</span>
                                    </button>
                                </div>

                                {/* Selected dates chips */}
                                {attendanceDates.length > 0 ? (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '38px' }}>
                                        {attendanceDates.map((dateStr) => (
                                            <span
                                                key={dateStr}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: '#eff6ff',
                                                    color: '#1e40af',
                                                    border: '1px solid #bfdbfe',
                                                    padding: '3px 8px 3px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                <HiOutlineCalendar size={13} color="#3b82f6" />
                                                <span>{formatDateDisplay(dateStr)}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveDate(dateStr)}
                                                    title="Remove date"
                                                    style={{
                                                        border: 'none',
                                                        background: 'none',
                                                        color: '#94a3b8',
                                                        cursor: 'pointer',
                                                        padding: '1px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        borderRadius: '3px'
                                                    }}
                                                    onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                                                    onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                >
                                                    <HiOutlineX size={13} />
                                                </button>
                                            </span>
                                        ))}
                                        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>
                                                {attendanceDates.length} date{attendanceDates.length > 1 ? 's' : ''} selected
                                            </span>
                                        </div>
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '6px', marginBottom: 0 }}>
                                        Please add at least one date.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Attendance Type <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <select
                            value={form.attendanceType}
                            onChange={(e) => setForm({ ...form, attendanceType: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        >
                            <option value="FULL_DAY">Full Day</option>
                            <option value="HALF_DAY">Half Day</option>
                            <option value="WFH">Work From Home (WFH)</option>
                            <option value="ON_DUTY">On Duty (OD)</option>
                            <option value="OTHER">Other</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Requested Check-In Time <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                            type="time"
                            value={form.requestedCheckIn}
                            onChange={(e) => setForm({ ...form, requestedCheckIn: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Requested Check-Out Time <span style={{ color: '#dc2626' }}>*</span>
                        </label>
                        <input
                            type="time"
                            value={form.requestedCheckOut}
                            onChange={(e) => setForm({ ...form, requestedCheckOut: e.target.value })}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Reason <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                    >
                        <option value="FORGOT_CHECK_IN">Forgot Check-In</option>
                        <option value="FORGOT_CHECK_OUT">Forgot Check-Out</option>
                        <option value="FORGOT_BOTH">Forgot Both Check-In & Check-Out</option>
                        <option value="BIOMETRIC_ISSUE">Biometric Issue</option>
                        <option value="GPS_ISSUE">GPS Location Issue</option>
                        <option value="FACE_VERIFICATION_ISSUE">Face Verification Issue</option>
                        <option value="SYSTEM_TECHNICAL_ISSUE">System Technical Glitch</option>
                        <option value="OTHER">Other</option>
                    </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Comments / Explanation (max 1000 characters)
                    </label>
                    <textarea
                        rows={4}
                        maxLength={1000}
                        placeholder="Provide details about why regularization is required..."
                        value={form.comment}
                        onChange={(e) => setForm({ ...form, comment: e.target.value })}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', resize: 'vertical' }}
                    />
                </div>

                {/* Attachments Section */}
                <div style={{ marginBottom: '28px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                        Supporting Document (Optional)
                    </label>
                    <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '20px', textAlign: 'center', background: '#f8fafc' }}>
                        <input
                            type="file"
                            id="reg-file-upload"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={uploading}
                        />
                        <label htmlFor="reg-file-upload" style={{ cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <HiOutlineCloudUpload size={32} color="#3b82f6" />
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#3b82f6' }}>
                                {uploading ? 'Uploading...' : 'Click to upload proof (PDF, JPG, PNG, Max 5MB)'}
                            </span>
                        </label>
                    </div>

                    {form.attachments.length > 0 && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {form.attachments.map((att, index) => (
                                <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '13px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <HiOutlinePaperClip size={16} color="#64748b" />
                                        <a href={att.fileUrl} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: '#2563eb', fontWeight: '500' }}>
                                            {att.fileName}
                                        </a>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(index)}
                                        disabled={deletingIndex === index}
                                        style={{ border: 'none', background: 'none', color: '#dc2626', cursor: deletingIndex === index ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                                        title="Remove file"
                                    >
                                        {deletingIndex === index ? (
                                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                        ) : (
                                            <HiOutlineX size={18} />
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Form Buttons */}
                <div className="create-reg-footer-btns">
                    <button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        disabled={submitting || uploading}
                        className="btn btn-outline"
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#334155', fontWeight: '600', cursor: 'pointer' }}
                    >
                        Save as Draft
                    </button>
                    <button
                        type="button"
                        onClick={() => handleSubmit(true)}
                        disabled={submitting || uploading}
                        className="btn btn-primary"
                        style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: '#3b82f6', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    );
}
