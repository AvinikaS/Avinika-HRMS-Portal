import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import { HiOutlineDocumentText, HiOutlineDownload, HiOutlineExclamationCircle, HiOutlineX } from 'react-icons/hi';
import * as XLSX from 'xlsx';

export default function EsicModule({ selectedMonth }) {
    const [data, setData] = useState(null);
    const [periodData, setPeriodData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('summary');
    const [employeeFilter, setEmployeeFilter] = useState('');
    const [challanFilter, setChallanFilter] = useState('All');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ challanNumber: '', paymentDate: '', transactionId: '' });

    useEffect(() => {
        if (selectedMonth) {
            fetchSummary();
            fetchPeriodSummary();
        }
    }, [selectedMonth]);

    const fetchPeriodSummary = async () => {
        try {
            const yearStr = selectedMonth.split('-')[0];
            const res = await api.get(`/payroll/esic-challan/period-summary?year=${yearStr}`);
            setPeriodData(res.data.periods);
        } catch (err) {
            console.error('Failed to fetch period summary', err);
        }
    };

    const fetchSummary = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/payroll/esic-challan?month=${selectedMonth}`);
            setData(res.data);
            if (res.data?.summary?.challanNumber) {
                setPaymentForm({
                    challanNumber: res.data.summary.challanNumber || '',
                    paymentDate: res.data.summary.paymentDate ? res.data.summary.paymentDate.split('T')[0] : '',
                    transactionId: res.data.summary.transactionId || ''
                });
            } else {
                setPaymentForm({ challanNumber: '', paymentDate: '', transactionId: '' });
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to fetch ESIC details');
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePayment = async (e) => {
        e.preventDefault();
        try {
            await api.post('/payroll/esic-challan/payment-details', {
                month: selectedMonth,
                ...paymentForm
            });
            toast.success('Payment details updated');
            setShowPaymentModal(false);
            fetchSummary();
        } catch (err) {
            toast.error(err?.response?.data?.message || 'Failed to update');
        }
    };

    const handleOpenPaymentModal = () => {
        if (data?.summary?.status === 'Not Generated' || !data?.summary?.totalESIC || data?.summary?.totalESIC === 0) {
            return toast.error("Please generate the payroll first before adding challan details!");
        }
        setShowPaymentModal(true);
    };

    const handleMarkSuccess = () => {
        if (!data?.summary?.challanNumber) {
            return toast.error("Please add Challan details first before marking as success!");
        }
        Swal.fire({
            title: 'Mark as Success?',
            text: 'Once marked as success, the challan details will be locked and cannot be edited again.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Make it Success!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.post('/payroll/esic-challan/payment-details', {
                        month: selectedMonth,
                        status: 'Paid',
                        challanNumber: data.summary.challanNumber,
                        transactionId: data.summary.transactionId,
                        paymentDate: data.summary.paymentDate
                    });
                    toast.success('Challan successfully marked as Paid!');
                    fetchSummary();
                } catch (err) {
                    toast.error(err?.response?.data?.message || 'Failed to update');
                }
            }
        });
    };

    const exportInternalExcel = () => {
        if (!data) return;
        const wb = XLSX.utils.book_new();

        let formattedMonth = selectedMonth;
        if (!selectedMonth.includes('All')) {
            const [y, m] = selectedMonth.split('-');
            const d = new Date(parseInt(y), parseInt(m) - 1, 1);
            formattedMonth = d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }).replace(/ /g, '-');
        } else {
            formattedMonth = `FY ${selectedMonth.split('-')[0]}-${parseInt(selectedMonth.split('-')[0].slice(2)) + 1}`;
        }

        if (activeTab === 'summary') {
            if (selectedMonth.includes('All') && data.monthlyBreakdown) {
                const ws = XLSX.utils.json_to_sheet(data.monthlyBreakdown.map(mb => ({
                    'Month': `${data.summary.year}-${mb.month.toString().padStart(2, '0')}`,
                    'Period': mb.period,
                    'Covered Employees': mb.eligibleEmployees,
                    'Employee ESIC (₹)': mb.employeeESIC,
                    'Employer ESIC (₹)': mb.employerESIC,
                    'Total Payable (₹)': mb.totalESIC
                })));
                ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary');
            } else {
                const ws = XLSX.utils.json_to_sheet([{
                    'Month': formattedMonth,
                    'Period': data.summary.contributionPeriod,
                    'Covered Employees': data.summary.eligibleEmployees,
                    'Employee ESIC (₹)': data.summary.totalEmployeeContribution,
                    'Employer ESIC (₹)': data.summary.totalEmployerContribution,
                    'Total Payable (₹)': data.summary.totalESIC
                }]);
                ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
                XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary');
            }
            XLSX.writeFile(wb, `ESIC_Summary_${formattedMonth.replace(/ /g, '_')}.xlsx`);
            return;
        }

        if (activeTab === 'history') {
            const mapToChallanSheet = (challanArray) => challanArray.map(c => ({
                'Month': c.month ? `${c.year}-${c.month.toString().padStart(2, '0')}` : formattedMonth,
                'Amount (₹)': c.amount || c.totalESIC || 0,
                'Challan Number': c.challanNumber || '-',
                'Payment Date': c.paymentDate ? new Date(c.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-',
                'Transaction ID': c.transactionId || '-',
                'Status': c.status || 'Pending'
            }));

            if (selectedMonth.includes('All')) {
                const allChallansLocal = data.allChallans || [];
                const successChallans = allChallansLocal.filter(c => c.status === 'Paid' || c.status === 'Completed');
                const pendingChallans = allChallansLocal.filter(c => c.status !== 'Paid' && c.status !== 'Completed');

                const wsAll = XLSX.utils.json_to_sheet(mapToChallanSheet(allChallansLocal));
                const wsSuccess = XLSX.utils.json_to_sheet(mapToChallanSheet(successChallans));
                const wsPending = XLSX.utils.json_to_sheet(mapToChallanSheet(pendingChallans));

                const cols = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }];
                wsAll['!cols'] = cols;
                wsSuccess['!cols'] = cols;
                wsPending['!cols'] = cols;

                XLSX.utils.book_append_sheet(wb, wsAll, 'All Challans');
                XLSX.utils.book_append_sheet(wb, wsSuccess, 'Success Challans');
                XLSX.utils.book_append_sheet(wb, wsPending, 'Pending Challans');
            } else {
                const ws = XLSX.utils.json_to_sheet(mapToChallanSheet([data.summary]));
                ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 }];
                XLSX.utils.book_append_sheet(wb, ws, 'Challans');
            }
            XLSX.writeFile(wb, `ESIC_Challans_${formattedMonth.replace(/ /g, '_')}.xlsx`);
            return;
        }

        if (activeTab === 'period') {
            if (!periodData) return;
            const ws = XLSX.utils.json_to_sheet(periodData.map(p => ({
                'Period': p.period,
                'Covered Employees': p.coveredEmployees,
                'Total ESIC Wages (₹)': p.totalWages,
                'Employee Contribution (₹)': p.employeeContribution,
                'Employer Contribution (₹)': p.employerContribution,
                'Total ESIC (₹)': p.totalESIC
            })));
            ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 20 }];
            XLSX.utils.book_append_sheet(wb, ws, 'Period Summary');
            XLSX.writeFile(wb, `ESIC_Period_Summary_${formattedMonth.replace(/ /g, '_')}.xlsx`);
            return;
        }

        // Default: Employee Details
        if (!data.employeeDetails) return;
        const mapToSheetData = (emps) => emps.map(e => ({
            'Month': formattedMonth,
            'IP Number': e.ipNumber || 'Missing',
            'Employee Code': e.employeeCode,
            'Employee Name': e.employeeName,
            'Gross Wages (₹)': e.grossWages,
            'ESIC Wages (₹)': e.esicWages,
            'Eligible': e.esicEligible ? 'Yes' : 'No',
            'Employee Contribution (₹)': e.employeeESIC,
            'Employer Contribution (₹)': e.employerESIC,
            'Total Contribution (₹)': e.totalESIC,
            'Period Covered': e.contributionPeriod
        }));

        const allEmployees = data.employeeDetails;
        const eligibleEmployees = allEmployees.filter(e => e.esicEligible);
        const notEligibleEmployees = allEmployees.filter(e => !e.esicEligible);

        const wsAll = XLSX.utils.json_to_sheet(mapToSheetData(allEmployees));
        const wsEligible = XLSX.utils.json_to_sheet(mapToSheetData(eligibleEmployees));
        const wsNotEligible = XLSX.utils.json_to_sheet(mapToSheetData(notEligibleEmployees));

        const colWidths = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 20 }];
        wsAll['!cols'] = colWidths;
        wsEligible['!cols'] = colWidths;
        wsNotEligible['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, wsAll, 'All Employees');
        XLSX.utils.book_append_sheet(wb, wsEligible, 'Eligible Employees');
        XLSX.utils.book_append_sheet(wb, wsNotEligible, 'Not Eligible Employees');

        XLSX.writeFile(wb, `ESIC_Employee_Details_${formattedMonth.replace(/ /g, '_')}.xlsx`);
    };

    const handlePrintPDF = () => {
        window.print();
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading ESIC Data...</div>;
    if (!data) return <div style={{ padding: 40, textAlign: 'center' }}>No payroll data found for this month.</div>;

    const summary = data.summary;
    const employees = data.employeeDetails;

    const filteredEmployees = employees.filter(e => {
        let ef = employeeFilter || 'All';
        if (selectedMonth.includes('All') && ef === 'All') ef = 'Eligible';

        if (ef === 'Eligible') return e.esicEligible;
        if (ef === 'Not Eligible') return !e.esicEligible;
        return true;
    });

    const filteredChallans = (data.allChallans || []).filter(c => {
        if (challanFilter === 'Success') return c.status === 'Paid' || c.status === 'Completed';
        if (challanFilter === 'Pending') return c.status !== 'Paid' && c.status !== 'Completed';
        return true;
    });

    return (
        <div className="printable-module">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ flex: '1 1 auto', minWidth: '300px' }}>
                    <h2 className="card-title">ESIC Challan Summary - {selectedMonth}</h2>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>
                        Current Contribution Period: <span style={{ fontWeight: 600 }}>{summary.contributionPeriod}</span>
                    </p>
                    <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', flex: '1 1 120px' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, whiteSpace: 'nowrap' }}>Total Covered</p>
                            <h3 style={{ margin: 0, fontSize: 18 }}>{summary.eligibleEmployees}</h3>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', flex: '1 1 120px' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, whiteSpace: 'nowrap' }}>Total ESIC Payable</p>
                            <h3 style={{ margin: 0, fontSize: 18 }}>₹{summary.totalESIC}</h3>
                        </div>
                        <div style={{ background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border-color)', flex: '1 1 120px' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4, whiteSpace: 'nowrap' }}>Status</p>
                            <span className={`badge badge-${summary.status === 'Completed' || summary.status === 'Paid' ? 'success' : summary.status === 'Generated' ? 'warning' : 'secondary'}`} style={{ fontSize: 14 }}>{summary.status}</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexDirection: 'column', alignItems: 'flex-end', flex: '0 0 auto' }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary" onClick={exportInternalExcel}><HiOutlineDownload /> Export Excel</button>
                        <button className="btn btn-secondary" onClick={handlePrintPDF}><HiOutlineDocumentText /> Print PDF</button>
                    </div>
                    <small style={{ color: 'var(--text-tertiary)', maxWidth: '300px', textAlign: 'right' }}>* Note: This is an internal report for manual portal entry. ESIC logic automatically locks eligibility per 6-month period.</small>
                </div>
            </div>

            {summary.isAnyIpMissing && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px 16px', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HiOutlineExclamationCircle size={20} />
                    <span style={{ fontSize: 14, fontWeight: 500 }}>Warning: Missing ESIC IP Number for some eligible employees. HR entry will be blocked on portal.</span>
                </div>
            )}

            <div className="tabs" style={{ marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('summary')}>Monthly Summary</button>
                <button className={`tab ${activeTab === 'details' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('details')}>Employee Details ({filteredEmployees.length})</button>
                <button className={`tab ${activeTab === 'history' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('history')}>Challan Details</button>
                <button className={`tab ${activeTab === 'period' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap', padding: '10px 12px' }} onClick={() => setActiveTab('period')}>
                    Period Summary <span title="Internal half-yearly rollup for management/audit reference. Not for ESIC portal submission.">ⓘ</span>
                </button>
            </div>

            {activeTab === 'summary' && (
                <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Period</th>
                                <th>Covered Employees</th>
                                <th>Employee ESIC</th>
                                <th>Employer ESIC</th>
                                <th>Total Payable</th>
                            </tr>
                        </thead>
                        <tbody>
                            {selectedMonth.includes('All') && data.monthlyBreakdown && data.monthlyBreakdown.length > 0 ? (
                                data.monthlyBreakdown.map(mb => (
                                    <tr key={mb.month}>
                                        <td>{summary.year}-{mb.month.toString().padStart(2, '0')}</td>
                                        <td>{mb.period}</td>
                                        <td>{mb.eligibleEmployees}</td>
                                        <td>₹{mb.employeeESIC}</td>
                                        <td>₹{mb.employerESIC}</td>
                                        <td style={{ fontWeight: 600 }}>₹{mb.totalESIC}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td>{selectedMonth}</td>
                                    <td>{summary.contributionPeriod}</td>
                                    <td>{summary.eligibleEmployees}</td>
                                    <td>₹{summary.totalEmployeeContribution}</td>
                                    <td>₹{summary.totalEmployerContribution}</td>
                                    <td style={{ fontWeight: 600 }}>₹{summary.totalESIC}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'details' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16, gap: 10 }}>
                        {!selectedMonth.includes('All') && (
                            <button className={`btn btn-sm ${(employeeFilter || 'All') === 'All' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEmployeeFilter('All')}>All Employees</button>
                        )}
                        <button className={`btn btn-sm ${(employeeFilter && employeeFilter !== 'All' ? employeeFilter : (selectedMonth.includes('All') ? 'Eligible' : 'All')) === 'Eligible' ? 'btn-success' : 'btn-secondary'}`} onClick={() => setEmployeeFilter('Eligible')}>Eligible Only</button>
                        <button className={`btn btn-sm ${employeeFilter === 'Not Eligible' ? 'btn-secondary' : 'btn-secondary'}`} style={employeeFilter === 'Not Eligible' ? { background: '#94a3b8', color: '#fff', border: 'none' } : {}} onClick={() => setEmployeeFilter('Not Eligible')}>Not Eligible</button>
                    </div>
                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Code</th>
                                    <th>Employee Name</th>
                                    <th>IP Number</th>
                                    <th>Gross Wages</th>
                                    <th>ESIC Wages</th>
                                    <th>Status</th>
                                    <th>Emp Cont.</th>
                                    <th>Employer Cont.</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.length === 0 ? (
                                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>No employees found for the selected filter.</td></tr>
                                ) : filteredEmployees.map(e => (
                                    <tr key={e.employeeId}>
                                        <td>{e.employeeCode}</td>
                                        <td>
                                            {e.employeeName}
                                            {e.esicEligible && e.esicWages > 21000 && (
                                                <div style={{ fontSize: 10, color: 'var(--primary-color)', marginTop: 2 }}>Period-locked Coverage</div>
                                            )}
                                        </td>
                                        <td>{e.ipNumber || <span style={{ color: '#ef4444', fontSize: 12 }}>Missing IP</span>}</td>
                                        <td>₹{e.grossWages}</td>
                                        <td>₹{e.esicWages}</td>
                                        <td>
                                            <span className={`badge badge-${e.esicEligible ? 'success' : 'secondary'}`}>
                                                {e.esicEligible ? 'Eligible' : 'Not Eligible'}
                                            </span>
                                        </td>
                                        <td>₹{e.employeeESIC}</td>
                                        <td>₹{e.employerESIC}</td>
                                        <td style={{ fontWeight: 600 }}>₹{e.totalESIC}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div style={{ background: 'var(--bg-secondary)', padding: 24, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 20 }}>
                    {selectedMonth.includes('All') ? (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 16 }}>
                                <h3 className="card-title" style={{ margin: 0, flex: '1 1 auto', minWidth: '200px' }}>All Challans - Financial Year {summary.year}</h3>
                                <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px', flexWrap: 'wrap', gap: 4, width: '100%', maxWidth: '400px' }}>
                                    {['All', 'Success', 'Pending'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => setChallanFilter(f)}
                                            style={{
                                                flex: '1 1 auto', border: 'none',
                                                background: challanFilter === f ? '#fff' : 'transparent',
                                                color: challanFilter === f ? '#4f46e5' : '#64748b',
                                                boxShadow: challanFilter === f ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                                fontWeight: challanFilter === f ? 600 : 500,
                                                padding: '8px 16px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s'
                                            }}
                                        >
                                            {f === 'Pending' ? 'Pending / Generated' : f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <table className="table" style={{ minWidth: '700px', width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Amount</th>
                                            <th>Challan Number</th>
                                            <th>Payment Date</th>
                                            <th>Transaction ID</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredChallans.length === 0 ? (
                                            <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>No challan details found for this filter.</td></tr>
                                        ) : filteredChallans.map(c => (
                                            <tr key={c._id}>
                                                <td style={{ fontWeight: 600 }}>{c.year}-{c.month.toString().padStart(2, '0')}</td>
                                                <td>₹{c.amount || 0}</td>
                                                <td>{c.challanNumber || '-'}</td>
                                                <td>{c.paymentDate ? new Date(c.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '-'}</td>
                                                <td>{c.transactionId || '-'}</td>
                                                <td>
                                                    <span className={`badge badge-${(c.status === 'Paid' || c.status === 'Completed') ? 'success' : 'warning'}`}>
                                                        {c.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                                <h3 className="card-title" style={{ margin: 0 }}>Challan Details</h3>
                                <span className={`badge badge-${(summary.status === 'Paid' || summary.status === 'Completed') ? 'success' : 'warning'}`}>{(summary.status === 'Paid' || summary.status === 'Completed') ? 'Success' : 'Pending'}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 24, marginBottom: 24 }}>
                                <div><p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Month</p><p style={{ fontWeight: 600 }}>{selectedMonth}</p></div>
                                <div><p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Amount</p><p style={{ fontWeight: 600, color: 'var(--primary-color)' }}>₹{summary.totalESIC || summary.amount || 0}</p></div>
                                <div><p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Challan Number</p><p style={{ fontWeight: 600 }}>{summary.challanNumber || 'Not specified'}</p></div>
                                <div><p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Payment Date</p><p style={{ fontWeight: 600 }}>{summary.paymentDate ? new Date(summary.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : 'Not specified'}</p></div>
                                <div><p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 4 }}>Transaction ID</p><p style={{ fontWeight: 600 }}>{summary.transactionId || 'Not specified'}</p></div>
                            </div>

                            {summary.status !== 'Paid' && summary.status !== 'Completed' && (
                                <div style={{ display: 'flex', gap: 12, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
                                    <button className="btn btn-secondary" onClick={handleOpenPaymentModal}>Add/Edit Details</button>
                                    <button
                                        className="btn btn-success"
                                        onClick={handleMarkSuccess}
                                        disabled={summary.status === 'Not Generated' || !summary.totalESIC || summary.totalESIC === 0}
                                        style={{
                                            opacity: (summary.status === 'Not Generated' || !summary.totalESIC || summary.totalESIC === 0) ? 0.5 : 1,
                                            cursor: (summary.status === 'Not Generated' || !summary.totalESIC || summary.totalESIC === 0) ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        Mark as Success
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'period' && (
                <div style={{ background: 'var(--bg-secondary)', padding: 24, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                        <h3 className="card-title" style={{ margin: 0 }}>ESIC Contribution Periods - Financial Year {selectedMonth.split('-')[0]}</h3>
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                            * Internal Reporting View
                        </div>
                    </div>
                    <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Period</th>
                                    <th>Covered Employees</th>
                                    <th>Total ESIC Wages</th>
                                    <th>Employee Contribution</th>
                                    <th>Employer Contribution</th>
                                    <th>Total ESIC</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!periodData ? (
                                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>Loading...</td></tr>
                                ) : periodData.map((p, idx) => (
                                    <tr key={idx}>
                                        <td style={{ fontWeight: 600 }}>
                                            {p.period}
                                            {p.inProgress && <span style={{ display: 'block', fontSize: 11, color: '#ef4444', fontWeight: 400 }}>Period in progress</span>}
                                        </td>
                                        <td>{p.coveredEmployees}</td>
                                        <td>₹{p.totalWages || 0}</td>
                                        <td>₹{p.employeeContribution || 0}</td>
                                        <td>₹{p.employerContribution || 0}</td>
                                        <td style={{ fontWeight: 600 }}>₹{p.totalESIC || 0}</td>
                                        <td>
                                            {p.coveredEmployees === 0 ? (
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => toast.info("No ESIC payroll data available for this period.")}
                                                >
                                                    Export PDF
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await api.get(`/payroll/esic-challan/period-summary/export?year=${selectedMonth.split('-')[0]}&period=${encodeURIComponent(p.period)}`, { responseType: 'blob' });
                                                            const url = window.URL.createObjectURL(new Blob([res.data]));
                                                            const link = document.createElement('a');
                                                            link.href = url;
                                                            link.setAttribute('download', `ESIC_Period_Summary_${p.period.replace(/\s+/g, '_')}.pdf`);
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            link.remove();
                                                        } catch (err) {
                                                            toast.error("Error downloading PDF");
                                                        }
                                                    }}
                                                    className="btn btn-sm btn-secondary"
                                                >
                                                    Export PDF
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ marginTop: 16, fontSize: 12, color: 'gray', textAlign: 'center' }}>
                        This is an internal half-yearly rollup for audit and management reference. ESIC does not require a separate half-yearly return — monthly wage data upload, challan generation, and payment on the ESIC government portal is the complete compliance requirement.
                    </div>
                </div>
            )}

            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                        <div className="modal-header">
                            <h2>Update Challan Details</h2>
                            <button className="btn btn-icon btn-secondary" onClick={() => setShowPaymentModal(false)}><HiOutlineX /></button>
                        </div>
                        <form onSubmit={handleUpdatePayment}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Amount (₹)</label>
                                    <input className="form-control" value={summary.totalESIC} readOnly style={{ background: 'var(--bg-secondary)', cursor: 'not-allowed', color: 'var(--primary-color)', fontWeight: 600 }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Challan Number</label>
                                    <input className="form-control" placeholder="e.g. 20260215000123" value={paymentForm.challanNumber} onChange={e => setPaymentForm({ ...paymentForm, challanNumber: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Payment Date</label>
                                    <input type="date" className="form-control" value={paymentForm.paymentDate} onChange={e => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Transaction ID</label>
                                    <input className="form-control" placeholder="e.g. HDFCESIC987654321" value={paymentForm.transactionId} onChange={e => setPaymentForm({ ...paymentForm, transactionId: e.target.value })} required />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Details</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
