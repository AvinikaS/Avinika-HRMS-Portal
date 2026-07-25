import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../../utils/api';
import { HiOutlinePlus, HiOutlineCheckCircle, HiOutlineClock, HiOutlineBan, HiOutlineX, HiOutlineDownload } from 'react-icons/hi';
import EmployeeSelect from '../../components/EmployeeSelect';
import { useYearManager, YearManagerModal, YearSelectDropdown } from '../../components/YearManagerModal';
import * as XLSX from 'xlsx';

export default function AdvanceSalary() {
    const [advances, setAdvances] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState('');
    const [formData, setFormData] = useState({ employee: '', amount: '', requestMonth: new Date().getMonth() + 1, requestYear: new Date().getFullYear(), recoveryStartMonth: new Date().getMonth() + 2, recoveryStartYear: new Date().getFullYear(), recoveryDuration: 1, reason: '' });
    const [activeTab, setActiveTab] = useState('pending');

    const [filterDept, setFilterDept] = useState('');
    const [filterMonth, setFilterMonth] = useState('');
    const [filterYear, setFilterYear] = useState('');
    const { years, showYearModal, setShowYearModal, fetchYears } = useYearManager();

    const [departments, setDepartments] = useState([]);
    const filteredEmployees = selectedDept ? employees.filter(e => e.department === selectedDept) : employees;

    const fetchAdvances = async () => {
        try {
            const { data } = await api.get('/advances');
            setAdvances(data.data || []);
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
        fetchAdvances();
        fetchEmployees();
        fetchDepartments();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/advances', formData);
            toast.success('Advance salary record added successfully');
            setShowModal(false);
            fetchAdvances();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error submitting request');
        }
    };

    const updateStatus = async (id, status, disbursalMode = null) => {
        try {
            const payload = { status };
            if (disbursalMode) payload.disbursalMode = disbursalMode;
            await api.put(`/advances/${id}/status`, payload);
            toast.success(`Advance marked as ${status}`);
            fetchAdvances();
        } catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
    };

    const handleApprove = async (id) => {
        const { value: mode, isConfirmed } = await Swal.fire({
            title: 'Select Disbursal Mode',
            input: 'select',
            inputOptions: { 'Payroll System': 'Via Payroll System', 'Outside Payroll': 'Outside Payroll', 'Bank Transfer': 'Bank Transfer', 'Cash': 'Cash' },
            showCancelButton: true,
            confirmButtonText: 'Approve & Release'
        });
        if (isConfirmed && mode) {
            updateStatus(id, 'Approved', mode);
        }
    };

    const processedAdvances = advances.map(a => ({
        ...a,
        status: (['Approved', 'Recovering'].includes(a.status) && a.outstandingAmount <= 0) ? 'Recovered' : a.status
    }));

    const filtered = processedAdvances.filter(a => {
        if (activeTab === 'pending') { if (a.status !== 'Pending') return false; }
        else if (activeTab === 'approved') { if (!['Approved', 'Recovering'].includes(a.status)) return false; }
        else if (activeTab === 'recovered') { if (!['Recovered', 'Rejected'].includes(a.status)) return false; }

        if (filterDept && a.employee?.department !== filterDept) return false;
        if (filterMonth && a.requestMonth !== Number(filterMonth)) return false;
        if (filterYear && a.requestYear?.toString() !== filterYear.toString()) return false;
        return true;
    });

    const openModal = () => {
        setSelectedDept('');
        setFormData({ employee: '', amount: '', requestMonth: new Date().getMonth() + 1, requestYear: new Date().getFullYear(), recoveryStartMonth: new Date().getMonth() + 2 > 12 ? 1 : new Date().getMonth() + 2, recoveryStartYear: new Date().getMonth() + 2 > 12 ? new Date().getFullYear() + 1 : new Date().getFullYear(), recoveryDuration: 1, reason: '' });
        setShowModal(true);
    };

    const handleExportExcel = () => {
        if (!filtered.length) {
            toast.error('No data to export for this selection.');
            return;
        }
        const headers = ['Employee Code', 'Employee Name', 'Department', 'Advance Amount', 'Recovered Amount', 'Pending Amount', 'Duration (Months)', 'EMI', 'EMI Starts On', 'Request Month', 'Request Year', 'Reason', 'Status'];
        const wb = XLSX.utils.book_new();

        const buildRow = a => [
            a.employee?.employeeCode || '',
            `${a.employee?.firstName || ''} ${a.employee?.lastName || ''}`.trim(),
            a.employee?.department || '',
            a.amount,
            a.amount - (a.outstandingAmount ?? a.amount),
            a.outstandingAmount ?? a.amount,
            a.recoveryDuration,
            a.installmentAmount || Math.ceil(a.amount / a.recoveryDuration),
            a.recoveryStartMonth ? `${new Date(0, a.recoveryStartMonth - 1).toLocaleString('default', { month: 'short' })} ${a.recoveryStartYear || a.requestYear}` : '-',
            new Date(0, a.requestMonth - 1).toLocaleString('default', { month: 'short' }),
            a.requestYear,
            a.reason || '',
            a.status
        ];

        // 1. Master sheet
        const allRows = filtered.map(buildRow);
        const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
        XLSX.utils.book_append_sheet(wb, wsAll, filterDept ? filterDept.substring(0, 31) : 'All Advances');

        // 2. Department-wise sheets if 'All Departments'
        if (!filterDept) {
            const byDept = {};
            filtered.forEach(a => {
                const d = a.employee?.department || 'Unassigned';
                if (!byDept[d]) byDept[d] = [];
                byDept[d].push(a);
            });
            Object.keys(byDept).sort().forEach(dept => {
                const deptRows = byDept[dept].map(buildRow);
                const ws = XLSX.utils.aoa_to_sheet([headers, ...deptRows]);
                XLSX.utils.book_append_sheet(wb, ws, dept.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '') || 'Unassigned');
            });
        }

        XLSX.writeFile(wb, `Advance_Salary_Report.xlsx`);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div style={{ flex: '1 1 auto' }}>
                    <h1>Advance Salary</h1>
                    <p>Manage employee advance requests and auto-recovery</p>
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
                    <button className="btn btn-primary" onClick={openModal}><HiOutlinePlus /> Add Advance</button>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 20, flexWrap: 'wrap', gap: '4px' }}>
                <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('pending')}>Pending Requests</button>
                <button className={`tab ${activeTab === 'approved' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('approved')}>Active / Recovering</button>
                <button className={`tab ${activeTab === 'recovered' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('recovered')}>Closed / Rejected</button>
            </div>



            <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                {loading ? <div style={{ padding: 20 }}>Loading...</div> : (
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Advance Amount</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Outstanding Amount</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Disbursal Info</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>EMI Amount</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Remaining EMI Terms</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>EMI Deduction Starts</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? <tr><td colSpan="9" style={{ textAlign: 'center', padding: 30, color: '#94a3b8' }}>No records found in this view</td></tr> : filtered.map(a => {
                                const remainingTerms = a.outstandingAmount > 0 ? Math.ceil(a.outstandingAmount / a.installmentAmount) : 0;
                                const monthName = new Date(0, a.recoveryStartMonth - 1).toLocaleString('default', { month: 'short' });

                                const isPayrollMode = ['Payroll System'].includes(a.disbursalMode) || !a.disbursalMode;
                                let disbursalDate;
                                if (a.status === 'Pending') {
                                    disbursalDate = 'Initial Pending';
                                } else if (isPayrollMode) {
                                    disbursalDate = `For ${new Date(0, a.requestMonth - 1).toLocaleString('default', { month: 'short' })} ${a.requestYear}`;
                                } else {
                                    disbursalDate = new Date(Math.max(new Date(a.createdAt), ...a.history.map(h => new Date(h.updatedAt)))).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                                }

                                const dispMode = a.status === 'Pending' ? 'Awaiting Approval' : (isPayrollMode ? 'Payroll System' : a.disbursalMode);

                                return (
                                    <tr key={a._id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s', ':hover': { background: '#f8fafc' } }}>
                                        <td style={{ padding: '12px 16px', minWidth: 150 }}>
                                            <div style={{ color: '#4f46e5', fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.employee?.firstName} {a.employee?.lastName}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: 2 }}>{a.employee?.employeeCode}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {a.amount.toLocaleString('en-IN')}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: '#1e293b' }}>INR {a.outstandingAmount.toLocaleString('en-IN')}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ color: '#334155', fontWeight: 500 }}>{dispMode}</div>
                                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>{disbursalDate}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontWeight: 500, color: '#1e293b' }}>
                                            INR {a.installmentAmount.toLocaleString('en-IN')}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 500, color: '#1e293b' }}>{remainingTerms}</div>
                                            <div style={{ color: '#64748b', fontSize: '12px', marginTop: 2 }}>out of {a.recoveryDuration}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>
                                            {monthName} {a.recoveryStartYear}
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>
                                            {(() => {
                                                let displayText = a.status;
                                                let textColor = '#64748b';
                                                if (a.status === 'Pending') { displayText = 'Pending Review'; textColor = '#d97706'; }
                                                else if (['Recovered', 'Rejected'].includes(a.status)) { displayText = a.status; textColor = '#64748b'; }
                                                else {
                                                    const hasDeductions = a.outstandingAmount < a.amount;
                                                    if (!hasDeductions) { displayText = 'Not Started'; textColor = '#10b981'; }
                                                    else { displayText = 'In Progress'; textColor = '#3b82f6'; }
                                                }
                                                return <span style={{ color: textColor, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 4 }}>{displayText}</span>;
                                            })()}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {a.status === 'Pending' && (
                                                <>
                                                    <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#10b981', marginRight: 8 }} onClick={() => handleApprove(a._id)} title="Approve"><HiOutlineCheckCircle /></button>
                                                    <button className="btn btn-icon btn-secondary btn-sm" style={{ color: '#ef4444' }} onClick={() => updateStatus(a._id, 'Rejected')} title="Reject"><HiOutlineBan /></button>
                                                </>
                                            )}
                                            {['Approved', 'Recovering'].includes(a.status) && (
                                                <span style={{ fontSize: '12px', color: '#64748b' }}>Active</span>
                                            )}
                                            {['Recovered', 'Rejected'].includes(a.status) && (
                                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Add Advance Salary</h2>
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
                                        <label className="form-label" style={{ marginBottom: 4 }}>Employee</label>
                                        <EmployeeSelect
                                            employees={filteredEmployees}
                                            value={formData.employee}
                                            onChange={(val) => setFormData({ ...formData, employee: val })}
                                        />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Advance Amount (₹)</label>
                                        <input type="number" min="1" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Expected Month (Payroll Month)</label>
                                        <input
                                            type="month"
                                            className="form-control"
                                            required
                                            value={`${formData.requestYear}-${String(formData.requestMonth).padStart(2, '0')}`}
                                            onChange={e => {
                                                if (e.target.value) {
                                                    const [y, m] = e.target.value.split('-');
                                                    setFormData({ ...formData, requestYear: Number(y), requestMonth: Number(m) });
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Recovery Duration (Months)</label>
                                        <input type="number" min="1" max="12" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={formData.recoveryDuration} onChange={e => setFormData({ ...formData, recoveryDuration: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Recovery Start Month</label>
                                        <select className="form-control" required value={formData.recoveryStartMonth} onChange={e => setFormData({ ...formData, recoveryStartMonth: Number(e.target.value) })}>
                                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Recovery Start Year</label>
                                        <input type="number" min="2020" onKeyDown={e => (e.key === '-' || e.key === 'e') && e.preventDefault()} className="form-control" required value={formData.recoveryStartYear} onChange={e => setFormData({ ...formData, recoveryStartYear: e.target.value === '' ? '' : Number(e.target.value) })} />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <textarea className="form-control" required value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                                </div>
                                {formData.amount && formData.recoveryDuration && (
                                    <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginTop: 12, border: '1px solid #e2e8f0', fontSize: 13 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Advance Amount:</span> <strong>₹{Number(formData.amount).toLocaleString('en-IN')}</strong></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Monthly Recovered EMI:</span> <strong style={{ color: '#ef4444' }}>₹{Math.ceil(Number(formData.amount) / formData.recoveryDuration).toLocaleString('en-IN')} /mo</strong></div>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Submit Request</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <YearManagerModal showYearModal={showYearModal} setShowYearModal={setShowYearModal} years={years} fetchYears={fetchYears} />
        </div>
    );
}
