import React, { useState, useEffect } from 'react';
import { HiOutlineDownload, HiOutlineCheckCircle, HiOutlineClock, HiOutlineDocumentText, HiOutlineX } from 'react-icons/hi';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PfModule() {
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [activeTab, setActiveTab] = useState('summary');
    const [loading, setLoading] = useState(false);

    // Details tab filters
    const [empFilter, setEmpFilter] = useState('All');
    // Challans tab filters
    const [challanFilter, setChallanFilter] = useState('All');

    const [summary, setSummary] = useState(null);
    const [monthlyBreakdown, setMonthlyBreakdown] = useState([]);
    const [employeeDetails, setEmployeeDetails] = useState([]);
    const [challanFlow, setChallanFlow] = useState(null);
    const [challansList, setChallansList] = useState([]);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedChallan, setSelectedChallan] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        trrn: '',
        paymentDate: '',
        transactionId: ''
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/payroll/pf-challan?year=${year}&month=${month}`);
            setSummary(res.data.summary);
            setMonthlyBreakdown(res.data.monthlyBreakdown || []);
            setEmployeeDetails(res.data.employeeDetails);
            setChallanFlow(res.data.challanFlow);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error fetching PF Challan calculation');
        } finally {
            setLoading(false);
        }
    };

    const fetchChallansList = async () => {
        try {
            setLoading(true);
            const res = await api.get('/payroll/pf-challans');
            setChallansList(res.data.data);
        } catch (err) { } finally { setLoading(false); }
    };

    useEffect(() => {
        if (activeTab !== 'challans') fetchReport();
        else fetchChallansList();
    }, [year, month, activeTab]);

    const handleGenerateEcr = async () => {
        try {
            setLoading(true);
            const res = await api.post('/payroll/pf-challan/generate', { year, month });
            toast.success(res.data.message);
            fetchReport();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to generate ECR');
        } finally {
            setLoading(false);
        }
    };

    const downloadEcrTxt = async () => {
        try {
            const res = await api.get(`/payroll/pf-challan/ecr-file?year=${year}&month=${month}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `ECR_Text_${month}_${year}.txt`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast.error("Error downloading file");
        }
    };

    const exportExcel = () => {
        if (!employeeDetails.length && (!monthlyBreakdown || monthlyBreakdown.length === 0) && (!filteredChallans || filteredChallans.length === 0)) {
            return toast.info("No payroll data generated for the selected period.");
        }

        const wb = XLSX.utils.book_new();

        const getStrStatus = (s) => {
            if (s === 'not_generated') return 'Not Generated';
            if (s === 'ecr_generated') return 'ECR Generated';
            if (s === 'payment_pending') return 'Payment Pending';
            if (s === 'paid') return 'Paid';
            if (s === 'completed') return 'Completed';
            return s || 'Not Generated';
        };

        if (activeTab === 'summary') {
            if (!summary) return toast.info("No summary data to export");
            if (month === 'All' && monthlyBreakdown.length > 0) {
                const rows = monthlyBreakdown.map(mb => ({
                    "Month & Year": `${MONTHS[mb.month - 1]} ${year}`,
                    "Included Employees": mb.totalEmployeesIncluded,
                    "Employee EPF": mb.totalEmployeeEPF,
                    "Employer EPF": mb.totalEmployerEPF,
                    "Employer EPS": mb.totalEmployerEPS,
                    "Admin & EDLI": (mb.adminCharges || 0) + mb.totalEDLI,
                    "Total Amount": mb.grandTotal || 0,
                    "Status": getStrStatus(mb.status)
                }));
                const ws = XLSX.utils.json_to_sheet(rows);
                ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
                XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
            } else {
                const rows = [{
                    "Month & Year": month === 'All' ? `All Months ${year}` : `${MONTHS[month - 1]} ${year}`,
                    "Included Employees": summary.totalEmployeesIncluded,
                    "Employee EPF": summary.totalEmployeeEPF,
                    "Employer EPF": summary.totalEmployerEPF,
                    "Employer EPS": summary.totalEmployerEPS,
                    "Admin & EDLI": (summary.adminCharges || 0) + summary.totalEDLI,
                    "Total Amount": summary.grandTotal || 0,
                    "Status": getStrStatus(challanFlow?.status || summary.status)
                }];
                const ws = XLSX.utils.json_to_sheet(rows);
                ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
                XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
            }
            XLSX.writeFile(wb, `PF_Summary_${month === 'All' ? 'All_Months' : MONTHS[month - 1]}_${year}.xlsx`);
            return;
        }

        if (activeTab === 'details') {
            if (!employeeDetails.length) return toast.info("No employee data to export");

            const mapData = (arr) => arr.map(e => ({
                "Emp Code": e.employeeCode,
                "Employee Name": e.employeeName,
                "UAN": e.uan || "Missing",
                "Basic Salary (₹)": e.basicSalary,
                "PF Type": e.pfCalculationType === 'actual_wage' ? 'Actual Wage' : e.pfCalculationType === 'pf_ceiling' ? 'PF Ceiling ₹15K' : 'Not Applicable',
                "PF Wage (₹)": e.pfWage,
                "Employee EPF (₹)": e.employeeEPF,
                "Employer EPF (₹)": e.employerEPF,
                "Employer EPS (₹)": e.employerEPS,
                "EDLI (₹)": e.edli,
                "Total (₹)": e.total
            }));

            const allEmps = mapData(employeeDetails);
            const actualWageEmps = mapData(employeeDetails.filter(e => e.pfCalculationType === 'actual_wage'));
            const ceilingEmps = mapData(employeeDetails.filter(e => e.pfCalculationType === 'pf_ceiling'));
            const naEmps = mapData(employeeDetails.filter(e => e.pfCalculationType === 'not_applicable'));

            const colWidths = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];

            const wsAll = XLSX.utils.json_to_sheet(allEmps); wsAll['!cols'] = colWidths;
            const wsActual = XLSX.utils.json_to_sheet(actualWageEmps); wsActual['!cols'] = colWidths;
            const wsCeiling = XLSX.utils.json_to_sheet(ceilingEmps); wsCeiling['!cols'] = colWidths;
            const wsNa = XLSX.utils.json_to_sheet(naEmps); wsNa['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, wsAll, "All");
            XLSX.utils.book_append_sheet(wb, wsActual, "Actual Wage");
            XLSX.utils.book_append_sheet(wb, wsCeiling, "PF Ceiling");
            XLSX.utils.book_append_sheet(wb, wsNa, "Not Applicable");

            XLSX.writeFile(wb, `PF_Employee_Details_${month === 'All' ? 'All_Months' : MONTHS[month - 1]}_${year}.xlsx`);
            return;
        }

        if (activeTab === 'challans') {
            const baseChallans = challansList.filter(c => c.year === year && (month === 'All' ? true : c.month === month));
            if (!baseChallans || !baseChallans.length) return toast.info("No challans to export");

            const mapRows = (arr) => arr.map(c => ({
                "Month": `${MONTHS[c.month - 1]} ${c.year}`,
                "Included Emps": c.totalEmployeesIncluded,
                "Employee EPF": c.totalEmployeeEPF,
                "Employer EPF": c.totalEmployerEPF,
                "Employer EPS": c.totalEmployerEPS,
                "Admin & EDLI": (c.adminCharges || 0) + c.totalEDLI,
                "Grand Total": c.grandTotal,
                "TRRN": c.trrn || '-',
                "Transaction ID": c.transactionId || '-',
                "Payment Date": c.paymentDate ? new Date(c.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pending',
                "Status": getStrStatus(c.status)
            }));
            const colWidths = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }];

            if (month === 'All') {
                const pendingChallans = baseChallans.filter(c => c.status !== 'paid' && c.status !== 'completed');
                const successChallans = baseChallans.filter(c => c.status === 'paid' || c.status === 'completed');

                const wsAll = XLSX.utils.json_to_sheet(mapRows(baseChallans)); wsAll['!cols'] = colWidths;
                const wsPending = XLSX.utils.json_to_sheet(mapRows(pendingChallans)); wsPending['!cols'] = colWidths;
                const wsSuccess = XLSX.utils.json_to_sheet(mapRows(successChallans)); wsSuccess['!cols'] = colWidths;

                XLSX.utils.book_append_sheet(wb, wsAll, "All Challan");
                XLSX.utils.book_append_sheet(wb, wsPending, "Pending Challan");
                XLSX.utils.book_append_sheet(wb, wsSuccess, "Success Challan");
            } else {
                const ws = XLSX.utils.json_to_sheet(mapRows(baseChallans));
                ws['!cols'] = colWidths;
                XLSX.utils.book_append_sheet(wb, ws, "Challans");
            }

            XLSX.writeFile(wb, `PF_Challan_Tracking_${month === 'All' ? 'All_Months' : MONTHS[month - 1]}_${year}.xlsx`);
            return;
            return;
        }
    };

    const exportPdf = async () => {
        if (month === 'All') {
            if (!monthlyBreakdown || monthlyBreakdown.length === 0) return toast.info("No payroll data generated for the selected period.");
            const allUnGenerated = monthlyBreakdown.every(mb => mb.status === 'not_generated');
            if (allUnGenerated) return toast.info("ECR has not been generated for any month in this period.");
        } else {
            if (!summary || summary.totalEmployeesIncluded === 0) return toast.info("No payroll data generated for the selected period.");
            if (summary.status === 'not_generated') return toast.info("Please generate the ECR first before exporting the PDF.");
        }

        try {
            const res = await api.get(`/payroll/pf-challan/export?year=${year}&month=${month}&format=pdf`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `PF_Challan_${month}_${year}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            toast.error("Error downloading PDF");
        }
    };

    const openPaymentModal = (c) => {
        setSelectedChallan(c);
        setPaymentForm({
            trrn: c.trrn || '',
            paymentDate: c.paymentDate ? new Date(c.paymentDate).toISOString().split('T')[0] : '',
            transactionId: c.transactionId || ''
        });
        setShowPaymentModal(true);
    };

    const handleUpdatePayment = async (e) => {
        e.preventDefault();
        if (!paymentForm.trrn) return toast.error("TRRN Number is required");

        try {
            await api.post('/payroll/pf-challan/payment-details', {
                year: selectedChallan.year, month: selectedChallan.month,
                trrn: paymentForm.trrn,
                transactionId: paymentForm.transactionId,
                paymentDate: paymentForm.paymentDate
            });
            toast.success('Payment details saved. You can now mark it as Success.');
            setShowPaymentModal(false);
            fetchChallansList();
        } catch (err) { toast.error(err.response?.data?.message || 'Error updating payment'); }
    };

    const handleMarkSuccess = (c) => {
        Swal.fire({
            title: 'Mark as Success?',
            text: "Are you sure you want to mark this challan as Paid/Completed? Ensure the payment date and TRRN are correctly updated.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#16a34a',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Make it Success!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.post('/payroll/pf-challan/payment-details', {
                        year: c.year, month: c.month,
                        status: 'paid'
                    });
                    toast.success('Challan successfully marked as Paid!');
                    fetchChallansList();
                } catch (err) {
                    toast.error(err?.response?.data?.message || 'Failed to update');
                }
            }
        });
    };

    const getStatusBadge = (s) => {
        const badgeStyle = { whiteSpace: 'nowrap' };
        if (s === 'not_generated') return <span className="badge badge-secondary" style={badgeStyle}>Not Generated</span>;
        if (s === 'ecr_generated') return <span className="badge badge-warning" style={badgeStyle}>ECR Generated</span>;
        if (s === 'payment_pending') return <span className="badge badge-warning" style={badgeStyle}>Payment Pending</span>;
        if (s === 'paid') return <span className="badge badge-success" style={badgeStyle}>Paid</span>;
        if (s === 'completed') return <span className="badge badge-success" style={{ ...badgeStyle, background: '#064e3b', color: '#fff' }}>Completed</span>;
        return <span className="badge badge-info" style={badgeStyle}>{s}</span>;
    };

    const getPfTypeBadge = (t) => {
        if (t === 'actual_wage') return <span className="badge" style={{ background: '#dbeafe', color: '#1e40af' }}>Actual Wage</span>;
        if (t === 'pf_ceiling') return <span className="badge" style={{ background: '#f3e8ff', color: '#6b21a8' }}>PF Ceiling ₹15K</span>;
        return <span className="badge badge-secondary">Not Applicable</span>;
    };

    const filteredChallans = challansList.filter(c => {
        if (year && c.year !== year) return false;
        if (month !== 'All' && c.month !== month) return false;
        if (challanFilter === 'Success') return c.status === 'paid' || c.status === 'completed';
        if (challanFilter === 'Pending / Generated') return c.status !== 'paid' && c.status !== 'completed';
        return true;
    });

    const filteredEmployees = employeeDetails.filter(e => {
        if (empFilter === 'All') return true;
        if (empFilter === 'Actual Wage' && e.pfCalculationType === 'actual_wage') return true;
        if (empFilter === 'PF Ceiling' && e.pfCalculationType === 'pf_ceiling') return true;
        if (empFilter === 'Not Applicable' && e.pfCalculationType === 'not_applicable') return true;
        return false;
    });

    const isUanMissing = employeeDetails.some(e => e.pfCalculationType !== 'not_applicable' && !e.uan);

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                        <input
                            type="number"
                            className="form-control"
                            value={year}
                            onChange={e => setYear(+e.target.value)}
                            style={{ width: 120 }}
                            min="2000"
                            max="2100"
                        />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                        <select className="form-control" value={month} onChange={e => setMonth(e.target.value === 'All' ? 'All' : +e.target.value)} style={{ width: 150 }}>
                            <option value="All">All Months</option>
                            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={exportExcel}><HiOutlineDownload /> Export Excel</button>
                    <button className="btn btn-secondary" onClick={exportPdf}><HiOutlineDocumentText /> Export PDF</button>
                </div>
            </div>

            {isUanMissing && activeTab !== 'challans' && (
                <div style={{ padding: 12, background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', borderRadius: 8, marginBottom: 20 }}>
                    <strong>Warning:</strong> One or more employees covered under PF are missing their UAN. They will be excluded from the generated ECR. Please update their Employee Profiles.
                </div>
            )}

            <div className="tabs" style={{ marginBottom: 20, display: 'flex', gap: '4px', borderBottom: '1px solid #eee', flexWrap: 'wrap' }}>
                <div onClick={() => setActiveTab('summary')} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 16px', cursor: 'pointer', borderBottom: activeTab === 'summary' ? '2px solid #4f46e5' : 'none', fontWeight: activeTab === 'summary' ? 600 : 400 }}>Monthly Summary</div>
                <div onClick={() => setActiveTab('details')} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 16px', cursor: 'pointer', borderBottom: activeTab === 'details' ? '2px solid #4f46e5' : 'none', fontWeight: activeTab === 'details' ? 600 : 400 }}>Employee Details</div>
                <div onClick={() => setActiveTab('challans')} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 16px', cursor: 'pointer', borderBottom: activeTab === 'challans' ? '2px solid #4f46e5' : 'none', fontWeight: activeTab === 'challans' ? 600 : 400 }}>Challan Tracking</div>
            </div>

            {loading ? <div><div className="spinner" style={{ margin: '40px auto' }}></div></div> : (
                <div>
                    {activeTab === 'summary' && summary && (
                        <div>
                            <div className="stat-grid" style={{ marginBottom: 20 }}>
                                <div className="stat-card purple">
                                    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                            <div className="stat-label" style={{ margin: 0 }}>Total Applicability :</div>
                                            <div className="stat-value" style={{ margin: 0, fontSize: 16 }}>{summary.totalEmployeesIncluded}</div>
                                        </div>
                                        <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text-secondary)' }}>Actual: <strong>{summary.actualWageCount}</strong> &nbsp;|&nbsp; Ceiling: <strong>{summary.ceilingCount}</strong></div>
                                    </div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-label">Total PF Wages</div>
                                    <div className="stat-value">₹{summary.totalPFWages.toLocaleString('en-IN')}</div>
                                </div>
                                <div className="stat-card green">
                                    <div className="stat-label">Employee EPF</div>
                                    <div className="stat-value">₹{summary.totalEmployeeEPF.toLocaleString('en-IN')}</div>
                                </div>
                                <div className="stat-card blue">
                                    <div className="stat-label">Employer (EPF+EPS)</div>
                                    <div className="stat-value">₹{(summary.totalEmployerEPF + summary.totalEmployerEPS).toLocaleString('en-IN')}</div>
                                </div>
                                <div className="stat-card orange">
                                    <div className="stat-label">Admin & EDLI</div>
                                    <div className="stat-value">₹{(summary.adminCharges + summary.totalEDLI).toLocaleString('en-IN')}</div>
                                </div>
                            </div>
                            <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                                <h3 style={{ margin: '0 0 16px 0', fontSize: 18 }}>Monthly PF Summary</h3>
                                <div className="table-responsive" style={{ marginBottom: 20, overflowX: 'auto' }}>
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Month & Year</th>
                                                <th>Included Employees</th>
                                                <th>Employee EPF</th>
                                                <th>Employer EPF</th>
                                                <th>Employer EPS</th>
                                                <th>Admin & EDLI</th>
                                                <th>Total Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {month === 'All' && monthlyBreakdown.length > 0 ? (
                                                monthlyBreakdown.map(mb => (
                                                    <tr key={mb.month}>
                                                        <td>{MONTHS[mb.month - 1]} {year}</td>
                                                        <td>{mb.totalEmployeesIncluded}</td>
                                                        <td>₹{mb.totalEmployeeEPF.toLocaleString('en-IN')}</td>
                                                        <td>₹{mb.totalEmployerEPF.toLocaleString('en-IN')}</td>
                                                        <td>₹{mb.totalEmployerEPS.toLocaleString('en-IN')}</td>
                                                        <td>₹{((mb.adminCharges || 0) + mb.totalEDLI).toLocaleString('en-IN')}</td>
                                                        <td style={{ fontWeight: 700, color: '#4f46e5' }}>
                                                            ₹{mb.grandTotal?.toLocaleString('en-IN')}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td>{month === 'All' ? 'All Months' : MONTHS[month - 1]} {year}</td>
                                                    <td>{summary.totalEmployeesIncluded}</td>
                                                    <td>₹{summary.totalEmployeeEPF.toLocaleString('en-IN')}</td>
                                                    <td>₹{summary.totalEmployerEPF.toLocaleString('en-IN')}</td>
                                                    <td>₹{summary.totalEmployerEPS.toLocaleString('en-IN')}</td>
                                                    <td>₹{(summary.adminCharges + summary.totalEDLI).toLocaleString('en-IN')}</td>
                                                    <td style={{ fontWeight: 700, color: '#4f46e5' }}>
                                                        ₹{summary.grandTotal?.toLocaleString('en-IN')}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {month !== 'All' && (
                                    <>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#64748b' }}>
                                                STATUS: {getStatusBadge(challanFlow?.status || summary.status)}
                                            </div>
                                            <div style={{ display: 'flex', gap: 12, flexDirection: 'column', flex: '1 1 auto', maxWidth: '100%' }}>
                                                <button className="btn btn-primary" onClick={handleGenerateEcr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 16px' }}>
                                                    <HiOutlineDocumentText size={18} /> {challanFlow && challanFlow.status !== 'not_generated' ? 'Regenerate Report & ECR' : 'Generate Report & ECR'}
                                                </button>
                                                {challanFlow && challanFlow.status !== 'not_generated' && !isUanMissing && (
                                                    <button className="btn btn-secondary" onClick={downloadEcrTxt} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '10px 16px' }}>
                                                        <HiOutlineDownload size={18} /> Download ECR Text File
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {challanFlow && challanFlow.status !== 'not_generated' && (
                                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 16 }}>
                                                <strong>Note:</strong> Upload this ECR file on the EPFO Unified Portal (unifiedportal-emp.epfindia.gov.in). After upload, generate the TRRN and complete payment. Enter TRRN in the 'Challan Tracking' tab.
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                    {activeTab === 'details' && (
                        <div>
                            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: 16, flexWrap: 'wrap', gap: 4, width: '100%' }}>
                                {['All', 'Actual Wage', 'PF Ceiling', 'Not Applicable'].map(f => (
                                    <button
                                        key={f}
                                        onClick={() => setEmpFilter(f)}
                                        style={{
                                            flex: '1 1 auto',
                                            border: 'none',
                                            background: empFilter === f ? '#fff' : 'transparent',
                                            color: empFilter === f ? '#4f46e5' : '#64748b',
                                            boxShadow: empFilter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: empFilter === f ? 600 : 500,
                                            padding: '8px 16px',
                                            borderRadius: '6px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                            <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <table style={{ minWidth: '850px', width: '100%' }}>
                                    <thead>
                                        <tr><th>Code & Name</th><th>UAN</th><th>Basic</th><th>PF Type</th><th>PF Wage</th><th>Employee EPF</th><th>Er. EPF</th><th>Er. EPS</th><th>EDLI</th><th>Total</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredEmployees.map((e, i) => (
                                            <tr key={i} style={{ background: (!e.uan && e.pfCalculationType !== 'not_applicable') ? '#fee2e2' : '' }}>
                                                <td style={{ minWidth: 150 }}>
                                                    <strong>{e.employeeName}</strong>
                                                    <div style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.employeeCode}</div>
                                                </td>
                                                <td>
                                                    {e.uan ? e.uan : (
                                                        e.pfCalculationType !== 'not_applicable' ? <span className="badge" style={{ background: '#ef4444', color: '#fff' }}>Missing</span> : '-'
                                                    )}
                                                </td>
                                                <td>₹{e.basicSalary.toLocaleString('en-IN')}</td>
                                                <td>{getPfTypeBadge(e.pfCalculationType)}</td>
                                                <td>₹{e.pfWage.toLocaleString('en-IN')}</td>
                                                <td>₹{e.employeeEPF.toLocaleString('en-IN')}</td>
                                                <td>₹{e.employerEPF.toLocaleString('en-IN')}</td>
                                                <td>₹{e.employerEPS.toLocaleString('en-IN')}</td>
                                                <td>₹{e.edli.toLocaleString('en-IN')}</td>
                                                <td style={{ fontWeight: 600 }}>₹{e.total.toLocaleString('en-IN')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {activeTab === 'challans' && (
                        <div>
                            {month === 'All' && (
                                <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', marginBottom: 16, flexWrap: 'wrap', gap: 4, width: '100%' }}>
                                    {['All', 'Success', 'Pending / Generated'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setChallanFilter(f)}
                                            style={{
                                                flex: '1 1 auto',
                                                border: 'none',
                                                background: challanFilter === f ? '#fff' : 'transparent',
                                                color: challanFilter === f ? '#4f46e5' : '#64748b',
                                                boxShadow: challanFilter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                fontWeight: challanFilter === f ? 600 : 500,
                                                padding: '8px 16px',
                                                borderRadius: '6px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="table-container" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <table style={{ minWidth: '800px', width: '100%' }}>
                                    <thead>
                                        <tr><th>Month</th><th>Included Emps</th><th>Grand Total</th><th>TRRN / Trans. ID</th><th>Payment Date</th><th>Status</th><th>Actions</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredChallans.length === 0 && (
                                            <tr><td colSpan="7" style={{ textAlign: 'center' }}>No regular challan tracking records found.</td></tr>
                                        )}
                                        {filteredChallans.map(c => (
                                            <tr key={c._id}>
                                                <td style={{ fontWeight: 600 }}>{MONTHS[c.month - 1]} {c.year}</td>
                                                <td>{c.totalEmployeesIncluded}</td>
                                                <td>₹{c.grandTotal.toLocaleString('en-IN')}</td>
                                                <td>
                                                    <span style={{ fontFamily: 'monospace' }}>{c.trrn || 'Not updated'}</span>
                                                    {c.transactionId ? <div style={{ fontSize: 11, color: 'gray', marginTop: 2 }}>Txn: {c.transactionId}</div> : null}
                                                </td>
                                                <td>{c.paymentDate ? new Date(c.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}</td>
                                                <td>{getStatusBadge(c.status)}</td>
                                                <td>
                                                    {c.status === 'paid' || c.status === 'completed' ? (
                                                        <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 600 }}>Payment Complete</span>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                            <button className="btn btn-secondary btn-sm" onClick={() => openPaymentModal(c)}>
                                                                {c.trrn ? 'Edit Details' : 'Add Details'}
                                                            </button>
                                                            {c.trrn && (
                                                                <button className="btn btn-success btn-sm" style={{ padding: '0 8px', fontSize: 13 }} onClick={() => handleMarkSuccess(c)}>
                                                                    <HiOutlineCheckCircle style={{ marginRight: 4 }} /> Success
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>{selectedChallan?.status === 'paid' || selectedChallan?.status === 'completed' ? 'Edit PF Challan Details' : 'Add PF Challan Details'}</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowPaymentModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleUpdatePayment}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label" style={{ display: 'block', fontSize: 13, marginBottom: 8, color: '#374151', fontWeight: 500 }}>Challan Amount (₹)</label>
                                    <input className="form-control" value={selectedChallan?.grandTotal?.toLocaleString('en-IN') || ''} readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--primary-color)', fontWeight: 600, width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6 }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label" style={{ display: 'block', fontSize: 13, marginBottom: 8, color: '#374151', fontWeight: 500 }}>TRRN Number</label>
                                    <input className="form-control" placeholder="Enter TRRN" value={paymentForm.trrn} onChange={e => setPaymentForm({ ...paymentForm, trrn: e.target.value })} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6 }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label" style={{ display: 'block', fontSize: 13, marginBottom: 8, color: '#374151', fontWeight: 500 }}>Payment Date</label>
                                    <input type="date" className="form-control" value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6 }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 16 }}>
                                    <label className="form-label" style={{ display: 'block', fontSize: 13, marginBottom: 8, color: '#374151', fontWeight: 500 }}>Transaction ID</label>
                                    <input className="form-control" placeholder="Transaction/BSR ID (Optional)" value={paymentForm.transactionId} onChange={e => setPaymentForm({ ...paymentForm, transactionId: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 6 }} />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: 12, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{(selectedChallan?.status === 'paid' || selectedChallan?.status === 'completed' || selectedChallan?.trrn) ? 'Save Changes' : 'Submit Details'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
