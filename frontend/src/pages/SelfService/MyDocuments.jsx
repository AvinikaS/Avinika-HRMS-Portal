import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineDocumentText, HiOutlineUpload, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

export default function MyDocuments() {
    const { isExEmployee } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [form16s, setForm16s] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [docName, setDocName] = useState('');
    const [docType, setDocType] = useState('');
    const [docTypes, setDocTypes] = useState([]);
    const [file, setFile] = useState(null);
    const [editingDoc, setEditingDoc] = useState(null);
    const fileRef = useRef();

    const fetchDocs = async () => {
        try {
            const [docsRes, form16Res] = await Promise.all([
                api.get('/documents/my').catch(() => ({ data: { data: [] } })),
                api.get('/payroll/form16/my').catch(() => ({ data: { data: [] } }))
            ]);
            setDocuments(docsRes.data?.data || []);
            setForm16s(form16Res.data?.data || []);
        } catch { setDocuments([]); setForm16s([]); }
        setLoading(false);
    };

    const fetchDocTypes = async () => {
        try {
            const { data } = await api.get('/document-types');
            setDocTypes(data.data || []);
        } catch { }
    };

    useEffect(() => {
        fetchDocs();
        fetchDocTypes();
    }, []);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setUploading(true);
        try {
            const payload = { name: docName, type: docType };

            if (file) {
                const { uploadToCloudinary } = await import('../../utils/cloudinaryUpload');
                const result = await uploadToCloudinary(file, 'hrms/documents');
                payload.fileUrl = result.url;
                payload.fileSize = result.size;
            }

            await api.put(`/documents/${editingDoc._id}`, payload);
            toast.success('Document updated');
            setShowModal(false);
            setEditingDoc(null);
            setDocName('');
            setDocType('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            fetchDocs();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Update failed');
        }
        setUploading(false);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (isExEmployee) {
            toast.error('Ex-employees are not permitted to upload documents.');
            return;
        }
        if (!file) return toast.error('Please select a file');
        setUploading(true);
        try {
            const { uploadToCloudinary } = await import('../../utils/cloudinaryUpload');
            const result = await uploadToCloudinary(file, 'hrms/documents');

            await api.post('/documents', {
                fileUrl: result.url,
                fileSize: result.size,
                name: docName || file.name,
                type: docType
            });
            setShowModal(false);
            setDocName('');
            setDocType('');
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
            fetchDocs();
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || 'Upload failed');
        }
        setUploading(false);
    };

    const handleDelete = async (id) => {
        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: 'Are you sure you want to delete this document?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
        if (!_swalRes.isConfirmed) return;
        try { await api.delete(`/documents/${id}`); fetchDocs(); } catch { }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const typeIcon = (type) => {
        return <HiOutlineDocumentText />;
    };


    const downloadForm16 = async (id, fy) => {
        try {
            const res = await api.get(`/payroll/form16/download/${id}?fy=${fy}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Form16_FY${fy}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) { toast.error("Error downloading Form 16"); }
    };

    return (
        <div className="animate-fadeIn">
            <style>{`
                .document-grid {
                    display: grid;
                    gap: 16px;
                    grid-template-columns: repeat(2, 1fr);
                }
                @media (max-width: 768px) {
                    .document-grid { grid-template-columns: 1fr; }
                }
            `}</style>
            <div className="page-header">
                <div><h1>My Documents</h1><p>{isExEmployee ? 'View and download your official documents' : 'Upload and manage your documents'}</p></div>
            </div>
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 16, marginBottom: 12 }}>Form 16 (Annual TDS Certificate)</h2>
                {form16s.length === 0 ? (
                    <div className="card" style={{ padding: '24px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>No Form 16 has been issued for you yet.</p>
                        <p style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>Once your employer generates and sends your Form 16, it will appear here.</p>
                    </div>
                ) : (
                    <div className="document-grid">
                        {form16s.map(f16 => (
                            <div key={f16._id} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: '4px solid var(--primary)' }}>
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>📄</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>Form 16 - FY {f16.financialYear}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                        <span className="badge badge-success" style={{ fontSize: 10, marginRight: 8 }}>Official</span>
                                        Issued {new Date(f16.sentOn || f16.generatedOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                                <button className="btn btn-sm btn-primary" onClick={() => downloadForm16(f16.employeeId, f16.financialYear)}>Download</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                <h2 style={{ fontSize: 16, margin: 0 }}>My Uploaded Documents</h2>
                {!isExEmployee && (
                    <button className="btn btn-primary" onClick={() => { setEditingDoc(null); setDocName(''); setDocType(''); setShowModal(true); }}>
                        <HiOutlineUpload /> Upload Document
                    </button>
                )}
            </div>

            {documents.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <h3>No documents uploaded</h3>
                        <p>{isExEmployee ? 'No official documents on record.' : 'Upload your ID proof, address proof, etc.'}</p>
                        {!isExEmployee && (
                            <button className="btn btn-primary" onClick={() => setShowModal(true)} style={{ marginTop: 16 }}>Upload First Document</button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="document-grid">
                    {documents.map(doc => (
                        <div key={doc._id} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'all 0.3s', border: '1px solid #f1f5f9' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                                <HiOutlineDocumentText />
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                    <span className="badge badge-primary" style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase' }}>{doc.type}</span>
                                    <span className={`badge badge-${doc.status === 'Approved' ? 'success' : doc.status === 'Rejected' ? 'danger' : 'warning'}`} style={{ fontSize: 9, textTransform: 'uppercase' }}>{doc.status || 'Pending'}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span>{formatSize(doc.fileSize)}</span>
                                    <span style={{ opacity: 0.5 }}>•</span>
                                    <span>{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                                {doc.status === 'Rejected' && doc.rejectionReason && (
                                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--danger)', background: '#fef2f2', padding: '8px 12px', borderRadius: 6, borderLeft: '3px solid var(--danger)' }}>
                                        <strong>Reason:</strong> {doc.rejectionReason}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">View</a>
                                {!isExEmployee && doc.status !== 'Approved' && (
                                    <>
                                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditingDoc(doc); setDocName(doc.name); setDocType(doc.type); setShowModal(true); }}>Edit</button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(doc._id)}><HiOutlineTrash /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>{editingDoc ? 'Edit Document' : 'Upload Document'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={editingDoc ? handleUpdate : handleUpload}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Document Name</label>
                                    <input className="form-control" placeholder="e.g. Aadhaar Card" value={docName} onChange={e => setDocName(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Document Type</label>
                                    <select className="form-control" value={docType} onChange={e => setDocType(e.target.value)} required>
                                        <option value="" disabled>Select Document Type</option>
                                        {docTypes.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{editingDoc && editingDoc.status === 'Rejected' ? 'Re-upload Correct Document *' : 'Select New File (Optional)'}</label>
                                    <input type="file" className="form-control" ref={fileRef} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx,.txt" onChange={e => setFile(e.target.files[0])} required={!editingDoc || (editingDoc && editingDoc.status === 'Rejected')} />
                                    {editingDoc && <small style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>Leave empty to keep existing file (only if not rejected)</small>}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={uploading}>
                                    {uploading ? (editingDoc ? 'Updating...' : 'Uploading...') : (editingDoc ? 'Update' : 'Upload')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
