import PublicNavbar from '../components/Layout/PublicNavbar';
import PublicFooter from '../components/Layout/PublicFooter';
import './LandingPage.css';

export default function AboutPage() {
    return (
        <div className="landing">
            <PublicNavbar />

            {/* Hero */}
            <section className="lp-hero" style={{ minHeight: 'auto', padding: '140px 24px 60px' }}>
                <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
                    <div className="lp-section-label">About Us</div>
                    <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 16 }}>Built for Growing Teams</h1>
                    <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
                        We believe that growing Indian organizations deserve world-class tools to manage their workforce. HRMS Portal was built by a passionate team of engineers and HR professionals to provide a secure, scalable, and low-latency employee platform. Learn about the proprietary architecture and core values driving our platform's operations.
                    </p>
                </div>
            </section>

            {/* Brand Intro & Stats */}
            <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div className="lp-section">
                    <div className="lp-grid-2col">
                        <div>
                            <span className="lp-section-label">Our Platform</span>
                            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 20px' }}>Enterprise scalability with startup agility.</h2>
                            <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>
                                HRMS Portal is a comprehensive human resource management system designed for modern companies. From startups to enterprises, we help organizations streamline their payroll, attendance tracking, compliance file routing, and resume data bank search instantly.
                            </p>
                            <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.8 }}>
                                Our platform integrates seamlessly with major payment channels, cloud portals, and statutory reporting systems to deliver a secure, encrypted, and low-latency workspace interface.
                            </p>
                        </div>
                        <div>
                            <div className="lp-about-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div className="lp-about-stat" style={{ padding: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 18, textAlign: 'center' }}>
                                    <div className="val" style={{ fontSize: 32, fontWeight: 900, color: '#4f46e5' }}>500+</div>
                                    <div className="lbl" style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Companies Trust Us</div>
                                </div>
                                <div className="lp-about-stat" style={{ padding: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 18, textAlign: 'center' }}>
                                    <div className="val" style={{ fontSize: 32, fontWeight: 900, color: '#4f46e5' }}>50K+</div>
                                    <div className="lbl" style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Employees Managed</div>
                                </div>
                                <div className="lp-about-stat" style={{ padding: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 18, textAlign: 'center' }}>
                                    <div className="val" style={{ fontSize: 32, fontWeight: 900, color: '#4f46e5' }}>99.9%</div>
                                    <div className="lbl" style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Platform Uptime</div>
                                </div>
                                <div className="lp-about-stat" style={{ padding: '24px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 18, textAlign: 'center' }}>
                                    <div className="val" style={{ fontSize: 32, fontWeight: 900, color: '#4f46e5' }}>24/7</div>
                                    <div className="lbl" style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Customer Support</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Values */}
            <section>
                <div className="lp-section">
                    <div style={{ textAlign: 'center', marginBottom: 60 }}>
                        <span className="lp-section-label">Core Values</span>
                        <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a' }}>What Drives Our Operations</h2>
                    </div>
                    <div className="lp-grid-3col">
                        <div style={{ padding: 32, border: '1px solid #e2e8f0', borderRadius: 20, background: '#ffffff' }}>
                            <div style={{ fontSize: 36, marginBottom: 16 }}>🔒</div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Security First</h3>
                            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>We treat employee records and payroll structures with maximum diligence. All files are fully encrypted dynamically.</p>
                        </div>
                        <div style={{ padding: 32, border: '1px solid #e2e8f0', borderRadius: 20, background: '#ffffff' }}>
                            <div style={{ fontSize: 36, marginBottom: 16 }}>🚀</div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Automate Everything</h3>
                            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>We believe repetitive tasks like clearance surveys and attendance log computation should happen hands-off.</p>
                        </div>
                        <div style={{ padding: 32, border: '1px solid #e2e8f0', borderRadius: 20, background: '#ffffff' }}>
                            <div style={{ fontSize: 36, marginBottom: 16 }}>🤝</div>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>Empower People</h3>
                            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>We create self-service links enabling employees to download payslips, map vacations, and structure resignations safely.</p>
                        </div>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </div>
    );
}
