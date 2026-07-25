import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { HiOutlineDocumentText, HiOutlineTrash, HiOutlineSearch, HiOutlineCog, HiOutlineX, HiOutlinePencil, HiOutlinePlus, HiChevronDown } from 'react-icons/hi';



export default function Documents() {
    const [employees, setEmployees] = useState([]);
    const [selectedEmp, setSelectedEmp] = useState('ALL');
    const [selectedDept, setSelectedDept] = useState('');
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('All');
    const [empSearch, setEmpSearch] = useState('');
    const [showEmpList, setShowEmpList] = useState(false);
    const [docTypes, setDocTypes] = useState([]);
    const [showTypeModal, setShowTypeModal] = useState(false);
    const [typeForm, setTypeForm] = useState({ name: '' });
    const [editingType, setEditingType] = useState(null);
    const [typeLoading, setTypeLoading] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const { data } = await api.get('/employees', { params: { limit: 500 } });
                const sorted = (data.data || []).sort((a, b) =>
                    a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)
                );
                setEmployees(sorted);
                // default is 'ALL'
            } catch { setEmployees([]); }
            setLoading(false);
        };
        fetchEmployees();
        fetchDocTypes();
    }, []);

    const fetchDocTypes = async () => {
        try {
            const { data } = await api.get('/document-types');
            setDocTypes(data.data || []);
        } catch { }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowEmpList(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!selectedEmp) return;
        const fetchDocs = async () => {
            try {
                const url = selectedEmp === 'ALL' ? '/documents' : `/documents/${selectedEmp}`;
                const { data } = await api.get(url);
                setDocuments(data.data || []);
            } catch { setDocuments([]); }
        };
        fetchDocs();
    }, [selectedEmp]);

    const handleDelete = async (id) => {
        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: 'Delete this document?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
        if (!_swalRes.isConfirmed) return;
        try { await api.delete(`/documents/${id}`); setDocuments(prev => prev.filter(d => d._id !== id)); } catch { }
    };

    const formatSize = (bytes) => {
        if (!bytes) return '-';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const typeIcon = (type) => { return <HiOutlineDocumentText />; };

    const filteredDocs = documents.filter(d => {
        const matchesType = filterType === 'All' || d.type === filterType;
        const isApproved = d.status === 'Approved';
        return matchesType && isApproved;
    });
    const currentEmp = selectedEmp === 'ALL' ? null : employees.find(e => e._id === selectedEmp);

    const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];

    const filteredEmployees = employees.filter(emp => {
        const matchSearch = `${emp.firstName} ${emp.lastName} ${emp.employeeCode}`.toLowerCase().includes(empSearch.toLowerCase());
        const matchDept = selectedDept ? emp.department === selectedDept : true;
        return matchSearch && matchDept;
    });

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Documents</h1><p>View and manage employee documents</p></div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Department Dropdown */}
                <select className="form-control" value={selectedDept} onChange={e => { setSelectedDept(e.target.value); setSelectedEmp('ALL'); }} style={{ flex: '1 1 200px', marginBottom: 0, height: 42 }}>
                    <option value="">All Departments</option>
                    {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                </select>
                {/* Searchable Custom Dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative', flex: '1 1 250px' }}>
                    <div
                        className="form-control"
                        onClick={() => setShowEmpList(!showEmpList)}
                        style={{
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'var(--bg-secondary)',
                            height: 42,
                            borderColor: showEmpList ? 'var(--primary)' : 'var(--border-color)',
                            boxShadow: showEmpList ? '0 0 0 2px var(--primary-light)' : 'none'
                        }}
                    >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>
                            {selectedEmp === 'ALL' ? 'All Employees' : (currentEmp ? `${currentEmp.firstName} ${currentEmp.lastName}` : 'Select Employee')}
                        </span>
                        <HiChevronDown style={{ opacity: 0.5, transform: showEmpList ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </div>

                    {showEmpList && (
                        <div style={{
                            position: 'absolute',
                            top: '105%',
                            left: 0,
                            right: 0,
                            background: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: 10,
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 1000,
                            padding: 8,
                            maxHeight: 400,
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ padding: '4px 4px 8px' }}>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Type to search..."
                                    autoFocus
                                    value={empSearch}
                                    onChange={e => setEmpSearch(e.target.value)}
                                    style={{ marginBottom: 0, height: 36, fontSize: 13 }}
                                />
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                <div
                                    onClick={() => { setSelectedEmp('ALL'); setShowEmpList(false); setEmpSearch(''); }}
                                    style={{
                                        padding: '10px 12px',
                                        cursor: 'pointer',
                                        borderRadius: 6,
                                        fontSize: 13.5,
                                        background: selectedEmp === 'ALL' ? 'var(--primary-light)' : 'transparent',
                                        fontWeight: selectedEmp === 'ALL' ? 600 : 400,
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10
                                    }}
                                    onMouseOver={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                    onMouseOut={e => e.currentTarget.style.background = selectedEmp === 'ALL' ? 'var(--primary-light)' : 'transparent'}
                                >
                                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--text-tertiary)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                                        All
                                    </div>
                                    <span>All Employees</span>
                                </div>
                                {filteredEmployees.length === 0 ? (
                                    <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)' }}>No results found</div>
                                ) : filteredEmployees.map(emp => (
                                    <div
                                        key={emp._id}
                                        onClick={() => { setSelectedEmp(emp._id); setShowEmpList(false); setEmpSearch(''); }}
                                        style={{
                                            padding: '10px 12px',
                                            cursor: 'pointer',
                                            borderRadius: 6,
                                            fontSize: 13.5,
                                            background: selectedEmp === emp._id ? 'var(--primary-light)' : 'transparent',
                                            fontWeight: selectedEmp === emp._id ? 600 : 400,
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseOver={e => e.currentTarget.style.background = 'var(--primary-light)'}
                                        onMouseOut={e => e.currentTarget.style.background = selectedEmp === emp._id ? 'var(--primary-light)' : 'transparent'}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary-gradient)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0, overflow: 'hidden' }}>
                                                {emp.profileImage ? <img src={emp.profileImage} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : emp.firstName.charAt(0)}
                                            </div>
                                            <span>{emp.firstName} {emp.lastName}</span>
                                            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.5 }}>{emp.employeeCode}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 200px' }}>
                    <select className="form-control" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ flex: 1, marginBottom: 0, height: 42 }}>
                        <option value="All">All Types</option>
                        {docTypes.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                    </select>
                    <button className="btn btn-icon btn-secondary" onClick={() => setShowTypeModal(true)} title="Manage Types" style={{ width: 42, height: 42 }}>
                        <HiOutlineCog />
                    </button>
                </div>
            </div>

            {currentEmp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '14px 18px', background: 'var(--primary-light)', borderRadius: 10 }}>
                    <div className="avatar" style={{ background: 'var(--primary-gradient)', overflow: 'hidden' }}>
                        {currentEmp.profileImage ? (
                            <img src={currentEmp.profileImage} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <>{currentEmp.firstName?.charAt(0)}{currentEmp.lastName?.charAt(0)}</>
                        )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{currentEmp.firstName} {currentEmp.lastName}</div>
                        <div style={{ fontSize: 12, color: 'black' }}>{currentEmp.employeeCode} · {currentEmp.department} · {currentEmp.designation}</div>
                    </div>
                    <span className="badge badge-info" style={{ marginLeft: 'auto' }}>{documents.length} document{documents.length !== 1 ? 's' : ''}</span>
                </div>
            )}

            {!selectedEmp ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon"><HiOutlineSearch /></div>
                        <h3>Select an employee</h3>
                        <p>Choose an employee from the dropdown above to view their documents</p>
                    </div>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="card">
                    <div className="empty-state">
                        <div className="empty-icon">📂</div>
                        <h3>No documents found</h3>
                        <p>{filterType !== 'All' ? `No ${filterType} documents for this employee` : 'This employee has not uploaded any documents yet'}</p>
                    </div>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))' }}>
                    {filteredDocs.map(doc => (
                        <div key={doc._id} className="card" style={{ padding: '20px', display: 'flex', alignItems: 'flex-start', gap: 16, transition: 'all 0.3s', border: '1px solid #f1f5f9' }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                                {typeIcon(doc.type)}
                            </div>
                            <div style={{ flex: 1, overflow: 'hidden' }}>
                                {selectedEmp === 'ALL' && doc.employee && (
                                    <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {doc.employee.firstName} {doc.employee.lastName} ({doc.employee.employeeCode})
                                    </div>
                                )}
                                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.name}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                    <span className="badge badge-primary" style={{ fontSize: 9, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{doc.type}</span>
                                    <span className="badge badge-success" style={{ fontSize: 9, textTransform: 'uppercase' }}>{doc.status || 'Approved'}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span>{formatSize(doc.fileSize)}</span>
                                    <span style={{ opacity: 0.5 }}>•</span>
                                    <span>{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {doc.status !== 'Approved' && (
                                    <button className="btn btn-sm btn-primary" onClick={async () => {
                                        try {
                                            await api.put(`/documents/${doc._id}/status`, { status: 'Approved' });
                                            toast.success('Document approved');
                                            setDocuments(prev => prev.map(d => d._id === doc._id ? { ...d, status: 'Approved' } : d));
                                        } catch { toast.error('Approval failed'); }
                                    }}>Approve</button>
                                )}
                                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-secondary">View</a>
                                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(doc._id)} title="Delete Document"><HiOutlineTrash /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Document Type Management Modal */}
            {showTypeModal && (
                <div className="modal-overlay" onClick={() => { setShowTypeModal(false); setEditingType(null); setTypeForm({ name: '' }); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Manage Document Types</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => { setShowTypeModal(false); setEditingType(null); setTypeForm({ name: '' }); }}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setTypeLoading(true);
                                try {
                                    if (editingType) {
                                        await api.put(`/document-types/${editingType._id}`, typeForm);
                                    } else {
                                        await api.post('/document-types', typeForm);
                                    }
                                    setTypeForm({ name: '' });
                                    setEditingType(null);
                                    fetchDocTypes();
                                } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
                                setTypeLoading(false);
                            }} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Type Name</label>
                                    <input type="text" className="form-control" value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} required placeholder="e.g. Vaccination Certificate" />
                                </div>

                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button type="submit" className="btn btn-primary" disabled={typeLoading} style={{ flex: 1 }}>
                                        {editingType ? 'Update Type' : 'Add Type'}
                                    </button>
                                    {editingType && (
                                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingType(null); setTypeForm({ name: '' }); }}>Cancel</button>
                                    )}
                                </div>
                            </form>

                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: 10, fontSize: 12 }}>Type</th>
                                            <th style={{ padding: 10, fontSize: 12, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {docTypes.length === 0 ? (
                                            <tr><td colSpan="2" style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No types added yet.</td></tr>
                                        ) : docTypes.map(t => (
                                            <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: 10, fontWeight: 600 }}>{t.name}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingType(t); setTypeForm({ name: t.name }); }} style={{ marginRight: 6, fontSize: 10 }}>
                                                        <HiOutlinePencil size={12} style={{ marginRight: 4 }} /> Edit
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: `Delete "${t.name}" type?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
                                                        if (!_swalRes.isConfirmed) return;
                                                        try { await api.delete(`/document-types/${t._id}`); fetchDocTypes(); } catch { }
                                                    }} style={{ color: '#ef4444', fontSize: 10 }}>
                                                        <HiOutlineTrash size={12} style={{ marginRight: 4 }} /> Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
