import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PublicNavbar from '../components/Layout/PublicNavbar';
import PublicFooter from '../components/Layout/PublicFooter';
import FaqSection from '../components/FaqSection';
import './LandingPage.css';

const FEATURES = [
    { icon: '👥', title: 'Employee Profiles Vault', desc: 'Centralized directory managing employee records, bank details, and credential verification approvals.' },
    { icon: '📅', title: 'GPS Attendance & Holidays', desc: 'Real-time clock logs, custom office holidays calendars, and attendance review sheets.' },
    { icon: '🏖️', title: 'Leave Rules & Policy', desc: 'Setup custom leave categories (Sick, Casual, Earned) with validation levels and balance sheets.' },
    { icon: '💼', title: 'Bonus & Incentives Master', desc: 'Configure company bonus rules, sales incentives slabs, and process extra payouts seamlessly.' },
    { icon: '💳', title: 'Salary Advances & Loans', desc: 'Employees apply for short-term salary advances or long-term loans with custom EMI schedules.' },
    { icon: '💵', title: 'IT Declaration & TDS', desc: 'Compute taxes dynamically. Employees declare under 80C/80D directly inside self-service.' },
    { icon: '📊', title: 'Compliance Bank Advice', desc: 'Export direct salary disbursements bank formats advice sheets and statutory reports instantly.' },
    { icon: '🚪', title: '8-Clearance Exit Pipeline', desc: 'Submit resignations under clear offboarding timelines check-off grids (KT, IT clear, Finance clear).' },
    { icon: '⚡', title: 'Platform ATS System', desc: 'Post careers openings to public hiring page, filter candidate resume archives, and release offers.' }
];

const SELF_SERVICE = [
    { icon: '⏰', title: 'Clock Logs Calendar', desc: 'View monthly check-in tables, holiday lists, and check status of attendance logs.' },
    { icon: '🏖️', title: 'Leave Applications', desc: 'Track available casual or sick leave balances and request supervisor clearance.' },
    { icon: '📄', title: 'PDF Payslips Download', desc: 'Securely generate and download detailed monthly payslips as PDF documents instantly.' },
    { icon: '💰', title: 'Loans Request & EMIs', desc: 'Request advance payments or loans and view active deduction cycles in EMI table listings.' },
    { icon: '📁', title: 'Credentials Upload', desc: 'Securely upload Govt cards (Aadhaar, PAN) and certificates for HR approval.' },
    { icon: '🚪', title: 'Clearance Timeline', desc: 'Begin resignation exit workflow with automatic clearance timeline tracking.' }
];

const RECRUIT_FEATURES = [
    { icon: '🚀', title: 'Multi-Platform Publishing', desc: 'Publish jobs to LinkedIn, Naukri, Indeed, Internshala, Monster, and Glassdoor with one click.' },
    { icon: '📥', title: 'Unified Candidate Inbox', desc: 'All applications from all platforms land in a single HRMS dashboard. No tab-switching.' },
    { icon: '📂', title: 'Resume Storage & Search', desc: 'Automatically store resumes and search across your entire candidate database instantly.' },
    { icon: '🔍', title: 'Duplicate Detection', desc: 'Smart algorithms detect duplicate candidates across jobs and platforms. Never process twice.' }
];

const PLATFORMS = [
    { name: 'LinkedIn', color: '#0077b5' }, { name: 'Naukri', color: '#4a90d9' },
    { name: 'Indeed', color: '#2164f3' }, { name: 'Internshala', color: '#00a5ec' },
    { name: 'Monster', color: '#6e45a5' }, { name: 'Glassdoor', color: '#0caa41' }
];

