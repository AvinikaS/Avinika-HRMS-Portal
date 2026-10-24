import { useState } from 'react';
import { HiOutlineChevronDown } from 'react-icons/hi';

const FAQS_INDIA = [
    {
        id: 'faq-1',
        question: 'What is HR management software and why does an Indian company need it?',
        answer: 'HR Management Software (HRMS) is an all-in-one digital platform that automates the complete employee lifecycle — from hiring, onboarding, daily attendance, and leave management to payroll calculation, tax compliance, performance tracking, and exit offboarding. For Indian companies, it eliminates manual Excel errors, saves hundreds of HR administrative hours, and ensures 100% compliance with Indian labor regulations like Provident Fund (PF), ESIC, Professional Tax, and TDS.'
    },
    {
        id: 'faq-2',
        question: 'Is Avinika HRMS suitable for small businesses, startups, and growing MSMEs in India?',
        answer: 'Yes, absolutely! Our platform is designed with modular flexibility, making it ideal for startups with 10 employees to mid-market companies and enterprises with thousands of staff. Small businesses in India can easily automate payroll, generate professional payslips with statutory deductions, maintain attendance records, and manage leaves without needing a dedicated large HR team.'
    },
    {
        id: 'faq-3',
        question: 'Does the software comply with Indian Labor Laws, PF, ESIC, and Gratuity regulations?',
        answer: 'Yes, 100%. Avinika HRMS is built specifically around Indian statutory compliance frameworks. It automatically handles Employee Provident Fund (PF calculations & monthly ECR export), Employee State Insurance (ESIC contribution ledger), Professional Tax (PT slabs for various Indian states), Payment of Gratuity Act calculations (for 5+ year tenures), and Statutory Bonus calculations.'
    },
    {
        id: 'faq-4',
        question: 'Can HR software automate Indian payroll, TDS calculation, Form 16, and Bank Advice files?',
        answer: 'Yes. With a single click, monthly gross-to-net payroll is generated, factoring in attendance proration, unpaid leaves (LWP), loan EMIs, salary advances, and overtime bonuses. It supports both the New and Old Income Tax Regimes, records 80C/80D investment declarations, computes monthly TDS, prepares Form 24Q quarterly return data, auto-generates Form 16 (Part A & B), and exports ready-to-upload Bank Advice files (NEFT/RTGS/NACH) for direct salary disbursement.'
    },
    {
        id: 'faq-5',
        question: 'How does smart attendance with GPS Geofencing and Face Recognition work in India?',
        answer: 'Employees can punch attendance directly from their mobile or browser. The system validates real-time GPS coordinates against designated office geofence boundaries to ensure physical presence. In addition, AI-powered biometric face recognition verifies the employee identity in real time, preventing buddy punching, proxy check-ins, and manual manipulation with detailed verification scores.'
    },
    {
        id: 'faq-6',
        question: 'How do Attendance Regularization and forensic audit controls work?',
        answer: 'If an employee misses a punch, experiences biometric/network failure, or is traveling on official duty, they can submit an Attendance Regularization request with mandatory proof and reasons. HR and SuperAdmins can review a forensic investigation panel displaying facial match scores, distance to office in meters, IP address, and raw attempt logs before approving or overriding with an immutable audit trail.'
    },
    {
        id: 'faq-7',
        question: 'Can HR software help with recruitment and multi-platform job publishing in India?',
        answer: 'Yes! Our built-in Applicant Tracking System (ATS) enables HR teams to create job openings and publish them with one click across leading hiring platforms in India, including LinkedIn, Naukri, Indeed, Internshala, and Glassdoor. All incoming applicants are organized in a single unified candidate pipeline with smart duplicate detection and interview round trackers.'
    },
    {
        id: 'faq-8',
        question: 'How secure is employee data (Aadhaar, PAN, Bank Details) in cloud-based HR software?',
        answer: 'Enterprise security is our top priority. All sensitive employee records — including Aadhaar numbers, PAN cards, bank account details, and salary sheets — are encrypted using industry-standard protocols both in transit (TLS/SSL) and at rest. Role-based access control (RBAC) ensures employees only see their own information while HR and SuperAdmins have strictly audited administrative permissions.'
    },
    {
        id: 'faq-9',
        question: 'What self-service features are available for employees (ESS Portal)?',
        answer: 'The Employee Self-Service (ESS) portal empowers employees to log daily attendance, request casual/sick/earned leaves, download monthly payslip PDFs, track loans and salary advances, submit reimbursement expense claims with receipts, declare income tax investments, raise helpdesk support tickets, and submit formal resignations with exit checklists.'
    },
    {
        id: 'faq-10',
        question: 'Can our company integrate Avinika HRMS with our existing business systems?',
        answer: 'Yes. Our platform provides modern REST APIs and export capabilities for major accounting, ERP, and banking systems. You can export salary disbursement batches directly in standard bank formats, generate accounting journal vouchers, and export compliance reports for tax professionals and auditors.'
    }
];

