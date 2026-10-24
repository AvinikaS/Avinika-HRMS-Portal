import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import * as XLSX from 'xlsx';
import { HiOutlineDownload, HiOutlineExclamationCircle, HiOutlineCheckCircle, HiOutlinePrinter } from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function BankAdvice() {
    const [payrolls, setPayrolls] = useState([]);
    const [settings, setSettings] = useState({});
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [years, setYears] = useState([{ year: new Date().getFullYear() }]);
    const [selectedDept, setSelectedDept] = useState('All');

    const [companyBanks, setCompanyBanks] = useState([]);
    const [disbursementDetails, setDisbursementDetails] = useState({
        senderName: '',
        senderBankName: '',
        senderAccount: '',
        senderIfsc: '',
        paymentDate: new Date().toISOString().split('T')[0]
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchYears();
        fetchSettings();
    }, []);

    useEffect(() => {
        if (year && month) fetchPayroll();
    }, [month, year]);

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/payroll-years');
            if (data.data?.length) setYears(data.data);
        } catch { }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/settings');
            if (data.data) {
                setSettings(data.data);
                let banks = data.data.companyBanks || [];
                setCompanyBanks(banks);

                let firstBank = banks[0] || {};
                let account = firstBank.accountNo || data.data.bankAccountNo || '';
                let ifsc = firstBank.ifsc || data.data.bankIfscCode || '';
                let bankNameStr = firstBank.bankName || '';

                setDisbursementDetails(prev => ({
                    ...prev,
                    senderName: data.data.companyName || '',
                    senderBankName: bankNameStr,
                    senderAccount: account,
                    senderIfsc: ifsc
                }));
            }
        } catch { }
    };

    const fetchPayroll = async () => {
        setLoading(true);
        try {
            const mQuery = month === 'All' ? '' : `&month=${month}`;
            const { data } = await api.get(`/payroll?year=${year}&limit=1000${mQuery}`);
            setPayrolls(data.data || []);
        } catch (err) {
            toast.error('Failed to fetch payroll data');
        }
        setLoading(false);
    };

    // Filter and Process Employees
    let filteredPayrolls = payrolls;
    if (selectedDept !== 'All') {
        filteredPayrolls = filteredPayrolls.filter(p => p.employee?.department === selectedDept);
    }

    const availableDepartments = ['All', ...new Set(payrolls.map(p => p.employee?.department).filter(Boolean))];

    const processedEmployees = filteredPayrolls.map(p => {
        const emp = p.employee || {};

        const bName = emp.bankName || emp.bankDetails?.bankName || '';
        const accNo = emp.accountNumber || emp.bankDetails?.accountNumber || '';
        const bIfsc = emp.ifscCode || emp.bankDetails?.ifscCode || '';

        const missingBank = !accNo || !bIfsc || !bName;
        const netSalary = p.netSalary || 0;

        let warnings = [];
        if (missingBank) warnings.push('Incomplete bank details');
        if (netSalary <= 0) warnings.push('Check payroll (Net salary is 0)');
        if (bIfsc && bIfsc.length !== 11) warnings.push('Invalid IFSC length');

        return {
            id: emp._id,
            payrollId: p._id,
            employeeCode: emp.employeeCode,
            name: `${emp.firstName || ''} ${emp.lastName || ''}`.trim(),
            department: emp.department || 'N/A',
            designation: emp.designation || 'N/A',
            bankName: emp.bankName || emp.bankDetails?.bankName || 'N/A',
            accountNumber: emp.accountNumber || emp.bankDetails?.accountNumber || '',
            ifscCode: emp.ifscCode || emp.bankDetails?.ifscCode || '',
            netSalary: netSalary,
            grossSalary: p.grossSalary || 0,
            narration: `SAL-${MONTHS[(p.month || month) - 1].substring(0, 3).toUpperCase()}-${p.year || year}-${emp.employeeCode}`,
            warnings,
            _monthVal: p.month || month,
            _yearVal: p.year || year
        };
    }).sort((a, b) => {
        if (a._yearVal !== b._yearVal) return a._yearVal - b._yearVal;
        return a._monthVal - b._monthVal;
    });

    const flaggedCount = processedEmployees.filter(e => e.warnings.length > 0).length;
    const totalPayout = processedEmployees.reduce((sum, e) => sum + e.netSalary, 0);

    const getFormattedExportData = (employeesBatch, isCsv = false) => {
        return employeesBatch.map(e => ({
            'Employee Name': e.name,
            'Employee ID': e.employeeCode,
            'Department': e.department,
            'Bank Name': e.bankName,
            'Account Number': isCsv ? `="${e.accountNumber}"` : e.accountNumber,
            'IFSC Code': e.ifscCode,
            'Net Salary': e.netSalary,
            'Narration': e.narration
        }));
    };

    const handleExportExcel = () => {
        if (!processedEmployees.length) return toast.error('No employees to export');

        const wb = XLSX.utils.book_new();
        const columnWidths = [
            { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 25 }
        ];

        if (month === 'All') {
            const uniqueMonths = [...new Set(processedEmployees.map(e => e._monthVal))].sort((a, b) => a - b);
            uniqueMonths.forEach(mVal => {
                const monthEmps = processedEmployees.filter(e => e._monthVal === mVal);
                const ws = XLSX.utils.json_to_sheet(getFormattedExportData(monthEmps, false));
                ws['!cols'] = columnWidths;
                XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[mVal - 1]} ${monthEmps[0]._yearVal}`);
            });
        } else {
            const ws = XLSX.utils.json_to_sheet(getFormattedExportData(processedEmployees, false));
            ws['!cols'] = columnWidths;
            XLSX.utils.book_append_sheet(wb, ws, 'Bank Advice');
        }

        XLSX.writeFile(wb, `Bank_Advice_${month === 'All' ? 'AllMonths' : MONTHS[month - 1]}_${year}${selectedDept !== 'All' ? '_' + selectedDept : ''}.xlsx`);
    };

    const handleExportCSV = () => {
        if (!processedEmployees.length) return toast.error('No employees to export');

        // CSV generates raw comma separated values logically formatted for database/bank ingestion.
        // We use ="number" to force excel to read it as a string instead of scientific notation.
        const dataForExport = getFormattedExportData(processedEmployees, true);

        const ws = XLSX.utils.json_to_sheet(dataForExport);
        const csv = XLSX.utils.sheet_to_csv(ws);

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Bank_Advice_${month === 'All' ? 'AllMonths' : MONTHS[month - 1]}_${year}${selectedDept !== 'All' ? '_' + selectedDept : ''}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Bank Advice File</h1>
                    <p>Generate salary disbursement files for bank upload (NEFT/NACH)</p>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <select className="form-control" value={selectedDept} onChange={e => setSelectedDept(e.target.value)} style={{ width: 170 }}>
                        {availableDepartments.map((d, i) => <option key={i} value={d}>{d === 'All' ? 'All Departments' : d}</option>)}
                    </select>
                    <select className="form-control" value={month} onChange={e => setMonth(e.target.value === 'All' ? 'All' : +e.target.value)} style={{ width: 140 }}>
                        <option value="All">All Months</option>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select className="form-control" value={year} onChange={e => setYear(+e.target.value)} style={{ flex: '1 1 80px', minWidth: 0 }}>
                        {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                    </select>
                </div>
            </div>

            {/* Metrics */}
            <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card blue">
                    <div className="stat-content">
                        <div className="stat-label">Total Employees</div>
                        <div className="stat-value">{processedEmployees.length}</div>
                    </div>
                </div>
                <div className="stat-card green">
                    <div className="stat-content">
                        <div className="stat-label">Total Payout (₹)</div>
                        <div className="stat-value">₹{totalPayout.toLocaleString()}</div>
                    </div>
                </div>
                <div className={`stat-card ${flaggedCount > 0 ? 'red' : 'purple'}`}>
                    <div className="stat-content">
                        <div className="stat-label">Flagged Issues</div>
                        <div className="stat-value">{flaggedCount}</div>
                    </div>
                </div>
            </div>

            {/* Disbursement Details */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <h3 className="card-title" style={{ margin: 0 }}>Disbursement Details</h3>
                    {companyBanks.length > 0 && (
                        <select className="form-control screen-only" style={{ flex: '1 1 250px', minWidth: 0, maxWidth: '100%' }} onChange={e => {
                            const selected = companyBanks[e.target.value];
                            if (selected) {
                                setDisbursementDetails(prev => ({ ...prev, senderBankName: selected.bankName || '', senderAccount: selected.accountNo, senderIfsc: selected.ifsc }));
                            }
                        }}>
                            <option value="">-- Switch Sender Bank --</option>
                            {companyBanks.map((b, i) => (
                                <option key={i} value={i}>{b.bankName || 'Bank'} - {b.accountNo}</option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">Company Name</label>
                        <input className="form-control screen-only" readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} value={disbursementDetails.senderName} />
                        <div className="print-only-text">{disbursementDetails.senderName}</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Sender Bank</label>
                        <input className="form-control screen-only" readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} value={disbursementDetails.senderBankName} />
                        <div className="print-only-text">{disbursementDetails.senderBankName}</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Account Number</label>
                        <input className="form-control screen-only" readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} value={disbursementDetails.senderAccount} />
                        <div className="print-only-text">{disbursementDetails.senderAccount}</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">IFSC Code</label>
                        <input className="form-control screen-only" readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed' }} value={disbursementDetails.senderIfsc} />
                        <div className="print-only-text">{disbursementDetails.senderIfsc}</div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Payment Date</label>
                        <input className="form-control screen-only" type="date" value={disbursementDetails.paymentDate} onChange={e => setDisbursementDetails({ ...disbursementDetails, paymentDate: e.target.value })} />
                        <div className="print-only-text">{disbursementDetails.paymentDate}</div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleExportExcel} disabled={!processedEmployees.length}>
                        <HiOutlineDownload /> Download Excel
                    </button>
                    <button className="btn btn-secondary" onClick={handleExportCSV} disabled={!processedEmployees.length}>
                        CSV format
                    </button>
                    <button className="btn btn-secondary" onClick={() => window.print()} disabled={!processedEmployees.length}>
                        <HiOutlinePrinter /> Print Summary
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3 className="card-title" style={{ margin: 0 }}>Employee Bank & Salary Details</h3>
                </div>

                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading data...</div>
                ) : processedEmployees.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <p>No payroll data found for {month === 'All' ? 'All Months' : MONTHS[month - 1]} {year} in {selectedDept === 'All' ? 'All Departments' : selectedDept}.</p>
                        <p style={{ fontSize: 12 }}>Please complete the payroll processing first.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Employee</th>
                                    <th>Bank Details</th>
                                    <th>Net Salary (₹)</th>
                                    <th>Narration</th>
                                    <th>Status/Warnings</th>
                                </tr>
                            </thead>
                            <tbody>
                                {processedEmployees.map((emp, i) => (
                                    <tr key={emp.payrollId} style={{ background: emp.warnings.length > 0 ? '#FEF2F2' : 'transparent' }}>
                                        <td>{i + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{emp.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{emp.employeeCode} · {emp.department}</div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{emp.accountNumber || 'MISSING'}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{emp.bankName} · {emp.ifscCode || 'MISSING'}</div>
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{emp.netSalary.toLocaleString()}</td>
                                        <td><div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{emp.narration}</div></td>
                                        <td>
                                            {emp.warnings.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {emp.warnings.map((w, wi) => (
                                                        <span key={wi} className="badge" style={{ background: '#FEE2E2', color: '#DC2626' }}>
                                                            <HiOutlineExclamationCircle /> {w}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="badge" style={{ background: '#DCFCE7', color: '#16A34A' }}>
                                                    <HiOutlineCheckCircle /> Ready
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Print Styles for Print Summary */}
            <style jsx>{`
                .print-only-text {
                    display: none;
                    font-weight: 600;
                    margin-top: 4px;
                    font-size: 14px;
                }
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .animate-fadeIn, .animate-fadeIn * {
                        visibility: visible;
                    }
                    .animate-fadeIn {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    .btn, select, .screen-only {
                        display: none !important;
                    }
                    .print-only-text {
                        display: block !important;
                    }
                }
            `}</style>
        </div>
    );
}
