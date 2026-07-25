import PublicNavbar from '../components/Layout/PublicNavbar';
import PublicFooter from '../components/Layout/PublicFooter';
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

const DETAIL_SECTIONS = [
    {
        title: "Advanced Employee Lifecycle & Self-Service",
        desc: "From the moment an employee submits a government credentials file to their exit clearances, HRMS Portal manages every step. Check active loans/salary advances, verify files digitally, and track offboarding resignation progress seamlessly on interactive timelines.",
        badge: "Employee Empowerment",
        image: "/self_service_mockup.png"
    },
    {
        title: "Real-time Attendance & Dashboard Analytics",
        desc: "Track monthly check-in states, configure custom holiday calendars, and visualize employee statistics dynamically. The system provides real-time attrition rates, headcount charts, and satisfaction tracking widgets.",
        badge: "Admin Intelligence",
        image: "/dashboard_mockup.png"
    },
    {
        title: "SaaS Platforms Integration & ATS Pipeline",
        desc: "Publish jobs across LinkedIn, Naukri, Indeed, and glassdoor. Maintain central candidate archives, track interview stages (Applied, Screen, Interview, Offered), filter resume bank files, and issue offers instantly.",
        badge: "Recruitment Automation",
        image: "/recruitment_mockup.png"
    }
];

export default function FeaturesPage() {
    return (
        <div className="landing">
            <PublicNavbar />

            {/* Hero */}
            <section className="lp-hero" style={{ minHeight: 'auto', padding: '140px 24px 60px' }}>
                <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
                    <div className="lp-section-label">All Modules</div>
                    <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 16 }}>Platform Features & Capabilities</h1>
                    <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
                        Explore our comprehensive suite of advanced HR modules designed to automate end-to-end employee lifecycle management. From self-service portals and GPS-based attendance tracking to automated compliance bank advice, multi-tier leave approval gates, and loan profiles, we empower Indian organizations with scalable, premium digitisation.
                    </p>
                </div>
            </section>

            {/* Feature Cards Grid */}
            <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div className="lp-section">
                    <div className="lp-features-grid">
                        {FEATURES.map((f, i) => (
                            <div className="lp-feature-card" key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                <div className="lp-feature-icon">{f.icon}</div>
                                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>{f.title}</h3>
                                <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Detailed Spotlights */}
            <section>
                <div className="lp-section">
                    {DETAIL_SECTIONS.map((section, idx) => (
                        <div key={idx} className={`lp-spotlight-grid ${idx % 2 !== 0 ? 'reverse' : ''}`} style={{
                            marginBottom: idx !== DETAIL_SECTIONS.length - 1 ? 80 : 0
                        }}>
                            <div>
                                <span className="lp-section-label">{section.badge}</span>
                                <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '8px 0 16px' }}>{section.title}</h2>
                                <p style={{ color: '#475569', fontSize: 15, lineHeight: 1.8, marginBottom: 20 }}>{section.desc}</p>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>✓ Cloud Encrypted</span>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>✓ Automated Workflows</span>
                                </div>
                            </div>
                            <div className="lp-hero-visual" style={{
                                height: 420,
                                overflow: 'hidden',
                                marginBottom: 0
                            }}>
                                <img src={section.image} alt={section.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <PublicFooter />
        </div>
    );
}
