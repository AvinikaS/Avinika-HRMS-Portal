import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../utils/api';
import { HiOutlinePlus, HiOutlineX, HiOutlineExclamation, HiOutlineGlobeAlt, HiOutlineLink, HiOutlineCheckCircle, HiOutlineExclamationCircle, HiOutlineClock, HiOutlineSearch } from 'react-icons/hi';

const STAGES = ['Applied', 'Screening', 'Interview', 'HR Round', 'Offered', 'Hired', 'Rejected'];
const STAGE_COLORS = { Applied: '#6366f1', Screening: '#06b6d4', Interview: '#f59e0b', 'HR Round': '#ec4899', Offered: '#10b981', Hired: '#059669', Rejected: '#ef4444' };

const PLATFORMS = [
    { id: 'Company Career Page', label: 'Career Page', icon: '🏢', color: '#6366f1' },
    { id: 'LinkedIn', label: 'LinkedIn', icon: '💼', color: '#0077b5' },
    { id: 'Naukri', label: 'Naukri.com', icon: '🔵', color: '#4a90d9' },
    { id: 'Indeed', label: 'Indeed', icon: '🟣', color: '#2164f3' },
    { id: 'Internshala', label: 'Internshala', icon: '🎓', color: '#00a5ec' },
    { id: 'Monster', label: 'Monster', icon: '🟢', color: '#6e45a5' },
    { id: 'Glassdoor', label: 'Glassdoor', icon: '🚪', color: '#0caa41' }
];

const SOURCE_ICONS = { 'Company Career Page': '🏢', 'LinkedIn': '💼', 'Naukri': '🔵', 'Indeed': '🟣', 'Internshala': '🎓', 'Monster': '🟢', 'Glassdoor': '🚪', 'Referral': '🤝', 'Other': '📌' };

