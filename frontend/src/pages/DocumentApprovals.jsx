import { useState, useEffect } from 'react';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { HiOutlineCheck, HiOutlineX, HiOutlineTrash, HiOutlineEye, HiOutlineSearch, HiOutlineClock } from 'react-icons/hi';

const REJECTION_REASONS = [
    "Document is not clear or visible",
    "Blurred image / poor quality",
    "Incorrect document category selected",
    "Document expired / out of date",
    "Missing signature or official stamp",
    "Not an official government document",
    "Other (please specify below)"
];

export default function DocumentApprovals() {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Pending'); // Pending, Approved, Rejected
    const [search, setSearch] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [rejectReason, setRejectReason] = useState(REJECTION_REASONS[0]);
    const [otherReason, setOtherReason] = useState('');

    const fetchAllDocs = async () => {
        try {
            const { data } = await api.get('/documents');
            setDocuments(data.data || []);
        } catch { }
        setLoading(false);
    };

    useEffect(() => {
        fetchAllDocs();
    }, []);

    const handleAction = async (id, status, reason = null) => {
        try {
            await api.put(`/documents/${id}/status`, {
                status,
                rejectionReason: status === 'Rejected' ? (reason === 'Other (please specify below)' ? otherReason : reason) : null
            });
            toast.success(`Document ${status.toLowerCase()} successfully`);
            setShowRejectModal(false);
            fetchAllDocs();
        } catch { toast.error('Operation failed'); }
    };

    const handleDelete = async (id) => {
        const res = await Swal.fire({
            title: 'Delete Document?',
            text: 'This will permanently remove the document record and file.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444'
        });
        if (!res.isConfirmed) return;
        try {
            await api.delete(`/documents/${id}`);
            toast.success('Document deleted');
            fetchAllDocs();
        } catch { }
    };

    const filteredDocs = documents.filter(doc => {
        const matchesStatus = doc.status === activeTab || (!doc.status && activeTab === 'Pending');
        const empName = `${doc.employee?.firstName} ${doc.employee?.lastName} ${doc.employee?.employeeCode}`.toLowerCase();
        const matchesSearch = empName.includes(search.toLowerCase()) || doc.name.toLowerCase().includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Document Approvals</h1>
                    <p>Manage and verify employee uploaded documents</p>
                </div>
            </div>

            {/* Tabs & Search */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="tabs" style={{ marginBottom: 0, flexWrap: 'wrap', gap: '4px', borderBottom: 'none', flex: '1 1 auto' }}>
                    {['Pending', 'Approved', 'Rejected'].map(tab => (
                        <button
                            key={tab}
                            className={`tab ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                            style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        >
                            {tab}
                            <span style={{ fontSize: 11, background: activeTab === tab ? 'var(--primary-light)' : '#f1f5f9', padding: '2px 8px', borderRadius: 10 }}>
                                {documents.filter(d => (d.status === tab || (!d.status && tab === 'Pending'))).length}
                            </span>
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: 10, border: '1px solid var(--border-color)', padding: '0 12px', flex: '1 1 250px', maxWidth: '400px' }}>
                    <HiOutlineSearch style={{ opacity: 0.5 }} />
                    <input
                        type="text"
                        placeholder="Search employee or document..."
                        style={{ border: 'none', padding: '10px 8px', outline: 'none', fontSize: 13, width: '100%' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Document List */}
            {filteredDocs.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon">
                            {activeTab === 'Pending' ? <HiOutlineClock /> : activeTab === 'Approved' ? <HiOutlineCheck /> : <HiOutlineX />}
                        </div>
                        <h3>No {activeTab.toLowerCase()} documents</h3>
                        <p>All documents in this category will appear here</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                    {filteredDocs.map(doc => (
                        <div key={doc._id} className="card" style={{ padding: '18px 24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 20 }}>
                            {/* Employee Info */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px' }}>
                                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 600, fontSize: 12, overflow: 'hidden' }}>
                                    {doc.employee?.profileImage ? <img src={doc.employee.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : doc.employee?.firstName?.charAt(0)}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{doc.employee?.firstName} {doc.employee?.lastName}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{doc.employee?.employeeCode} · {doc.employee?.department}</div>
                                </div>
                            </div>

                            {/* Document Info */}
                            <div style={{ flex: '2 1 300px' }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.name}</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                                    <span className="badge badge-primary" style={{ fontSize: 10 }}>{doc.type}</span>
                                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                                        Uploaded {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                {doc.rejectionReason && activeTab === 'Rejected' && (
                                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--danger)', background: '#fef2f2', padding: '6px 12px', borderRadius: 6, display: 'inline-block' }}>
                                        Reason: {doc.rejectionReason}
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="actions-mobile-nowrap" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className={`btn btn-sm btn-secondary ${activeTab === 'Pending' ? 'btn-mobile-full' : ''}`} title="View Document" style={{ justifyContent: 'center' }}>
                                    <HiOutlineEye style={{ marginRight: 6 }} /> View
                                </a>

                                {activeTab === 'Pending' && (
                                    <>
                                        <button className="btn btn-sm btn-primary" onClick={() => handleAction(doc._id, 'Approved')} style={{ flex: 1, minWidth: '90px', justifyContent: 'center' }}>
                                            <HiOutlineCheck style={{ marginRight: 6 }} /> Approve
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => { setSelectedDoc(doc); setShowRejectModal(true); }} style={{ flex: 1, minWidth: '80px', justifyContent: 'center' }}>
                                            <HiOutlineX style={{ marginRight: 6 }} /> Reject
                                        </button>
                                    </>
                                )}

                                <button className="btn btn-icon btn-secondary" onClick={() => handleDelete(doc._id)} title="Delete Record">
                                    <HiOutlineTrash />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header" style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <h2 style={{ color: 'var(--danger)' }}>Reject Document</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowRejectModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body" style={{ padding: '24px' }}>
                            <p style={{ marginBottom: 20, fontSize: 14 }}>
                                Please specify the reason for rejecting <strong>{selectedDoc?.name}</strong> uploaded by <strong>{selectedDoc?.employee?.firstName}</strong>.
                            </p>

                            <div className="form-group">
                                <label className="form-label">Reason for Rejection</label>
                                <select
                                    className="form-control"
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                >
                                    {REJECTION_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>

                            {rejectReason === 'Other (please specify below)' && (
                                <div className="form-group animate-slideDown">
                                    <label className="form-label">Detailed Reason</label>
                                    <textarea
                                        className="form-control"
                                        rows="3"
                                        placeholder="Write specific details here..."
                                        value={otherReason}
                                        onChange={e => setOtherReason(e.target.value)}
                                        style={{ resize: 'none' }}
                                    />
                                </div>
                            )}

                            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
                                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleAction(selectedDoc._id, 'Rejected', rejectReason)}>
                                    Confirm Rejection
                                </button>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowRejectModal(false)}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
