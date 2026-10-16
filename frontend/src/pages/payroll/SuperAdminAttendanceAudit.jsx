import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import EmployeeSelect from '../../components/EmployeeSelect';
import {
    HiOutlineSearch,
    HiOutlineShieldCheck,
    HiOutlineEye,
    HiOutlineX,
    HiOutlineCheckCircle,
    HiOutlineXCircle,
    HiOutlineClock,
    HiOutlineExclamation,
    HiOutlinePaperClip,
    HiOutlineFilter
} from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SuperAdminAttendanceAudit() {
    const [employees, setEmployees] = useState([]);
    const [selectedDepartment, setSelectedDepartment] = useState('ALL');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('ALL');
    const [auditItems, setAuditItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [years, setYears] = useState([]);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/payroll-years');
            setYears(data.data || []);
        } catch {}
    };

    useEffect(() => {
        fetchYears();
    }, []);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const res = await api.get('/employees?limit=500');
                if (res.data.success) {
                    const list = res.data.data || res.data.employees || [];
                    const sorted = list.sort((a, b) =>
                        (a.firstName || '').localeCompare(b.firstName || '') || (a.lastName || '').localeCompare(b.lastName || '')
                    );
                    setEmployees(sorted);
                    setSelectedEmployeeId('ALL');
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchEmployees();
    }, []);

    // Unique list of departments from employees
    const departments = [...new Set(employees.map(emp => emp.department).filter(Boolean))];

    // Filter employees by selected department
    const filteredEmployees = employees.filter(emp =>
        selectedDepartment === 'ALL' || emp.department === selectedDepartment
    );

    const handleDepartmentChange = (dept) => {
        setSelectedDepartment(dept);
        setSelectedEmployeeId('ALL');
    };

    const fetchAuditLogs = async () => {
        if (!selectedEmployeeId) return;
        setLoading(true);
        try {
            const res = await api.get(`/superadmin/attendance/audit/${selectedEmployeeId}`, {
                params: { year: selectedYear, month: selectedMonth }
            });
            if (res.data.success) {
                setAuditItems(res.data.data || []);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to fetch audit logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (selectedEmployeeId) fetchAuditLogs();
    }, [selectedEmployeeId, selectedYear, selectedMonth]);

    // Filter items locally by department, status, and search term (Only display user submitted Regularization Requests)
    const filteredItems = auditItems.filter(item => {
        // Show ONLY submitted Regularization Requests in outer table (exclude standalone system events like SYSTEM_EVENT)
        if (item.type !== 'REGULARIZATION_REQUEST') return false;

        // Filter by Department when selecting department
        if (selectedDepartment !== 'ALL') {
            const itemDept = typeof item.employee === 'object' ? item.employee?.department : (employees.find(e => e._id === item.employee)?.department);
            if (itemDept !== selectedDepartment) return false;
        }

        const matchesStatus = statusFilter === 'ALL' || item.currentStatus === statusFilter;
        const searchLower = searchTerm.toLowerCase();
        const empName = item.employee?.firstName ? `${item.employee.firstName} ${item.employee.lastName || ''}`.toLowerCase() : '';
        const matchesSearch = !searchTerm ||
            (item.regularizationNumber && item.regularizationNumber.toLowerCase().includes(searchLower)) ||
            (item.reason && item.reason.toLowerCase().includes(searchLower)) ||
            (item.comment && item.comment.toLowerCase().includes(searchLower)) ||
            empName.includes(searchLower);
        return matchesStatus && matchesSearch;
    }).sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    const getStatusBadge = (status) => {
        const s = status ? status.toUpperCase() : '';
        if (s === 'APPROVED') {
            return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><HiOutlineCheckCircle size={14} /> Approved</span>;
        }
        if (s === 'REJECTED') {
            return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#fee2e2', color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><HiOutlineXCircle size={14} /> Rejected</span>;
        }
        if (s === 'INFORMATION_REQUIRED') {
            return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#fef3c7', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><HiOutlineExclamation size={14} /> Info Required</span>;
        }
        if (s === 'PENDING_HR_REVIEW') {
            return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><HiOutlineClock size={14} /> Pending Review</span>;
        }
        if (s === 'CANCELLED') {
            return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#f1f5f9', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Cancelled</span>;
        }
        return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', background: '#f1f5f9', color: '#475569' }}>{status}</span>;
    };

    const getActionBadge = (action) => {
        if (!action) return null;
        if (action.includes('APPROVED')) return <span style={{ color: '#16a34a', fontWeight: '700' }}>APPROVED</span>;
        if (action.includes('REJECTED')) return <span style={{ color: '#dc2626', fontWeight: '700' }}>REJECTED</span>;
        if (action.includes('INFO_REQUIRED')) return <span style={{ color: '#d97706', fontWeight: '700' }}>INFO REQUESTED</span>;
        if (action.includes('RESUBMITTED')) return <span style={{ color: '#2563eb', fontWeight: '700' }}>RESUBMITTED / INFO PROVIDED</span>;
        if (action.includes('SUBMITTED')) return <span style={{ color: '#0284c7', fontWeight: '700' }}>SUBMITTED</span>;
        if (action.includes('PAYROLL_SYNC')) return <span style={{ color: '#7c3aed', fontWeight: '700' }}>PAYROLL SYNC</span>;
        if (action.includes('CORRECTION')) return <span style={{ color: '#ea580c', fontWeight: '700' }}>OVERRIDE</span>;
        return <span style={{ color: '#475569', fontWeight: '600' }}>{action}</span>;
    };

    const formatUserName = (userObj) => {
        if (!userObj) return 'SYSTEM';
        if (typeof userObj === 'string') return userObj;
        if (userObj.employeeId) {
            const emp = userObj.employeeId;
            return `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
        }
        if (userObj.firstName) {
            return `${userObj.firstName} ${userObj.lastName || ''}`.trim();
        }
        if (userObj.email) return userObj.email.split('@')[0];
        return 'SYSTEM';
    };

    return (
        <div className="page-container sa-audit-page">
            <style>{`
                .sa-audit-page {
                    padding: 0;
                    margin: 0;
                    width: 100%;
                }
                .sa-audit-header {
                    margin-bottom: 24px;
                }
                .sa-audit-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 24px;
                    margin-bottom: 24px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    width: 100%;
                    box-sizing: border-box;
                }
                .sa-audit-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                    align-items: flex-end;
                }
                .sa-audit-field {
                    display: flex;
                    flex-direction: column;
                }
                .sa-audit-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .sa-audit-control {
                    width: 100%;
                    height: 46px;
                    box-sizing: border-box;
                    padding: 0 14px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    font-size: 14px;
                    outline: none;
                    background: #fff;
                    color: #1e293b;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .sa-audit-control:focus {
                    border-color: #7c3aed;
                    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
                }
                .sa-audit-actions-bar {
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    gap: 12px;
                    align-items: center;
                }
                .sa-audit-search-wrapper {
                    flex: 1;
                    position: relative;
                }
                .sa-audit-search-input {
                    width: 100%;
                    height: 46px;
                    box-sizing: border-box;
                    padding: 0 14px 0 40px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    font-size: 14px;
                    outline: none;
                    background: #fff;
                    color: #1e293b;
                    transition: all 0.2s;
                }
                .sa-audit-search-input::placeholder {
                    color: #94a3b8;
                    font-size: 13.5px;
                }
                .sa-audit-search-input:focus {
                    border-color: #7c3aed;
                    box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.2);
                }
                .sa-audit-btn-search {
                    height: 46px;
                    box-sizing: border-box;
                    padding: 0 22px;
                    border-radius: 8px;
                    background: #7c3aed;
                    color: #fff;
                    border: none;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    white-space: nowrap;
                    box-shadow: 0 1px 2px rgba(124, 58, 237, 0.2);
                    transition: all 0.2s;
                }
                .sa-audit-btn-search:hover {
                    background: #6d28d9;
                }
                .sa-audit-btn-reset {
                    height: 46px;
                    box-sizing: border-box;
                    padding: 0 18px;
                    border-radius: 8px;
                    background: #fff;
                    color: #64748b;
                    border: 1px solid #cbd5e1;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 14px;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .sa-audit-btn-reset:hover {
                    background: #f8fafc;
                    color: #334155;
                }

                /* Modal Styles */
                .sa-audit-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(15, 23, 42, 0.65);
                    backdrop-filter: blur(4px);
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    box-sizing: border-box;
                }
                .sa-audit-modal-container {
                    background: #fff;
                    border-radius: 16px;
                    width: 100%;
                    max-width: 780px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
                    box-sizing: border-box;
                }
                .sa-audit-modal-header {
                    padding: 18px 24px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8fafc;
                    width: 100%;
                    box-sizing: border-box;
                }
                .sa-audit-modal-title {
                    font-size: 18px;
                    font-weight: 700;
                    color: #0f172a;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .sa-audit-modal-sub {
                    font-size: 13px;
                    color: #64748b;
                    margin-top: 2px;
                }
                .sa-audit-modal-close {
                    border: none;
                    background: #f1f5f9;
                    border-radius: 50%;
                    width: 36px;
                    height: 36px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #64748b;
                    margin-left: 12px;
                    flex-shrink: 0;
                    transition: background 0.15s;
                }
                .sa-audit-modal-close:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                .sa-audit-modal-body {
                    padding: 24px;
                    overflow-y: auto;
                    overflow-x: hidden;
                    flex: 1;
                    box-sizing: border-box;
                }
                .sa-audit-summary-grid {
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 16px;
                    margin-bottom: 24px;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 16px;
                    box-sizing: border-box;
                }
                .sa-audit-timeline {
                    position: relative;
                    padding-left: 24px;
                    border-left: 2px solid #e2e8f0;
                    margin-left: 10px;
                }
                .sa-audit-step {
                    position: relative;
                    margin-bottom: 22px;
                }
                .sa-audit-bullet {
                    position: absolute;
                    left: -33px;
                    top: 4px;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    border: 3px solid #fff;
                    box-shadow: 0 0 0 2px rgba(226, 232, 240, 1);
                }
                .sa-audit-step-card {
                    background: #fff;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 14px 16px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
                    box-sizing: border-box;
                    word-break: break-word;
                    overflow-wrap: break-word;
                }
                .sa-audit-step-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 6px;
                    flex-wrap: wrap;
                }
                .sa-audit-step-timestamp {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 600;
                    white-space: nowrap;
                }
                .sa-audit-modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: flex-end;
                    background: #f8fafc;
                    box-sizing: border-box;
                }

                @media (max-width: 768px) {
                    .sa-audit-card {
                        padding: 16px !important;
                        margin-bottom: 16px !important;
                    }
                    .sa-audit-search-input {
                        font-size: 13.5px !important;
                        padding: 0 12px 0 38px !important;
                    }
                    .sa-audit-search-input::placeholder {
                        font-size: 13px !important;
                    }
                    .sa-audit-actions-bar {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 10px !important;
                    }
                    .sa-audit-btn-search,
                    .sa-audit-btn-reset {
                        width: 100% !important;
                        justify-content: center !important;
                    }

                    /* Modal Mobile Responsive */
                    .sa-audit-modal-overlay {
                        padding: 8px !important;
                        align-items: flex-end !important;
                    }
                    .sa-audit-modal-container {
                        max-height: 94vh !important;
                        border-radius: 16px 16px 8px 8px !important;
                    }
                    .sa-audit-modal-header {
                        padding: 12px 14px !important;
                    }
                    .sa-audit-modal-title {
                        font-size: 15px !important;
                    }
                    .sa-audit-modal-sub {
                        font-size: 11.5px !important;
                    }
                    .sa-audit-modal-body {
                        padding: 14px 12px !important;
                    }
                    .sa-audit-summary-grid {
                        grid-template-columns: 1fr 1fr !important;
                        padding: 12px !important;
                        gap: 10px !important;
                        margin-bottom: 16px !important;
                    }
                    .sa-audit-timeline {
                        padding-left: 18px !important;
                        margin-left: 6px !important;
                    }
                    .sa-audit-bullet {
                        left: -25px !important;
                        width: 12px !important;
                        height: 12px !important;
                        top: 3px !important;
                    }
                    .sa-audit-step-card {
                        padding: 10px 12px !important;
                    }
                    .sa-audit-step-header {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 4px !important;
                    }
                    .sa-audit-step-header > div {
                        display: flex;
                        align-items: center;
                        flex-wrap: wrap;
                        gap: 6px;
                    }
                    .sa-audit-step-timestamp {
                        font-size: 11px !important;
                    }
                    .sa-audit-modal-footer {
                        padding: 10px 14px !important;
                    }
                    .sa-audit-modal-footer button {
                        width: 100% !important;
                        justify-content: center !important;
                    }
                }

                @media (max-width: 480px) {
                    .sa-audit-summary-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>

            {/* Page Header */}
            <div className="sa-audit-header">
                <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: '#7c3aed', color: '#fff', borderRadius: '8px', padding: '8px', display: 'flex' }}>
                        <HiOutlineShieldCheck size={24} />
                    </div>
                    Attendance Audit Trail Explorer
                </h1>
                <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
                    View employee request activity, real-time resolution status, and complete step-by-step history trace.
                </p>
            </div>

            {/* Filter Toolbar Card with Synced Department & Searchable EmployeeSelect */}
            <div className="sa-audit-card">
                <div className="sa-audit-grid">
                    {/* Department Dropdown */}
                    <div className="sa-audit-field">
                        <label className="sa-audit-label">Filter Department</label>
                        <select
                            value={selectedDepartment}
                            onChange={(e) => handleDepartmentChange(e.target.value)}
                            className="sa-audit-control"
                        >
                            <option value="ALL">All Departments</option>
                            {departments.map((dept, idx) => (
                                <option key={idx} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    {/* Employee Select Component (Synced with Department) */}
                    <div className="sa-audit-field">
                        <label className="sa-audit-label">Select Employee</label>
                        <EmployeeSelect
                            employees={filteredEmployees}
                            value={selectedEmployeeId}
                            onChange={(id) => setSelectedEmployeeId(id)}
                            height="46px"
                        />
                    </div>

                    {/* Filter Status */}
                    <div className="sa-audit-field">
                        <label className="sa-audit-label">Filter Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="sa-audit-control"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="INFORMATION_REQUIRED">Info Required</option>
                            <option value="PENDING_HR_REVIEW">Pending Review</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>

                    {/* Select Month */}
                    <div className="sa-audit-field">
                        <label className="sa-audit-label">Filter Month</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="sa-audit-control"
                        >
                            <option value="">All Months</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Select Year */}
                    <div className="sa-audit-field">
                        <label className="sa-audit-label">Filter Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="sa-audit-control"
                        >
                            <option value="">All Years</option>
                            {years.map(y => (
                                <option key={y._id} value={y.year}>{y.year}</option>
                            ))}
                            {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                        </select>
                    </div>
                </div>

                {/* Search Term Bar & Action Buttons */}
                <div className="sa-audit-actions-bar">
                    <div className="sa-audit-search-wrapper">
                        <HiOutlineFilter style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={18} />
                        <input
                            type="text"
                            placeholder="Search Request # or reason..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="sa-audit-search-input"
                        />
                    </div>
                    <button
                        onClick={fetchAuditLogs}
                        className="sa-audit-btn-search"
                    >
                        <HiOutlineSearch size={18} /> Search Logs
                    </button>
                    {(selectedDepartment !== 'ALL' || selectedEmployeeId !== 'ALL' || statusFilter !== 'ALL' || selectedMonth || selectedYear || searchTerm) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedDepartment('ALL');
                                setSelectedEmployeeId('ALL');
                                setStatusFilter('ALL');
                                setSelectedMonth('');
                                setSelectedYear('');
                                setSearchTerm('');
                            }}
                            className="sa-audit-btn-reset"
                            title="Reset all filters"
                        >
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="sa-audit-card" style={{ padding: 0, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <div className="spinner"></div>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                        <HiOutlineShieldCheck size={48} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                        <div style={{ fontSize: '16px', fontWeight: '600', color: '#334155' }}>No audit trail records found</div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Try adjusting your date range or filter criteria.</div>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Submitted On</th>
                                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Attendance Date</th>
                                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Request ID & Reason</th>
                                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Submitted By</th>
                                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Active Status</th>
                                    <th style={{ padding: '14px 16px', fontWeight: '700' }}>Latest Event</th>
                                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'center' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, idx) => (
                                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}>
                                        <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                                            {item.submittedAt ? new Date(item.submittedAt).toLocaleString('en-IN') : 'N/A'}
                                        </td>
                                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                                            {new Date(item.attendanceDate).toLocaleDateString('en-IN')}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: '700', color: '#7c3aed', fontSize: '13px' }}>
                                                {item.regularizationNumber}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>
                                                {item.reason || item.attendanceType || 'Regularization Request'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontWeight: '600', color: '#1e293b' }}>
                                                {item.employee?.firstName ? `${item.employee.firstName} ${item.employee.lastName || ''}`.trim() : 'Employee'}
                                            </div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                {item.employee?.employeeCode ? `Code: ${item.employee.employeeCode}` : 'Employee'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            {getStatusBadge(item.currentStatus)}
                                        </td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ fontSize: '13px' }}>{getActionBadge(item.latestAction)}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                                by {formatUserName(item.latestPerformedBy)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => setSelectedItem(item)}
                                                style={{
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #7c3aed',
                                                    background: '#f5f3ff',
                                                    color: '#7c3aed',
                                                    fontWeight: '600',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}
                                            >
                                                <HiOutlineEye size={16} /> View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* DETAIL MODAL WITH FULL AUDIT HISTORY TIMELINE */}
            {selectedItem && (
                <div className="sa-audit-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedItem(null); }}>
                    <div className="sa-audit-modal-container">
                        {/* Modal Header */}
                        <div className="sa-audit-modal-header">
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="sa-audit-modal-title">
                                    Audit Details – <span style={{ color: '#7c3aed' }}>{selectedItem.regularizationNumber}</span>
                                </div>
                                <div className="sa-audit-modal-sub">
                                    Full activity timeline & update log for attendance date {new Date(selectedItem.attendanceDate).toLocaleDateString('en-IN')}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedItem(null)}
                                className="sa-audit-modal-close"
                                aria-label="Close"
                            >
                                <HiOutlineX size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="sa-audit-modal-body">
                            {/* Summary Card */}
                            <div className="sa-audit-summary-grid">
                                <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Active Status</div>
                                    <div style={{ marginTop: '4px' }}>{getStatusBadge(selectedItem.currentStatus)}</div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Employee</div>
                                    <div style={{ fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>
                                        {formatUserName(selectedItem.employee)}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        {selectedItem.employee?.department || 'Department N/A'}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Requested Timings</div>
                                    <div style={{ fontWeight: '700', color: '#1e293b', marginTop: '2px' }}>
                                        {selectedItem.requestedCheckIn || 'N/A'} – {selectedItem.requestedCheckOut || 'N/A'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: '600' }}>
                                        {selectedItem.attendanceType || 'FULL_DAY'}
                                    </div>
                                </div>

                                <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>Initial Reason</div>
                                    <div style={{ fontWeight: '600', color: '#334155', marginTop: '2px' }}>
                                        {selectedItem.reason || 'N/A'}
                                    </div>
                                </div>
                            </div>

                            {/* Attachments if any */}
                            {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                                <div style={{
                                    marginBottom: '24px',
                                    background: '#eff6ff',
                                    border: '1px solid #bfdbfe',
                                    borderRadius: '10px',
                                    padding: '12px 16px'
                                }}>
                                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <HiOutlinePaperClip size={16} /> Attached Proof Documents / Screenshots ({selectedItem.attachments.length})
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {selectedItem.attachments.map((att, aIdx) => (
                                            <a
                                                key={aIdx}
                                                href={att.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    background: '#fff',
                                                    color: '#2563eb',
                                                    fontSize: '12px',
                                                    fontWeight: '700',
                                                    textDecoration: 'none',
                                                    border: '1px solid #93c5fd',
                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                <HiOutlinePaperClip size={14} /> {att.fileName || `Attachment ${aIdx + 1}`}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Full Activity Timeline */}
                            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <HiOutlineClock color="#7c3aed" size={18} /> Step-by-Step Activity History (Chronological)
                            </h3>

                            <div className="sa-audit-timeline">
                                {selectedItem.history && selectedItem.history.map((step, sIdx) => {
                                    const action = step.action || '';
                                    const isApproved = action.includes('APPROVED');
                                    const isRejected = action.includes('REJECTED') || action.includes('CANCELLED');
                                    const isInfoReq = action.includes('INFO_REQUIRED');
                                    const isPayroll = action.includes('PAYROLL');

                                    return (
                                        <div key={sIdx} className="sa-audit-step">
                                            {/* Bullet Marker */}
                                            <div
                                                className="sa-audit-bullet"
                                                style={{
                                                    background: isApproved ? '#22c55e' : (isRejected ? '#ef4444' : (isInfoReq ? '#f59e0b' : (isPayroll ? '#a855f7' : '#3b82f6')))
                                                }}
                                            />

                                            {/* Step Card */}
                                            <div className="sa-audit-step-card">
                                                <div className="sa-audit-step-header">
                                                    <div>
                                                        <span style={{ fontWeight: '700', fontSize: '13.5px', color: '#0f172a' }}>
                                                            {sIdx + 1}. {getActionBadge(action)}
                                                        </span>
                                                        <span style={{ marginLeft: '8px', fontSize: '12px', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                                                            {step.performedByRole || step.source || 'SYSTEM'}
                                                        </span>
                                                    </div>
                                                    <span className="sa-audit-step-timestamp">
                                                        {step.timestamp ? new Date(step.timestamp).toLocaleString('en-IN') : 'N/A'}
                                                    </span>
                                                </div>

                                                <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                                                    <strong>Performed By:</strong> {formatUserName(step.performedBy)}
                                                </div>

                                                {/* Reason / Remarks Content */}
                                                {(step.reason || (step.newValue && (step.newValue.comment || step.newValue.note || step.newValue.reason))) && (
                                                    <div style={{
                                                        marginTop: '8px',
                                                        background: isApproved ? '#f0fdf4' : (isRejected ? '#fef2f2' : (isInfoReq ? '#fffbeb' : '#f8fafc')),
                                                        border: `1px solid ${isApproved ? '#bbf7d0' : (isRejected ? '#fecaca' : (isInfoReq ? '#fef3c7' : '#e2e8f0'))}`,
                                                        borderRadius: '6px',
                                                        padding: '10px 12px',
                                                        fontSize: '13px',
                                                        color: '#1e293b',
                                                        wordBreak: 'break-word',
                                                        overflowWrap: 'break-word'
                                                    }}>
                                                        <div style={{ fontWeight: '600', color: '#475569', marginBottom: '2px', fontSize: '11px', textTransform: 'uppercase' }}>Remarks / Details</div>
                                                        {step.reason || step.newValue?.comment || step.newValue?.note || (typeof step.newValue === 'string' ? step.newValue : JSON.stringify(step.newValue || {}))}
                                                    </div>
                                                )}

                                                {/* Attachments if any inside step */}
                                                {(step.newValue?.attachments || step.attachments) && (step.newValue?.attachments || step.attachments).length > 0 && (
                                                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                        {(step.newValue?.attachments || step.attachments).map((att, aIdx) => (
                                                            <a
                                                                key={aIdx}
                                                                href={att.fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '4px 8px',
                                                                    borderRadius: '6px',
                                                                    background: '#eff6ff',
                                                                    color: '#2563eb',
                                                                    fontSize: '12px',
                                                                    fontWeight: '600',
                                                                    textDecoration: 'none',
                                                                    border: '1px solid #bfdbfe'
                                                                }}
                                                            >
                                                                <HiOutlinePaperClip size={14} /> Attachment {aIdx + 1}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sa-audit-modal-footer">
                            <button
                                onClick={() => setSelectedItem(null)}
                                style={{
                                    padding: '9px 22px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#fff',
                                    color: '#334155',
                                    fontWeight: '600',
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}
                            >
                                Close Detail
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
