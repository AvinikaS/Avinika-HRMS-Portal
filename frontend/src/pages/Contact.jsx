import { useState } from 'react';
import PublicNavbar from '../components/Layout/PublicNavbar';
import PublicFooter from '../components/Layout/PublicFooter';
import './LandingPage.css';

export default function ContactPage() {
    const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
    const [submitted, setSubmitted] = useState(false);

    const handleContact = (e) => {
        e.preventDefault();
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 4000);
        setContactForm({ name: '', email: '', message: '' });
    };

    return (
        <div className="landing">
            <PublicNavbar />

            {/* Hero */}
            <section className="lp-hero" style={{ minHeight: 'auto', padding: '140px 24px 60px' }}>
                <div style={{ textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
                    <div className="lp-section-label">Contact Us</div>
                    <h1 style={{ fontSize: 44, fontWeight: 900, marginBottom: 16 }}>Get in Touch</h1>
                    <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.7, maxWidth: 660, margin: '0 auto', textAlign: 'center' }}>
                        Have questions about our enterprise security standards, custom pricing plans, or integration capability with your legacy systems? Request a guided platform demonstration and we will customize a dashboard workspace suited for your company.
                    </p>
                </div>
            </section>

            {/* Contact details & Form */}
            <section style={{ background: '#f8fafc', padding: '60px 24px 100px', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
                <div className="lp-section" style={{ padding: 0, maxWidth: 1100, margin: '0 auto' }}>
                    <div className="lp-contact-grid lp-grid-contact">

                        {/* Form Card */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 24,
                            padding: '40px 36px',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center'
                        }}>
                            <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 8, textAlign: 'left' }}>Send us a message</h3>
                            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28, lineHeight: 1.5, textAlign: 'left' }}>
                                Fill out the form below and our partnerships or support team will get back to you within 24 hours.
                            </p>
                            <form className="lp-contact-form" onSubmit={handleContact} style={{ display: 'grid', gap: 18 }}>
                                <div className="lp-grid-2col-equal">
                                    <div style={{ textAlign: 'left' }}>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Full Name</label>
                                        <input className="lp-input" placeholder="Enter your name" required value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '12px 16px', background: '#ffffff', color: '#0f172a' }} />
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Work Email</label>
                                        <input className="lp-input" type="email" placeholder="name@company.com" required value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '12px 16px', background: '#ffffff', color: '#0f172a' }} />
                                    </div>
                                </div>
                                <div style={{ textAlign: 'left' }}>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Your Message</label>
                                    <textarea className="lp-input" rows={6} placeholder="Type your message details here..." required value={contactForm.message} onChange={e => setContactForm({ ...contactForm, message: e.target.value })} style={{ borderRadius: 12, border: '1px solid #cbd5e1', padding: '12px 16px', background: '#ffffff', color: '#0f172a', resize: 'vertical' }}></textarea>
                                </div>
                                <button type="submit" className="lp-btn lp-btn-primary lp-btn-large" style={{ width: '100%', justifyContent: 'center', borderRadius: 12, padding: '14px 28px', marginTop: 10 }}>
                                    {submitted ? '✅ Message Sent Successfully!' : 'Send Message →'}
                                </button>
                            </form>
                        </div>

                        {/* Info Card */}
                        <div style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 24,
                            padding: '40px 36px',
                            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.02)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ textAlign: 'left' }}>
                                <h3 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Corporate Office</h3>
                                <p style={{ color: '#64748b', fontSize: 14, marginBottom: 32, lineHeight: 1.5 }}>
                                    Find our coordinates below or pay us a visit at our Noida tech park headquarters.
                                </p>

                                <div className="lp-contact-info" style={{ display: 'grid', gap: 24 }}>
                                    <div className="lp-contact-item" style={{ display: 'flex', gap: 16 }}>
                                        <div className="lp-contact-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', color: '#4f46e5', width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Email Support</h4>
                                            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>support@hrmsportal.com</p>
                                        </div>
                                    </div>

                                    <div className="lp-contact-item" style={{ display: 'flex', gap: 16 }}>
                                        <div className="lp-contact-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', color: '#4f46e5', width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Call Center</h4>
                                            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>+91 1800-100-HRMS</p>
                                        </div>
                                    </div>

                                    <div className="lp-contact-item" style={{ display: 'flex', gap: 16 }}>
                                        <div className="lp-contact-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', color: '#4f46e5', width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Address</h4>
                                            <p style={{ color: '#475569', fontSize: 13, margin: 0, lineHeight: 1.5 }}>Tech Park, Sector 62, Noida, UP 201301, India</p>
                                        </div>
                                    </div>

                                    <div className="lp-contact-item" style={{ display: 'flex', gap: 16 }}>
                                        <div className="lp-contact-item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e0e7ff', color: '#4f46e5', width: 44, height: 44, borderRadius: 12, flexShrink: 0 }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Business Hours</h4>
                                            <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>Mon - Sat: 9:00 AM - 6:00 PM IST</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div style={{
                                marginTop: 32,
                                padding: '16px 20px',
                                background: '#f8fafc',
                                borderRadius: 14,
                                border: '1px dashed #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                textAlign: 'left'
                            }}>
                                <span style={{ fontSize: 20 }}>💬</span>
                                <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                                    Need direct sales onboarding support? Drop us a note at <strong>sales@hrmsportal.com</strong>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <PublicFooter />
        </div>
    );
}
