import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';
import { HiOutlineMail, HiOutlineKey, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineArrowLeft, HiOutlineCheckCircle, HiOutlineHome } from 'react-icons/hi';

export default function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1=email, 2=otp, 3=password
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/forgot-password', { email });
            setSuccess(data.message);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP');
        }
        setLoading(false);
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        try {
            const { data } = await api.post('/auth/verify-otp', { email, otp });
            setSuccess(data.message);
            setResetToken(data.resetToken);
            setStep(3);
        } catch (err) {
            setError(err.response?.data?.message || 'OTP verification failed');
        }
        setLoading(false);
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError(''); setSuccess(''); setLoading(true);
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }
        try {
            const { data } = await api.post('/auth/reset-password', { resetToken, newPassword, confirmPassword });
            setSuccess(data.message);
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setError(err.response?.data?.message || 'Password reset failed');
        }
        setLoading(false);
    };

    const stepInfo = [
        { num: 1, label: 'Email' },
        { num: 2, label: 'Verify OTP' },
        { num: 3, label: 'New Password' },
    ];

    return (
        <div className="login-page">
            {/* Home Button */}
            <Link to="/" style={{
                position: 'absolute', top: 24, left: 24, zIndex: 10,
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10,
                background: '#ffffff', border: '1px solid #e2e8f0',
                color: '#475569', fontSize: 13, fontWeight: 600,
                textDecoration: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                transition: 'all 0.2s'
            }}>
                <HiOutlineHome size={16} /> Back to Home
            </Link>

            <div className="login-card" style={{ maxWidth: 420 }}>
                <div className="login-logo">
                    <div className="logo-box">H</div>
                    <h1>Reset Password</h1>
                    <p>HRMS Portal</p>
                </div>

                {/* Step Indicator */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
                    {stepInfo.map(s => (
                        <div key={s.num} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 20,
                            background: step >= s.num ? 'rgba(79,70,229,0.12)' : '#f1f5f9',
                            color: step >= s.num ? '#4f46e5' : '#94a3b8',
                            fontSize: 12, fontWeight: 600, transition: 'all 0.3s'
                        }}>
                            {step > s.num ? <HiOutlineCheckCircle size={14} /> : <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{s.num}</span>}
                            {s.label}
                        </div>
                    ))}
                </div>

                {error && <div className="login-error">{error}</div>}
                {success && <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#059669', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{success}</div>}

                {/* Step 1: Email */}
                {step === 1 && (
                    <form onSubmit={handleSendOtp}>
                        <div className="form-group">
                            <label className="form-label">Registered Email Address</label>
                            <input
                                type="email" className="form-control" placeholder="Enter your email"
                                value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                            {loading ? 'Sending OTP...' : 'Send OTP'}
                        </button>
                    </form>
                )}

                {/* Step 2: OTP */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOtp}>
                        <div className="form-group">
                            <label className="form-label">Enter 6-digit OTP</label>
                            <input
                                type="text" className="form-control" placeholder="Enter OTP"
                                value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required autoFocus maxLength={6}
                                style={{ textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: 700 }}
                            />
                            <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                                OTP sent to <strong style={{ color: '#0f172a' }}>{email}</strong>. Valid for 5 minutes.
                            </p>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading || otp.length !== 6} style={{ width: '100%' }}>
                            {loading ? 'Verifying...' : 'Verify OTP'}
                        </button>
                        <button type="button" onClick={() => { setStep(1); setOtp(''); setError(''); setSuccess(''); }}
                            style={{ width: '100%', marginTop: 8, background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                            Resend OTP
                        </button>
                    </form>
                )}

                {/* Step 3: New Password */}
                {step === 3 && (
                    <form onSubmit={handleResetPassword}>
                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <div className="password-group">
                                <input
                                    type={showPassword ? "text" : "password"} className="form-control" placeholder="Enter new password"
                                    value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                                />
                                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                                    {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                </button>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirm Password</label>
                            <div className="password-group">
                                <input
                                    type={showConfirm ? "text" : "password"} className="form-control" placeholder="Confirm new password"
                                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                                />
                                <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} tabIndex="-1">
                                    {showConfirm ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                )}

                <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <Link to="/login" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <HiOutlineArrowLeft size={14} /> Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
}
