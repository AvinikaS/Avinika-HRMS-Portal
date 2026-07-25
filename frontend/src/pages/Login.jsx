import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineHome } from 'react-icons/hi';

export default function Login() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            console.error('Login error:', err);
            setError(err.response?.data?.message || err.message || 'Login failed. Please check your credentials.');
        }
        setLoading(false);
    };

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

            <div className="login-card">
                <div className="login-logo">
                    <div className="logo-box">H</div>
                    <h1>HRMS Portal</h1>
                    <p>Human Resource Management System</p>
                </div>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email" className="form-control" placeholder="Enter your email"
                            value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="password-group">
                            <input
                                type={showPassword ? "text" : "password"} className="form-control" placeholder="Enter your password"
                                value={password} onChange={e => setPassword(e.target.value)} required
                            />
                            <button
                                type="button" className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                tabIndex="-1"
                            >
                                {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: 16 }}>
                    <Link to="/forgot-password" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none' }}>
                        Forgot Password?
                    </Link>
                </div>

                <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
                    Default: admin@hrms.com / admin123
                </p>
            </div>
        </div>
    );
}