export default function Recruitment() {
    const [tab, setTab] = useState('pipeline');
    const [jobs, setJobs] = useState([]);
    const [candidates, setCandidates] = useState([]);
    const [platformConfigs, setPlatformConfigs] = useState([]);
    const [showJobModal, setShowJobModal] = useState(false);
    const [showCandidateModal, setShowCandidateModal] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [publishing, setPublishing] = useState(false);
    const [connecting, setConnecting] = useState(null);
    const [selectedJob, setSelectedJob] = useState(null);
    const [selectedPlatforms, setSelectedPlatforms] = useState([]);
    const [publishResults, setPublishResults] = useState(null);
    const [sourceFilter, setSourceFilter] = useState('');
    const [jobFilter, setJobFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCandidate, setExpandedCandidate] = useState(null);
    const [selectedStage, setSelectedStage] = useState(null);
    const [schedulingCandidate, setSchedulingCandidate] = useState(null);

    const [interviewForm, setInterviewForm] = useState({
        interviewerName: '', date: '', time: '', duration: '30', interviewType: 'Video Call', meetingLink: ''
    });

    const [jobForm, setJobForm] = useState({
        title: '', description: '', department: '', location: '', employmentType: 'Full-Time',
        experienceMin: 0, experienceMax: 5, salaryMin: '', salaryMax: '', currency: 'INR',
        skills: '', qualifications: '', responsibilities: '', status: 'Open', openings: 1
    });
    const [candidateForm, setCandidateForm] = useState({
        name: '', email: '', phone: '', aadhaar: '', skills: '', experience: 0,
        currentCompany: '', expectedSalary: '', noticePeriod: '', source: 'Other', jobPost: ''
    });

    const fetchData = async () => {
        try {
            const [jobRes, candRes, platRes] = await Promise.all([
                api.get('/recruitment/jobs'),
                api.get('/recruitment/candidates'),
                api.get('/recruitment/platforms')
            ]);
            setJobs(jobRes.data.data || []);
            setCandidates(candRes.data.data || []);
            setPlatformConfigs(platRes.data.data || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // ---- Job Creation ----
    const handleCreateJob = async (e) => {
        e.preventDefault();
        try {
            await api.post('/recruitment/jobs', {
                ...jobForm,
                skills: jobForm.skills.split(',').map(s => s.trim()).filter(Boolean),
                qualifications: jobForm.qualifications ? jobForm.qualifications.split(',').map(s => s.trim()).filter(Boolean) : [],
                responsibilities: jobForm.responsibilities ? jobForm.responsibilities.split('\n').filter(Boolean) : [],
                salaryMin: jobForm.salaryMin ? +jobForm.salaryMin : undefined,
                salaryMax: jobForm.salaryMax ? +jobForm.salaryMax : undefined
            });
            setShowJobModal(false);
            setJobForm({ title: '', description: '', department: '', location: '', employmentType: 'Full-Time', experienceMin: 0, experienceMax: 5, salaryMin: '', salaryMax: '', currency: 'INR', skills: '', qualifications: '', responsibilities: '', status: 'Open', openings: 1 });
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    };

    // ---- Publish Job ----
    const openPublishModal = (job) => {
        setSelectedJob(job);
        setSelectedPlatforms(job.publishedPlatforms?.map(p => p.platform) || ['Company Career Page']);
        setPublishResults(null);
        setShowPublishModal(true);
    };

    const togglePlatform = (platformId) => {
        setSelectedPlatforms(prev => prev.includes(platformId) ? prev.filter(p => p !== platformId) : [...prev, platformId]);
    };

    const handlePublish = async () => {
        if (selectedPlatforms.length === 0) return toast.error('Select at least one platform');
        setPublishing(true);
        try {
            const { data } = await api.post(`/recruitment/jobs/${selectedJob._id}/publish`, { platforms: selectedPlatforms });
            setPublishResults(data.publishResults);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Publish failed'); }
        setPublishing(false);
    };

    // ---- Close / Reopen Job ----
    const handleCloseJob = async (jobId) => {
        const res = await Swal.fire({ title: 'Close Job?', text: 'Are you sure you want to close this job? It will be removed from all platforms.', icon: 'warning', showCancelButton: true });
        if (!res.isConfirmed) return;
        try {
            await api.put(`/recruitment/jobs/${jobId}/close`);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error closing job'); }
    };

    const handleReopenJob = async (jobId) => {
        try {
            await api.put(`/recruitment/jobs/${jobId}/reopen`);
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error reopening job'); }
    };

    // ---- Platform Connect (OAuth Popup) ----
    const handleOAuthConnect = async (platform) => {
        setConnecting(platform);
        try {
            const { data } = await api.get(`/oauth/${encodeURIComponent(platform)}/init`);
            if (data.demo) {
                // No OAuth creds configured — use demo connect
                await api.post(`/oauth/${encodeURIComponent(platform)}/demo-connect`);
                fetchData();
                setConnecting(null);
                return;
            }
            // Open OAuth popup
            const w = 500, h = 600;
            const left = window.screenX + (window.innerWidth - w) / 2;
            const top = window.screenY + (window.innerHeight - h) / 2;
            const popup = window.open(data.authUrl, `Connect ${platform}`, `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`);

            // Listen for OAuth completion via postMessage
            const handler = (event) => {
                if (event.data?.type === 'OAUTH_COMPLETE') {
                    window.removeEventListener('message', handler);
                    setConnecting(null);
                    fetchData();
                }
            };
            window.addEventListener('message', handler);

            // Fallback: poll for popup close
            const interval = setInterval(() => {
                if (popup?.closed) {
                    clearInterval(interval);
                    window.removeEventListener('message', handler);
                    setConnecting(null);
                    fetchData();
                }
            }, 1000);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to start connection');
            setConnecting(null);
        }
    };

    const handleDisconnect = async (platform) => {
        const res = await Swal.fire({ title: 'Disconnect platform?', text: `Disconnect ${platform}?`, icon: 'warning', showCancelButton: true });
        if (!res.isConfirmed) return;
        try { await api.delete(`/recruitment/platforms/${encodeURIComponent(platform)}`); fetchData(); } catch { }
    };

    // ---- Candidates ----
    const handleAddCandidate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/recruitment/candidates', { ...candidateForm, skills: candidateForm.skills.split(',').map(s => s.trim()).filter(Boolean), expectedSalary: candidateForm.expectedSalary ? +candidateForm.expectedSalary : undefined });
            if (res.data.isPreviousEmployee) toast.warning('⚠️ This candidate is a Previous Employee!');
            if (res.data.isDuplicate) toast.warning('⚠️ Duplicate candidate detected across jobs');
            setShowCandidateModal(false);
            setCandidateForm({ name: '', email: '', phone: '', aadhaar: '', skills: '', experience: 0, currentCompany: '', expectedSalary: '', noticePeriod: '', source: 'Other', jobPost: '' });
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const handleScheduleInterview = async (e) => {
        e.preventDefault();
        try {
            await api.post(`/recruitment/candidates/${schedulingCandidate._id}/schedule-interview`, interviewForm);
            toast.success('Interview scheduled and email sent successfully!');
            setSchedulingCandidate(null);
            setInterviewForm({ interviewerName: '', date: '', time: '', duration: '30', interviewType: 'Video Call', meetingLink: '' });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error scheduling interview');
        }
    };

    const updateStage = async (id, stage) => {
        try { await api.put(`/recruitment/candidates/${id}`, { stage }); fetchData(); } catch { }
    };

    const hireCandidate = async (id) => {
        const { value: formValues } = await Swal.fire({
            title: 'Hire Candidate',
            html:
                '<input id="swal-input1" class="swal2-input" placeholder="Department">' +
                '<input id="swal-input2" class="swal2-input" placeholder="Designation">',
            focusConfirm: false,
            showCancelButton: true,
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value
                ]
            }
        });

        if (!formValues) return;
        const [dept, designation] = formValues;
        if (!dept || !designation) return toast.error('Department and Designation are required.');

        try {
            await api.post(`/recruitment/candidates/${id}/hire`, { department: dept, designation });
            toast.success('Candidate hired! Employee record created.');
            fetchData();
        } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    };

    const filteredCandidates = candidates.filter(c => {
        if (sourceFilter && c.source !== sourceFilter) return false;
        if (jobFilter) {
            const jobId = typeof c.jobPost === 'object' && c.jobPost ? c.jobPost._id : c.jobPost;
            // Handle if c.jobPost is a string title instead of ID, or just straight compare if there's no mismatch
            if (jobId !== jobFilter && c.jobPost !== jobFilter) return false;
        }
        if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase()) && !c.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    const grouped = {};
    STAGES.forEach(s => { grouped[s] = filteredCandidates.filter(c => c.stage === s); });

    const appliedCount = filteredCandidates.filter(c => c.stage === 'Applied').length;
    const screeningCount = filteredCandidates.filter(c => c.stage === 'Screening').length;
    const interviewCount = filteredCandidates.filter(c => c.stage === 'Interview').length;
    const hrRoundCount = filteredCandidates.filter(c => c.stage === 'HR Round').length;
    const offeredCount = filteredCandidates.filter(c => c.stage === 'Offered').length;
    const hiredCount = filteredCandidates.filter(c => c.stage === 'Hired').length;

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Recruitment</h1><p>Manage job posts, distribute to platforms, and track candidates</p></div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => setShowCandidateModal(true)}><HiOutlinePlus /> Add Candidate</button>
                    <button className="btn btn-primary" onClick={() => setShowJobModal(true)}><HiOutlinePlus /> Create Job Post</button>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: (tab === 'pipeline' || tab === 'candidates') ? '16px' : '24px' }}>
                {['pipeline', 'jobs', 'candidates', 'platforms'].map(t => (
                    <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t === 'platforms' ? '🔗 Platforms' : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            {/* ============ GLOBAL CANDIDATE FILTERS ============ */}
            {(tab === 'pipeline' || tab === 'candidates') && (
                <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', alignItems: 'center', justifyContent: 'space-between' }}>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '1 1 auto' }}>
                        <select className="form-control" style={{ flex: '1 1 200px' }} value={jobFilter} onChange={e => setJobFilter(e.target.value)}>
                            <option value="">All Jobs</option>
                            {jobs.map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
                        </select>

                        <select className="form-control" style={{ flex: '1 1 200px' }} value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
                            <option value="">All Sources</option>
                            {Object.keys(SOURCE_ICONS).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    <div style={{ position: 'relative', flex: '1 1 250px', maxWidth: '400px' }}>
                        <HiOutlineSearch style={{ position: 'absolute', left: 12, top: 11, color: 'var(--text-tertiary)' }} />
                        <input className="form-control" placeholder="Search by name or email..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 36, width: '100%' }} />
                    </div>
                </div>
            )}

            {/* ============ PIPELINE TAB ============ */}
            {tab === 'pipeline' && (
                <div>
                    {/* Top Stat Cards */}
                    <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                        <div className="stat-card purple" style={{ padding: '16px', cursor: 'pointer', border: selectedStage === 'Applied' ? '2px solid #6366f1' : undefined, transform: selectedStage === 'Applied' ? 'translateY(-2px)' : undefined, boxShadow: selectedStage === 'Applied' ? 'var(--shadow-md)' : undefined }} onClick={() => setSelectedStage(s => s === 'Applied' ? null : 'Applied')}>
                            <div className="stat-icon purple" style={{ width: '36px', height: '36px', fontSize: '18px' }}>📥</div>
                            <div className="stat-content">
                                <div className="stat-label">Applied</div>
                                <div className="stat-value" style={{ fontSize: '20px' }}>{appliedCount}</div>
                            </div>
                        </div>
                        <div className="stat-card cyan" style={{ padding: '16px', cursor: 'pointer', border: selectedStage === 'Screening' ? '2px solid #06b6d4' : undefined, transform: selectedStage === 'Screening' ? 'translateY(-2px)' : undefined, boxShadow: selectedStage === 'Screening' ? 'var(--shadow-md)' : undefined }} onClick={() => setSelectedStage(s => s === 'Screening' ? null : 'Screening')}>
                            <div className="stat-icon cyan" style={{ width: '36px', height: '36px', fontSize: '18px' }}>🔍</div>
                            <div className="stat-content">
                                <div className="stat-label">Screening</div>
                                <div className="stat-value" style={{ fontSize: '20px' }}>{screeningCount}</div>
                            </div>
                        </div>
                        <div className="stat-card orange" style={{ padding: '16px', cursor: 'pointer', border: selectedStage === 'Interview' ? '2px solid #f59e0b' : undefined, transform: selectedStage === 'Interview' ? 'translateY(-2px)' : undefined, boxShadow: selectedStage === 'Interview' ? 'var(--shadow-md)' : undefined }} onClick={() => setSelectedStage(s => s === 'Interview' ? null : 'Interview')}>
                            <div className="stat-icon orange" style={{ width: '36px', height: '36px', fontSize: '18px' }}>🎙️</div>
                            <div className="stat-content">
                                <div className="stat-label">Interview</div>
                                <div className="stat-value" style={{ fontSize: '20px' }}>{interviewCount}</div>
                            </div>
                        </div>
                        <div className="stat-card red" style={{ padding: '16px', cursor: 'pointer', border: selectedStage === 'HR Round' ? '2px solid #ec4899' : undefined, transform: selectedStage === 'HR Round' ? 'translateY(-2px)' : undefined, boxShadow: selectedStage === 'HR Round' ? 'var(--shadow-md)' : undefined }} onClick={() => setSelectedStage(s => s === 'HR Round' ? null : 'HR Round')}>
                            <div className="stat-icon red" style={{ width: '36px', height: '36px', fontSize: '18px' }}>🤝</div>
                            <div className="stat-content">
                                <div className="stat-label">HR Round</div>
                                <div className="stat-value" style={{ fontSize: '20px' }}>{hrRoundCount}</div>
                            </div>
                        </div>
                        <div className="stat-card blue" style={{ padding: '16px', cursor: 'pointer', border: selectedStage === 'Offered' ? '2px solid #3b82f6' : undefined, transform: selectedStage === 'Offered' ? 'translateY(-2px)' : undefined, boxShadow: selectedStage === 'Offered' ? 'var(--shadow-md)' : undefined }} onClick={() => setSelectedStage(s => s === 'Offered' ? null : 'Offered')}>
                            <div className="stat-icon blue" style={{ width: '36px', height: '36px', fontSize: '18px' }}>📄</div>
                            <div className="stat-content">
                                <div className="stat-label">Offered</div>
                                <div className="stat-value" style={{ fontSize: '20px' }}>{offeredCount}</div>
                            </div>
                        </div>
                        <div className="stat-card green" style={{ padding: '16px', cursor: 'pointer', border: selectedStage === 'Hired' ? '2px solid #10b981' : undefined, transform: selectedStage === 'Hired' ? 'translateY(-2px)' : undefined, boxShadow: selectedStage === 'Hired' ? 'var(--shadow-md)' : undefined }} onClick={() => setSelectedStage(s => s === 'Hired' ? null : 'Hired')}>
                            <div className="stat-icon green" style={{ width: '36px', height: '36px', fontSize: '18px' }}>🎉</div>
                            <div className="stat-content">
                                <div className="stat-label">Hired</div>
                                <div className="stat-value" style={{ fontSize: '20px' }}>{hiredCount}</div>
                            </div>
                        </div>
                    </div>

                    {/* Pipeline Kanban or Grid */}
                    {selectedStage ? (
                        <div style={{ marginTop: '20px' }}>
                            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h3 style={{ fontSize: '16px', fontWeight: '700', color: STAGE_COLORS[selectedStage] }}>
                                    {selectedStage} Candidates ({grouped[selectedStage]?.length || 0})
                                </h3>
                                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedStage(null)}>
                                    <HiOutlineX style={{ marginRight: '4px' }} /> Clear Filter
                                </button>
                            </div>
                            {grouped[selectedStage]?.length === 0 ? (
                                <div className="card"><div className="empty-state"><div className="empty-icon">🤷</div><h3>No candidates in {selectedStage}</h3></div></div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                                    {grouped[selectedStage].map(c => (
                                        <div key={c._id} className="pipeline-card" style={{ margin: 0, display: 'flex', flexDirection: 'column' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <strong style={{ fontSize: 14 }}>{c.name}</strong>
                                                {c.isPreviousEmployee && <span className="badge badge-warning" style={{ fontSize: 10 }}><HiOutlineExclamation style={{ marginRight: 2 }} /> Rehire</span>}
                                            </div>
                                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{c.email}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                                {SOURCE_ICONS[c.source] || '📌'} {c.source} · {c.experience}yr
                                            </div>
                                            {c.resumeUrl && <div style={{ marginTop: 6 }}><a href={c.resumeUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>📄 View Resume</a></div>}
                                            {c.isDuplicate && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 6 }}>⚠️ Duplicate detected</div>}
                                            {c.skills?.length > 0 && (
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
                                                    {c.skills.slice(0, 4).map((s, i) => <span key={i} className="badge badge-primary" style={{ fontSize: 10 }}>{s}</span>)}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 16 }}>
                                                {selectedStage === 'Screening' && (
                                                    <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={() => setSchedulingCandidate(c)}>
                                                        📅 Schedule Interview
                                                    </button>
                                                )}
                                                {selectedStage !== 'Hired' && selectedStage !== 'Screening' && STAGES.indexOf(selectedStage) < STAGES.indexOf('Offered') && (
                                                    <button className="btn btn-sm btn-secondary" style={{ flex: 1 }} onClick={() => updateStage(c._id, STAGES[STAGES.indexOf(selectedStage) + 1])}>
                                                        Move to {STAGES[STAGES.indexOf(selectedStage) + 1]}
                                                    </button>
                                                )}
                                                {selectedStage === 'Offered' && <button className="btn btn-sm btn-success" style={{ flex: 1 }} onClick={() => hireCandidate(c._id)}>✓ Hire</button>}
                                                {selectedStage !== 'Hired' && <button className="btn btn-sm btn-danger" title="Reject" onClick={() => updateStage(c._id, 'Rejected')}>✗</button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="pipeline">
                            {STAGES.filter(s => s !== 'Rejected').map(stage => (
                                <div key={stage} className="pipeline-column">
                                    <div className="pipeline-column-header">
                                        <h4 style={{ color: STAGE_COLORS[stage] }}>{stage}</h4>
                                        <span className="count">{grouped[stage]?.length || 0}</span>
                                    </div>
                                    {(grouped[stage] || []).map(c => (
                                        <div key={c._id} className="pipeline-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                                <strong style={{ fontSize: 13.5 }}>{c.name}</strong>
                                                {c.isPreviousEmployee && <span className="badge badge-warning" style={{ fontSize: 10 }}><HiOutlineExclamation style={{ marginRight: 2 }} /> Rehire</span>}
                                            </div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{c.email}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                                {SOURCE_ICONS[c.source] || '📌'} {c.source} · {c.experience}yr
                                            </div>
                                            {c.resumeUrl && <a href={c.resumeUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--primary)' }}>📄 Resume</a>}
                                            {c.isDuplicate && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>⚠️ Duplicate detected</div>}
                                            {c.skills?.length > 0 && (
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                                                    {c.skills.slice(0, 3).map((s, i) => <span key={i} className="badge badge-primary" style={{ fontSize: 10 }}>{s}</span>)}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                                                {stage === 'Screening' ? (
                                                    <button className="btn btn-sm btn-primary" onClick={() => setSchedulingCandidate(c)}>
                                                        📅 Schedule
                                                    </button>
                                                ) : (
                                                    stage !== 'Hired' && STAGES.indexOf(stage) < STAGES.indexOf('Offered') && (
                                                        <button className="btn btn-sm btn-secondary" onClick={() => updateStage(c._id, STAGES[STAGES.indexOf(stage) + 1])}>
                                                            → {STAGES[STAGES.indexOf(stage) + 1]}
                                                        </button>
                                                    )
                                                )}
                                                {stage === 'Offered' && <button className="btn btn-sm btn-success" onClick={() => hireCandidate(c._id)}>✓ Hire</button>}
                                                {stage !== 'Hired' && <button className="btn btn-sm btn-danger" onClick={() => updateStage(c._id, 'Rejected')} style={{ marginLeft: 'auto' }}>✗</button>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ============ JOBS TAB ============ */}
            {tab === 'jobs' && (
                <div>
                    {jobs.length === 0 ? (
                        <div className="card"><div className="empty-state"><div className="empty-icon">📋</div><h3>No job posts yet</h3><p>Create your first job post and distribute it to multiple platforms</p></div></div>
                    ) : (
                        <div style={{ display: 'grid', gap: 16 }}>
                            {jobs.map(j => (
                                <div key={j._id} className="card" style={{ padding: 20 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <div>
                                            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{j.title}</h3>
                                            <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                                                {j.department} · {j.location || 'Remote'} · {j.employmentType} · {j.openings} opening{j.openings > 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span className={`badge ${j.status === 'Open' ? 'badge-success' : j.status === 'Draft' ? 'badge-neutral' : j.status === 'Closed' ? 'badge-danger' : 'badge-warning'}`}>{j.status}</span>
                                            {j.status === 'Open' && (
                                                <>
                                                    <button className="btn btn-sm btn-primary" onClick={() => openPublishModal(j)}>
                                                        <HiOutlineGlobeAlt /> Publish
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleCloseJob(j._id)}>
                                                        <HiOutlineX /> Close
                                                    </button>
                                                </>
                                            )}
                                            {j.status === 'Draft' && (
                                                <button className="btn btn-sm btn-primary" onClick={() => openPublishModal(j)}>
                                                    <HiOutlineGlobeAlt /> Publish
                                                </button>
                                            )}
                                            {j.status === 'Closed' && (
                                                <button className="btn btn-sm btn-success" onClick={() => handleReopenJob(j._id)}>
                                                    🔄 Reopen
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Salary & Experience */}
                                    <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 13 }}>
                                        {(j.salaryMin || j.salaryMax) && (
                                            <span>💰 {j.salaryMin ? `₹${(j.salaryMin / 100000).toFixed(1)}L` : ''}{j.salaryMin && j.salaryMax ? ' - ' : ''}{j.salaryMax ? `₹${(j.salaryMax / 100000).toFixed(1)}L` : ''}</span>
                                        )}
                                        <span>📊 {j.experienceMin}-{j.experienceMax || '10+'} years</span>
                                        <span style={{ fontWeight: 700, color: 'var(--primary)' }}>👥 {j.applicationsCount} applications</span>
                                    </div>

                                    {/* Skills */}
                                    {j.skills?.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                            {j.skills.map((s, i) => <span key={i} className="badge badge-primary" style={{ fontSize: 11 }}>{s}</span>)}
                                        </div>
                                    )}

                                    {/* Published Platforms */}
                                    {j.publishedPlatforms?.length > 0 && (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
                                            {j.publishedPlatforms.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 6, background: p.status === 'Published' ? '#d1fae520' : p.status === 'Failed' ? '#fee2e220' : '#fef3c720', fontSize: 12 }}>
                                                    {p.status === 'Published' ? <HiOutlineCheckCircle color="#059669" /> : p.status === 'Failed' ? <HiOutlineExclamationCircle color="#ef4444" /> : <HiOutlineClock color="#f59e0b" />}
                                                    {SOURCE_ICONS[p.platform]} {p.platform}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ============ CANDIDATES TAB ============ */}
            {tab === 'candidates' && (
                <div>
                    <div className="table-container"><div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead><tr><th></th><th>Name</th><th>Email</th><th>Phone</th><th>Experience</th><th>Source</th><th>Resume</th><th>Stage</th><th>Flags</th></tr></thead>
                            <tbody>
                                {filteredCandidates.map(c => (
                                    <>
                                        <tr key={c._id} onClick={() => setExpandedCandidate(expandedCandidate === c._id ? null : c._id)} style={{ cursor: 'pointer' }}>
                                            <td style={{ width: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>{expandedCandidate === c._id ? '▼' : '▶'}</td>
                                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                                            <td>{c.email}</td>
                                            <td>{c.phone}</td>
                                            <td>{c.experience} yrs</td>
                                            <td><span className="badge badge-info">{SOURCE_ICONS[c.source]} {c.source}</span></td>
                                            <td>{c.resumeUrl ? <a href={c.resumeUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary" onClick={e => e.stopPropagation()}>📄 View</a> : '-'}</td>
                                            <td><span className="badge" style={{ background: `${STAGE_COLORS[c.stage]}20`, color: STAGE_COLORS[c.stage] }}>{c.stage}</span></td>
                                            <td>
                                                {c.isPreviousEmployee && <span className="badge badge-warning" style={{ fontSize: 10, marginRight: 4 }}>Rehire</span>}
                                                {c.isDuplicate && <span className="badge badge-info" style={{ fontSize: 10 }}>Duplicate</span>}
                                            </td>
                                        </tr>
                                        {expandedCandidate === c._id && (
                                            <tr key={c._id + '-detail'}>
                                                <td colSpan="9" style={{ padding: 0 }}>
                                                    <div style={{ background: '#f8fafc', padding: '20px 28px', borderLeft: '4px solid var(--primary)', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '18px 32px' }}>
                                                        {c.skills?.length > 0 && (
                                                            <div>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>🛠️ Skills</div>
                                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                                    {c.skills.map((s, i) => <span key={i} style={{ background: '#eef2ff', color: '#4f46e5', padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{s}</span>)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {c.expectedSalary && (
                                                            <div>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>💰 Expected Salary</div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>₹{Number(c.expectedSalary).toLocaleString('en-IN')}</div>
                                                            </div>
                                                        )}
                                                        {c.currentCompany && (
                                                            <div>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>🏢 Current Company</div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{c.currentCompany}</div>
                                                            </div>
                                                        )}
                                                        {c.noticePeriod && (
                                                            <div>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>⏳ Notice Period</div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{c.noticePeriod}</div>
                                                            </div>
                                                        )}
                                                        {c.jobPost && (
                                                            <div>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>🎯 Applied For</div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{typeof c.jobPost === 'object' ? c.jobPost.title : c.jobPost}</div>
                                                            </div>
                                                        )}
                                                        {c.appliedAt && (
                                                            <div>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>📅 Applied On</div>
                                                                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>{new Date(c.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                                            </div>
                                                        )}
                                                        {c.coverLetter && (
                                                            <div style={{ gridColumn: '1 / -1' }}>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>💌 Cover Letter</div>
                                                                <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#fff', padding: '14px 18px', borderRadius: 10, border: '1px solid #e2e8f0', color: '#334155' }}>{c.coverLetter}</div>
                                                            </div>
                                                        )}
                                                        {!c.skills?.length && !c.expectedSalary && !c.currentCompany && !c.noticePeriod && !c.coverLetter && (
                                                            <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>No additional details available for this candidate.</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                                {filteredCandidates.length === 0 && <tr><td colSpan="9"><div className="empty-state"><div className="empty-icon">👤</div><h3>No candidates</h3></div></td></tr>}
                            </tbody>
                        </table>
                    </div></div>
                </div>
            )}

            {/* ============ PLATFORMS TAB ============ */}
            {tab === 'platforms' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {PLATFORMS.map(p => {
                        const config = platformConfigs.find(c => c.platform === p.id);
                        const isConnected = config?.isConnected || p.id === 'Company Career Page';
                        return (
                            <div key={p.id} className="card" style={{ padding: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${p.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{p.icon}</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</div>
                                        <div style={{ fontSize: 12, color: isConnected ? '#059669' : 'var(--text-tertiary)' }}>
                                            {isConnected ? '● Connected' : '○ Not connected'}
                                        </div>
                                    </div>
                                </div>
                                {config && (
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>
                                        {config.accountEmail && <div>📧 {config.accountEmail}</div>}
                                        <div>📋 {config.totalJobsPublished || 0} jobs published · {config.totalCandidatesSynced || 0} candidates synced</div>
                                    </div>
                                )}
                                {p.id === 'Company Career Page' ? (
                                    <div style={{ fontSize: 12, padding: '8px 12px', background: 'var(--primary-light)', borderRadius: 8, color: 'var(--primary)' }}>
                                        ✅ Always active at <strong>/careers</strong>
                                    </div>
                                ) : isConnected ? (
                                    <button className="btn btn-sm btn-danger" onClick={() => handleDisconnect(p.id)}>Disconnect</button>
                                ) : (
                                    <button className="btn btn-sm btn-primary" onClick={() => handleOAuthConnect(p.id)} disabled={connecting === p.id}>
                                        {connecting === p.id ? '⏳ Connecting...' : <><HiOutlineLink /> Connect</>}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ============ CREATE JOB MODAL ============ */}
            {showJobModal && (
                <div className="modal-overlay" onClick={() => setShowJobModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header"><h2>Create Job Post</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowJobModal(false)}><HiOutlineX /></button></div>
                        <form onSubmit={handleCreateJob}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Job Title *</label><input className="form-control" value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })} required placeholder="e.g. Senior React Developer" /></div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Department *</label><input className="form-control" value={jobForm.department} onChange={e => setJobForm({ ...jobForm, department: e.target.value })} required /></div>
                                    <div className="form-group"><label className="form-label">Location</label><input className="form-control" value={jobForm.location} onChange={e => setJobForm({ ...jobForm, location: e.target.value })} placeholder="e.g. Bangalore, Remote" /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Employment Type</label>
                                        <select className="form-control" value={jobForm.employmentType} onChange={e => setJobForm({ ...jobForm, employmentType: e.target.value })}>
                                            {['Full-Time', 'Part-Time', 'Contract', 'Intern'].map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label className="form-label">Openings</label><input type="number" className="form-control" value={jobForm.openings} onChange={e => setJobForm({ ...jobForm, openings: +e.target.value })} min="1" /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Description *</label><textarea className="form-control" rows={4} value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })} required placeholder="Detailed job description..." /></div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Experience (Min)</label><input type="number" className="form-control" value={jobForm.experienceMin} onChange={e => setJobForm({ ...jobForm, experienceMin: +e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Experience (Max)</label><input type="number" className="form-control" value={jobForm.experienceMax} onChange={e => setJobForm({ ...jobForm, experienceMax: +e.target.value })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Salary Min (₹)</label><input type="number" className="form-control" value={jobForm.salaryMin} onChange={e => setJobForm({ ...jobForm, salaryMin: e.target.value })} placeholder="e.g. 500000" /></div>
                                    <div className="form-group"><label className="form-label">Salary Max (₹)</label><input type="number" className="form-control" value={jobForm.salaryMax} onChange={e => setJobForm({ ...jobForm, salaryMax: e.target.value })} placeholder="e.g. 1200000" /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Skills (comma-separated)</label><input className="form-control" value={jobForm.skills} onChange={e => setJobForm({ ...jobForm, skills: e.target.value })} placeholder="React, Node.js, MongoDB" /></div>
                                <div className="form-group"><label className="form-label">Responsibilities (one per line)</label><textarea className="form-control" rows={3} value={jobForm.responsibilities} onChange={e => setJobForm({ ...jobForm, responsibilities: e.target.value })} placeholder="Build scalable web apps&#10;Code reviews&#10;Mentor junior devs" /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowJobModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create Job Post</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ PUBLISH MODAL (Buffer-like) ============ */}
            {showPublishModal && selectedJob && (
                <div className="modal-overlay" onClick={() => setShowPublishModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2><HiOutlineGlobeAlt style={{ marginRight: 8 }} /> Publish Job</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowPublishModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ padding: '12px 16px', background: 'var(--primary-light)', borderRadius: 10, marginBottom: 20 }}>
                                <div style={{ fontWeight: 700, fontSize: 15 }}>{selectedJob.title}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{selectedJob.department} · {selectedJob.location || 'Remote'}</div>
                            </div>

                            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Select Platforms</h4>
                            <div style={{ display: 'grid', gap: 8 }}>
                                {PLATFORMS.map(p => {
                                    const isSelected = selectedPlatforms.includes(p.id);
                                    const existing = selectedJob.publishedPlatforms?.find(pp => pp.platform === p.id);
                                    const config = platformConfigs.find(c => c.platform === p.id);
                                    const isAvailable = p.id === 'Company Career Page' || config?.isConnected;
                                    return (
                                        <div key={p.id} onClick={() => isAvailable && togglePlatform(p.id)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, cursor: isAvailable ? 'pointer' : 'default',
                                                border: `2px solid ${isSelected ? p.color : 'var(--border-color)'}`,
                                                background: isSelected ? `${p.color}08` : 'transparent',
                                                opacity: isAvailable ? 1 : 0.5
                                            }}>
                                            <span style={{ fontSize: 20 }}>{p.icon}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</div>
                                                {existing?.status === 'Published' && <div style={{ fontSize: 11, color: '#059669' }}>✅ Already published</div>}
                                                {!isAvailable && <div style={{ fontSize: 11, color: '#ef4444' }}>Not connected</div>}
                                            </div>
                                            <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? p.color : '#ccc'}`, background: isSelected ? p.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
                                                {isSelected && '✓'}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Publish Results */}
                            {publishResults && (
                                <div style={{ marginTop: 20 }}>
                                    <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Results</h4>
                                    {publishResults.map((r, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, marginBottom: 6, background: r.status === 'Published' ? '#d1fae520' : '#fee2e220' }}>
                                            {r.status === 'Published' ? <HiOutlineCheckCircle color="#059669" /> : <HiOutlineExclamationCircle color="#ef4444" />}
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.platform}</span>
                                            <span style={{ fontSize: 12, color: r.status === 'Published' ? '#059669' : '#ef4444', marginLeft: 'auto' }}>{r.status}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowPublishModal(false)}>Close</button>
                            {!publishResults && (
                                <button className="btn btn-primary" onClick={handlePublish} disabled={publishing || selectedPlatforms.length === 0}>
                                    {publishing ? '⏳ Publishing...' : `🚀 Publish to ${selectedPlatforms.length} Platform${selectedPlatforms.length > 1 ? 's' : ''}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============ ADD CANDIDATE MODAL ============ */}
            {showCandidateModal && (
                <div className="modal-overlay" onClick={() => setShowCandidateModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h2>Add Candidate</h2><button className="btn btn-icon btn-secondary" onClick={() => setShowCandidateModal(false)}><HiOutlineX /></button></div>
                        <form onSubmit={handleAddCandidate}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Full Name *</label><input className="form-control" value={candidateForm.name} onChange={e => setCandidateForm({ ...candidateForm, name: e.target.value })} required /></div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-control" value={candidateForm.email} onChange={e => setCandidateForm({ ...candidateForm, email: e.target.value })} required /></div>
                                    <div className="form-group"><label className="form-label">Phone *</label><input className="form-control" value={candidateForm.phone} onChange={e => setCandidateForm({ ...candidateForm, phone: e.target.value })} required /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Aadhaar No.</label><input className="form-control" value={candidateForm.aadhaar} onChange={e => setCandidateForm({ ...candidateForm, aadhaar: e.target.value })} placeholder="For duplicate detection" /></div>
                                    <div className="form-group"><label className="form-label">Experience (years)</label><input type="number" className="form-control" value={candidateForm.experience} onChange={e => setCandidateForm({ ...candidateForm, experience: +e.target.value })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Source</label>
                                        <select className="form-control" value={candidateForm.source} onChange={e => setCandidateForm({ ...candidateForm, source: e.target.value })}>
                                            {Object.keys(SOURCE_ICONS).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group"><label className="form-label">Job Post</label>
                                        <select className="form-control" value={candidateForm.jobPost} onChange={e => setCandidateForm({ ...candidateForm, jobPost: e.target.value })}>
                                            <option value="">Select job</option>
                                            {jobs.filter(j => j.status === 'Open').map(j => <option key={j._id} value={j._id}>{j.title}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Expected Salary (₹)</label><input type="number" className="form-control" value={candidateForm.expectedSalary} onChange={e => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Notice Period</label><input className="form-control" value={candidateForm.noticePeriod} onChange={e => setCandidateForm({ ...candidateForm, noticePeriod: e.target.value })} placeholder="e.g. 30 days" /></div>
                                </div>
                                <div className="form-group"><label className="form-label">Skills (comma-separated)</label><input className="form-control" value={candidateForm.skills} onChange={e => setCandidateForm({ ...candidateForm, skills: e.target.value })} /></div>
                            </div>
                            <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowCandidateModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Candidate</button></div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ SCHEDULE INTERVIEW MODAL ============ */}
            {schedulingCandidate && (
                <div className="modal-overlay" onClick={() => setSchedulingCandidate(null)}>
                    <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                            <h2 style={{ fontSize: '1.25rem' }}>Schedule Interview</h2>
                            <button type="button" className="btn btn-icon btn-secondary" onClick={() => setSchedulingCandidate(null)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleScheduleInterview}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>CANDIDATE</label>
                                    <input className="form-control" value={schedulingCandidate.name} disabled style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>INTERVIEWER NAME</label>
                                    <input className="form-control" placeholder="e.g. Rahul Sharma" value={interviewForm.interviewerName} onChange={e => setInterviewForm({ ...interviewForm, interviewerName: e.target.value })} required />
                                </div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>DATE</label>
                                        <input type="date" className="form-control" min={new Date().toISOString().split('T')[0]} value={interviewForm.date} onChange={e => setInterviewForm({ ...interviewForm, date: e.target.value })} required />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>TIME</label>
                                        <input type="time" className="form-control" value={interviewForm.time} onChange={e => setInterviewForm({ ...interviewForm, time: e.target.value })} required />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>DURATION (MINS)</label>
                                        <input type="number" className="form-control" value={interviewForm.duration} onChange={e => setInterviewForm({ ...interviewForm, duration: e.target.value })} required min="15" step="15" />
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>INTERVIEW TYPE</label>
                                        <select className="form-control" value={interviewForm.interviewType} onChange={e => setInterviewForm({ ...interviewForm, interviewType: e.target.value })}>
                                            <option>Video Call</option>
                                            <option>Phone Call</option>
                                            <option>In-Person</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                                        {interviewForm.interviewType === 'Phone Call' ? 'CANDIDATE PHONE NUMBER' : interviewForm.interviewType === 'In-Person' ? 'OFFICE LOCATION' : 'MEETING LINK (ZOOM/MEET)'}
                                    </label>
                                    <input
                                        type={interviewForm.interviewType === 'Video Call' ? 'url' : 'text'}
                                        className="form-control"
                                        placeholder={interviewForm.interviewType === 'Phone Call' ? 'e.g. +91 9876543210' : interviewForm.interviewType === 'In-Person' ? 'e.g. Conference Room A' : 'https://'}
                                        value={interviewForm.meetingLink}
                                        onChange={e => setInterviewForm({ ...interviewForm, meetingLink: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setSchedulingCandidate(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Schedule & Notify</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
