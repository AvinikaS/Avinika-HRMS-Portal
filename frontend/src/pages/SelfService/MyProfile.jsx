import Swal from 'sweetalert2';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { HiOutlineCamera, HiOutlineTrash, HiOutlineUpload, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { toast } from 'react-toastify';

export default function MyProfile() {
    const { user, fetchMe } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileImage, setProfileImage] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [employeeData, setEmployeeData] = useState(null);
    const fileRef = useRef(null);
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showImageMenu, setShowImageMenu] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');
    const [adminPhone, setAdminPhone] = useState('+91 98765 43210');
    const [notifications, setNotifications] = useState({ newLeave: true, leaveStatus: true, jobApp: true, payslip: true, challanReminder: true });

    // Fetch employee data with profile image
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const { data } = await api.get('/auth/me');
                if (data.user?.employeeId) {
                    setEmployeeData(data.user.employeeId);
                }
                setProfileImage(data.user?.profileImage || null);
            } catch { }
            setProfileLoading(false);
        };
        fetchProfile();
    }, []);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowed.includes(file.type)) {
            toast.error('Only JPG, PNG, GIF images are allowed');
            return;
        }

        setUploading(true);
        setShowImageMenu(false); // Hide the popup instantly
        const toastId = toast.loading('Uploading profile image...');

        try {
            const { uploadToCloudinary } = await import('../../utils/cloudinaryUpload');
            const result = await uploadToCloudinary(file, 'hrms/profiles');

            const { data } = await api.put('/auth/profile-image', { imageUrl: result.url });
            setProfileImage(data.profileImage);
            toast.update(toastId, { render: 'Profile image updated successfully!', type: 'success', isLoading: false, autoClose: 3000 });
            fetchMe(); // Update global auth user state for Topbar
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.message || err.message || 'Failed to upload image', type: 'error', isLoading: false, autoClose: 3000 });
        }

        setUploading(false);
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleImageDelete = async () => {
        setShowImageMenu(false); // Hide the popup instantly
        const _swalRes = await Swal.fire({ title: 'Delete Profile Image?', text: 'Are you sure you want to remove your profile picture?', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#f1f5f9', confirmButtonText: 'Delete', cancelButtonText: '<span style="color: #475569; font-weight: 600;">Cancel</span>', reverseButtons: true, customClass: { confirmButton: 'swal-delete-btn' } });
        if (!_swalRes.isConfirmed) return;

        setUploading(true);
        const toastId = toast.loading('Removing profile image...');

        try {
            await api.delete('/auth/profile-image');
            setProfileImage(null);
            toast.update(toastId, { render: 'Profile image removed successfully!', type: 'success', isLoading: false, autoClose: 3000 });
            fetchMe(); // Update global auth user state for Topbar
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.message || 'Failed to delete image', type: 'error', isLoading: false, autoClose: 3000 });
        }
        setUploading(false);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (currentPassword === newPassword) {
            return toast.error('New password must be different from current password');
        }
        if (newPassword !== confirmPassword) { return toast.error('New password and confirm password do not match'); }
        if (newPassword.length < 6) { return toast.error('New password must be at least 6 characters'); }
        setLoading(true);
        const toastId = toast.loading('Updating password...');
        try {
            const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
            toast.update(toastId, { render: data.message || 'Password updated successfully!', type: 'success', isLoading: false, autoClose: 3000 });
            setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
        } catch (err) {
            toast.update(toastId, { render: err.response?.data?.message || 'Failed to update password', type: 'error', isLoading: false, autoClose: 3000 });
        }
        setLoading(false);
    };

    const displayName = profileLoading
        ? '...'
        : employeeData
            ? `${employeeData.firstName} ${employeeData.lastName}`
            : user?.email?.split('@')[0];

    const initials = profileLoading
        ? ''
        : employeeData
            ? `${employeeData.firstName?.charAt(0) || ''}${employeeData.lastName?.charAt(0) || ''}`
            : user?.email?.charAt(0).toUpperCase();

    return (
        <div className="animate-fadeIn">
            <style>{`
                .profile-header-card { display: flex; align-items: center; gap: 24px; margin-bottom: 32px; }
                .profile-tabs { display: flex; border-bottom: 1px solid var(--border-color); margin-bottom: 24px; gap: 24px; overflow-x: auto; flex-wrap: nowrap; }
                .profile-tab { white-space: nowrap; padding-bottom: 12px; cursor: pointer; font-weight: 600; transition: all 0.2s; border-bottom: 2px solid transparent; color: var(--text-tertiary); }
                .profile-tab.active { color: var(--primary); border-bottom-color: var(--primary); }
                
                @media (max-width: 480px) {
                    .profile-header-card { flex-direction: column; text-align: center; gap: 16px; }
                    .profile-header-card > div:last-child { display: flex; flex-direction: column; align-items: center; word-break: break-word; }
                    /* Remove underlines only on mobile */
                    .profile-tabs { border-bottom: none; }
                    .profile-tab { border-bottom: none; }
                    .profile-tab.active { border-bottom: none; }
                }
            `}</style>
            <div className="page-header"><div><h1>My Profile</h1><p>View and manage your personal information</p></div></div>

            <div className="card" style={{ maxWidth: 800 }}>
                {/* Profile Image Section */}
                <div className="profile-header-card">
                    <div style={{ position: 'relative' }}>
                        {profileImage ? (
                            <>
                                <img src={profileImage} alt="Profile" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }} />
                                <div style={{ position: 'absolute', bottom: -5, right: -5 }}>
                                    <div onClick={() => setShowImageMenu(!showImageMenu)} style={{ background: '#fff', border: '2px solid #4f46e5', color: '#4f46e5', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.2s', zIndex: 10 }}>
                                        <HiOutlineCamera size={20} />
                                    </div>
                                    {showImageMenu && (
                                        <div style={{ position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.1)', padding: '8px 0', width: 150, zIndex: 100, border: '1px solid #e2e8f0' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', fontSize: 13, cursor: 'pointer', color: '#1e293b', margin: 0 }}>
                                                <HiOutlineUpload size={16} /> Upload Image
                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { handleImageUpload(e); setShowImageMenu(false); }} />
                                            </label>
                                            <div onClick={handleImageDelete} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', fontSize: 13, cursor: 'pointer', color: '#ef4444' }}>
                                                <HiOutlineTrash size={16} /> Delete Image
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="avatar avatar-lg" style={{ background: 'var(--primary-gradient)', width: 96, height: 96, fontSize: 32, border: '4px solid #fff', boxShadow: '0 4px 15px rgba(0,0,0,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                                    {initials}
                                </div>
                                <label style={{ position: 'absolute', bottom: -5, right: -5, background: '#fff', border: '2px solid #4f46e5', color: '#4f46e5', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.2s', zIndex: 10 }} title="Upload Profile Photo">
                                    <HiOutlineCamera size={20} />
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                                </label>
                            </>
                        )}
                    </div>

                    <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: 22, fontWeight: 800 }}>{displayName}</h2>
                        <p style={{ color: 'var(--text-tertiary)', marginBottom: 8, wordBreak: 'break-word' }}>{user?.role} · {user?.email}</p>
                        {employeeData && (
                            <p style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                                {employeeData.department} · {employeeData.designation} · <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{employeeData.employeeCode}</span>
                            </p>
                        )}
                    </div>
                </div>

                {/* Tabs Navigation */}
                <div className="profile-tabs">
                    <div className={`profile-tab ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
                        Personal & Security
                    </div>
                    {employeeData && (
                        <div className={`profile-tab ${activeTab === 'employment' ? 'active' : ''}`} onClick={() => setActiveTab('employment')}>
                            Employment & Statutory
                        </div>
                    )}
                    <div className={`profile-tab ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
                        Notifications
                    </div>
                </div>

                {activeTab === 'personal' && (
                    <div className="animate-fadeIn">
                        {/* Personal Information */}
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>Personal Information</h3>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Email (System)</label><input className="form-control" value={user?.email || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={employeeData ? employeeData.phone : adminPhone} onChange={e => setAdminPhone(e.target.value)} readOnly={!!employeeData} /></div>
                        </div>
                        {employeeData && (
                            <div className="form-row">
                                <div className="form-group"><label className="form-label">Date of Birth</label><input className="form-control" value={employeeData.dateOfBirth ? new Date(employeeData.dateOfBirth).toLocaleDateString('en-GB') : ''} readOnly /></div>
                                <div className="form-group"><label className="form-label">Residential Address</label><input className="form-control" value={employeeData.address || ''} readOnly /></div>
                            </div>
                        )}

                        {/* Change Password */}
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '24px 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>Change Password</h3>

                        <form onSubmit={handleChangePassword}>
                            <div className="form-group">
                                <label className="form-label">Current Password</label>
                                <div className="password-group">
                                    <input type={showCurrent ? "text" : "password"} className="form-control" placeholder="Current password"
                                        value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
                                    <button type="button" className="password-toggle" onClick={() => setShowCurrent(!showCurrent)} tabIndex="-1">
                                        {showCurrent ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">New Password</label>
                                    <div className="password-group">
                                        <input type={showNew ? "text" : "password"} className="form-control" placeholder="New password (min 6 chars)"
                                            value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
                                        <button type="button" className="password-toggle" onClick={() => setShowNew(!showNew)} tabIndex="-1">
                                            {showNew ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Confirm New Password</label>
                                    <div className="password-group">
                                        <input type={showConfirm ? "text" : "password"} className="form-control" placeholder="Confirm new password"
                                            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                                        <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} tabIndex="-1">
                                            {showConfirm ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 8 }}>
                                {loading ? 'Updating...' : 'Update Password'}
                            </button>
                        </form>

                    </div>
                )}

                {activeTab === 'employment' && employeeData && (
                    <div className="animate-fadeIn">
                        {/* Employment Details */}
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>Employment Details</h3>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Employee Code</label><input className="form-control" value={employeeData?.employeeCode || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">Date of Joining</label><input className="form-control" value={employeeData?.dateOfJoining ? new Date(employeeData.dateOfJoining).toLocaleDateString('en-GB') : ''} readOnly /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={employeeData?.department || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">Designation</label><input className="form-control" value={employeeData?.designation || ''} readOnly /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Employment Type</label><input className="form-control" value={employeeData?.employmentType || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">Work Location</label><input className="form-control" value={employeeData?.workLocation || ''} readOnly /></div>
                        </div>

                        {/* Bank & Statutory Details */}
                        <h3 style={{ fontSize: 14, fontWeight: 700, margin: '24px 0 16px', paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>Bank & Statutory Information</h3>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Bank Name</label><input className="form-control" value={employeeData?.bankName || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">Account Number</label><input className="form-control" value={employeeData?.accountNumber || ''} readOnly /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">IFSC Code</label><input className="form-control" value={employeeData?.ifscCode || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">PAN Number</label><input className="form-control" value={employeeData?.pan || ''} readOnly /></div>
                        </div>
                        <div className="form-row">
                            <div className="form-group"><label className="form-label">Aadhaar Number</label><input className="form-control" value={employeeData?.aadhaar || ''} readOnly /></div>
                            <div className="form-group"><label className="form-label">UAN Number</label><input className="form-control" value={employeeData?.uan || ''} readOnly /></div>
                        </div>
                    </div>
                )}

                {activeTab === 'notifications' && (
                    <div className="animate-fadeIn">
                        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border-color)' }}>Email Notifications</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 24 }}>Manage what events trigger an email notification to your inbox.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, cursor: 'pointer' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>New Leave Application Received</span>
                                <input type="checkbox" checked={notifications.newLeave} onChange={e => setNotifications({ ...notifications, newLeave: e.target.checked })} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, cursor: 'pointer' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>Leave Approved / Rejected</span>
                                <input type="checkbox" checked={notifications.leaveStatus} onChange={e => setNotifications({ ...notifications, leaveStatus: e.target.checked })} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, cursor: 'pointer' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>New Job Application Received</span>
                                <input type="checkbox" checked={notifications.jobApp} onChange={e => setNotifications({ ...notifications, jobApp: e.target.checked })} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, cursor: 'pointer' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>Payslip Generated</span>
                                <input type="checkbox" checked={notifications.payslip} onChange={e => setNotifications({ ...notifications, payslip: e.target.checked })} />
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, cursor: 'pointer' }}>
                                <span style={{ fontWeight: 500, fontSize: 13 }}>PF / ESIC Challan Due Reminder</span>
                                <input type="checkbox" checked={notifications.challanReminder} onChange={e => setNotifications({ ...notifications, challanReminder: e.target.checked })} />
                            </label>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
