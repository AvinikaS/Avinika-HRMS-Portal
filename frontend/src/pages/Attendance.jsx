import { useState, useEffect } from 'react';
import api from '../utils/api';
import { HiOutlineClock, HiOutlineCalendar, HiOutlineDownload, HiOutlineDocumentText, HiOutlineX } from 'react-icons/hi';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import EmployeeSelect from '../components/EmployeeSelect';

export default function Attendance() {
    const [records, setRecords] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('Present');

    // Report Modal State
    const [showReportModal, setShowReportModal] = useState(false);
    const [employeesList, setEmployeesList] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [reportForm, setReportForm] = useState({ employeeId: '', month: '', year: new Date().getFullYear().toString() });
    const [downloadingReport, setDownloadingReport] = useState(false);

    useEffect(() => {
        api.get('/employees?limit=5000').then(res => setEmployeesList(res.data.data)).catch(() => { });
        api.get('/departments').then(res => setDepartments((res.data.data || []).map(d => d.name || d))).catch(() => { });
    }, []);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const [attRes, holRes] = await Promise.all([
                    api.get('/attendance/all', { params: { date } }),
                    api.get('/holidays', { params: { date } }) // Backend needs to support date filter, or we filter locally
                ]);

                let rawRecords = attRes.data.data || [];
                const hols = holRes.data.data || [];

                // If today is a holiday, override "Absent" to "Holiday"
                if (hols.length > 0) {
                    const holName = hols[0].name;
                    rawRecords = rawRecords.map(r => {
                        if (r.status === 'Absent') {
                            return { ...r, status: 'Holiday', details: holName };
                        }
                        return r;
                    });
                }

                setRecords(rawRecords);
            } catch { setRecords([]); }
            setLoading(false);
        };
        fetch();
        setStatusFilter(null); // Clear filter to show the new situation correctly
    }, [date]);

    const filteredRecords = records.filter(r => {
        const matchesSearch = `${r.employee?.firstName} ${r.employee?.lastName} ${r.employee?.employeeCode}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !statusFilter ||
            (statusFilter === 'Late / Half-Day' ? ['Late', 'Half-Day'].includes(r.status) : r.status === statusFilter);
        return matchesSearch && matchesStatus;
    });

    const handleFilterClick = (status) => {
        setStatusFilter(prev => prev === status ? null : status);
    };

    const statusBadge = (s) => {
        const map = { Present: 'badge-success', Absent: 'badge-danger', 'Half-Day': 'badge-warning', Late: 'badge-warning', 'On Leave': 'badge-info', 'Holiday': 'badge-primary', 'Weekly Off': 'badge-neutral' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    const formatTime = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const formatHoursDisplay = (hours) => {
        if (!hours) return '-';
        const h = Math.floor(Number(hours));
        const m = Math.round((Number(hours) - h) * 60);
        if (h > 0 && m > 0) return `${h}h ${m}m`;
        if (h > 0) return `${h}h`;
        if (m > 0) return `${m}m`;
        return '0m';
    };

    const handleExportExcel = () => {
        if (!filteredRecords.length) {
            toast.error('No records to export');
            return;
        }

        const wb = XLSX.utils.book_new();

        const getSheetStructure = (statusType) => {
            const coreHeaders = ['Employee Code', 'Employee Name', 'Department', 'Designation'];

            if (['Present', 'Late', 'Half-Day', 'Late / Half-Day'].includes(statusType)) {
                return {
                    headers: [...coreHeaders, 'Check In', 'Check Out', 'Hours', 'Status'],
                    buildRow: r => [
                        r.employee?.employeeCode || '',
                        `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim(),
                        r.employee?.department || '',
                        r.employee?.designation || '',
                        formatTime(r.checkIn),
                        formatTime(r.checkOut),
                        formatHoursDisplay(r.totalHours),
                        r.status
                    ]
                };
            }

            if (statusType === 'On Leave') {
                return {
                    headers: [...coreHeaders, 'Leave Type', 'Leave From', 'Leave To', 'Total Days', 'Status'],
                    buildRow: r => [
                        r.employee?.employeeCode || '',
                        `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim(),
                        r.employee?.department || '',
                        r.employee?.designation || '',
                        r.leaveDetails?.leaveType || '-',
                        formatDate(r.leaveDetails?.startDate),
                        formatDate(r.leaveDetails?.endDate),
                        r.leaveDetails?.totalDays || '-',
                        r.status
                    ]
                };
            }

            // Default for Absent, Holiday, Weekly Off
            return {
                headers: [...coreHeaders, 'Status'],
                buildRow: r => [
                    r.employee?.employeeCode || '',
                    `${r.employee?.firstName || ''} ${r.employee?.lastName || ''}`.trim(),
                    r.employee?.department || '',
                    r.employee?.designation || '',
                    r.details || r.status
                ]
            };
        };

        if (!statusFilter) {
            // Multi-sheets by Status ONLY
            const byStatus = {};
            filteredRecords.forEach(r => {
                const s = r.status || 'Unknown';
                if (!byStatus[s]) byStatus[s] = [];
                byStatus[s].push(r);
            });
            Object.keys(byStatus).forEach(s => {
                const { headers, buildRow } = getSheetStructure(s);
                const rows = byStatus[s].map(buildRow);
                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                XLSX.utils.book_append_sheet(wb, ws, s.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, '') || 'Others');
            });
        } else {
            // Single sheet for the selected status
            const { headers, buildRow } = getSheetStructure(statusFilter);
            const wsSingle = XLSX.utils.aoa_to_sheet([headers, ...filteredRecords.map(buildRow)]);
            XLSX.utils.book_append_sheet(wb, wsSingle, statusFilter.substring(0, 31).replace(/[\\\/\?\*\[\]]/g, ''));
        }

        const dateStr = new Date(date).toLocaleDateString('en-GB').replace(/\//g, '-');
        XLSX.writeFile(wb, `Attendance_${dateStr}.xlsx`);
    };

    const handleDownloadEmployeeReport = async () => {
        if (!reportForm.employeeId || !reportForm.year) {
            toast.error('Please select an employee and year.');
            return;
        }
        setDownloadingReport(true);
        try {
            const { data } = await api.get(`/attendance/employee/${reportForm.employeeId}`, {
                params: {
                    month: reportForm.month || undefined,
                    year: reportForm.year
                }
            });
            const records = data.data || [];
            if (records.length === 0) {
                toast.error('No records found for this period.');
                setDownloadingReport(false);
                return;
            }

            const wb = XLSX.utils.book_new();
            const headers = ['Employee Code', 'Employee Name', 'Date', 'Day', 'Status', 'Check In', 'Check Out', 'Hours', 'Leave Type', 'Holiday Name'];

            const emp = employeesList.find(e => e._id === reportForm.employeeId);
            const empCode = emp?.employeeCode || '-';
            const empName = emp ? `${emp.firstName} ${emp.lastName}`.trim() : 'Employee';

            const byMonth = {};
            records.forEach(r => {
                const dateObj = new Date(r.date);
                const mName = dateObj.toLocaleString('en-GB', { month: 'short' });
                if (!byMonth[mName]) byMonth[mName] = [];
                byMonth[mName].push([
                    empCode,
                    empName,
                    dateObj.toLocaleDateString('en-GB'),
                    dateObj.toLocaleDateString('en-GB', { weekday: 'short' }),
                    r.status,
                    r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
                    r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
                    formatHoursDisplay(r.totalHours),
                    r.isLeaveRecord ? r.leaveType : '',
                    r.status === 'Holiday' ? (r.details || '') : ''
                ]);
            });

            const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const sortedMonths = Object.keys(byMonth).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

            sortedMonths.forEach(m => {
                const ws = XLSX.utils.aoa_to_sheet([headers, ...byMonth[m]]);
                ws['!cols'] = [
                    { wch: 15 }, // Emp Code
                    { wch: 20 }, // Emp Name
                    { wch: 12 }, // Date
                    { wch: 10 }, // Day
                    { wch: 15 }, // Status
                    { wch: 12 }, // Check In
                    { wch: 12 }, // Check Out
                    { wch: 10 }, // Hours
                    { wch: 20 }, // Leave Type
                    { wch: 25 }, // Holiday Name
                ];
                XLSX.utils.book_append_sheet(wb, ws, m);
            });

            XLSX.writeFile(wb, `${empCode}_${empName}_Attendance_${reportForm.month ? 'M' + reportForm.month : 'Yearly'}_${reportForm.year}.xlsx`.replace(/\s+/g, '_'));

            setShowReportModal(false);
        } catch (err) {
            toast.error('Failed to generate report');
        }
        setDownloadingReport(false);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Attendance</h1><p>Track employee attendance records</p></div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    <div style={{ display: 'flex', gap: 12, flex: '1 1 280px', minWidth: 0 }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search employees..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ flex: '1 1 auto', minWidth: 0 }}
                        />
                        <button className="btn btn-secondary" onClick={handleExportExcel} style={{ padding: '0 16px', height: '40px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <HiOutlineDownload size={18} /> Export
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 12, flex: '1 1 280px', minWidth: 0 }}>
                        <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} style={{ flex: '1 1 auto', minWidth: 0 }} />
                        <button className="btn btn-primary" onClick={() => setShowReportModal(true)} style={{ padding: '0 16px', height: '40px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <HiOutlineDocumentText size={18} /> Emp Report
                        </button>
                    </div>
                </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: 24, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                <div
                    className={`stat-card green ${statusFilter === 'Present' ? 'active' : ''}`}
                    onClick={() => handleFilterClick('Present')}
                    style={{ cursor: 'pointer', border: statusFilter === 'Present' ? '2px solid var(--success)' : '1px solid rgba(255,255,255,0.05)' }}
                >
                    <div className="stat-icon green"><HiOutlineClock /></div>
                    <div className="stat-content">
                        <div className="stat-label">Present</div>
                        <div className="stat-value">{records.filter(r => r.status === 'Present').length}</div>
                    </div>
                </div>
                <div
                    className={`stat-card red ${statusFilter === 'Absent' ? 'active' : ''}`}
                    onClick={() => handleFilterClick('Absent')}
                    style={{ cursor: 'pointer', border: statusFilter === 'Absent' ? '2px solid var(--danger)' : '1px solid rgba(255,255,255,0.05)' }}
                >
                    <div className="stat-icon red"><HiOutlineCalendar /></div>
                    <div className="stat-content">
                        <div className="stat-label">Absent</div>
                        <div className="stat-value">{records.filter(r => r.status === 'Absent').length}</div>
                    </div>
                </div>
                <div
                    className={`stat-card blue ${statusFilter === 'On Leave' ? 'active' : ''}`}
                    onClick={() => handleFilterClick('On Leave')}
                    style={{ cursor: 'pointer', border: statusFilter === 'On Leave' ? '2px solid #3b82f6' : '1px solid rgba(255,255,255,0.05)' }}
                >
                    <div className="stat-icon blue"><HiOutlineCalendar /></div>
                    <div className="stat-content">
                        <div className="stat-label">On Leave</div>
                        <div className="stat-value">{records.filter(r => r.status === 'On Leave').length}</div>
                    </div>
                </div>
                <div
                    className={`stat-card orange ${statusFilter === 'Late / Half-Day' ? 'active' : ''}`}
                    onClick={() => handleFilterClick('Late / Half-Day')}
                    style={{ cursor: 'pointer', border: statusFilter === 'Late / Half-Day' ? '2px solid var(--warning)' : '1px solid rgba(255,255,255,0.05)' }}
                >
                    <div className="stat-icon orange"><HiOutlineClock /></div>
                    <div className="stat-content">
                        <div className="stat-label">Late / Half-Day</div>
                        <div className="stat-value">{records.filter(r => ['Late', 'Half-Day'].includes(r.status)).length}</div>
                    </div>
                </div>
                {records.some(r => r.status === 'Holiday') && (
                    <div
                        className={`stat-card purple ${statusFilter === 'Holiday' ? 'active' : ''}`}
                        onClick={() => handleFilterClick('Holiday')}
                        style={{ cursor: 'pointer', border: statusFilter === 'Holiday' ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.05)' }}
                    >
                        <div className="stat-icon purple"><HiOutlineCalendar /></div>
                        <div className="stat-content">
                            <div className="stat-label">Holiday</div>
                            <div className="stat-value">{records.filter(r => r.status === 'Holiday').length}</div>
                        </div>
                    </div>
                )}
            </div>
            <div className="table-container">
                <div className="table-header">
                    <h3>Attendance Records — {new Date(date).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
                </div>
                {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Code</th>
                                    <th>Department</th>
                                    <th>Designation</th>
                                    {/* Dynamic Headers */}
                                    {statusFilter === 'On Leave' ? (
                                        <>
                                            <th>Leave Type</th>
                                            <th>From</th>
                                            <th>To</th>
                                            <th>Days</th>
                                        </>
                                    ) : statusFilter === 'Absent' ? (
                                        null // No time columns for Absent
                                    ) : (
                                        <>
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Hours</th>
                                        </>
                                    )}
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredRecords.length === 0 ? (
                                    <tr><td colSpan="10"><div className="empty-state"><div className="empty-icon">⏰</div><h3>No records found</h3><p>{search ? 'No employee matches your search' : 'Attendance data will appear here'}</p></div></td></tr>
                                ) : filteredRecords.map(r => (
                                    <tr key={r._id}>
                                        <td style={{ maxWidth: 200, minWidth: 140 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                {r.employee?.profileImage ? (
                                                    <img
                                                        src={r.employee.profileImage}
                                                        alt="profile"
                                                        style={{ width: 32, height: 32, minWidth: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                                                    />
                                                ) : (
                                                    <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                                                        {r.employee?.firstName?.charAt(0)}{r.employee?.lastName?.charAt(0)}
                                                    </div>
                                                )}
                                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {r.employee?.firstName} {r.employee?.lastName}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.employee?.employeeCode}</td>
                                        <td>{r.employee?.department}</td>
                                        <td>{r.employee?.designation}</td>

                                        {/* Dynamic Rows Data */}
                                        {statusFilter === 'On Leave' ? (
                                            <>
                                                <td><span style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{r.leaveDetails?.leaveType}</span></td>
                                                <td>{formatDate(r.leaveDetails?.startDate)}</td>
                                                <td>{formatDate(r.leaveDetails?.endDate)}</td>
                                                <td>{r.leaveDetails?.totalDays}</td>
                                            </>
                                        ) : statusFilter === 'Absent' ? (
                                            null // No time data for Absent
                                        ) : (
                                            <>
                                                {/* If filter is null (All), some rows might be On Leave or Absent */}
                                                {r.status === 'On Leave' ? (
                                                    <td colSpan="3">
                                                        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-secondary)', alignItems: 'center' }}>
                                                            <span style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>{r.leaveDetails?.leaveType}</span>
                                                            <span><strong>From:</strong> {formatDate(r.leaveDetails?.startDate)}</span>
                                                            <span><strong>To:</strong> {formatDate(r.leaveDetails?.endDate)}</span>
                                                            <span><strong>Days:</strong> {r.leaveDetails?.totalDays}</span>
                                                        </div>
                                                    </td>
                                                ) : r.status === 'Absent' ? (
                                                    <td colSpan="3">
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontStyle: 'italic' }}>No attendance marked</span>
                                                    </td>
                                                ) : r.status === 'Holiday' || r.status === 'Weekly Off' ? (
                                                    <td colSpan="3">
                                                        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>{r.details || r.status}</span>
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td>{formatTime(r.checkIn)}</td>
                                                        <td>{formatTime(r.checkOut)}</td>
                                                        <td>{formatHoursDisplay(r.totalHours)}</td>
                                                    </>
                                                )}
                                            </>
                                        )}
                                        <td>{statusBadge(r.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Employee Report Modal */}
            {showReportModal && (
                <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Employee Attendance Report</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowReportModal(false)}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body" style={{ minHeight: '350px' }}>
                            <div className="form-group" style={{ marginBottom: 15 }}>
                                <label>Filter by Department</label>
                                <select
                                    className="form-control"
                                    value={selectedDept}
                                    onChange={e => {
                                        setSelectedDept(e.target.value);
                                        setReportForm({ ...reportForm, employeeId: '' });
                                    }}
                                >
                                    <option value="">All Departments</option>
                                    {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 15 }}>
                                <label>Select Employee *</label>
                                <EmployeeSelect
                                    employees={selectedDept ? employeesList.filter(e => e.department === selectedDept) : employeesList}
                                    value={reportForm.employeeId}
                                    onChange={(val) => setReportForm({ ...reportForm, employeeId: val })}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 15, marginBottom: 25 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Year *</label>
                                    <select
                                        className="form-control"
                                        value={reportForm.year}
                                        onChange={e => setReportForm({ ...reportForm, year: e.target.value })}
                                    >
                                        {[...Array(5)].map((_, i) => {
                                            const y = new Date().getFullYear() - i;
                                            return <option key={y} value={y}>{y}</option>
                                        })}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label>Month</label>
                                    <select
                                        className="form-control"
                                        value={reportForm.month}
                                        onChange={e => setReportForm({ ...reportForm, month: e.target.value })}
                                    >
                                        <option value="">Full Year</option>
                                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                            <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '12px' }}
                                onClick={handleDownloadEmployeeReport}
                                disabled={downloadingReport}
                            >
                                {downloadingReport ? 'Generating Report...' : 'Download Excel Report'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
