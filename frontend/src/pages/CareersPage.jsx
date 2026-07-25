import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import PublicNavbar from '../components/Layout/PublicNavbar';
import PublicFooter from '../components/Layout/PublicFooter';
import './LandingPage.css';

const API = `${import.meta.env.VITE_API_URL || '/api'}/careers`;

const EMPLOYMENT_ICONS = { 'Full-Time': '💼', 'Part-Time': '⏰', 'Contract': '📋', 'Intern': '🎓' };
const EMPLOYMENT_COLORS = { 'Full-Time': '#6366f1', 'Part-Time': '#f59e0b', 'Contract': '#06b6d4', 'Intern': '#10b981' };

const PERKS = [
    { icon: '🏥', title: 'Health Insurance', desc: 'Comprehensive medical coverage' },
    { icon: '📚', title: 'Learning Budget', desc: 'Grow your skills with us' },
    { icon: '🏠', title: 'Remote Friendly', desc: 'Work from anywhere' },
    { icon: '🎯', title: 'Career Growth', desc: 'Clear promotion paths' },
    { icon: '💰', title: 'Competitive Pay', desc: 'Industry-best packages' },
    { icon: '🎉', title: 'Fun Culture', desc: 'Events & celebrations' },
];

export default function CareersPage() {
    const { slug } = useParams();
    return slug ? <JobDetail slug={slug} /> : <JobListing />;
}

