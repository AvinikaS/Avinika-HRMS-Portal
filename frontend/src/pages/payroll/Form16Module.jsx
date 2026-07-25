import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { HiOutlineDownload, HiOutlineCheckCircle, HiOutlineClock, HiOutlineDocumentText, HiOutlinePaperAirplane } from 'react-icons/hi';
import Swal from 'sweetalert2';

export default function Form16Module({ fy }) {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [blocker, setBlocker] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [processingId, setProcessingId] = useState(null);

    const fetchList = async () => {
        setLoading(true);
        setBlocker(null);
        try {
            const res = await api.get(`/payroll/form16?fy=${fy}`);
            setEmployees(res.data.data || []);
        } catch (err) {
            if (err.response?.data?.isBlocker) {
                setBlocker(err.response.data.message);
            } else {
                toast.error('Failed to load Form 16 mapping');
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        if (fy) fetchList();
    }, [fy]);

    const handleGenerate = async (id, isBulk = false) => {
        const ids = isBulk ? employees.filter(e => !e.mismatch && e.status !== 'generated' && e.status !== 'sent_to_employee').map(e => e.employeeId) : [id];
        if (ids.length === 0) return toast.info("No eligible employees to generate Form 16.");

        try {
            if (isBulk) setIsGenerating(true);
            else setProcessingId(id);

            const res = await api.post('/payroll/form16/generate', { employeeIds: ids, financialYear: fy });
            toast.success(res.data.message);
            fetchList();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error generating Form 16');
        }
        setIsGenerating(false);
        setProcessingId(null);
    };

    const handleGenerateAll = async () => {
        // Regenerate ALL who are already generated or sent
        const ids = employees.filter(e => !e.mismatch && (e.status === 'generated' || e.status === 'sent_to_employee')).map(e => e.employeeId);
        if (ids.length === 0) return toast.info("No existing certificates to regenerate.");

        try {
            setIsRegenerating(true);
            const res = await api.post('/payroll/form16/generate', { employeeIds: ids, financialYear: fy });
            toast.success(res.data.message);
            fetchList();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error regenerating Form 16');
        }
        setIsRegenerating(false);
    };

    const handleSend = async (id, isBulk = false) => {
        const ids = isBulk ? employees.filter(e => e.status === 'generated').map(e => e.employeeId) : [id];
        if (ids.length === 0) return toast.info("No eligible employees to send.");

        try {
            if (isBulk) setIsSending(true);
            else setProcessingId(id);

            const res = await api.post('/payroll/form16/send', { employeeIds: ids, financialYear: fy });
            toast.success(res.data.message);
            fetchList();
        } catch (err) {
            toast.error('Error sending Form 16');
        }
        setIsSending(false);
        setProcessingId(null);
    };

    const handleDownload = (id) => {
        const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/payroll/form16/download/${id}?fy=${fy}`;
        window.open(url, '_blank');
        // Better way: authenticated blob
        // I will implement blob download inline to prevent unauth popup
    };

    const downloadBlob = async (id) => {
        try {
            const res = await api.get(`/payroll/form16/download/${id}?fy=${fy}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Form16.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) { toast.error("Error downloading PDF"); }
    };

    return (
        <div className="animate-fadeIn">
            {blocker && (
                <div style={{ padding: 16, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 24 }}>⚠️</div>
                    <div>
                        <h4 style={{ margin: 0 }}>Configuration Missing</h4>
                        <p style={{ margin: '4px 0 0 0', fontSize: 13 }}>{blocker}</p>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                <h3 className="card-title" style={{ margin: 0, alignSelf: 'center' }}>Employee Form 16 Generation (FY {fy})</h3>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', width: '100%' }}>
                    <div style={{ fontSize: 12, background: '#f1f5f9', padding: '10px 15px', borderRadius: 8, color: '#475569', flex: '1 1 100%' }}>
                        <strong>Tip:</strong> Only employees with 0 mismatch (Deducted vs Deposited) are eligible for generation.
                    </div>
                    <button className="btn btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => handleGenerate(null, true)} disabled={loading || isGenerating || !!blocker}>
                        {isGenerating ? 'Generating...' : 'Generate All Eligible'}
                    </button>
                    <button className="btn btn-secondary" style={{ flex: '1 1 auto' }} onClick={() => handleGenerateAll(true)} disabled={loading || isRegenerating || !!blocker}>
                        {isRegenerating ? 'Regenerating...' : 'Regenerate All Existing'}
                    </button>
                    <button className="btn btn-primary" onClick={() => handleSend(null, true)} disabled={loading || isSending || !!blocker} style={{ display: 'flex', flex: '1 1 auto', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <HiOutlinePaperAirplane style={{ transform: 'rotate(45deg)' }} />
                        {isSending ? 'Sending...' : 'Send All Generated'}
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="spinner"></div>
            ) : (
                <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
                    <table style={{ minWidth: '800px', width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Employee</th>
                                <th>PAN</th>
                                <th>Gross Salary</th>
                                <th>TDS Deducted</th>
                                <th>Match Status</th>
                                <th>Form 16</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.length === 0 ? (
                                <tr><td colSpan="7" style={{ textAlign: 'center' }}>No employees found for this FY</td></tr>
                            ) : employees.map(emp => (
                                <tr key={emp.employeeId}>
                                    <td style={{ minWidth: 150 }}>
                                        <strong>{emp.employeeName}</strong>
                                        <div style={{ fontSize: 11, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.employeeCode} &bull; {emp.taxRegime.toLowerCase().includes('regime') ? emp.taxRegime : `${emp.taxRegime} regime`}</div>
                                    </td>
                                    <td>{emp.pan}</td>
                                    <td>₹{emp.grossSalary.toLocaleString('en-IN')}</td>
                                    <td>₹{emp.totalTdsDeducted.toLocaleString('en-IN')}</td>
                                    <td>
                                        {emp.mismatch ? (
                                            <span className="badge badge-danger" title={`Deducted: ${emp.totalTdsDeducted}, Deposited: ${emp.totalTdsDeposited}`}>
                                                Mismatch ₹{emp.mismatchAmount}
                                            </span>
                                        ) : (
                                            <span className="badge badge-success">Reconciled</span>
                                        )}
                                    </td>
                                    <td>
                                        {emp.status === 'not_generated' && <span className="badge badge-secondary">Not Generated</span>}
                                        {emp.status === 'generated' && (
                                            <span className="badge badge-success">
                                                Generated {emp.totalTdsDeducted === 0 ? '(Nil TDS)' : ''}
                                            </span>
                                        )}
                                        {emp.status === 'sent_to_employee' && (
                                            <span className="badge badge-primary">
                                                Sent to Employee {emp.totalTdsDeducted === 0 ? '(Nil TDS)' : ''}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            {(emp.status === 'not_generated' || emp.status === 'generated') && (
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleGenerate(emp.employeeId)}
                                                    disabled={emp.mismatch || isGenerating || isRegenerating || processingId === emp.employeeId}
                                                    title={emp.mismatch ? 'Resolve mismatch in 24Q first' : 'Generate PDF'}
                                                >
                                                    {processingId === emp.employeeId ? '...' : (emp.status === 'generated' ? 'Regenerate' : 'Generate')}
                                                </button>
                                            )}
                                            {emp.status !== 'not_generated' && (
                                                <>
                                                    <button className="btn btn-icon btn-secondary" onClick={() => downloadBlob(emp.employeeId)} title="Download PDF">
                                                        <HiOutlineDownload />
                                                    </button>
                                                    {emp.status === 'generated' && (
                                                        <button className="btn btn-icon btn-primary" onClick={() => handleSend(emp.employeeId)} disabled={isSending || processingId === emp.employeeId} title="Send to Employee">
                                                            <HiOutlinePaperAirplane style={{ transform: 'rotate(45deg)' }} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
