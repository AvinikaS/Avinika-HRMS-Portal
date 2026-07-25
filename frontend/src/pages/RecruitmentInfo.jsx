import { useNavigate } from 'react-router-dom';
import PublicNavbar from '../components/Layout/PublicNavbar';
import PublicFooter from '../components/Layout/PublicFooter';
import './LandingPage.css';

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

export default function RecruitmentInfoPage() {
    const navigate = useNavigate();

    return (
        <div className="landing">
            <PublicNavbar />

            {/* Hero */}
            <section className="lp-hero" style={{ minHeight: 'auto', padding: '140px 24px 60px' }}>
                <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
                    <div className="lp-section-label">Recruitment Suite</div>
                    <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 16 }}>Applicant Tracking System (ATS)</h1>
                    <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
                        Streamline your hiring process, build a robust candidate database, and collaborate with your team coordinates in one smart platform. Our integrated ATS recruitment engine lets you publish openings to popular boards like LinkedIn, Naukri, and Indeed instantly, track stage progression, and manage offer pipelines seamlessly.
                    </p>
                </div>
            </section>

            {/* Recruitment Details */}
            <section style={{ background: '#ffffff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div className="lp-section">
                    <div className="lp-grid-2col">
                        <div>
                            <span className="lp-section-label">Centralized ATS</span>
                            <h2 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', margin: '8px 0 20px' }}>Publish once. Hire everywhere.</h2>
                            <div className="lp-recruit-features" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                {RECRUIT_FEATURES.map((f, i) => (
                                    <div className="lp-recruit-item" key={i} style={{ display: 'flex', gap: 16 }}>
                                        <div className="lp-recruit-icon" style={{ fontSize: 24, padding: 10, background: '#f1f5f9', borderRadius: 12, height: 'fit-content' }}>{f.icon}</div>
                                        <div>
                                            <h4 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>{f.title}</h4>
                                            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>{f.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <div className="lp-hero-visual" style={{ height: 520, overflow: 'hidden', marginBottom: 24 }}>
                                <img src="/recruitment_mockup.png" alt="Recruitment Stage Tracking Mockup" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                            <div className="lp-platform-logos lp-grid-3col" style={{ gap: 10 }}>
                                {PLATFORMS.map((p, i) => (
                                    <div className="lp-platform-logo" key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, fontWeight: 600 }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }}></span>
                                        {p.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Careers callout */}
            <section style={{ textAlign: 'center', padding: '80px 24px' }}>
                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 16 }}>Are you looking for work?</h2>
                    <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.6, marginBottom: 28 }}>
                        We are currently looking for talented individuals. Explore open positions in our company right now.
                    </p>
                    <button className="lp-btn lp-btn-primary lp-btn-large" onClick={() => navigate('/careers')}>
                        Browse Open Careers →
                    </button>
                </div>
            </section>

            <PublicFooter />
        </div>
    );
}