export default function FaqSection({ title = "HR Software FAQs", subtitle = "Frequently asked questions about Indian payroll, compliance, attendance, and HR automation." }) {
    const [openId, setOpenId] = useState(null);

    const toggleFaq = (id) => {
        setOpenId(prev => (prev === id ? null : id));
    };

    return (
        <section className="faq-section" id="faqs" style={{ background: '#ffffff', padding: '90px 24px' }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <h2 style={{
                        fontSize: '34px',
                        fontWeight: 800,
                        color: '#0f2744',
                        marginBottom: 12,
                        letterSpacing: '-0.5px'
                    }}>
                        {title}
                    </h2>
                    {subtitle && (
                        <p style={{
                            fontSize: '16px',
                            color: '#64748b',
                            maxWidth: 650,
                            margin: '0 auto',
                            lineHeight: 1.6
                        }}>
                            {subtitle}
                        </p>
                    )}
                </div>

                {/* FAQ Accordion List */}
                <div className="faq-accordion-list" style={{ borderTop: '1px solid #e2e8f0' }}>
                    {FAQS_INDIA.map((item) => {
                        const isOpen = openId === item.id;
                        return (
                            <div
                                key={item.id}
                                className={`faq-accordion-item ${isOpen ? 'active' : ''}`}
                                style={{
                                    borderBottom: '1px solid #e2e8f0',
                                    transition: 'background-color 0.2s ease'
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleFaq(item.id)}
                                    aria-expanded={isOpen}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: 16,
                                        padding: '22px 8px',
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left'
                                    }}
                                >
                                    <span style={{
                                        fontSize: '17px',
                                        fontWeight: 600,
                                        color: isOpen ? '#3b82f6' : '#1e3a5f',
                                        lineHeight: 1.45,
                                        transition: 'color 0.2s ease'
                                    }}>
                                        {item.question}
                                    </span>
                                    <span style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: 28,
                                        height: 28,
                                        flexShrink: 0,
                                        color: isOpen ? '#3b82f6' : '#64748b',
                                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                        transition: 'transform 0.25s ease, color 0.2s ease'
                                    }}>
                                        <HiOutlineChevronDown size={20} />
                                    </span>
                                </button>

                                {isOpen && (
                                    <div
                                        style={{
                                            padding: '0 8px 22px 8px',
                                            fontSize: '15px',
                                            lineHeight: 1.7,
                                            color: '#475569',
                                            animation: 'faqFadeIn 0.25s ease'
                                        }}
                                    >
                                        {item.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                @keyframes faqFadeIn {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .faq-accordion-item:hover button span:first-child {
                    color: #3b82f6 !important;
                }
                @media (max-width: 640px) {
                    .faq-section {
                        padding: 60px 16px !important;
                    }
                    .faq-accordion-item button span:first-child {
                        fontSize: 15px !important;
                    }
                }
            `}</style>
        </section>
    );
}
