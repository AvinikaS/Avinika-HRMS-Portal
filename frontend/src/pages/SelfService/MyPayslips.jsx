import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../../utils/api';
import { HiOutlineDownload } from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MyPayslips() {
    const [payslips, setPayslips] = useState([]);
    const [years, setYears] = useState([]);
    const [filter, setFilter] = useState({ month: '', year: '' });
    const [loading, setLoading] = useState(true);
    const [dataLoading, setDataLoading] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [yearsRes, payslipsRes] = await Promise.all([
                api.get('/payroll-years'),
                api.get('/payroll/my')
            ]);
            setYears(yearsRes.data.data || []);
            setPayslips(payslipsRes.data.data || []);
        } catch (err) {
            console.error('Error fetching initial data:', err);
        }
        setLoading(false);
    };

    const fetchFilteredPayslips = async () => {
        setDataLoading(true);
        try {
            const params = {};
            if (filter.month) params.month = filter.month;
            if (filter.year) params.year = filter.year;

            const { data } = await api.get('/payroll/my', { params });
            setPayslips(data.data || []);
        } catch (err) {
            console.error('Error fetching filtered payslips:', err);
            setPayslips([]);
        }
        setDataLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        // Skip first call since fetchData already gets initial data
        if (!loading) {
            fetchFilteredPayslips();
        }
    }, [filter]);

    const fmt = (n) => '₹' + (n || 0).toLocaleString('en-IN');

    const statusBadge = (s) => {
        const map = { Draft: 'badge-neutral', Generated: 'badge-info', Paid: 'badge-success' };
        return <span className={`badge ${map[s] || 'badge-neutral'}`}>{s}</span>;
    };

    const handleDownload = async (id) => {
        try {
            const res = await api.get(`/payroll/${id}/download`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payslip_${id}.pdf`);
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
        if (!payslips.length) {
            toast.error('No data to export.');
            return;
        }

        const headers = [
            'Month', 'Year', 'Present', 'Absent', 'Paid Leaves', 'Unpaid Leaves',
            'Basic', 'HRA', 'Allowances', 'Gross Salary',
            'PF Deducted', 'Tax Deducted', 'Absent/Leave Deduction', 'Total Deductions',
            'Net Salary', 'Status'
        ];

        const rows = payslips.map(p => [
            MONTHS[p.month - 1] || p.month,
            p.year,
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
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "My_Payslips");

        const fname = filter.month ? `My_Payslips_${MONTHS[filter.month - 1]}_${filter.year || 'All'}.xlsx` : `My_Payslips_All.xlsx`;
        XLSX.writeFile(wb, fname);
    };

    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div className="payslip-header">
                <div>
                    <h1>My Payslips</h1>
                    <p>View and download your salary details</p>
                </div>
                <div className="payslip-header-filters">
                    <select
                        className="form-control"
                        value={filter.month}
                        onChange={e => setFilter({ ...filter, month: e.target.value })}
                    >
                        <option value="">All Months</option>
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                    <select
                        className="form-control"
                        value={filter.year}
                        onChange={e => setFilter({ ...filter, year: e.target.value })}
                    >
                        <option value="">All Years</option>
                        {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                    </select>
                    <button className="btn btn-secondary" onClick={handleExportExcel} title="Download Export (Excel)">
                        <HiOutlineDownload /> Export List
                    </button>
                </div>
            </div>

            <div style={{ position: 'relative', minHeight: 200 }}>
                {dataLoading && (
                    <div style={{
                        position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
                        borderRadius: 12, backdropFilter: 'blur(2px)'
                    }}>
                        <div className="spinner"></div>
                    </div>
                )}

                {payslips.length === 0 ? (
                    <div className="card"><div className="empty-state"><div className="empty-icon">💰</div><h3>No payslips available</h3><p>Your payslips will appear here once generated by HR</p></div></div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {payslips.map(p => (
                            <div key={p._id} className="card" style={{ padding: 0 }}>
                                <div className="payslip-card-header">
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{MONTHS[p.month - 1]} {p.year}</h3>
                                        <div style={{ color: 'var(--text-tertiary)', fontSize: 13, marginTop: 2 }}>Payslip</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        {statusBadge(p.status)}
                                        <button className="btn btn-primary btn-sm" onClick={() => handleDownload(p._id)}>
                                            <HiOutlineDownload /> Download PDF
                                        </button>
                                    </div>
                                </div>
                                <div className="payslip-card-body">
                                    <div className="payslip-details-grid">
                                        {/* Earnings Column */}
                                        <div className="payslip-sec-earn">
                                            <h4 className="payslip-sec-title earn">Earnings</h4>
                                            <div className="payslip-items-grid">
                                                <div><div className="payslip-item-lbl">Basic Salary</div><div className="payslip-item-val">{fmt(p.earnings?.basic)}</div></div>
                                                <div><div className="payslip-item-lbl">HRA</div><div className="payslip-item-val">{fmt(p.earnings?.hra)}</div></div>
                                                {p.earnings?.specialAllowance > 0 && <div><div className="payslip-item-lbl">Special Allowance</div><div className="payslip-item-val">{fmt(p.earnings?.specialAllowance)}</div></div>}
                                                {p.earnings?.conveyance > 0 && <div><div className="payslip-item-lbl">Conveyance</div><div className="payslip-item-val">{fmt(p.earnings?.conveyance)}</div></div>}
                                                {p.earnings?.medicalAllowance > 0 && <div><div className="payslip-item-lbl">Medical Allowance</div><div className="payslip-item-val">{fmt(p.earnings?.medicalAllowance)}</div></div>}
                                                {p.earnings?.otherAllowance > 0 && <div><div className="payslip-item-lbl">Other Allowance</div><div className="payslip-item-val">{fmt(p.earnings?.otherAllowance)}</div></div>}
                                                {p.earnings?.bonus > 0 && <div><div className="payslip-item-lbl">Bonus</div><div className="payslip-item-val">{fmt(p.earnings?.bonus)}</div></div>}
                                                {p.earnings?.incentive > 0 && <div><div className="payslip-item-lbl">Incentives</div><div className="payslip-item-val">{fmt(p.earnings?.incentive)}</div></div>}
                                                {p.earnings?.loanDisbursal > 0 && <div><div className="payslip-item-lbl">Loan Disbursal</div><div className="payslip-item-val">{fmt(p.earnings?.loanDisbursal)}</div></div>}
                                                {p.earnings?.advanceDisbursal > 0 && <div><div className="payslip-item-lbl">Advance Disbursal</div><div className="payslip-item-val">{fmt(p.earnings?.advanceDisbursal)}</div></div>}
                                                {p.earnings?.expenseReimbursement > 0 && <div><div className="payslip-item-lbl" style={{ color: 'var(--primary)' }}>Expense Reimbursement</div><div className="payslip-item-val">{fmt(p.earnings?.expenseReimbursement)}</div></div>}
                                            </div>
                                            <div className="payslip-sec-total earn">
                                                <span>Gross Salary</span>
                                                <strong>{fmt(p.grossSalary)}</strong>
                                            </div>
                                        </div>

                                        {/* Deductions Column */}
                                        <div className="payslip-sec-ded">
                                            <h4 className="payslip-sec-title ded">Deductions</h4>
                                            <div className="payslip-items-grid">
                                                <div><div className="payslip-item-lbl danger">PF Deduction</div><div className="payslip-item-val">{fmt(p.deductions?.pf)}</div></div>
                                                {p.deductions?.esic > 0 && <div><div className="payslip-item-lbl danger">ESIC Deduction</div><div className="payslip-item-val">{fmt(p.deductions?.esic)}</div></div>}
                                                {p.deductions?.tax > 0 && <div><div className="payslip-item-lbl danger">Tax / TDS</div><div className="payslip-item-val">{fmt(p.deductions?.tax)}</div></div>}
                                                {p.deductions?.loanEmi > 0 && <div><div className="payslip-item-lbl danger">Loan EMI Deduction</div><div className="payslip-item-val">{fmt(p.deductions?.loanEmi)}</div></div>}
                                                {p.deductions?.advanceRecovery > 0 && <div><div className="payslip-item-lbl danger">Advance Deduction</div><div className="payslip-item-val">{fmt(p.deductions?.advanceRecovery)}</div></div>}
                                                <div><div className="payslip-item-lbl danger">Absent/Leave Ded.</div><div className="payslip-item-val">{fmt(p.deductions?.leaveDeduction)}</div></div>
                                            </div>
                                            <div className="payslip-sec-total ded">
                                                <span>Total Deductions</span>
                                                <strong>{fmt(p.totalDeductions)}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Net Salary Summary Card */}
                                    <div className="payslip-net-salary-card">
                                        <div>
                                            <span style={{ fontSize: 11, color: '#4338CA', textTransform: 'uppercase', fontWeight: 600 }}>Net Salary Payable</span>
                                            <div style={{ fontSize: 22, fontWeight: 800, color: '#4F46E5', marginTop: 4 }}>{fmt(p.netSalary)}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Pay Status</span>
                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#10B981', marginTop: 4 }}>PAID via Direct Deposit</div>
                                        </div>
                                    </div>

                                    {/* Days/Hours Summary Block */}
                                    <div className="payslip-summary-footer">
                                        <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>PRESENT:</span> <span style={{ fontWeight: 600 }}>{p.presentDays || 0} days</span></div>
                                        <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>ABSENT:</span> <span style={{ fontWeight: 600 }}>{p.absentDays || 0} days</span></div>
                                        <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>UNPAID LEAVES:</span> <span style={{ fontWeight: 600 }}>{p.unpaidLeaves || 0} days</span></div>
                                        <div><span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginRight: 8 }}>OVERTIME:</span> <span style={{ fontWeight: 600 }}>{p.overtimeHours || 0} hrs</span></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
