import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../../utils/api';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX, HiOutlineDownload, HiOutlineCheck } from 'react-icons/hi';
import EmployeeSelect from '../../components/EmployeeSelect';
import { useYearManager, YearManagerModal, YearSelectDropdown } from '../../components/YearManagerModal';
import * as XLSX from 'xlsx';

export default function BonusModule() {
    const [bonuses, setBonuses] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState('');

    // Page level filters
    const [filterDept, setFilterDept] = useState('');
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const { years, showYearModal, setShowYearModal, fetchYears } = useYearManager();

    const [formData, setFormData] = useState({ employee: '', bonusType: '', amount: '', month: new Date().getMonth() + 1, financialYear: new Date().getFullYear().toString(), remarks: '' });
    const [editingId, setEditingId] = useState(null);
    const [isBulk, setIsBulk] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedTableIds, setSelectedTableIds] = useState([]);

    const [departments, setDepartments] = useState([]);
    const filteredEmployees = selectedDept ? employees.filter(e => e.department === selectedDept) : employees;

    const displayBonuses = bonuses.filter(b => {
        if (filterDept && b.employee?.department !== filterDept) return false;
        if (filterMonth && b.month !== Number(filterMonth)) return false;
        if (filterYear && b.financialYear?.toString() !== filterYear.toString()) return false;
        return true;
    });

    const fetchBonuses = async () => {
        try {
            const { data } = await api.get('/bonus');
            setBonuses(data.data || []);
        } catch { }
        setLoading(false);
    };

    const fetchEmployees = async () => {
        try {
            const { data } = await api.get('/employees?limit=1000');
            setEmployees(Array.isArray(data.data) ? data.data : []);
        } catch { }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/departments');
            setDepartments((data.data || []).map(d => d.name));
        } catch { }
    };

    useEffect(() => {
        fetchBonuses();
        fetchEmployees();
        fetchDepartments();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (isBulk) {
                await api.post('/bonus/bulk', { ...formData, employeeIds: selectedEmployees });
                toast.success('Bulk bonus added successfully');
            } else if (editingId) {
                await api.put(`/bonus/${editingId}`, formData);
                toast.success('Bonus updated successfully');
            } else {
                await api.post('/bonus', formData);
                toast.success('Bonus added successfully');
            }
            setShowModal(false);
            fetchBonuses();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving bonus');
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await api.put(`/bonus/${id}/status`, { status });
            toast.success(`Bonus marked as ${status}`);
            fetchBonuses();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async (id) => {
        const res = await Swal.fire({ title: 'Delete Component?', text: "You can't revert this!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444' });
        if (res.isConfirmed) {
            try {
                await api.delete(`/bonus/${id}`);
                fetchBonuses();
            } catch (err) { toast.error(err.response?.data?.message || 'Failed to delete'); }
        }
    };

    const handleBulkTableAction = async (action) => {
        if (!selectedTableIds.length) return;
        const res = await Swal.fire({ title: `${action} Selected?`, text: `Are you sure you want to ${action.toLowerCase()} ${selectedTableIds.length} records?`, icon: 'warning', showCancelButton: true, confirmButtonColor: action === 'Delete' ? '#ef4444' : '#10b981' });
        if (res.isConfirmed) {
            try {
                await api.post('/bonus/bulk-action', { ids: selectedTableIds, action });
                toast.success(`Bulk ${action} successful`);
                setSelectedTableIds([]);
                fetchBonuses();
            } catch (err) { toast.error('Bulk action failed'); }
        }
    };

    const openModal = (b = null) => {
        if (b) {
            const empObj = employees.find(e => e._id === b.employee._id);
            setSelectedDept(empObj?.department || '');
            setFormData({ employee: b.employee._id, bonusType: b.bonusType, amount: b.amount, month: b.month, financialYear: b.financialYear, remarks: b.remarks || '' });
            setEditingId(b._id);
            setIsBulk(false);
        } else {
            setSelectedDept('');
            setFormData({ employee: '', bonusType: '', amount: '', month: new Date().getMonth() + 1, financialYear: new Date().getFullYear().toString(), remarks: '' });
            setEditingId(null);
            setIsBulk(false);
            setSelectedEmployees([]);
        }
        setShowModal(true);
    };

    const handleExportExcel = () => {
        if (!displayBonuses.length) {
            toast.error('No data to export for this selection.');
            return;
        }
        const headers = ['Employee Code', 'Employee Name', 'Department', 'Bonus Type', 'Amount', 'Target Month', 'Financial Year', 'Remarks', 'Status'];
        const wb = XLSX.utils.book_new();

        const buildRow = b => [
            b.employee?.employeeCode || '',
            `${b.employee?.firstName || ''} ${b.employee?.lastName || ''}`.trim(),
            b.employee?.department || '',
            b.bonusType,
            b.amount,
            new Date(0, b.month - 1).toLocaleString('default', { month: 'short' }),
            b.financialYear,
            b.remarks || '',
            b.status
        ];

        // 1. Always create a master sheet
        const allRows = displayBonuses.map(buildRow);
        const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
        XLSX.utils.book_append_sheet(wb, wsAll, filterDept ? filterDept.substring(0, 31) : 'All Bonuses');

        // 2. If 'All Departments' selected, create extra department-wise sheets
        if (!filterDept) {
            const byDept = {};
            displayBonuses.forEach(b => {
                const d = b.employee?.department || 'Unassigned';
                if (!byDept[d]) byDept[d] = [];
                byDept[d].push(b);
            });
            Object.keys(byDept).sort().forEach(dept => {
                const deptRows = byDept[dept].map(buildRow);
                const ws = XLSX.utils.aoa_to_sheet([headers, ...deptRows]);
                XLSX.utils.book_append_sheet(wb, ws, dept.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '') || 'Unassigned');
            });
        }

        XLSX.writeFile(wb, `Bonuses_Report.xlsx`);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Bonus Master</h1>
                    <p>Manage employee bonuses that integrate automatically with payroll</p>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="form-control" style={{ width: 170 }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                        <option value="">All Departments</option>
                        {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                    </select>
                    <select className="form-control" style={{ width: 140 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                        <option value="">All Months</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'short' })}</option>)}
                    </select>
                    <YearSelectDropdown value={filterYear} onChange={setFilterYear} years={years} setShowYearModal={setShowYearModal} />
                    <button className="btn btn-secondary" onClick={handleExportExcel} title="Download Excel">
                        <HiOutlineDownload /> Export
                    </button>
                    <button className="btn btn-primary" onClick={() => openModal()}><HiOutlinePlus /> Add Bonus</button>
                </div>
            </div>

            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                {loading ? <div style={{ padding: 20 }}>Loading...</div> : (
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: '30px' }}>
                                    <input type="checkbox" checked={selectedTableIds.length > 0 && selectedTableIds.length === displayBonuses.filter(b => b.status === 'Pending').length} onChange={(e) => {
                                        if (e.target.checked) setSelectedTableIds(displayBonuses.filter(b => b.status === 'Pending').map(b => b._id));
                                        else setSelectedTableIds([]);
                                    }} />
                                </th>
                                <th>Employee</th>
                                <th>Bonus Type</th>
                                <th>Amount</th>
                                <th>Month/Year</th>
                                <th>Remarks</th>
                                <th>Status</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayBonuses.length === 0 ? <tr><td colSpan="8" style={{ textAlign: 'center', padding: 20 }}>No bonus records found</td></tr> : displayBonuses.map(b => (
                                <tr key={b._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        {b.status === 'Pending' && (
                                            <input type="checkbox" checked={selectedTableIds.includes(b._id)} onChange={(e) => {
                                                if (e.target.checked) setSelectedTableIds([...selectedTableIds, b._id]);
                                                else setSelectedTableIds(selectedTableIds.filter(id => id !== b._id));
                                            }} />
                                        )}
                                    </td>
                                    <td style={{ minWidth: 150 }}>
                                        <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.employee?.firstName} {b.employee?.lastName}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{b.employee?.employeeCode}</div>
                                    </td>
                                    <td>{b.bonusType}</td>
                                    <td style={{ fontWeight: 600 }}>₹{b.amount.toLocaleString('en-IN')}</td>
                                    <td>{new Date(0, b.month - 1).toLocaleString('default', { month: 'short' })} {b.financialYear}</td>
                                    <td style={{ minWidth: 100 }}>
                                        {b.remarks ? (
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => Swal.fire({ title: 'Remark', text: b.remarks, confirmButtonColor: '#4f46e5' })}
                                                style={{ padding: '2px 8px', fontSize: '11px', minHeight: '24px' }}
                                            >
                                                View
                                            </button>
                                        ) : (
                                            <span style={{ color: 'var(--text-tertiary)' }}>-</span>
                                        )}
                                    </td>
                                    <td><span className={`badge ${b.status === 'Approved' ? 'badge-success' : 'badge-warning'}`}>{b.status}</span></td>
                                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: '120px' }}>
                                        {b.status === 'Pending' ? (
                                            <>
                                                <button className="btn btn-sm" style={{ padding: '4px 8px', fontSize: '11px', background: '#10b981', color: 'white', marginRight: 4 }} onClick={() => handleUpdateStatus(b._id, 'Approved')}>Approve</button>
                                                <button className="btn btn-icon btn-secondary btn-sm" onClick={() => openModal(b)}><HiOutlinePencil /></button>
                                                <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#ef4444', marginLeft: 4 }} onClick={() => handleDelete(b._id)}><HiOutlineTrash /></button>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: '#64748b' }}>Locked</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {selectedTableIds.length > 0 && (
                <div style={{
                    position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#111827', color: 'white', padding: '12px 24px', borderRadius: '50px',
                    display: 'flex', alignItems: 'center', gap: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 1000
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderRight: '1px solid #374151', paddingRight: '20px' }}>
                        <span style={{ backgroundColor: '#374151', padding: '2px 8px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' }}>{selectedTableIds.length}</span>
                        <span style={{ fontSize: '14px', fontWeight: 500 }}>Selected</span>
                    </div>
                    <button onClick={() => handleBulkTableAction('Approve')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <HiOutlineCheck size={18} /> Approve Selected
                    </button>
                    <button onClick={() => handleBulkTableAction('Delete')} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        <HiOutlineTrash size={18} /> Delete Selected
                    </button>
                    <button onClick={() => setSelectedTableIds([])} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px', marginLeft: '10px' }}>
                        Cancel
                    </button>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Edit Bonus' : 'Add New Bonus'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Filter by Department</label>
                                        <select className="form-control" value={selectedDept} onChange={e => {
                                            setSelectedDept(e.target.value);
                                            setFormData({ ...formData, employee: '' });
                                        }}>
                                            <option value="">All Departments</option>
                                            {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <label className="form-label">Employee</label>
                                            {!editingId && (
                                                <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#6366f1' }}>
                                                    <input type="checkbox" checked={isBulk} onChange={e => setIsBulk(e.target.checked)} />
                                                    Bulk Select Mode
                                                </label>
                                            )}
                                        </div>
                                        {isBulk ? (
                                            <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                                                <div style={{ display: 'flex', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #e5e7eb' }}>
                                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedEmployees(filteredEmployees.map(e => e._id))}>Select All</button>
                                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedEmployees([])}>Clear</button>
                                                    <span style={{ fontSize: 12, marginLeft: 'auto', alignSelf: 'center', color: '#64748b' }}>{selectedEmployees.length} selected</span>
                                                </div>
                                                {filteredEmployees.map(e => (
                                                    <label key={e._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 14 }}>
                                                        <input type="checkbox" checked={selectedEmployees.includes(e._id)} onChange={(evt) => {
                                                            if (evt.target.checked) setSelectedEmployees([...selectedEmployees, e._id]);
                                                            else setSelectedEmployees(selectedEmployees.filter(id => id !== e._id));
                                                        }} />
                                                        {e.firstName} {e.lastName} ({e.employeeCode})
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmployeeSelect
                                                employees={filteredEmployees}
                                                value={formData.employee}
                                                onChange={(val) => setFormData({ ...formData, employee: val })}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Bonus Type</label>
                                        <input type="text" className="form-control" required placeholder="e.g. Diwali Bonus" value={formData.bonusType} onChange={e => setFormData({ ...formData, bonusType: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Amount (₹)</label>
                                        <input type="number" className="form-control" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Month</label>
                                        <select className="form-control" required value={formData.month} onChange={e => setFormData({ ...formData, month: Number(e.target.value) })}>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Financial Year</label>
                                        <input type="text" className="form-control" required value={formData.financialYear} onChange={e => setFormData({ ...formData, financialYear: e.target.value })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Remarks</label>
                                    <textarea className="form-control" value={formData.remarks} onChange={e => setFormData({ ...formData, remarks: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingId ? 'Update' : 'Save'} Bonus</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <YearManagerModal showYearModal={showYearModal} setShowYearModal={setShowYearModal} years={years} fetchYears={fetchYears} />
        </div>
    );
}
