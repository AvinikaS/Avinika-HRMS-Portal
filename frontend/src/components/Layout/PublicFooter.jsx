import { Link } from 'react-router-dom';

export default function PublicFooter() {
    return (
        <footer className="lp-footer">
            <div className="lp-footer-inner">
                <div className="lp-footer-grid">
                    <div className="lp-footer-brand">
                        <Link className="lp-logo" to="/">
                            <div className="lp-logo-icon">H</div>
                            HRMS Portal
                        </Link>
                        <p>Complete human resource management solution for modern Indian companies. Streamline HR operations from hire to retire.</p>
                    </div>
                    <div>
                        <h4>Product</h4>
                        <ul className="lp-footer-links">
                            <li><Link to="/features">Features</Link></li>
                            <li><Link to="/recruitment-info">Recruitment</Link></li>
                            <li><Link to="/careers">Careers</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4>Company</h4>
                        <ul className="lp-footer-links">
                            <li><Link to="/about">About Us</Link></li>
                            <li><Link to="/careers">Careers</Link></li>
                            <li><Link to="/contact">Contact</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4>Support</h4>
                        <ul className="lp-footer-links">
                            <li><a href="#">Help Center</a></li>
                            <li><a href="#">Documentation</a></li>
                            <li><a href="#">API Reference</a></li>
                        </ul>
                    </div>
                </div>
                <div className="lp-footer-bottom">
                    <div>© 2026 HRMS Portal. All rights reserved.</div>
                    <div className="lp-social-links">
                        <a className="lp-social-link" href="#" title="LinkedIn">in</a>
                        <a className="lp-social-link" href="#" title="Twitter">𝕏</a>
                        <a className="lp-social-link" href="#" title="GitHub">⊙</a>
                        <a className="lp-social-link" href="#" title="YouTube">▶</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
