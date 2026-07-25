import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { HiOutlineCurrencyDollar, HiOutlineDownload, HiOutlineCog, HiOutlineX, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Payroll() {
    const [payrolls, setPayrolls] = useState([]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [years, setYears] = useState([]);
    const [showYearModal, setShowYearModal] = useState(false);
    const [yearForm, setYearForm] = useState({ year: '' });
    const [editingYear, setEditingYear] = useState(null);
    const [yearLoading, setYearLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchPayroll = async () => {
        try {
            const params = { year, limit: month === 0 ? 5000 : 500 };
            if (month !== 0) params.month = month;

            const { data } = await api.get('/payroll', { params });
            setPayrolls(data.data || []);
        } catch { setPayrolls([]); }
        setLoading(false);
    };

    const isMonthPassed = () => {
        if (month === 0) return false;
        const today = new Date();
        const currentM = today.getMonth() + 1;
        const currentY = today.getFullYear();
        if (year < currentY) return true;
        if (year === currentY && month < currentM) return true;
        return false;
    };
    const canGenerate = isMonthPassed();

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/payroll-years');
            const yearsList = data.data || [];
            setYears(yearsList);
            if (yearsList.length > 0 && !yearsList.some(y => y.year === year)) {
                setYear(yearsList[0].year);
            }
        } catch { }
    };

    useEffect(() => { fetchYears(); }, []);
    useEffect(() => { setLoading(true); fetchPayroll(); }, [month, year]);

    const handleGenerate = async (regenerate = false) => {
        if (!canGenerate) {
            toast.error('Cannot generate! Payslips can only be generated after the month is fully completed.');
            return;
        }
        setGenerating(true);
        try {
            await api.post('/payroll/generate', { month, year, regenerate });
            fetchPayroll();
        } catch (err) { toast.error(err.response?.data?.message || 'Error generating payroll'); }
        setGenerating(false);
    };

    const handleMarkPaid = async (id) => {
        try { await api.put(`/payroll/${id}/pay`); fetchPayroll(); } catch { }
    };

    const fmt = (n) => '₹' + (n || 0).toLocaleString('en-IN');

    const statusBadge = (s) => {
        const map = { Draft: 'badge-neutral', Generated: 'badge-info', Paid: 'badge-success', Hold: 'badge-warning' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    const totalNet = payrolls.reduce((s, p) => s + (p.netSalary || 0), 0);
    const totalGross = payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0);
    const paidCount = payrolls.filter(p => p.status === 'Paid').length;

    const filteredPayrolls = payrolls.filter(p => {
        const fullName = `${p.employee?.firstName} ${p.employee?.lastName}`.toLowerCase();
        const code = p.employee?.employeeCode?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();
        return fullName.includes(term) || code.includes(term);
    });

    const handleDownload = async (p) => {
        try {
            const res = await api.get(`/payroll/${p._id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            const code = p.employee?.employeeCode || 'EMP';
            const name = p.employee?.firstName || 'Payslip';
            link.setAttribute('download', `Payslip_${code}_${name}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading payslip:', err);
            toast.error('Failed to download payslip.');
        }
    };

    const handleExportExcel = () => {
        if (!filteredPayrolls.length) {
            toast.error('No data to export for this selection.');
            return;
        }

        const headers = [
            'Employee Code', 'Employee Name', 'Month', 'Present', 'Absent', 'Paid Leaves', 'Unpaid Leaves',
            'Basic', 'HRA', 'Allowances', 'Gross Salary',
            'PF Deducted', 'Tax Deducted', 'Absent/Leave Deduction', 'Total Deductions',
            'Net Salary', 'Status'
        ];

        const wb = XLSX.utils.book_new();

        if (month === 0) {
            // Group by month
            const byMonth = {};
            filteredPayrolls.forEach(p => {
                if (!byMonth[p.month]) byMonth[p.month] = [];
                byMonth[p.month].push(p);
            });

            Object.keys(byMonth).sort((a, b) => +a - +b).forEach(mStr => {
                const m = parseInt(mStr);
                const monthName = MONTHS[m - 1];
                const list = byMonth[m];

                const rows = list.map(p => [
                    p.employee?.employeeCode || '',
                    `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.trim(),
                    monthName,
                    p.presentDays || 0,
                    p.absentDays || 0,
                    p.paidLeaves || 0,
                    p.unpaidLeaves || 0,
                    p.earnings?.basic || 0,
                    p.earnings?.hra || 0,
                    p.earnings?.allowances || 0,
                    p.grossSalary || 0,
                    p.deductions?.pf || 0,
                    p.deductions?.tax || 0,
                    p.deductions?.leaveDeduction || 0,
                    p.totalDeductions || 0,
                    p.netSalary || 0,
                    p.status || ''
                ]);

                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                XLSX.utils.book_append_sheet(wb, ws, monthName);
            });
            XLSX.writeFile(wb, `Payroll_All_Months_${year}.xlsx`);
        } else {
            // Single Month
            const rows = filteredPayrolls.map(p => [
                p.employee?.employeeCode || '',
                `${p.employee?.firstName || ''} ${p.employee?.lastName || ''}`.trim(),
                MONTHS[month - 1],
                p.presentDays || 0,
                p.absentDays || 0,
                p.paidLeaves || 0,
                p.unpaidLeaves || 0,
                p.earnings?.basic || 0,
                p.earnings?.hra || 0,
                p.earnings?.allowances || 0,
                p.grossSalary || 0,
                p.deductions?.pf || 0,
                p.deductions?.tax || 0,
                p.deductions?.leaveDeduction || 0,
                p.totalDeductions || 0,
                p.netSalary || 0,
                p.status || ''
            ]);
            const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
            XLSX.utils.book_append_sheet(wb, ws, MONTHS[month - 1]);
            XLSX.writeFile(wb, `Payroll_${MONTHS[month - 1]}_${year}.xlsx`);
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Payroll</h1><p>Manage salary and payslip generation</p></div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={handleExportExcel} title="Download Excel (CSV)">
                        <HiOutlineDownload /> Export
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleGenerate(false)}
                        disabled={generating}
                        title="Generate Payroll"
                    >
                        <HiOutlineCurrencyDollar /> {generating ? 'Processing...' : 'Generate Payroll'}
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={async () => {
                            if (!canGenerate) {
                                toast.error('Cannot regenerate! Payslips can only be generated after the month is fully completed.');
                                return;
                            }
                            const res = await Swal.fire({ title: 'Regenerate Payroll', text: 'This will delete existing payroll for this month and regenerate. Continue?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
                            if (res.isConfirmed) handleGenerate(true);
                        }}
                        disabled={generating}
                        title="Delete existing and regenerate with fresh attendance data"
                    >
                        🔄 Regenerate
                    </button>
                </div>
            </div>

            <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card purple">
                    <div className="stat-icon purple"><HiOutlineCurrencyDollar /></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Gross</div>
                        <div className="stat-value">{fmt(totalGross)}</div>
                    </div>
                </div>
                <div className="stat-card green">
                    <div className="stat-icon green"><HiOutlineCurrencyDollar /></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Net Payout</div>
                        <div className="stat-value">{fmt(totalNet)}</div>
                    </div>
                </div>
                <div className="stat-card blue">
                    <div className="stat-icon blue"><HiOutlineDownload /></div>
                    <div className="stat-content">
                        <div className="stat-label">Payslips Generated</div>
                        <div className="stat-value">{payrolls.length}</div>
                        <div className="stat-change positive">{paidCount} paid</div>
                    </div>
                </div>
            </div>

            <div className="table-container">
                <div className="table-header">
                    <h3>Payroll — {month === 0 ? `All Months` : MONTHS[month - 1]} {year}</h3>
                    <div className="table-actions">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 0, flexWrap: 'nowrap', width: '100%' }}>
                            <select className="form-control" value={month} onChange={e => setMonth(+e.target.value)} style={{ flex: '3 1 110px', minWidth: '90px' }}>
                                <option value={0}>All Months</option>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                            <select className="form-control" value={year} onChange={e => setYear(+e.target.value)} style={{ flex: '2 1 80px', minWidth: '70px' }}>
                                {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                            </select>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowYearModal(true)} title="Manage Years" style={{ flexShrink: 0, width: '42px', minWidth: '42px', padding: 0, display: 'flex', justifyContent: 'center' }}>
                                <HiOutlineCog />
                            </button>
                        </div>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search employee or code..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead><tr><th>Month</th><th>Employee</th><th>Basic</th><th>HRA</th><th>Allowances</th><th>Bonus/Inc</th><th>Deductions</th><th>Net Salary</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {filteredPayrolls.length === 0 ? (
                                    <tr><td colSpan="10"><div className="empty-state"><div className="empty-icon">💰</div><h3>No payroll records</h3><p>Change selection or generate payroll</p></div></td></tr>
                                ) : filteredPayrolls.map((p, index) => (
                                    <tr key={p._id || index}>
                                        <td style={{ fontWeight: 600 }}>{MONTHS[p.month - 1]}</td>
                                        <td style={{ maxWidth: 200, minWidth: 140 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                                {p.employee?.profileImage ? (
                                                    <img
                                                        src={p.employee.profileImage}
                                                        alt="profile"
                                                        style={{ width: 32, height: 32, minWidth: 32, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(0,0,0,0.1)' }}
                                                    />
                                                ) : (
                                                    <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white' }}>
                                                        {p.employee?.firstName?.charAt(0)}{p.employee?.lastName?.charAt(0)}
                                                    </div>
                                                )}
                                                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.employee?.firstName} {p.employee?.lastName}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.employee?.employeeCode}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{fmt(p.earnings?.basic)}</td>
                                        <td>{fmt(p.earnings?.hra)}</td>
                                        <td>{fmt(p.earnings?.allowances)}</td>
                                        <td>
                                            <div style={{ color: '#10b981', fontSize: 13 }}>{fmt(p.earnings?.bonus)} (B)</div>
                                            <div style={{ color: '#10b981', fontSize: 13 }}>{fmt(p.earnings?.incentive)} (I)</div>
                                            {((p.earnings?.loanDisbursal || 0) > 0 || (p.earnings?.advanceDisbursal || 0) > 0) && (
                                                <div style={{ color: '#4f46e5', fontSize: 13, fontWeight: 600 }}>{fmt((p.earnings?.loanDisbursal || 0) + (p.earnings?.advanceDisbursal || 0))} (L/A Give)</div>
                                            )}
                                        </td>
                                        <td>
                                            <div style={{ color: '#ef4444', fontSize: 12 }}>PF: {fmt(p.deductions?.pf)}</div>
                                            <div style={{ color: '#ef4444', fontSize: 12 }}>ESI: {fmt(p.deductions?.esic)}</div>
                                            <div style={{ color: '#ef4444', fontSize: 12 }}>L/A: {fmt((p.deductions?.loanEmi || 0) + (p.deductions?.advanceRecovery || 0))}</div>
                                        </td>
                                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.netSalary)}</td>
                                        <td>{statusBadge(p.status)}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                {p.status !== 'Paid' && (
                                                    <button className="btn btn-sm btn-success" onClick={() => handleMarkPaid(p._id)}>Mark Paid</button>
                                                )}
                                                <button className="btn btn-icon btn-secondary btn-sm" onClick={() => handleDownload(p)} title="Download Payslip">
                                                    <HiOutlineDownload size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Year Management Modal */}
            {showYearModal && (
                <div className="modal-overlay" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Manage Payroll Years</h2>
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
