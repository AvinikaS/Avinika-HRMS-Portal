import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

export default function PublicNavbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenu, setMobileMenu] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 30);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isActive = (path) => location.pathname === path;

    return (
        <nav className={`lp-nav cp-nav-solid ${scrolled ? 'scrolled' : ''}`}>
            <div className="lp-nav-inner">
                <Link className="lp-logo" to="/">
                    <div className="lp-logo-icon">H</div>
                    HRMS Portal
                </Link>
                <ul className="lp-nav-links">
                    <li><Link to="/" style={{ color: isActive('/') ? '#4f46e5' : '', fontWeight: isActive('/') ? '700' : '' }}>Home</Link></li>
                    <li><Link to="/about" style={{ color: isActive('/about') ? '#4f46e5' : '', fontWeight: isActive('/about') ? '700' : '' }}>About Us</Link></li>
                    <li><Link to="/features" style={{ color: isActive('/features') ? '#4f46e5' : '', fontWeight: isActive('/features') ? '700' : '' }}>Features</Link></li>
                    <li><Link to="/recruitment-info" style={{ color: isActive('/recruitment-info') ? '#4f46e5' : '', fontWeight: isActive('/recruitment-info') ? '700' : '' }}>Recruitment</Link></li>
                    <li><Link to="/careers" style={{ color: isActive('/careers') ? '#4f46e5' : '', fontWeight: isActive('/careers') ? '700' : '' }}>Careers</Link></li>
                    <li><Link to="/contact" style={{ color: isActive('/contact') ? '#4f46e5' : '', fontWeight: isActive('/contact') ? '700' : '' }}>Contact</Link></li>
                </ul>
                <div className="lp-nav-btns">
                    <button className="lp-btn lp-btn-secondary" onClick={() => navigate('/login')}>Login</button>
                    <button className="lp-btn lp-btn-primary" onClick={() => navigate('/contact')}>Get Started</button>
                </div>
                <button className="lp-mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? '✕' : '☰'}</button>
            </div>
            {mobileMenu && (
                <div className="lp-mobile-menu">
                    <Link to="/" onClick={() => setMobileMenu(false)}>Home</Link>
                    <Link to="/about" onClick={() => setMobileMenu(false)}>About Us</Link>
                    <Link to="/features" onClick={() => setMobileMenu(false)}>Features</Link>
                    <Link to="/recruitment-info" onClick={() => setMobileMenu(false)}>Recruitment</Link>
                    <Link to="/careers" onClick={() => setMobileMenu(false)}>Careers</Link>
                    <Link to="/contact" onClick={() => setMobileMenu(false)}>Contact</Link>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                        <button className="lp-btn lp-btn-secondary" style={{ flex: 1 }} onClick={() => { navigate('/login'); setMobileMenu(false); }}>Login</button>
                        <button className="lp-btn lp-btn-primary" style={{ flex: 1 }} onClick={() => { navigate('/contact'); setMobileMenu(false); }}>Get Started</button>
                    </div>
                </div>
            )}
        </nav>
    );
}
