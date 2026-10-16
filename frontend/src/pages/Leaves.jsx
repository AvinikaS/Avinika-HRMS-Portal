import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import { HiOutlineCheck, HiOutlineX, HiOutlineCog, HiOutlinePencil, HiOutlineTrash, HiOutlineDownload } from 'react-icons/hi';
import * as XLSX from 'xlsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Leaves() {
    const [leaves, setLeaves] = useState([]);
    const [tab, setTab] = useState('pending');
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");
    const [years, setYears] = useState([]);
    const [showYearModal, setShowYearModal] = useState(false);
    const [yearForm, setYearForm] = useState({ year: '' });
    const [editingYear, setEditingYear] = useState(null);
    const [yearLoading, setYearLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("");

    const fetchLeaves = async () => {
        try {
            const endpoint = tab === 'pending' ? '/leaves/pending' : '/leaves/all';
            const params = { month, year };
            if (tab !== 'pending') params.status = tab.charAt(0).toUpperCase() + tab.slice(1);

            const { data } = await api.get(endpoint, { params });
            setLeaves(data.data || []);
        } catch { setLeaves([]); }
        setLoading(false);
    };

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/payroll-years');
            const yearsList = data.data || [];
            setYears(yearsList);
        } catch { }
    };

    useEffect(() => { fetchYears(); }, []);
    useEffect(() => { setLoading(true); fetchLeaves(); }, [tab, month, year]);

    const handleAction = async (id, action, reasonText = '') => {
        try {
            await api.put(`/leaves/${id}/${action}`, { comments: reasonText });
            fetchLeaves();
        } catch { }
    };

    const handleReject = async (id) => {
        const { value: reason, isConfirmed } = await Swal.fire({
            title: 'Reject Leave Request',
            html: `
                <div style="text-align:left;font-size:13px;">
                    <label style="font-weight:600;display:block;margin-bottom:6px;">Reason for Rejection <span style="color:#ef4444;">*</span></label>
                    <textarea id="swal-reject-reason" class="swal2-textarea" placeholder="Enter reason for rejecting this leave request..." style="width:100%;margin:0;box-sizing:border-box;font-size:13px;height:90px;"></textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Reject Leave',
            confirmButtonColor: '#ef4444',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const val = document.getElementById('swal-reject-reason')?.value?.trim();
                if (!val) {
                    Swal.showValidationMessage('Please enter a reason for rejection');
                    return false;
                }
                return val;
            }
        });
        if (!isConfirmed || !reason) return;
        await handleAction(id, 'reject', reason);
    };


    const typeBadge = (t) => {
        const map = { Casual: 'badge-info', Sick: 'badge-danger', Earned: 'badge-success', Unpaid: 'badge-neutral', Maternity: 'badge-primary', Paternity: 'badge-primary', Other: 'badge-primary' };
        return <span className={`badge ${map[t] || 'badge-neutral'}`}>{t}</span>;
    };

    const statusBadge = (s) => {
        const map = { Pending: 'badge-warning', Approved: 'badge-success', Rejected: 'badge-danger', Cancelled: 'badge-neutral' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

    const filteredLeaves = leaves.filter(l => {
        const fullName = `${l.employee?.firstName} ${l.employee?.lastName}`.toLowerCase();
        const dept = l.employee?.department?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        const matchesSearch = fullName.includes(term) || dept.includes(term);
        const matchesType = !typeFilter || l.leaveType === typeFilter;
        return matchesSearch && matchesType;
    });

    const downloadExcel = () => {
        if (leaves.length === 0) {
            toast.error("No leaves data to export.");
            return;
        }

        const baseLeaves = leaves.filter(l => {
            const fullName = `${l.employee?.firstName} ${l.employee?.lastName}`.toLowerCase();
            const dept = l.employee?.department?.toLowerCase() || "";
            const term = searchTerm.toLowerCase();
            return fullName.includes(term) || dept.includes(term);
        });

        if (baseLeaves.length === 0) {
            toast.error("No leaves match the current search filters.");
            return;
        }

        const wb = XLSX.utils.book_new();
        const xlFormatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

        const mapLeaveData = (list) => list.map(l => ({
            'Employee Code': l.employee?.employeeCode || '-',
            'Employee Name': `${l.employee?.firstName} ${l.employee?.lastName}`,
            'Department': l.employee?.department || '-',
            'Leave Type': l.leaveType,
            'Month & Year': l.startDate ? new Date(l.startDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '-',
            'From Date': xlFormatDate(l.startDate),
            'To Date': xlFormatDate(l.endDate),
            'Total Days': l.totalDays,
            'Reason': l.reason || '-',
            'Status': l.status
        }));

        const headers = ['Employee Code', 'Employee Name', 'Department', 'Leave Type', 'Month & Year', 'From Date', 'To Date', 'Total Days', 'Reason', 'Status'];

        const createSheet = (list) => {
            if (list.length === 0) {
                return XLSX.utils.aoa_to_sheet([headers]);
            }
            return XLSX.utils.json_to_sheet(mapLeaveData(list));
        };

        // 1. All Leaves Sheet
        XLSX.utils.book_append_sheet(wb, createSheet(baseLeaves), "All Leaves");

        // 2. Sick Leaves Sheet
        XLSX.utils.book_append_sheet(wb, createSheet(baseLeaves.filter(l => l.leaveType === 'Sick')), "Sick Leaves");

        // 3. Unpaid Leaves Sheet
        XLSX.utils.book_append_sheet(wb, createSheet(baseLeaves.filter(l => l.leaveType === 'Unpaid')), "Unpaid Leaves");

        // 4. Earned Leaves Sheet
        XLSX.utils.book_append_sheet(wb, createSheet(baseLeaves.filter(l => l.leaveType === 'Earned')), "Earned Leaves");

        // 5. Casual Leaves Sheet
        XLSX.utils.book_append_sheet(wb, createSheet(baseLeaves.filter(l => l.leaveType === 'Casual')), "Casual Leaves");

        // 6. Other Leaves Sheet (Maternity, Paternity, Comp-Off, etc.)
        XLSX.utils.book_append_sheet(wb, createSheet(baseLeaves.filter(l => !['Sick', 'Unpaid', 'Earned', 'Casual'].includes(l.leaveType))), "Other Leaves");

        // Autofit columns for premium look
        Object.keys(wb.Sheets).forEach(sheetName => {
            const ws = wb.Sheets[sheetName];
            if (ws && ws['!ref']) {
                const range = XLSX.utils.decode_range(ws['!ref']);
                const cols = [];
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    let maxLen = 10;
                    for (let R = range.s.r; R <= range.e.r; ++R) {
                        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
                        if (cell && cell.v) {
                            const len = cell.v.toString().length;
                            if (len > maxLen) maxLen = len;
                        }
                    }
                    cols.push({ wch: maxLen + 3 });
                }
                ws['!cols'] = cols;
            }
        });

        const fileName = `Leave_Report_${tab.toUpperCase()}_${month ? MONTHS[month - 1] : 'AllMonths'}_${year || 'AllYears'}.xlsx`;
        XLSX.writeFile(wb, fileName);
        toast.success("Excel report downloaded!");
    };

    return (
        <div className="animate-fadeIn" style={{ minHeight: '80vh' }}>
            <div className="page-header">
                <div><h1>Leave Management</h1><p>Review and manage leave requests</p></div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search employee or dept..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        style={{ flex: '1 1 200px', minWidth: 0 }}
                    />
                    <select
                        className="form-control"
                        value={typeFilter}
                        onChange={e => setTypeFilter(e.target.value)}
                        style={{ flex: '1 1 120px', minWidth: 0 }}
                    >
                        <option value="">All Types</option>
                        <option value="Sick">Sick Leave</option>
                        <option value="Unpaid">Unpaid Leave</option>
                        <option value="Earned">Earned Leave</option>
                        <option value="Casual">Casual Leave</option>
                        <option value="Other">Other Leave</option>
                    </select>
                    <select className="form-control" value={month} onChange={e => setMonth(e.target.value)} style={{ flex: '1 1 120px', minWidth: 0 }}>
                        <option value="">All Months</option>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 120px', minWidth: 0 }}>
                        <select className="form-control" value={year} onChange={e => setYear(e.target.value)} style={{ width: '100%', minWidth: 0 }}>
                            <option value="">All Years</option>
                            {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                            {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
                        </select>
                        <button className="btn btn-icon btn-secondary" onClick={() => setShowYearModal(true)} title="Manage Years" style={{ flexShrink: 0 }}>
                            <HiOutlineCog />
                        </button>
                    </div>
                    <button className="btn btn-secondary" onClick={downloadExcel} title="Export Excel" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <HiOutlineDownload size={16} /> Export
                    </button>
                </div>
            </div>

            <div className="tabs">
                {['pending', 'approved', 'rejected'].map(t => (
                    <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                ))}
            </div>

            <div className="table-container">
                {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead><tr><th>Employee</th><th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th>{tab === 'pending' && <th>Actions</th>}</tr></thead>
                            <tbody>
                                {filteredLeaves.length === 0 ? (
                                    <tr><td colSpan="8"><div className="empty-state"><div className="empty-icon">📅</div><h3>No {tab} leaves</h3></div></td></tr>
                                ) : filteredLeaves.map(l => (
                                    <tr key={l._id}>
                                        <td style={{ maxWidth: 200, minWidth: 140 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                {l.employee?.profileImage ? (
                                                    <img
                                                        src={l.employee.profileImage}
                                                        alt="profile"
                                                        style={{ width: 32, height: 32, minWidth: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,0,0,0.1)' }}
                                                    />
                                                ) : (
                                                    <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                                                        {l.employee?.firstName?.charAt(0)}{l.employee?.lastName?.charAt(0)}
                                                    </div>
                                                )}
                                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.employee?.firstName} {l.employee?.lastName}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.employee?.department}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{typeBadge(l.leaveType)}</td>
                                        <td>{formatDate(l.startDate)}</td>
                                        <td>{formatDate(l.endDate)}</td>
                                        <td style={{ fontWeight: 700 }}>{l.totalDays}</td>
                                        <td style={{ maxWidth: 200 }}>
                                            {l.reason ? (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    style={{ fontSize: '11px', padding: '3px 10px', color: '#4f46e5', fontWeight: 600 }}
                                                    onClick={() => Swal.fire({
                                                        title: 'Leave Reason',
                                                        html: `<div style="text-align:left;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;font-size:13px;color:#334155;line-height:1.6;">${l.reason.replace(/\n/g, '<br/>')}</div>`,
                                                        confirmButtonText: 'Close'
                                                    })}
                                                >
                                                    View
                                                </button>
                                            ) : <span style={{ color: '#cbd5e1' }}>-</span>}
                                        </td>
                                        <td>
                                            {statusBadge(l.status)}
                                            {l.status === 'Rejected' && l.approverComments && (
                                                <div style={{ marginTop: 4 }}>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        style={{ fontSize: '10px', padding: '2px 8px', color: '#dc2626', fontWeight: 600 }}
                                                        onClick={() => Swal.fire({
                                                            title: 'Rejection Reason',
                                                            html: `<div style="text-align:left;background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:14px;font-size:13px;color:#991b1b;line-height:1.6;">${l.approverComments.replace(/\n/g, '<br/>')}</div>`,
                                                            confirmButtonText: 'Close'
                                                        })}
                                                    >
                                                        View Reason
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        {tab === 'pending' && (
                                            <td>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button className="btn btn-sm btn-success" onClick={() => handleAction(l._id, 'approve')}><HiOutlineCheck /> Approve</button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => handleReject(l._id)}><HiOutlineX /> Reject</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showYearModal && (
                <div className="modal-overlay" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Manage Leave Years</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}><HiOutlineX /></button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setYearLoading(true);
                                try {
                                    if (editingYear) {
                                        await api.put(`/payroll-years/${editingYear._id}`, yearForm);
                                    } else {
                                        await api.post('/payroll-years', yearForm);
                                    }
                                    setYearForm({ year: '' });
                                    setEditingYear(null);
                                    fetchYears();
                                } catch (err) {
                                    const msg = err.response?.data?.message || err.message || 'Operation failed';
                                    toast.error(msg);
                                }
                                setYearLoading(false);
                            }} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 12 }}>
                                <div className="form-group">
                                    <label className="form-label">Year (YYYY)</label>
                                    <input type="number" className="form-control" value={yearForm.year} onChange={e => setYearForm({ year: e.target.value })} required placeholder="e.g. 2025" min="2000" max="2100" />
                                </div>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <button type="submit" className="btn btn-primary" disabled={yearLoading} style={{ flex: 1 }}>
                                        {editingYear ? 'Update Year' : 'Add Year'}
                                    </button>
                                    {editingYear && (
                                        <button type="button" className="btn btn-secondary" onClick={() => { setEditingYear(null); setYearForm({ year: '' }); }}>Cancel</button>
                                    )}
                                </div>
                            </form>

                            <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'auto' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: 10, fontSize: 12 }}>Year</th>
                                            <th style={{ padding: 10, fontSize: 12, textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {years.length === 0 ? (
                                            <tr><td colSpan="2" style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No years added yet.</td></tr>
                                        ) : years.map(y => (
                                            <tr key={y._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: 10, fontWeight: 600 }}>{y.year}</td>
                                                <td style={{ padding: 10, textAlign: 'right' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditingYear(y); setYearForm({ year: y.year }); }} style={{ marginRight: 6, fontSize: 10 }}>
                                                        <HiOutlinePencil size={12} style={{ marginRight: 4 }} /> Edit
                                                    </button>
                                                    <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: `Delete ${y.year} year?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
                                                        if (!_swalRes.isConfirmed) return;
                                                        try { await api.delete(`/payroll-years/${y._id}`); fetchYears(); } catch { }
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
