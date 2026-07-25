import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { HiOutlineDocumentText, HiOutlineDownload, HiOutlineCheckCircle, HiOutlineClock, HiOutlineExclamationCircle, HiOutlineX } from 'react-icons/hi';
import * as XLSX from 'xlsx';

export default function Form24QModule({ fy }) {
    const [quarter, setQuarter] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('summary');
    const [annexure2Data, setAnnexure2Data] = useState([]);

    const [selectedMonthConfig, setSelectedMonthConfig] = useState(null);
    const [isAddEditFormOpen, setIsAddEditFormOpen] = useState(false);
    const [editingChallanId, setEditingChallanId] = useState(null);

    const [challanForm, setChallanForm] = useState({ month: 4, year: new Date().getFullYear(), bsrCode: '', challanSerial: '', depositDate: '', amount: '' });
    const [availableEmployeesForMonth, setAvailableEmployeesForMonth] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [selectedAnnexEmployee, setSelectedAnnexEmployee] = useState(null);
    const [isFilingModalOpen, setIsFilingModalOpen] = useState(false);
    const [filingForm, setFilingForm] = useState({ receiptNumber: '', dateOfFiling: '' });

    useEffect(() => {
        if (fy) {
            fetchSummary();
            if (quarter === 4) fetchAnnexure2();
        }
    }, [fy, quarter]);

    useEffect(() => {
        if (data?.returnRecord) {
            setFilingForm({
                receiptNumber: data.returnRecord.receiptNumber || '',
                dateOfFiling: data.returnRecord.dateOfFiling ? new Date(data.returnRecord.dateOfFiling).toISOString().split('T')[0] : ''
            });
        } else {
            setFilingForm({ receiptNumber: '', dateOfFiling: '' });
        }
    }, [data]);

    const handleSaveFiling = async (e) => {
        e.preventDefault();
        try {
            await api.post('/payroll/form24q/filing-details', {
                fy,
                quarter: `Q${quarter}`,
                ...filingForm
            });
            toast.success('Filing details updated');
            setIsFilingModalOpen(false);
            fetchSummary();
        } catch (err) {
            toast.error('Failed to update filing details');
        }
    };

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/form24q?fy=${fy}&quarter=Q${quarter}`);
            setData(res.data);
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to fetch quarter details');
        }
        setLoading(false);
    };

    const fetchAnnexure2 = async () => {
        try {
            const res = await api.get(`/payroll/form24q/annexure2?fy=${fy}`);
            setAnnexure2Data(res.data.data || []);
        } catch (err) { }
    };

    const openMonthDashboard = async (monthConfig) => {
        setSelectedMonthConfig(monthConfig);
    };

    const openAddEditForm = async (monthConfig, existingChallan = null) => {
        try {
            if (!existingChallan && monthConfig.balanceDue <= 0 && monthConfig.challans.length > 0) {
                return toast.error('No balance due. Additional challans cannot be added for this month.');
            }

            const res = await api.get(`/payroll/form24q/available-payrolls?month=${monthConfig.month}&year=${monthConfig.year}`);

            let emps = res.data.employees.map(emp => {
                let mappedSoFar = 0;
                monthConfig.challans.forEach(c => {
                    if (existingChallan && c._id === existingChallan._id) return;
                    const me = c.mappedEmployees.find(x => x.employeeId === emp.employeeId);
                    if (me) mappedSoFar += me.amount;
                });
                return {
                    ...emp,
                    mappedTds: mappedSoFar,
                    remainingTds: emp.tdsDeducted - mappedSoFar
                };
            });
            emps = emps.filter(emp => emp.remainingTds > 0 || (existingChallan && existingChallan.mappedEmployees.some(x => x.employeeId === emp.employeeId)));

            setAvailableEmployeesForMonth(emps);

            if (existingChallan) {
                setEditingChallanId(existingChallan._id);
                setChallanForm({
                    month: existingChallan.month, year: existingChallan.year,
                    bsrCode: existingChallan.bsrCode, challanSerial: existingChallan.challanSerial,
                    depositDate: new Date(existingChallan.depositDate).toISOString().substring(0, 10),
                    amount: existingChallan.amount
                });
                setSelectedEmployees(existingChallan.mappedEmployees.map(e => e.employeeId));
            } else {
                let defaultBsr = '';
                if (monthConfig.challans && monthConfig.challans.length > 0) {
                    defaultBsr = monthConfig.challans[monthConfig.challans.length - 1].bsrCode;
                } else if (data && data.monthWise) {
                    for (let i = data.monthWise.length - 1; i >= 0; i--) {
                        if (data.monthWise[i].challans && data.monthWise[i].challans.length > 0) {
                            defaultBsr = data.monthWise[i].challans[data.monthWise[i].challans.length - 1].bsrCode;
                            break;
                        }
                    }
                }

                setEditingChallanId(null);
                setChallanForm({ month: monthConfig.month, year: monthConfig.year, bsrCode: defaultBsr, challanSerial: '', depositDate: '', amount: '' });
                setSelectedEmployees([]);
            }

            setIsAddEditFormOpen(true);
        } catch (err) {
            toast.error('Failed to load employees for mapping');
        }
    };

    const handleSaveChallan = async (e) => {
        e.preventDefault();
        try {
            const enteredAmount = Number(challanForm.amount);

            let maxAllowed = selectedMonthConfig.balanceDue;
            if (editingChallanId) {
                const existing = selectedMonthConfig.challans.find(c => c._id === editingChallanId);
                if (existing) maxAllowed += existing.amount;
            }

            if (enteredAmount > maxAllowed) {
                return toast.error(`Challan amount (₹${enteredAmount}) cannot exceed the total pending due (₹${maxAllowed}).`);
            }

            let remainingChallanAmount = enteredAmount;
            let mappedEmpsPayload = [];

            for (const empId of selectedEmployees) {
                const emp = availableEmployeesForMonth.find(e => e.employeeId === empId);
                if (!emp) continue;

                let amountToTake = Math.min(emp.remainingTds, remainingChallanAmount);
                if (amountToTake > 0) {
                    mappedEmpsPayload.push({ employeeId: empId, amount: amountToTake });
                    remainingChallanAmount -= amountToTake;
                }
            }

            if (remainingChallanAmount > 0) {
                return toast.error(`You entered ₹${enteredAmount}, but selected employees only have a combined due of ₹${enteredAmount - remainingChallanAmount}. Please select more employees or reduce amount.`);
            }

            const payload = {
                fy,
                ...challanForm,
                amount: enteredAmount,
                mappedEmployees: mappedEmpsPayload
            };

            if (editingChallanId) {
                await api.put(`/payroll/form24q/challan/${editingChallanId}`, payload);
                toast.success('Challan updated successfully');
            } else {
                await api.post('/payroll/form24q/challan', payload);
                toast.success('Challan added successfully');
            }

            setIsAddEditFormOpen(false);
            setSelectedMonthConfig(null);
            fetchSummary();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to save challan');
        }
    };

    const generateReturnFiles = async (format) => {
        try {
            if (format === 'rpu-csv') {
                if (data.status === 'Not processed') {
                    return Swal.fire('No Payroll Data', 'No payroll has been processed for this quarter yet. Form 24Q requires payroll data for all 3 months to generate.', 'warning');
                }

                if (data.status === 'Pending') {
                    const hasBalanceDue = data.monthWise.some(mw => mw.taxDeducted > 0 && mw.balanceDue > 0);
                    const completedMonths = data.monthWise.filter(mw => mw.challans.length > 0).length;
                    const processedPayrollMonths = data.monthWise.filter(mw => mw.totalEmployees > 0).length;

                    let errors = [];

                    if (processedPayrollMonths < 3) {
                        errors.push(`<b>• Incomplete Payroll:</b> TDS data is available for only ${processedPayrollMonths} month(s). Form 24Q requires all 3 months of the quarter to be processed.`);
                    } else if (completedMonths < 3) {
                        errors.push(`<b>• Missing Challans:</b> TDS Challans are mapped for only ${completedMonths} month(s). Every applicable month must have at least one mapped challan.`);
                    }

                    if (hasBalanceDue) {
                        errors.push(`<b>• Outstanding Liability:</b> There is a pending TDS balance for one or more months. You must deposit and map all challan payments so the Balance Due is ₹0.`);
                    }

                    if (errors.length === 0) {
                        errors.push(`<b>• Incomplete Data:</b> The quarterly TDS data is incomplete. Please review the month-wise summary.`);
                    }

                    const errorHtml = `<div style="text-align: left; font-size: 14.5px; line-height: 1.6; color: var(--text-secondary); margin-top: 12px;">${errors.join('<br><br>')}</div>`;

                    return Swal.fire({
                        icon: 'error',
                        title: 'Cannot Generate RPU',
                        html: errorHtml,
                        confirmButtonColor: '#4f46e5'
                    });
                }

                const missingPan = data.employeeDetails.filter(e => !e.pan);
                if (missingPan.length > 0) {
                    return Swal.fire('Missing PAN Numbers', `PAN is required for Form 24Q filing. Please update PAN for: ${missingPan.map(e => e.employeeName).join(', ')}`, 'error');
                }

                const payload = { quarter: `Q${quarter}`, fy, format };
                await api.post('/payroll/form24q/generate', payload);

                exportRpuCsv();
                toast.success('Return Generated Successfully. Status marked as Completed.');
                fetchSummary();
            } else if (format === 'internal-excel') {
                exportInternalExcel();
            } else if (format === 'internal-pdf') {
                window.print();
            }
        } catch (err) {
            console.error('FORM24Q ERROR:', err);
            toast.error(err?.response?.data?.message || err.message || 'Failed to generate return');
        }
    };

    const exportRpuCsv = () => {
        const rows = [];
        rows.push(['TAN', 'Company Name', 'Financial Year', 'Quarter', 'Form Type']);
        rows.push(['-', 'HRMS Portal Technologies', fy, `Q${quarter}`, '24Q']);
        rows.push([]);

        rows.push(['Annexure I - Deductee Details']);
        rows.push(['Employee Name', 'PAN', 'Employee Ref No', 'Amount Paid', 'TDS Deducted', 'Surcharge', 'Education Cess', 'Total Tax Deposited', 'Challan BSR Code', 'Date of Deposit']);
        data.employeeDetails.forEach(e => {
            rows.push([
                e.employeeName, e.pan, e.employeeRefNo, e.amountPaid, e.tdsDeducted, e.surcharge, e.educationCess, e.totalTaxDeposited, e.challanBsrCode, e.dateOfDeposit === '-' ? '-' : new Date(e.dateOfDeposit).toLocaleDateString('en-GB')
            ]);
        });

        if (quarter === 4 && annexure2Data.length) {
            rows.push([]);
            rows.push(['Annexure II - Annual Salary Breakup']);
            rows.push(['Employee Name', 'PAN', 'Annual Gross Salary', 'Sec 16 Deduction', 'Total Tax Deductions', 'Taxable Income', 'Annual Tax', 'Total TDS Deducted']);
            annexure2Data.forEach(e => {
                rows.push([
                    e.employeeName, e.pan, e.grossSalary, e.deduction16, Math.max(0, e.grossSalary - e.deduction16), e.totalTaxDeductions, e.taxPayable, e.totalTdsDeducted
                ]);
            });
        }

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `24Q_${fy}_Q${quarter}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportInternalExcel = () => {
        const wb = XLSX.utils.book_new();

        const monthData = data.monthWise.map(mw => {
            const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mw.month - 1];
            return {
                'Month': `${monthName} ${mw.year}`,
                'Tax Deducted (₹)': mw.taxDeducted,
                'Challan Payments': mw.challans.map(c => `₹${c.amount} (#${c.challanSerial} • BSR: ${c.bsrCode} • ${new Date(c.depositDate).toLocaleDateString('en-GB')})`).join('\n') || 'No challans',
                'Employees Mapped': `${mw.employeesMapped} / ${mw.totalEmployees}`,
                'Balance Due (₹)': mw.balanceDue
            };
        });
        const ws1 = XLSX.utils.json_to_sheet(monthData);
        ws1['!cols'] = [
            { wch: 15 }, { wch: 18 }, { wch: 35 }, { wch: 20 }, { wch: 18 }
        ];
        XLSX.utils.book_append_sheet(wb, ws1, 'Month-wise Summary');

        const employeeData = data.employeeDetails.map(ed => ({
            'Employee Name': ed.employeeName,
            'PAN': ed.pan || 'MISSING',
            'Employee Ref No': ed.employeeRefNo,
            'Date of Payment': new Date(ed.dateOfPayment).toLocaleDateString('en-GB'),
            'Amount Paid (₹)': ed.amountPaid,
            'TDS Deducted (₹)': ed.tdsDeducted,
            'Cess (₹)': ed.educationCess
        }));
        const ws2 = XLSX.utils.json_to_sheet(employeeData);
        ws2['!cols'] = [
            { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 15 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws2, 'Employee TDS Details');

        if (quarter === 4 && annexure2Data.length > 0) {
            const annex2DataFormatted = annexure2Data.map(ad => ({
                'Employee Name': ad.employeeName,
                'PAN': ad.pan,
                'Annual Gross Salary (₹)': ad.grossSalary,
                'Sec 16 Deduction (₹)': ad.deduction16,
                'Total Tax Deductions (₹)': ad.totalTaxDeductions,
                'Taxable Income (₹)': ad.totalTaxableIncome,
                'Annual Tax (₹)': ad.taxPayable,
                'Total TDS Deducted (₹)': ad.totalTdsDeducted
            }));
            const ws3 = XLSX.utils.json_to_sheet(annex2DataFormatted);
            ws3['!cols'] = [
                { wch: 25 }, { wch: 15 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
            ];
            XLSX.utils.book_append_sheet(wb, ws3, 'Annexure II');
        }

        XLSX.writeFile(wb, `Internal_Record_24Q_Q${quarter}_${fy}.xlsx`);
    };

    const statusColors = {
        'Completed': '#16A34A',
        'Ready to file': '#2563EB',
        'Pending': '#CA8A04',
        'Not processed': '#6B7280'
    };

    return (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: '1 1 250px', maxWidth: '300px', minWidth: '240px', padding: 0 }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>Select Quarter</div>
                {[1, 2, 3, 4].map(q => (
                    <div
                        key={q}
                        onClick={() => setQuarter(q)}
                        style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: quarter === q ? 'var(--bg-secondary)' : 'transparent', borderLeft: quarter === q ? '3px solid var(--primary-color)' : '3px solid transparent' }}
                    >
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Q{q} Return</div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{q === 1 ? 'Apr-Jun' : q === 2 ? 'Jul-Sep' : q === 3 ? 'Oct-Dec' : 'Jan-Mar'}</div>
                        {q === 4 && <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4 }}>+ Annexure II</div>}
                    </div>
                ))}
            </div>

            <div style={{ flex: '1 1 600px', minWidth: 0 }}>
                <div className="card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ flex: '1 1 auto' }}>
                            <h2 style={{ fontSize: 20, margin: '0 0 8px 0' }}>Q{quarter} Return ({fy})</h2>
                            <span className="badge" style={{ whiteSpace: 'nowrap', background: `${statusColors[data?.status || 'Not processed']}20`, color: statusColors[data?.status || 'Not processed'], padding: '6px 12px', fontSize: 13 }}>
                                {data?.status || 'Loading...'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-start' }}>
                            <button className="btn btn-secondary" onClick={() => setIsFilingModalOpen(true)} style={{ flex: '1 1 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 16px', background: data?.returnRecord?.receiptNumber ? '#f0fdf4' : '', color: data?.returnRecord?.receiptNumber ? '#166534' : '' }}>
                                {data?.returnRecord?.receiptNumber ? <HiOutlineCheckCircle size={18} /> : <HiOutlineClock size={18} />}
                                {data?.returnRecord?.receiptNumber ? 'Filing Updated' : 'Update Filing'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => generateReturnFiles('internal-excel')} style={{ flex: '1 1 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 16px' }}><HiOutlineDownload size={18} /> Internal Excel</button>
                            <button className="btn btn-secondary" onClick={() => generateReturnFiles('internal-pdf')} style={{ flex: '1 1 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 16px' }}><HiOutlineDocumentText size={18} /> Internal PDF</button>
                            <button className="btn btn-primary" onClick={() => generateReturnFiles('rpu-csv')} style={{ flex: '1 1 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '10px 16px' }}>
                                Generate RPU File
                            </button>
                        </div>
                    </div>

                    <div className="tabs" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        <button className={`tab ${activeSubTab === 'summary' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveSubTab('summary')}>Month-wise Summary</button>
                        <button className={`tab ${activeSubTab === 'details' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveSubTab('details')}>Employee TDS Detail</button>
                        {quarter === 4 && <button className={`tab ${activeSubTab === 'annex2' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveSubTab('annex2')}>Annexure II</button>}
                    </div>

                    {!data ? <p>Loading data...</p> : (
                        <>
                            {activeSubTab === 'summary' && (
                                <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                    <table className="table" style={{ minWidth: '800px', width: '100%' }}>
                                        <thead><tr><th>Month</th><th>Tax Deducted (₹)</th><th>Challan Payments</th><th>Employees Mapped</th><th>Balance Due</th><th>Actions</th></tr></thead>
                                        <tbody>
                                            {data.monthWise.map((mw, i) => (
                                                <tr key={i}>
                                                    <td>{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mw.month - 1]} {mw.year}</td>
                                                    <td style={{ fontWeight: 600 }}>₹{mw.taxDeducted.toLocaleString()}</td>
                                                    <td>
                                                        {mw.challans.length === 0 ? <span style={{ color: 'var(--text-tertiary)' }}>No challans</span> :
                                                            mw.challans.map(c => <div key={c._id} style={{ fontSize: 13, marginBottom: 4 }}>₹{c.amount} <span style={{ color: 'var(--text-secondary)' }}>(#{c.challanSerial} &bull; BSR: {c.bsrCode} &bull; {new Date(c.depositDate).toLocaleDateString('en-GB')})</span></div>)
                                                        }
                                                    </td>
                                                    <td style={{ color: mw.employeesMapped < mw.totalEmployees ? '#dc2626' : '#16a34a', fontWeight: mw.employeesMapped < mw.totalEmployees ? 600 : 400 }}>
                                                        {mw.employeesMapped} / {mw.totalEmployees}
                                                    </td>
                                                    <td style={{ color: mw.balanceDue > 0 ? '#dc2626' : 'inherit', fontWeight: mw.balanceDue > 0 ? 600 : 'normal' }}>
                                                        ₹{mw.balanceDue}
                                                    </td>
                                                    <td>
                                                        <button
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => {
                                                                if (mw.totalEmployees === 0) {
                                                                    const monthName = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mw.month - 1];
                                                                    toast.info(`Payroll has not been processed for ${monthName} ${mw.year} yet. You cannot map challans to an empty payroll.`);
                                                                } else {
                                                                    openMonthDashboard(mw);
                                                                }
                                                            }}
                                                        >
                                                            Manage Challans
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeSubTab === 'details' && (
                                <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                    <table className="table" style={{ width: '100%', minWidth: '750px' }}>
                                        <thead><tr><th>Employee Name</th><th>PAN</th><th>Date of Pmt</th><th>Amount Paid</th><th>TDS Deducted</th><th>Cess</th></tr></thead>
                                        <tbody>
                                            {data.employeeDetails.map((ed, i) => (
                                                <tr key={i}>
                                                    <td style={{ fontWeight: 600 }}>{ed.employeeName}<div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 'normal' }}>{ed.employeeRefNo}</div></td>
                                                    <td>{ed.pan || <span style={{ color: 'red' }}>MISSING</span>}</td>
                                                    <td>{new Date(ed.dateOfPayment).toLocaleDateString('en-GB')}</td>
                                                    <td>₹{(ed.amountPaid || 0).toLocaleString()}</td>
                                                    <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{(ed.tdsDeducted || 0).toLocaleString()}</td>
                                                    <td>₹{(ed.educationCess || 0)}</td>
                                                </tr>
                                            ))}
                                            {data.employeeDetails.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No TDS entries found.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeSubTab === 'annex2' && quarter === 4 && (
                                <div>
                                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 6, marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
                                        Annexure II is filed only with Q4 return and contains annual salary and deduction details for each employee. Output matches Form 16 Part B mapping.
                                    </div>
                                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                        <table className="table" style={{ width: '100%', wordBreak: 'break-word', minWidth: '950px' }}>
                                            <thead><tr><th>Employee Name</th><th>PAN</th><th>Annual Gross Salary</th><th>Sec 16 Deduction</th><th>Total Deductions</th><th>Taxable Income</th><th>Annual Tax</th><th>Total TDS Deducted</th></tr></thead>
                                            <tbody>
                                                {annexure2Data.map((ad, i) => (
                                                    <tr key={i} onClick={() => setSelectedAnnexEmployee(ad)} style={{ cursor: 'pointer' }} className="hover-row">
                                                        <td style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{ad.employeeName}</td>
                                                        <td>{ad.pan}</td>
                                                        <td>₹{(ad.grossSalary || 0).toLocaleString()}</td>
                                                        <td>₹{(ad.deduction16 || 0).toLocaleString()}</td>
                                                        <td style={{ textDecoration: 'underline' }}>₹{(ad.totalTaxDeductions || 0).toLocaleString()}</td>
                                                        <td style={{ fontWeight: 600 }}>₹{(ad.totalTaxableIncome || 0).toLocaleString()}</td>
                                                        <td style={{ fontWeight: 600 }}>₹{(ad.taxPayable || 0).toLocaleString()}</td>
                                                        <td style={{ color: '#dc2626', fontWeight: 600 }}>₹{(ad.totalTdsDeducted || 0).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                                {annexure2Data.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: 20 }}>No data available.</td></tr>}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {
                selectedMonthConfig && !isAddEditFormOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="card" style={{ width: '600px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 18 }}>Manage Challans <br /><span style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Month {selectedMonthConfig.month}/{selectedMonthConfig.year}</span></h2>
                                <HiOutlineX style={{ cursor: 'pointer', fontSize: 24, flexShrink: 0 }} onClick={() => setSelectedMonthConfig(null)} />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, background: '#f8fafc', padding: 12, borderRadius: 6 }}>
                                    <div><strong>Tax Deducted:</strong> ₹{selectedMonthConfig.taxDeducted}</div>
                                    <div><strong>Balance Due:</strong> ₹{selectedMonthConfig.balanceDue}</div>
                                </div>
                            </div>
                            {selectedMonthConfig.challans.length > 0 ? (
                                <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: 20 }}>
                                    <table className="table" style={{ width: '100%', minWidth: '600px' }}>
                                        <thead><tr><th>Challan Serial</th><th>BSR Code</th><th>Deposit Date</th><th>Amount</th><th>Action</th></tr></thead>
                                        <tbody>
                                            {selectedMonthConfig.challans.map((c, i) => (
                                                <tr key={i}>
                                                    <td>{c.challanSerial}</td>
                                                    <td>{c.bsrCode}</td>
                                                    <td>{new Date(c.depositDate).toLocaleDateString('en-GB')}</td>
                                                    <td>₹{c.amount}</td>
                                                    <td>
                                                        <button className="btn btn-secondary btn-sm" onClick={() => openAddEditForm(selectedMonthConfig, c)}>Edit</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ padding: 20, textAlign: 'center', background: '#f8fafc', borderRadius: 8, marginBottom: 20 }}>
                                    <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No challans recorded for this month.</p>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedMonthConfig(null)}>Close</button>
                                <button type="button" className="btn btn-primary" onClick={() => openAddEditForm(selectedMonthConfig)}>+ Add New Challan</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                isAddEditFormOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="card" style={{ width: '500px', maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h2 style={{ margin: 0, fontSize: 20 }}>{editingChallanId ? 'Edit Challan Entry' : 'Add Challan Entry'}</h2>
                                <HiOutlineX style={{ cursor: 'pointer', fontSize: 24 }} onClick={() => setIsAddEditFormOpen(false)} />
                            </div>
                            <form onSubmit={handleSaveChallan}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">BSR Code</label>
                                        <input className="form-control" value={challanForm.bsrCode} onChange={e => setChallanForm({ ...challanForm, bsrCode: e.target.value })} required maxLength={7} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Challan Serial No.</label>
                                        <input className="form-control" value={challanForm.challanSerial} onChange={e => setChallanForm({ ...challanForm, challanSerial: e.target.value })} required maxLength={5} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Date of Deposit</label>
                                        <input type="date" className="form-control" value={challanForm.depositDate} onChange={e => setChallanForm({ ...challanForm, depositDate: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Amount Deposited (₹)</label>
                                        <input type="number" className="form-control" value={challanForm.amount} onChange={e => setChallanForm({ ...challanForm, amount: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Map Employees</label>
                                    <div style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '12px', maxHeight: 200, overflowY: 'auto' }}>
                                        {availableEmployeesForMonth.length === 0 ? 'No employees with TDS deduction found for this month.' : availableEmployeesForMonth.map(emp => (
                                            <label key={emp.employeeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedEmployees.includes(emp.employeeId)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedEmployees([...selectedEmployees, emp.employeeId]);
                                                        else setSelectedEmployees(selectedEmployees.filter(id => id !== emp.employeeId));
                                                    }}
                                                />
                                                <div style={{ flex: 1 }}>{emp.name} <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>({emp.employeeCode})</span></div>
                                                <div style={{ fontWeight: 600 }}>₹{emp.remainingTds} {emp.mappedTds > 0 && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>(of ₹{emp.tdsDeducted})</span>}</div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsAddEditFormOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">{editingChallanId ? 'Update Challan' : 'Save Challan'}</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                isFilingModalOpen && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="card" style={{ width: '450px', padding: '24px', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <h2 style={{ margin: 0, fontSize: 20 }}>Form 24Q Filing Details</h2>
                                <HiOutlineX style={{ cursor: 'pointer', fontSize: 24 }} onClick={() => setIsFilingModalOpen(false)} />
                            </div>
                            <form onSubmit={handleSaveFiling}>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label">Receipt / Acknowledgement No.</label>
                                    <input className="form-control" value={filingForm.receiptNumber} onChange={e => setFilingForm({ ...filingForm, receiptNumber: e.target.value })} required placeholder="e.g. 84120250000123" />
                                    <small style={{ color: 'var(--text-tertiary)' }}>This number will appear on Employee Form 16 Part A.</small>
                                </div>
                                <div className="form-group" style={{ marginBottom: 20 }}>
                                    <label className="form-label">Date of Filing</label>
                                    <input type="date" className="form-control" value={filingForm.dateOfFiling} onChange={e => setFilingForm({ ...filingForm, dateOfFiling: e.target.value })} required />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setIsFilingModalOpen(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">Save Details</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {
                selectedAnnexEmployee && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <div style={{ width: '400px', height: '100vh', background: '#fff', padding: '24px', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                <h2 style={{ margin: 0, fontSize: 18 }}>Tax Deductions Breakup</h2>
                                <HiOutlineX style={{ cursor: 'pointer', fontSize: 24 }} onClick={() => setSelectedAnnexEmployee(null)} />
                            </div>
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ fontWeight: 600, fontSize: 16 }}>{selectedAnnexEmployee.employeeName}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>PAN: {selectedAnnexEmployee.pan} | Regime: {selectedAnnexEmployee.regime}</div>
                            </div>
                            <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 8, marginBottom: 20 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Section 80C</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.deduction80C || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Section 80D</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.deduction80D || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Section 80E</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.deduction80E || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Home Loan Int.</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.homeLoanInterest || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>HRA Exemption</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.hraExemption || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Section 80G</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.deduction80G || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Section 80TTA</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.deduction80TTA || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Other Deductions</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.otherDeductions || 0).toLocaleString()}</span></div>
                                <div style={{ borderTop: '1px solid #cbd5e1', margin: '12px 0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary-color)', fontWeight: 600 }}><span>Total Deductions</span><span>₹{(selectedAnnexEmployee.totalTaxDeductions || 0).toLocaleString()}</span></div>
                            </div>
                            <div style={{ padding: '16px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Annual Gross Salary</span><span style={{ fontWeight: 600 }}>₹{(selectedAnnexEmployee.grossSalary || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Sec 16 Deduction</span><span style={{ fontWeight: 600 }}>- ₹{(selectedAnnexEmployee.deduction16 || 0).toLocaleString()}</span></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}><span>Tax Deductions</span><span style={{ fontWeight: 600 }}>- ₹{(selectedAnnexEmployee.totalTaxDeductions || 0).toLocaleString()}</span></div>
                                <div style={{ borderTop: '1px solid var(--border-color)', margin: '12px 0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}><span>Taxable Income</span><span>₹{(selectedAnnexEmployee.totalTaxableIncome || 0).toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