function JobListing() {
    const [jobs, setJobs] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [deptFilter, setDeptFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const params = {};
        if (search) params.search = search;
        if (deptFilter) params.department = deptFilter;
        if (typeFilter) params.type = typeFilter;
        axios.get(API, { params })
            .then(r => setJobs(r.data.data || []))
            .catch(() => setJobs([]))
            .finally(() => setLoading(false));
    }, [search, deptFilter, typeFilter]);

    const departments = [...new Set(jobs.map(j => j.department))];

    return (
        <div className="landing careers-page">
            {/* Floating Particles */}
            <div className="cp-particles">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="cp-particle" style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 8}s`,
                        animationDuration: `${6 + Math.random() * 8}s`,
                        width: `${2 + Math.random() * 4}px`,
                        height: `${2 + Math.random() * 4}px`,
                    }} />
                ))}
            </div>

            {/* Navbar */}
            <PublicNavbar />

            {/* Hero */}
            <section className="cp-hero">
                <div className="cp-hero-glow" />
                <div className="cp-hero-content">
                    <div className="lp-hero-badge">
                        <span className="cp-badge-dot" style={{ background: '#4f46e5' }} />
                        We're Hiring — {jobs.length} Open Position{jobs.length !== 1 ? 's' : ''}
                    </div>
                    <h1 className="cp-hero-title">
                        Build Your Future With Us
                    </h1>
                    <p className="cp-hero-desc" style={{ maxWidth: 660 }}>
                        Join a team that values innovation, growth, and positive impact. We are looking for talented, passionate individuals to help us build the next generation of cloud-native enterprise workplace systems. Find your dream role below and take the next step.
                    </p>

                    {/* Search Bar */}
                    <div className="cp-search-wrap">
                        <div className="cp-search-icon">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                            </svg>
                        </div>
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setLoading(true); }}
                            placeholder="Search jobs by title, skills, or department..."
                            className="cp-search-input"
                        />
                    </div>

                    {/* Filters */}
                    <div className="cp-filters">
                        <select value={deptFilter} onChange={e => { setDeptFilter(e.target.value); setLoading(true); }} className="cp-filter-select">
                            <option value="">All Departments</option>
                            {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setLoading(true); }} className="cp-filter-select">
                            <option value="">All Types</option>
                            {['Full-Time', 'Part-Time', 'Contract', 'Intern'].map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </section>

            {/* Job Cards */}
            <section className="cp-jobs-section">
                <div className="cp-jobs-container">
                    {loading ? (
                        <div className="cp-loading">
                            <div className="cp-spinner" />
                            <p>Finding opportunities...</p>
                        </div>
                    ) : jobs.length === 0 ? (
                        <div className="cp-empty">
                            <div className="cp-empty-icon">🔍</div>
                            <h3>No open positions right now</h3>
                            <p>Check back soon — we're always growing!</p>
                        </div>
                    ) : (
                        <div className="cp-jobs-grid">
                            {jobs.map((job, idx) => (
                                <div key={job._id}
                                    className="cp-job-card"
                                    style={{ animationDelay: `${idx * 0.08}s` }}
                                    onClick={() => navigate(`/careers/${job.slug}`)}>
                                    <div className="cp-job-card-top">
                                        <div className="cp-job-type-badge" style={{ background: `${EMPLOYMENT_COLORS[job.employmentType]}18`, color: EMPLOYMENT_COLORS[job.employmentType], borderColor: `${EMPLOYMENT_COLORS[job.employmentType]}30` }}>
                                            {EMPLOYMENT_ICONS[job.employmentType]} {job.employmentType}
                                        </div>
                                        <div className="cp-job-openings">
                                            {job.openings} opening{job.openings > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    <h3 className="cp-job-title">{job.title}</h3>
                                    <div className="cp-job-meta">
                                        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg> {job.department}</span>
                                        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg> {job.location || 'Remote'}</span>
                                    </div>
                                    <div className="cp-job-meta">
                                        <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg> {job.experienceMin}-{job.experienceMax || '10+'}yr</span>
                                        {(job.salaryMin || job.salaryMax) && (
                                            <span>💰 {job.salaryMin ? `₹${(job.salaryMin / 100000).toFixed(1)}L` : ''}{job.salaryMin && job.salaryMax ? ' - ' : ''}{job.salaryMax ? `₹${(job.salaryMax / 100000).toFixed(1)}L` : ''}</span>
                                        )}
                                    </div>
                                    {job.skills?.length > 0 && (
                                        <div className="cp-job-skills">
                                            {job.skills.slice(0, 4).map((s, i) => (
                                                <span key={i} className="cp-skill-tag">{s}</span>
                                            ))}
                                            {job.skills.length > 4 && <span className="cp-skill-more">+{job.skills.length - 4}</span>}
                                        </div>
                                    )}
                                    <div className="cp-job-apply-hint">
                                        View Details & Apply →
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* Why Join Us */}
            <section className="cp-perks-section">
                <div className="cp-perks-container">
                    <div className="cp-section-badge">Why Join Us</div>
                    <h2 className="cp-section-title">Benefits & Perks</h2>
                    <p className="cp-section-desc">We believe in taking care of our people. Here's what you get when you join our team.</p>
                    <div className="cp-perks-grid">
                        {PERKS.map((p, i) => (
                            <div key={i} className="cp-perk-card" style={{ animationDelay: `${i * 0.1}s` }}>
                                <div className="cp-perk-icon">{p.icon}</div>
                                <h4>{p.title}</h4>
                                <p>{p.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <PublicFooter />

            <style>{careersCSS}</style>
        </div>
    );
}

function JobDetail({ slug }) {
    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showApply, setShowApply] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const [form, setForm] = useState({ name: '', email: '', phone: '', experience: '', skills: '', currentCompany: '', expectedSalary: '', noticePeriod: '', coverLetter: '' });
    const [resume, setResume] = useState(null);

    useEffect(() => {
        axios.get(`${API}/${slug}`)
            .then(r => setJob(r.data.data))
            .catch(() => setJob(null))
            .finally(() => setLoading(false));
    }, [slug]);

    const handleApply = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            let resumeUrl = null;
            // Upload resume directly to Cloudinary (unsigned preset for public users)
            if (resume) {
                const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dogawcdni';
                const fd = new FormData();
                fd.append('file', resume);
                fd.append('upload_preset', 'hrms_unsigned');
                fd.append('folder', 'hrms/resumes');
                const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, fd);
                resumeUrl = uploadRes.data.secure_url;
            }
            // Send application data with just the Cloudinary URL
            await axios.post(`${API}/${job._id}/apply`, { ...form, resumeUrl });
            setSubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || 'Something went wrong');
        }
        setSubmitting(false);
    };

    if (loading) return (
        <div className="landing careers-page">
            <div className="cp-detail-loading">
                <div className="cp-spinner" />
                <p style={{ color: '#64748b', marginTop: 16 }}>Loading job details...</p>
            </div>
            <style>{careersCSS}</style>
        </div>
    );

    if (!job) return (
        <div className="landing careers-page">
            <div className="cp-detail-loading">
                <div style={{ fontSize: 64, marginBottom: 16 }}>😕</div>
                <h2 style={{ color: '#0f172a', marginBottom: 8 }}>Job not found</h2>
                <p style={{ color: '#64748b', marginBottom: 24 }}>This job may have been closed or doesn't exist.</p>
                <button onClick={() => navigate('/careers')} className="cp-btn-back-large">← Browse All Jobs</button>
            </div>
            <style>{careersCSS}</style>
        </div>
    );

    const color = EMPLOYMENT_COLORS[job.employmentType] || '#6366f1';

    return (
        <div className="landing careers-page">
            {/* Nav */}
            <PublicNavbar />

            {/* Job Header */}
            <section className="cp-detail-hero">
                <div className="cp-detail-hero-glow" style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}25 0%, transparent 70%)` }} />
                <div className="cp-detail-hero-content">
                    <div className="cp-job-type-badge" style={{ background: `${color}18`, color, borderColor: `${color}30` }}>
                        {EMPLOYMENT_ICONS[job.employmentType]} {job.employmentType}
                    </div>
                    <h1 className="cp-detail-title">{job.title}</h1>
                    <div className="cp-detail-meta">
                        <div className="cp-detail-meta-item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
                            {job.department}
                        </div>
                        <div className="cp-detail-meta-item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                            {job.location || 'Remote'}
                        </div>
                        <div className="cp-detail-meta-item">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                            {job.experienceMin}-{job.experienceMax || '10+'}yr experience
                        </div>
                        {(job.salaryMin || job.salaryMax) && (
                            <div className="cp-detail-meta-item">
                                💰 {job.salaryMin ? `₹${(job.salaryMin / 100000).toFixed(1)}L` : ''}{job.salaryMin && job.salaryMax ? ' - ' : ''}{job.salaryMax ? `₹${(job.salaryMax / 100000).toFixed(1)}L` : ''} / year
                            </div>
                        )}
                    </div>
                    <button onClick={() => setShowApply(true)} className="cp-apply-btn">
                        Apply Now
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </button>
                </div>
            </section>

            {/* Content */}
            <section className="cp-detail-body">
                <div className="cp-detail-container">
                    <div className="cp-detail-main">
                        {/* Description */}
                        <div className="cp-detail-card">
                            <h3>📝 About This Role</h3>
                            <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
                        </div>

                        {/* Skills */}
                        {job.skills?.length > 0 && (
                            <div className="cp-detail-card">
                                <h3>🛠️ Skills Required</h3>
                                <div className="cp-detail-skills">
                                    {job.skills.map((s, i) => (
                                        <span key={i} className="cp-detail-skill-tag" style={{ borderColor: `${color}40`, color }}>{s}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Responsibilities */}
                        {job.responsibilities?.length > 0 && (
                            <div className="cp-detail-card">
                                <h3>📋 Responsibilities</h3>
                                <ul className="cp-detail-list">
                                    {job.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="cp-detail-sidebar">
                        <div className="cp-sidebar-card">
                            <h4>Job Overview</h4>
                            <div className="cp-sidebar-row"><span>📍 Location</span><strong>{job.location || 'Remote'}</strong></div>
                            <div className="cp-sidebar-row"><span>🏢 Department</span><strong>{job.department}</strong></div>
                            <div className="cp-sidebar-row"><span>💼 Type</span><strong>{job.employmentType}</strong></div>
                            <div className="cp-sidebar-row"><span>📊 Experience</span><strong>{job.experienceMin}-{job.experienceMax || '10+'}yr</strong></div>
                            <div className="cp-sidebar-row"><span>🪑 Openings</span><strong>{job.openings}</strong></div>
                            {(job.salaryMin || job.salaryMax) && (
                                <div className="cp-sidebar-row"><span>💰 Salary</span><strong>{job.salaryMin ? `₹${(job.salaryMin / 100000).toFixed(1)}L` : ''}{job.salaryMin && job.salaryMax ? '-' : ''}{job.salaryMax ? `₹${(job.salaryMax / 100000).toFixed(1)}L` : ''}</strong></div>
                            )}
                            <button onClick={() => setShowApply(true)} className="cp-apply-btn cp-apply-btn-full">Apply for this Position →</button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Apply Modal */}
            {showApply && (
                <div className="cp-modal-overlay" onClick={() => !submitting && setShowApply(false)}>
                    <div className="cp-modal" onClick={e => e.stopPropagation()}>
                        {submitted ? (
                            <div className="cp-modal-success">
                                <div className="cp-success-animation">✨🎉✨</div>
                                <h2>Application Submitted!</h2>
                                <p>Thank you for applying for <strong>{job.title}</strong>. We'll review your application and get back to you soon.</p>
                                <button onClick={() => { setShowApply(false); navigate('/careers'); }} className="cp-apply-btn">Browse More Jobs</button>
                            </div>
                        ) : (
                            <form onSubmit={handleApply}>
                                <div className="cp-modal-header">
                                    <div>
                                        <h2>Apply for {job.title}</h2>
                                        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{job.department} · {job.location || 'Remote'}</p>
                                    </div>
                                    <button type="button" onClick={() => setShowApply(false)} className="cp-modal-close">✕</button>
                                </div>
                                <div className="cp-modal-body">
                                    {error && <div className="cp-form-error">{error}</div>}
                                    <div className="cp-form-section-title">Personal Information</div>
                                    {[
                                        { label: 'Full Name', key: 'name', type: 'text', req: true, ph: 'John Doe' },
                                        { label: 'Email Address', key: 'email', type: 'email', req: true, ph: 'john@example.com' },
                                        { label: 'Phone Number', key: 'phone', type: 'tel', req: true, ph: '+91 98765 43210' }
                                    ].map(f => (
                                        <div key={f.key} className="cp-form-group">
                                            <label>{f.label} {f.req && <span style={{ color: '#ef4444' }}>*</span>}</label>
                                            <input type={f.type} required={f.req} value={form[f.key]} placeholder={f.ph}
                                                onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                                        </div>
                                    ))}
                                    <div className="cp-form-section-title">Professional Details</div>
                                    <div className="cp-form-row">
                                        <div className="cp-form-group">
                                            <label>Experience (years)</label>
                                            <input type="number" value={form.experience} placeholder="e.g. 3"
                                                onChange={e => setForm({ ...form, experience: e.target.value })} />
                                        </div>
                                        <div className="cp-form-group">
                                            <label>Expected Salary (₹/year)</label>
                                            <input type="number" value={form.expectedSalary} placeholder="e.g. 800000"
                                                onChange={e => setForm({ ...form, expectedSalary: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="cp-form-row">
                                        <div className="cp-form-group">
                                            <label>Current Company</label>
                                            <input value={form.currentCompany} placeholder="e.g. TCS"
                                                onChange={e => setForm({ ...form, currentCompany: e.target.value })} />
                                        </div>
                                        <div className="cp-form-group">
                                            <label>Notice Period</label>
                                            <input value={form.noticePeriod} placeholder="e.g. 30 days"
                                                onChange={e => setForm({ ...form, noticePeriod: e.target.value })} />
                                        </div>
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Skills (comma-separated)</label>
                                        <input value={form.skills} placeholder="React, Node.js, MongoDB"
                                            onChange={e => setForm({ ...form, skills: e.target.value })} />
                                    </div>
                                    <div className="cp-form-section-title">Documents</div>
                                    <div className="cp-form-group">
                                        <label>Resume <span style={{ color: '#ef4444' }}>*</span></label>
                                        <div className="cp-file-upload">
                                            <input type="file" accept=".pdf,.doc,.docx" required onChange={e => setResume(e.target.files[0])} />
                                            <div className="cp-file-upload-label">
                                                {resume ? (
                                                    <><span className="cp-file-name">📄 {resume.name}</span><span className="cp-file-size">({(resume.size / 1024).toFixed(0)} KB)</span></>
                                                ) : (
                                                    <><span>📎 Drag & drop or click to upload</span><span style={{ fontSize: 11, color: '#64748b' }}>PDF, DOC, DOCX (Max 5MB)</span></>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="cp-form-group">
                                        <label>Cover Letter <span style={{ color: '#64748b', fontWeight: 400 }}>(optional)</span></label>
                                        <textarea rows={4} value={form.coverLetter} placeholder="Tell us why you'd be a great fit for this role..."
                                            onChange={e => setForm({ ...form, coverLetter: e.target.value })} />
                                    </div>
                                </div>
                                <div className="cp-modal-footer">
                                    <button type="button" onClick={() => setShowApply(false)} className="cp-btn-cancel">Cancel</button>
                                    <button type="submit" disabled={submitting} className="cp-apply-btn">
                                        {submitting ? (
                                            <><span className="cp-btn-spinner" /> Submitting...</>
                                        ) : 'Submit Application'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            <PublicFooter />
            <style>{careersCSS}</style>
        </div>
    );
}

const careersCSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

.careers-page {
    min-height: 100vh;
    background: #f8fafc;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    color: #0f172a;
    position: relative;
    overflow-x: hidden;
}

/* ======= PARTICLES ======= */
.cp-particles { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
.cp-particle {
    position: absolute; border-radius: 50%; background: #6366f1;
    opacity: 0.05; animation: cpFloat linear infinite;
}
@keyframes cpFloat {
    0%, 100% { transform: translateY(0) scale(1); opacity: 0.05; }
    50% { transform: translateY(-40px) scale(1.5); opacity: 0.1; }
}

/* ======= NAV ======= */
.cp-nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    backdrop-filter: blur(20px); background: rgba(255, 255, 255, 0.85);
    border-bottom: 1px solid #e2e8f0;
}
.cp-nav-solid { background: rgba(255, 255, 255, 0.96); }
.cp-nav-inner {
    max-width: 1200px; margin: 0 auto; padding: 14px 28px;
    display: flex; align-items: center; justify-content: space-between;
}
.cp-nav-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; color: #0f172a; font-weight: 800; font-size: 17px;
}
.cp-logo-icon {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-weight: 900; font-size: 16px;
}
.cp-nav-right { display: flex; align-items: center; gap: 20px; }
.cp-nav-link {
    color: #475569; text-decoration: none; font-size: 14px; font-weight: 500;
    transition: color .2s;
}
.cp-nav-link:hover { color: #4f46e5; }
.cp-btn-login {
    background: rgba(79, 70, 229, 0.08); color: #4f46e5; border: 1px solid rgba(79, 70, 229, 0.2);
    padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
    text-decoration: none; transition: all .2s;
}
.cp-btn-login:hover { background: rgba(79, 70, 229, 0.15); border-color: rgba(79, 70, 229, 0.3); }
.cp-btn-back {
    color: #4f46e5; background: rgba(79, 70, 229, 0.08); border: 1px solid rgba(79, 70, 229, 0.15);
    padding: 8px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: all .2s;
}
.cp-btn-back:hover { background: rgba(79, 70, 229, 0.12); }
.cp-btn-back-large {
    color: #4f46e5; background: rgba(79, 70, 229, 0.08); border: 1px solid rgba(79, 70, 229, 0.2);
    padding: 12px 28px; border-radius: 12px; font-size: 15px; font-weight: 600;
    cursor: pointer; transition: all .2s;
}

/* ======= HERO ======= */
.cp-hero {
    position: relative; padding: 140px 28px 60px; text-align: center;
    overflow: hidden;
}
.cp-hero-glow {
    position: absolute; top: -100px; left: 50%; transform: translateX(-50%);
    width: 700px; height: 500px;
    background: radial-gradient(ellipse, rgba(79, 70, 229, 0.08) 0%, transparent 70%);
    pointer-events: none;
}
.cp-hero-content { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
.cp-hero-badge {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 18px; border-radius: 50px;
    background: #ecfdf5; border: 1px solid #a7f3d0;
    color: #059669; font-size: 13px; font-weight: 600; margin-bottom: 28px;
}
.cp-badge-dot {
    width: 8px; height: 8px; border-radius: 50%; background: #10b981;
    animation: cpPulse 2s ease-in-out infinite;
}
@keyframes cpPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }

.cp-hero-title {
    font-size: clamp(36px, 6vw, 56px); font-weight: 900; line-height: 1.1;
    margin: 0 0 20px;
    background: linear-gradient(135deg, #0f172a, #4f46e5);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}
.cp-hero-desc {
    font-size: 17px; color: #475569; line-height: 1.7; margin: 0 0 36px;
    max-width: 540px; margin-left: auto; margin-right: auto;
}

/* Search */
.cp-search-wrap {
    position: relative; max-width: 560px; margin: 0 auto 20px;
}
.cp-search-icon {
    position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
    color: #64748b; pointer-events: none;
}
.cp-search-input {
    width: 100%; padding: 16px 20px 16px 50px; font-size: 15px;
    border: 1px solid #cbd5e1; border-radius: 14px;
    background: #ffffff; color: #0f172a; outline: none;
    box-sizing: border-box; transition: border-color .3s, box-shadow .3s;
    font-family: inherit;
}
.cp-search-input::placeholder { color: #94a3b8; }
.cp-search-input:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.08);
}

/* Filters */
.cp-filters { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
.cp-filter-select {
    padding: 10px 16px; background: #ffffff; border: 1px solid #cbd5e1;
    border-radius: 10px; color: #475569; font-size: 13px; font-family: inherit;
    cursor: pointer; outline: none; min-width: 150px;
}
.cp-filter-select:focus { border-color: #4f46e5; }

/* ======= JOBS ======= */
.cp-jobs-section { padding: 20px 28px 60px; position: relative; z-index: 1; }
.cp-jobs-container { max-width: 1100px; margin: 0 auto; }

.cp-loading { text-align: center; padding: 80px 0; color: #64748b; }
.cp-spinner {
    width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #4f46e5;
    border-radius: 50%; animation: cpSpin 0.8s linear infinite; margin: 0 auto 16px;
}
@keyframes cpSpin { to { transform: rotate(360deg); } }

.cp-empty { text-align: center; padding: 80px 0; }
.cp-empty-icon { font-size: 56px; margin-bottom: 16px; }
.cp-empty h3 { color: #0f172a; font-size: 20px; margin-bottom: 8px; }
.cp-empty p { color: #64748b; }

.cp-jobs-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 20px;
}

/* Job Card */
.cp-job-card {
    background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 18px; padding: 26px; cursor: pointer;
    transition: all .3s cubic-bezier(.4,0,.2,1); position: relative;
    animation: cpFadeUp 0.5s ease-out both;
    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
}
.cp-job-card::before {
    content: ''; position: absolute; inset: 0; border-radius: 18px;
    background: linear-gradient(135deg, rgba(79, 70, 229, 0.03) 0%, transparent 50%);
    opacity: 0; transition: opacity .3s;
}
.cp-job-card:hover {
    border-color: rgba(79, 70, 229, 0.3); transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0,0,0,0.06), 0 0 0 1px rgba(79, 70, 229, 0.15);
}
.cp-job-card:hover::before { opacity: 1; }
@keyframes cpFadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.cp-job-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; position: relative; z-index: 1; }
.cp-job-type-badge {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 12px; border-radius: 8px; font-size: 12px; font-weight: 600;
    border: 1px solid;
}
.cp-job-openings { font-size: 12px; color: #64748b; font-weight: 500; }
.cp-job-title {
    font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 14px;
    position: relative; z-index: 1; line-height: 1.3;
}
.cp-job-meta {
    display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: #64748b;
    margin-bottom: 10px; position: relative; z-index: 1;
}
.cp-job-meta span { display: flex; align-items: center; gap: 5px; }
.cp-job-meta svg { opacity: 0.6; }
.cp-job-skills {
    display: flex; gap: 6px; flex-wrap: wrap; margin-top: 14px; position: relative; z-index: 1;
}
.cp-skill-tag {
    background: rgba(79, 70, 229, 0.06); color: #4f46e5; padding: 4px 10px;
    border-radius: 6px; font-size: 11px; font-weight: 600;
    border: 1px solid rgba(79, 70, 229, 0.1);
}
.cp-skill-more {
    color: #64748b; font-size: 11px; font-weight: 600; padding: 4px 8px;
}
.cp-job-apply-hint {
    margin-top: 18px; font-size: 13px; font-weight: 600; color: #4f46e5;
    opacity: 0; transform: translateY(4px); transition: all .3s;
    position: relative; z-index: 1;
}
.cp-job-card:hover .cp-job-apply-hint { opacity: 1; transform: translateY(0); }

/* ======= PERKS ======= */
.cp-perks-section {
    padding: 80px 28px; position: relative; z-index: 1;
    background: linear-gradient(180deg, transparent, rgba(79, 70, 229, 0.02) 50%, transparent);
}
.cp-perks-container { max-width: 1100px; margin: 0 auto; text-align: center; }
.cp-section-badge {
    display: inline-block; padding: 6px 16px; border-radius: 50px;
    background: rgba(79, 70, 229, 0.08); border: 1px solid rgba(79, 70, 229, 0.15);
    color: #4f46e5; font-size: 13px; font-weight: 600; margin-bottom: 16px;
}
.cp-section-title { font-size: 32px; font-weight: 900; color: #0f172a; margin: 0 0 12px; }
.cp-section-desc { font-size: 15px; color: #64748b; margin: 0 0 48px; }
.cp-perks-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
}
@media (max-width: 900px) {
    .cp-perks-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
@media (max-width: 600px) {
    .cp-perks-grid {
        grid-template-columns: 1fr;
    }
}
.cp-perk-card {
    background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 16px; padding: 28px 20px; text-align: center;
    transition: all .3s; animation: cpFadeUp 0.5s ease-out both;
}
.cp-perk-card:hover {
    border-color: rgba(79, 70, 229, 0.2); transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(0,0,0,0.04);
}
.cp-perk-icon { font-size: 32px; margin-bottom: 12px; }
.cp-perk-card h4 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }
.cp-perk-card p { font-size: 12px; color: #64748b; margin: 0; line-height: 1.5; }

/* ======= FOOTER ======= */
.cp-footer {
    border-top: 1px solid #e2e8f0; padding: 28px; background: #ffffff;
}
.cp-footer-inner {
    max-width: 1100px; margin: 0 auto;
    display: flex; align-items: center; justify-content: space-between;
}
.cp-footer-logo {
    display: flex; align-items: center; gap: 10px;
    color: #0f172a; font-weight: 700; font-size: 15px;
}
.cp-footer p { color: #475569; font-size: 13px; margin: 0; }

/* ======= JOB DETAIL ======= */
.cp-detail-loading {
    min-height: 100vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
}
.cp-detail-hero {
    position: relative; padding: 120px 28px 50px; text-align: center;
}
.cp-detail-hero-glow {
    position: absolute; top: 0; left: 0; right: 0; height: 400px; pointer-events: none;
}
.cp-detail-hero-content { position: relative; z-index: 1; max-width: 700px; margin: 0 auto; }
.cp-detail-title {
    font-size: clamp(28px, 5vw, 42px); font-weight: 900; color: #0f172a;
    margin: 16px 0; line-height: 1.2;
}
.cp-detail-meta {
    display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;
    margin-bottom: 28px;
}
.cp-detail-meta-item {
    display: flex; align-items: center; gap: 6px;
    color: #64748b; font-size: 14px; font-weight: 500;
}
.cp-detail-meta-item svg { opacity: 0.7; }

.cp-apply-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff;
    border: none; padding: 14px 32px; border-radius: 12px;
    font-size: 15px; font-weight: 700; cursor: pointer;
    transition: all .3s; font-family: inherit;
    box-shadow: 0 8px 30px rgba(79, 70, 229, 0.2);
}
.cp-apply-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(79, 70, 229, 0.3);
}
.cp-apply-btn:disabled { opacity: 0.7; cursor: wait; }
.cp-apply-btn-full { width: 100%; justify-content: center; margin-top: 20px; }

/* Detail Body */
.cp-detail-body { padding: 20px 28px 80px; position: relative; z-index: 1; }
.cp-detail-container {
    max-width: 1100px; margin: 0 auto;
    display: grid; grid-template-columns: 1fr 340px; gap: 24px;
}
.cp-detail-card {
    background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 18px; padding: 28px 32px; margin-bottom: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.015);
}
.cp-detail-card h3 {
    font-size: 17px; font-weight: 800; color: #0f172a; margin: 0 0 16px;
}
.cp-detail-card p { color: #475569; line-height: 1.8; font-size: 14px; margin: 0; }
.cp-detail-skills { display: flex; gap: 8px; flex-wrap: wrap; }
.cp-detail-skill-tag {
    padding: 7px 16px; border-radius: 10px; font-size: 13px; font-weight: 600;
    background: rgba(79, 70, 229, 0.05); border: 1px solid;
}
.cp-detail-list {
    color: #475569; line-height: 2; padding-left: 20px; font-size: 14px; margin: 0;
}
.cp-detail-list li::marker { color: #4f46e5; }

/* Sidebar */
.cp-sidebar-card {
    background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 18px; padding: 28px; position: sticky; top: 80px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.015);
}
.cp-sidebar-card h4 { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0 0 20px; }
.cp-sidebar-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 0; border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
}
.cp-sidebar-row span { color: #64748b; }
.cp-sidebar-row strong { color: #0f172a; font-weight: 600; }

/* ======= MODAL ======= */
.cp-modal-overlay {
    position: fixed; inset: 0; background: rgba(15, 23, 42, 0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 1000; padding: 20px; backdrop-filter: blur(4px);
}
.cp-modal {
    background: #ffffff; border: 1px solid #e2e8f0;
    border-radius: 20px; width: 100%; max-width: 580px;
    max-height: 90vh; overflow: auto; animation: cpModalIn .3s ease-out;
    box-shadow: 0 20px 50px rgba(0,0,0,0.12);
}
@keyframes cpModalIn {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
.cp-modal-header {
    padding: 22px 28px; border-bottom: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; align-items: flex-start;
}
.cp-modal-header h2 { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
.cp-modal-close {
    background: #f1f5f9; border: none; color: #64748b;
    width: 32px; height: 32px; border-radius: 8px; font-size: 16px;
    cursor: pointer; transition: all .2s;
}
.cp-modal-close:hover { background: #fee2e2; color: #ef4444; }
.cp-modal-body { padding: 24px 28px; }
.cp-modal-footer {
    padding: 16px 28px; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: flex-end; gap: 10px;
}
.cp-btn-cancel {
    padding: 10px 20px; border: 1px solid #cbd5e1; border-radius: 10px;
    background: transparent; color: #64748b; cursor: pointer; font-family: inherit;
    font-size: 14px; transition: all .2s;
}
.cp-btn-cancel:hover { border-color: #94a3b8; color: #0f172a; }

.cp-modal-success {
    padding: 60px 40px; text-align: center;
}
.cp-success-animation { font-size: 48px; margin-bottom: 20px; }
.cp-modal-success h2 { font-size: 24px; font-weight: 900; color: #0f172a; margin: 0 0 12px; }
.cp-modal-success p { color: #94a3b8; margin: 0 0 28px; line-height: 1.6; }

/* Form */
.cp-form-section-title {
    font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase;
    letter-spacing: 1.5px; margin: 20px 0 14px; padding-bottom: 8px;
    border-bottom: 1px solid #e2e8f0;
}
.cp-form-section-title:first-child { margin-top: 0; }
.cp-form-error {
    padding: 12px 16px; background: #fef2f2; color: #dc2626;
    border-radius: 10px; margin-bottom: 16px; font-size: 13px;
    border: 1px solid #fecaca;
}
.cp-form-group { margin-bottom: 16px; }
.cp-form-group label {
    display: block; color: #475569; font-size: 13px; font-weight: 600; margin-bottom: 7px;
}
.cp-form-group input, .cp-form-group textarea {
    width: 100%; padding: 11px 14px; background: #f8fafc;
    border: 1px solid #cbd5e1; border-radius: 10px; color: #0f172a;
    font-size: 14px; box-sizing: border-box; font-family: inherit;
    transition: border-color .2s, box-shadow .2s; outline: none;
}
.cp-form-group input:focus, .cp-form-group textarea:focus {
    border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.08);
}
.cp-form-group input::placeholder, .cp-form-group textarea::placeholder { color: #94a3b8; }
.cp-form-group textarea { resize: vertical; }
.cp-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* File Upload */
.cp-file-upload { position: relative; }
.cp-file-upload input[type="file"] {
    position: absolute; inset: 0; opacity: 0; cursor: pointer; z-index: 2;
}
.cp-file-upload-label {
    padding: 20px; border: 2px dashed #cbd5e1; border-radius: 12px;
    text-align: center; color: #64748b; font-size: 13px;
    transition: all .2s; display: flex; flex-direction: column; gap: 4px;
}
.cp-file-upload:hover .cp-file-upload-label { border-color: #4f46e5; color: #4f46e5; }
.cp-file-name { color: #4f46e5; font-weight: 600; }
.cp-file-size { color: #64748b; font-size: 11px; }

.cp-btn-spinner {
    display: inline-block; width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
    border-radius: 50%; animation: cpSpin .6s linear infinite;
}

/* ======= RESPONSIVE ======= */
@media (max-width: 768px) {
    .cp-jobs-grid { grid-template-columns: 1fr; }
    .cp-detail-container { grid-template-columns: 1fr; }
    .cp-form-row { grid-template-columns: 1fr; }
    .cp-footer-inner { flex-direction: column; gap: 12px; text-align: center; }
    .cp-perks-grid { grid-template-columns: repeat(2, 1fr); }
    .cp-hero { padding: 120px 20px 40px; }
    .cp-detail-hero { padding: 100px 20px 40px; }
}
@media (max-width: 480px) {
    .cp-perks-grid { grid-template-columns: 1fr; }
    .cp-nav-inner { padding: 12px 16px; }
}
`;