export default function LandingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenu, setMobileMenu] = useState(false);
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        const targetHash = window.location.hash || (location.state && location.state.scrollTo ? `#${location.state.scrollTo}` : '');
        if (targetHash) {
            const id = targetHash.replace('#', '');
            const element = document.getElementById(id);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth' });
                }, 150);
            }
        }
    }, [location, window.location.hash]);

    const scrollTo = (e, id) => { e.preventDefault(); setMobileMenu(false); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

    const handleContact = (e) => {
        e.preventDefault();
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 4000);
        setContactForm({ name: '', email: '', message: '' });
    };

    // Simple animated bars for the dashboard preview
    const barHeights = [40, 65, 50, 80, 55, 70, 45, 75, 60, 85, 50, 70];

    return (
        <div className="landing">
            {/* ============ NAVBAR ============ */}
            <PublicNavbar />

            {/* ============ HERO ============ */}
            <section className="lp-hero" id="hero">
                <div className="lp-hero-inner">
                    <div className="lp-animate">
                        <div className="lp-hero-badge">✨ All-in-one HR Platform</div>
                        <h1>Complete HRMS Solution for Modern Companies</h1>
                        <p>Streamline employee management, recruitment, payroll, attendance, and performance — all in one powerful platform. Built for growing teams.</p>
                        <div className="lp-hero-btns">
                            <button className="lp-btn lp-btn-primary lp-btn-large" onClick={() => navigate('/login')}>Get Started Free →</button>
                            <button className="lp-btn lp-btn-secondary lp-btn-large" onClick={(e) => scrollTo(e, 'features')}>Explore Features</button>
                        </div>
                        <div className="lp-hero-stats">
                            <div className="lp-hero-stat"><div className="lp-hero-stat-value">500+</div><div className="lp-hero-stat-label">Companies</div></div>
                            <div className="lp-hero-stat"><div className="lp-hero-stat-value">50K+</div><div className="lp-hero-stat-label">Employees</div></div>
                            <div className="lp-hero-stat"><div className="lp-hero-stat-value">99.9%</div><div className="lp-hero-stat-label">Uptime</div></div>
                        </div>
                    </div>

                    {/* Dashboard Preview */}
                    <div className="lp-hero-visual lp-animate lp-animate-d2" style={{ padding: 0, overflow: 'hidden' }}>
                        <img src="/dashboard_mockup.png" alt="HRMS Dashboard Mockup" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                </div>
            </section>

            {/* ============ ABOUT ============ */}
            <section id="about" style={{ background: 'linear-gradient(180deg, #ffffff, #f8fafc)', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div className="lp-section">
                    <div className="lp-about-grid">
                        <div>
                            <div className="lp-section-label">About Us</div>
                            <div className="lp-section-title">Built for Growing Teams</div>
                            <p className="lp-section-subtitle" style={{ marginBottom: 24 }}>
                                HRMS Portal is a secure, cloud-native workplace platform engineered for modern organizations. We help startups and enterprises across India digitalize attendance, payroll rules, tax clearances, and ATS hiring within an integrated dashboard setup.
                            </p>
                            <button className="lp-btn lp-btn-secondary" onClick={() => navigate('/about')} style={{ padding: '10px 20px', fontSize: 14 }}>
                                Read Our Story & Values →
                            </button>
                        </div>
                        <div className="lp-about-stats">
                            <div className="lp-about-stat"><div className="val">500+</div><div className="lbl">Companies Trust Us</div></div>
                            <div className="lp-about-stat"><div className="val">50K+</div><div className="lbl">Employees Managed</div></div>
                            <div className="lp-about-stat"><div className="val">99.9%</div><div className="lbl">Platform Uptime</div></div>
                            <div className="lp-about-stat"><div className="val">24/7</div><div className="lbl">Customer Support</div></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============ FEATURES ============ */}
            <section id="features">
                <div className="lp-section">
                    <div style={{ textAlign: 'center' }}>
                        <div className="lp-section-label">Features</div>
                        <div className="lp-section-title">Everything You Need to Manage HR</div>
                        <p className="lp-section-subtitle" style={{ margin: '0 auto' }}>From hiring to retiring, our comprehensive suite covers every aspect of human resource management.</p>
                    </div>
                    <div className="lp-features-grid">
                        {FEATURES.slice(0, 3).map((f, i) => (
                            <div className="lp-feature-card lp-animate" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
                                <div className="lp-feature-icon">{f.icon}</div>
                                <h3>{f.title}</h3>
                                <p>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 40 }}>
                        <button className="lp-btn lp-btn-primary lp-btn-large" onClick={() => navigate('/features')}>
                            View All Features →
                        </button>
                    </div>
                </div>
            </section>

            {/* ============ RECRUITMENT HIGHLIGHT ============ */}
            <section className="lp-recruit-section" id="recruitment">
                <div className="lp-section">
                    <div style={{ textAlign: 'center' }}>
                        <div className="lp-section-label">Recruitment</div>
                        <div className="lp-section-title">Hire Smarter, Faster, Better</div>
                        <p className="lp-section-subtitle" style={{ margin: '0 auto' }}>Publish jobs across all major platforms with one click. Track every candidate in a unified pipeline.</p>
                    </div>
                    <div className="lp-recruit-grid">
                        <div className="lp-recruit-features">
                            {RECRUIT_FEATURES.slice(0, 2).map((f, i) => (
                                <div className="lp-recruit-item" key={i}>
                                    <div className="lp-recruit-icon">{f.icon}</div>
                                    <div><h4>{f.title}</h4><p>{f.desc}</p></div>
                                </div>
                            ))}
                            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                                <button className="lp-btn lp-btn-primary" onClick={() => navigate('/recruitment-info')} style={{ padding: '10px 20px', fontSize: 14 }}>
                                    Learn About ATS System →
                                </button>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div className="lp-hero-visual" style={{ height: 500, overflow: 'hidden' }}>
                                <img src="/recruitment_mockup.png" alt="Recruitment Pipeline Mockup" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ============ SELF SERVICE ============ */}
            <section id="selfservice">
                <div className="lp-section">
                    <div style={{ textAlign: 'center' }}>
                        <div className="lp-section-label">Employee Self-Service</div>
                        <div className="lp-section-title">Empower Your Employees</div>
                        <p className="lp-section-subtitle" style={{ margin: '0 auto' }}>Give employees access to manage their own HR tasks — reducing admin workload by up to 60%.</p>
                    </div>
                    <div className="lp-grid-2col">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div className="lp-ss-grid" style={{ gap: 20 }}>
                                {SELF_SERVICE.slice(0, 4).map((s, i) => (
                                    <div className="lp-ss-card" key={i} style={{ margin: 0 }}>
                                        <div className="lp-ss-icon">{s.icon}</div>
                                        <h3 style={{ fontSize: 16 }}>{s.title}</h3>
                                        <p style={{ fontSize: 13, lineHeight: 1.5 }}>{s.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <button className="lp-btn lp-btn-primary" onClick={() => navigate('/features')} style={{ padding: '10px 20px', fontSize: 14 }}>
                                    Explore Employee Modules →
                                </button>
                            </div>
                        </div>
                        <div className="lp-hero-visual" style={{ height: 560, overflow: 'hidden' }}>
                            <img src="/self_service_mockup.png" alt="Employee Self Service Mockup" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>
                    </div>
                </div>
            </section>



            {/* ============ FAQS (INDIA HRMS) ============ */}
            <FaqSection />

            {/* ============ CONTACT ============ */}
            {/* ============ CTA / CONTACT HINT ============ */}
            <section id="contact" style={{ background: '#ffffff', padding: '100px 24px' }}>
                <div style={{
                    maxWidth: 1000,
                    margin: '0 auto',
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    borderRadius: 24,
                    padding: '60px 40px',
                    textAlign: 'center',
                    boxShadow: '0 20px 50px rgba(79, 70, 229, 0.15)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.05) 0%, transparent 80%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -50, right: -50, width: 250, height: 250, borderRadius: '50%', background: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />

                    <div className="lp-section-label" style={{ color: '#c084fc', marginBottom: 16 }}>Ready to transform your workplace?</div>
                    <h2 style={{ fontSize: 36, fontWeight: 900, color: '#ffffff', marginBottom: 16, lineHeight: 1.2 }}>Get Started with HRMS Portal Today</h2>
                    <p style={{ color: '#e0e7ff', fontSize: 16, maxWidth: 600, margin: '0 auto 32px', lineHeight: 1.6 }}>
                        Join hundreds of Indian businesses using our secure platform to automate payroll processing, log attendance, and manage candidate workflows.
                    </p>
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                        <button className="lp-btn" onClick={() => navigate('/contact')} style={{ background: '#ffffff', color: '#4f46e5', fontWeight: 700, padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer', transition: 'transform 0.2s' }}>
                            Get in Touch →
                        </button>
                        <button className="lp-btn" onClick={() => navigate('/login')} style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#ffffff', fontWeight: 650, padding: '14px 32px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                            Access Dashboard
                        </button>
                    </div>
                </div>
            </section>

            {/* ============ FOOTER ============ */}
            <PublicFooter />
        </div>
    );
}
