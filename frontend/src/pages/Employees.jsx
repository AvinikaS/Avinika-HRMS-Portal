import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { HiOutlineSearch, HiOutlinePlus, HiOutlineCog, HiOutlineDownload } from 'react-icons/hi';
import { FaEye, FaPencilAlt, FaTrash, FaTimes } from 'react-icons/fa';
import EmployeeWizard from '../components/EmployeeWizard';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

export default function Employees() {
    const [employees, setEmployees] = useState([]);
    const [search, setSearch] = useState('');
    const [filterDept, setFilterDept] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [wizardInitialData, setWizardInitialData] = useState(null);
    const [viewEmp, setViewEmp] = useState(null);
    const [editingEmpId, setEditingEmpId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [depts, setDepts] = useState([]);
    const [showDeptModal, setShowDeptModal] = useState(false);
    const [deptForm, setDeptForm] = useState({ name: '' });
    const [editingDept, setEditingDept] = useState(null);
    const [deptLoading, setDeptLoading] = useState(false);
    const [form, setForm] = useState({
        firstName: '', lastName: '', email: '', phone: '', department: '',
        designation: '', dateOfJoining: '', dateOfBirth: '', gender: '', employmentType: 'Full-Time',
        aadhaar: '', salary: {
            basic: 0,
            hra: 0,
            allowances: { travel: 0, food: 0, other: 0 },
            bonus: 0,
            pfPercentage: 12,
            taxSlabApplicable: true
        }
    });

    const fetchEmployees = async () => {
        try {
            const params = { limit: 5000 };
            if (search) params.search = search;
            if (filterDept) params.department = filterDept;
            const { data } = await api.get('/employees', { params });
            setEmployees(data.data || []);
        } catch {
            setEmployees([]);
        }
        setLoading(false);
    };

    const fetchDepts = async () => {
        try {
            const { data } = await api.get('/departments');
            setDepts(data.data || []);
        } catch (err) {
            console.error('Error fetching departments:', err);
        }
    };

    useEffect(() => {
        fetchEmployees();
        fetchDepts();
    }, [search, filterDept]);

    useEffect(() => {
        if (showDeptModal) fetchDepts();
    }, [showDeptModal]);

    const handleEdit = (emp) => {
        setWizardInitialData(emp);
        setShowWizard(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingEmpId) {
                await api.put(`/employees/${editingEmpId}`, form);
            } else {
                await api.post('/employees', form);
            }
            setShowModal(false);
            setEditingEmpId(null);
            setForm({
                firstName: '', lastName: '', email: '', phone: '', department: '',
                designation: '', dateOfJoining: '', dateOfBirth: '', gender: '', employmentType: 'Full-Time',
                aadhaar: '', salary: { basic: 0, hra: 0, allowances: { travel: 0, food: 0, other: 0 }, bonus: 0, pfPercentage: 12, taxSlabApplicable: true }
            });
            fetchEmployees();
        } catch (err) { toast.error(err.response?.data?.message || 'Error processing request'); }
    };

    const handleDelete = async (id) => {
        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: 'Are you sure you want to deactivate this employee?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
        if (!_swalRes.isConfirmed) return;
        try { await api.delete(`/employees/${id}`); fetchEmployees(); } catch { }
    };

    const statusBadge = (s) => {
        const map = { Active: 'badge-success', Inactive: 'badge-neutral', 'On Notice': 'badge-warning', Terminated: 'badge-danger', Resigned: 'badge-danger' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    const handleExportExcel = () => {
        if (!employees || employees.length === 0) {
            toast.error('No employee data available to export.');
            return;
        }

        const headers = [
            'Employee Code', 'First Name', 'Last Name', 'Email', 'Phone', 'Gender',
            'Department', 'Designation', 'Employment Type', 'Status', 'Date of Joining', 'Date of Birth',
            'Aadhaar Number', 'Basic Salary', 'HRA', 'Travel Allowance', 'Food Allowance', 'Other Allowance',
            'Gross Salary', 'PF Percentage', 'Tax Slab Enabled'
        ];

        const generateRow = (emp) => {
            const b = emp.salary?.basic || 0;
            const h = emp.salary?.hra || 0;
            const t = emp.salary?.allowances?.travel || 0;
            const f = emp.salary?.allowances?.food || 0;
            const o = emp.salary?.allowances?.other || 0;
            const gross = b + h + t + f + o;

            return [
                emp.employeeCode || '',
                emp.firstName || '',
                emp.lastName || '',
                emp.email || '',
                emp.phone || '',
                emp.gender || '',
                emp.department || '',
                emp.designation || '',
                emp.employmentType || '',
                emp.status || '',
                emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString() : '',
                emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : '',
                emp.aadhaar || '',
                b, h, t, f, o, gross,
                emp.salary?.pfPercentage || 0,
                emp.salary?.taxSlabApplicable ? 'Yes' : 'No'
            ];
        };

        const wb = XLSX.utils.book_new();

        if (!filterDept) {
            // "All Departments" is selected -> Create multiple sheets
            const grouped = employees.reduce((acc, emp) => {
                const dName = emp.department || 'Unassigned';
                if (!acc[dName]) acc[dName] = [];
                acc[dName].push(emp);
                return acc;
            }, {});

            Object.keys(grouped).forEach(deptName => {
                const rows = grouped[deptName].map(generateRow);
                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                const sheetName = deptName.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '');
                XLSX.utils.book_append_sheet(wb, ws, sheetName);
            });
            XLSX.writeFile(wb, `Employees_All_Departments.xlsx`);
        } else {
            // A specific department is filtered -> Create single sheet
            const rows = employees.map(generateRow);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            const sheetName = filterDept.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '');
            XLSX.utils.book_append_sheet(wb, ws, sheetName || "Employees");
            XLSX.writeFile(wb, `Employees_${filterDept.replace(/\s+/g, '_')}_Export.xlsx`);
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Employees</h1><p>Manage your organization's workforce</p></div>
                <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-secondary" onClick={handleExportExcel}>
                        <HiOutlineDownload /> Export Excel
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                        setWizardInitialData(null);
                        setShowWizard(true);
                    }}><HiOutlinePlus /> Add Employee</button>
                </div>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <h3>{employees.length} Employees</h3>
                    <div className="table-actions">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select className="form-control emp-dept-select" value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ width: 160, padding: '8px 32px 8px 12px' }}>
                                <option value="">All Departments</option>
                                {depts.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                            </select>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowDeptModal(true)} title="Manage Departments">
                                <HiOutlineCog />
                            </button>
                        </div>
                        <input className="search-input" placeholder="Search employees..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                </div>
                {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Employee</th><th>Code</th><th>Department</th><th>Designation</th><th>Type</th><th>PF Type</th><th>Status</th><th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {employees.length === 0 ? (
                                    <tr><td colSpan="7"><div className="empty-state"><div className="empty-icon">👥</div><h3>No employees found</h3><p>Add your first employee to get started</p></div></td></tr>
                                ) : employees.map((emp, i) => (
                                    <tr key={emp._id}>
                                        <td style={{ maxWidth: 200, minWidth: 140 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                {emp.profileImage ? (
                                                    <img src={emp.profileImage} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)', flexShrink: 0 }} />
                                                ) : (
                                                    <div className="avatar" style={{ background: COLORS[i % COLORS.length], flexShrink: 0 }}>
                                                        {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                                                    </div>
                                                )}
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.firstName} {emp.lastName}</div>
                                                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.4 }}>{emp.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span style={{ fontWeight: 600, color: 'var(--primary)' }}>{emp.employeeCode}</span></td>
                                        <td>{emp.department}</td>
                                        <td>{emp.designation}</td>
                                        <td><span className="badge badge-info">{emp.employmentType}</span></td>
                                        <td>
                                            {(!emp.pfCalculationType || emp.pfCalculationType === 'actual_wage') ? <span className="badge badge-success">Actual Wage</span> :
                                                emp.pfCalculationType === 'pf_ceiling' ? <span className="badge badge-warning">Ceiling ₹15k</span> :
                                                    <span className="badge badge-secondary">Not Applicable</span>}
                                        </td>
                                        <td>{statusBadge(emp.status)}</td>
                                        <td style={{ whiteSpace: 'nowrap' }}>
                                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                <button className="btn btn-icon btn-secondary" onClick={() => setViewEmp(emp)} title="View Employee" style={{ width: 32, height: 32, minWidth: 32, flexShrink: 0, border: '1px solid #4f46e5', backgroundColor: '#eef2ff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaEye size={14} color="#4f46e5" /></button>
                                                <button className="btn btn-icon btn-secondary" onClick={() => handleEdit(emp)} title="Edit Employee" style={{ width: 32, height: 32, minWidth: 32, flexShrink: 0, border: '1px solid #d97706', backgroundColor: '#fffbeb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaPencilAlt size={13} color="#d97706" /></button>
                                                <button className="btn btn-icon btn-secondary" onClick={() => handleDelete(emp._id)} title="Deactivate" style={{ width: 32, height: 32, minWidth: 32, flexShrink: 0, border: '1px solid #ef4444', backgroundColor: '#fef2f2', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><FaTrash size={13} color="#ef4444" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Employee Modal */}
            {showWizard && (
                <EmployeeWizard initialData={wizardInitialData}
                    onClose={() => setShowWizard(false)}
                    onSuccess={(newEmp) => {
                        setShowWizard(false);
                        fetchEmployees();
                    }}
                />
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
                        <div className="modal-header">
                            <h2>{editingEmpId ? 'Edit Employee' : 'Add New Employee'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)} style={{ width: 32, height: 32, border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32 }}><FaTimes size={15} style={{ color: '#475569' }} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">First Name *</label>
                                        <input className="form-control" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Last Name *</label>
                                        <input className="form-control" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Email *</label>
                                        <input type="email" className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Phone *</label>
                                        <input className="form-control" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Department *</label>
                                        <select className="form-control" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} required>
                                            <option value="">Select</option>
                                            {depts.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Designation *</label>
                                        <input className="form-control" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Date of Joining *</label>
                                        <input type="date" className="form-control" value={form.dateOfJoining} onChange={e => setForm({ ...form, dateOfJoining: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Date of Birth *</label>
                                        <input type="date" className="form-control" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Gender</label>
                                        <select className="form-control" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                                            <option value="">Select</option>
                                            <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Aadhaar Number</label>
                                        <input className="form-control" value={form.aadhaar} onChange={e => setForm({ ...form, aadhaar: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Employment Type</label>
                                        <select className="form-control" value={form.employmentType} onChange={e => setForm({ ...form, employmentType: e.target.value })}>
                                            <option value="Full-Time">Full-Time</option><option value="Part-Time">Part-Time</option><option value="Contract">Contract</option><option value="Intern">Intern</option>
                                        </select>
                                    </div>
                                </div>
                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: '20px 0 12px' }}>Salary Structure (Monthly)</h3>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Basic</label><input type="number" className="form-control" value={form.salary.basic} onChange={e => setForm({ ...form, salary: { ...form.salary, basic: +e.target.value } })} /></div>
                                    <div className="form-group"><label className="form-label">HRA</label><input type="number" className="form-control" value={form.salary.hra} onChange={e => setForm({ ...form, salary: { ...form.salary, hra: +e.target.value } })} /></div>
                                    <div className="form-group"><label className="form-label">PF (%)</label><input type="number" className="form-control" value={form.salary.pfPercentage} onChange={e => setForm({ ...form, salary: { ...form.salary, pfPercentage: +e.target.value } })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Travel Allow.</label><input type="number" className="form-control" value={form.salary.allowances.travel} onChange={e => setForm({ ...form, salary: { ...form.salary, allowances: { ...form.salary.allowances, travel: +e.target.value } } })} /></div>
                                    <div className="form-group"><label className="form-label">Food Allow.</label><input type="number" className="form-control" value={form.salary.allowances.food} onChange={e => setForm({ ...form, salary: { ...form.salary, allowances: { ...form.salary.allowances, food: +e.target.value } } })} /></div>
                                    <div className="form-group"><label className="form-label">Bonus</label><input type="number" className="form-control" value={form.salary.bonus} onChange={e => setForm({ ...form, salary: { ...form.salary, bonus: +e.target.value } })} /></div>
                                </div>
                                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <input type="checkbox" id="taxSlab" checked={form.salary.taxSlabApplicable} onChange={e => setForm({ ...form, salary: { ...form.salary, taxSlabApplicable: e.target.checked } })} />
                                    <label htmlFor="taxSlab" className="form-label" style={{ marginBottom: 0 }}>Apply Indian Tax Slabs (TDS)</label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingEmpId ? 'Save Changes' : 'Create Employee'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Employee Detail Modal */}
            {viewEmp && (
                <div className="modal-overlay" onClick={() => { setViewEmp(null); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
                        <div className="modal-header">
                            <h2>Employee Details</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => { setViewEmp(null); }} style={{ width: 32, height: 32, border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32 }}><FaTimes size={15} style={{ color: '#475569' }} /></button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                                <div>
                                    {viewEmp.profileImage ? (
                                        <img src={viewEmp.profileImage} alt="Profile"
                                            style={{
                                                width: 72, height: 72, borderRadius: '50%', objectFit: 'cover',
                                                border: '3px solid var(--primary)', boxShadow: '0 4px 16px rgba(79,70,229,0.2)'
                                            }} />
                                    ) : (
                                        <div className="avatar avatar-lg" style={{ background: 'var(--primary-gradient)', width: 72, height: 72 }}>
                                            {viewEmp.firstName?.charAt(0)}{viewEmp.lastName?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h3 style={{ fontSize: 20, fontWeight: 700 }}>{viewEmp.firstName} {viewEmp.lastName}</h3>
                                    <p style={{ color: 'var(--text-tertiary)' }}>{viewEmp.designation} · {viewEmp.department}</p>
                                </div>
                            </div>
                            <div className="grid-2">
                                {[
                                    ['Employee Code', viewEmp.employeeCode],
                                    ['Email', viewEmp.email],
                                    ['Phone', viewEmp.phone],
                                    ['Gender', viewEmp.gender],
                                    ['Employment Type', viewEmp.employmentType],
                                    ['Status', viewEmp.status],
                                    ['Date of Joining', viewEmp.dateOfJoining ? new Date(viewEmp.dateOfJoining).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'],
                                    ['Date of Birth', viewEmp.dateOfBirth ? new Date(viewEmp.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'],
                                    ['Aadhaar', viewEmp.aadhaar || '-'],
                                ].map(([label, val], i) => (
                                    <div key={i} style={{ marginBottom: 12 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{label}</div>
                                        <div style={{ fontSize: 14, fontWeight: 500, marginTop: 2 }}>{val}</div>
                                    </div>
                                ))}
                            </div>

                            {/* NEW FLAT SALARY STRUCTURE */}
                            <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
                                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 16 }}>Monthly Salary Structure</h4>
                                <div className="grid-3" style={{ gap: '15px' }}>
                                    <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>BASIC</div><div style={{ fontWeight: 600 }}>₹{viewEmp.basic || viewEmp.salary?.basic || 0}</div></div>
                                    <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>HRA</div><div style={{ fontWeight: 600 }}>₹{viewEmp.hra || viewEmp.salary?.hra || 0}</div></div>
                                    <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Gross</div><div style={{ fontWeight: 600 }}>₹{viewEmp.gross || 0}</div></div>
                                    <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>PF / ESIC (Ded)</div><div style={{ fontWeight: 600 }}>₹{(viewEmp.pfEmployee || 0) + (viewEmp.esicEmployee || 0)}</div></div>
                                    <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>TDS (Monthly)</div><div style={{ fontWeight: 600 }}>₹{viewEmp.tds || 0}</div></div>
                                    <div><div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Net Salary</div><div style={{ fontWeight: 600, color: 'var(--success)' }}>₹{viewEmp.netSalary || 0}</div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Department Management Modal */}
            {showDeptModal && (
                <div className="modal-overlay" onClick={() => { setShowDeptModal(false); setEditingDept(null); setDeptForm({ name: '' }); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h2>Manage Departments</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => { setShowDeptModal(false); setEditingDept(null); setDeptForm({ name: '' }); }} style={{ width: 32, height: 32, border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32 }}><FaTimes size={15} style={{ color: '#475569' }} /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setDeptLoading(true);
                                try {
                                    if (editingDept) {
                                        await api.put(`/departments/${editingDept._id}`, deptForm);
                                    } else {
                                        await api.post('/departments', deptForm);
                                    }
                                    setDeptForm({ name: '' });
                                    setEditingDept(null);
                                    fetchDepts();
                                } catch (err) { toast.error(err.response?.data?.message || 'Operation failed'); }
                                setDeptLoading(false);
                            }} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Department Name</label>
                                    <input className="form-control" value={deptForm.name} onChange={e => setDeptForm({ ...deptForm, name: e.target.value })} required placeholder="e.g. Finance" />
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button type="submit" className="btn btn-primary" disabled={deptLoading} style={{ flex: 1 }}>
                                        {editingDept ? 'Update Department' : 'Add Department'}
                                    </button>
                                    {editingDept && (
                                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingDept(null); setDeptForm({ name: '' }); }}>Cancel</button>
                                    )}
                                </div>
                            </form>

                            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 'auto' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: 10, fontSize: 12, width: '65%' }}>Name</th>
                                            <th style={{ padding: 10, fontSize: 12, textAlign: 'right', width: '35%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {depts.length === 0 ? (
                                            <tr>
                                                <td colSpan="2" style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                                                    No departments added yet.
                                                </td>
                                            </tr>
                                        ) : depts.map(d => (
                                            <tr key={d._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: 10, width: '65%', wordBreak: 'break-word' }}>
                                                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                                                </td>
                                                <td style={{ padding: 10, textAlign: 'right', width: '35%' }}>
                                                    <button type="button" className="btn btn-icon btn-secondary btn-sm" onClick={() => { setEditingDept(d); setDeptForm({ name: d.name }); }} style={{ marginRight: 6, width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Edit"><FaPencilAlt size={12} style={{ color: 'var(--text-secondary)' }} /></button>
                                                    <button type="button" className="btn btn-icon btn-secondary btn-sm" onClick={async () => {
                                                        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: `Delete ${d.name} department?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
                                                        if (!_swalRes.isConfirmed) return;
                                                        try {
                                                            await api.delete(`/departments/${d._id}`);
                                                            fetchDepts();
                                                            if (filterDept === d.name) setFilterDept('');
                                                        } catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
                                                    }} style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title="Delete"><FaTrash size={12} style={{ color: '#ef4444' }} /></button>
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
