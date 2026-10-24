import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';
import api from '../../utils/api';
import {
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineBan,
    HiOutlineCurrencyDollar,
    HiOutlinePlus,
    HiOutlineDocumentDownload,
    HiOutlineExclamation,
    HiOutlineArrowRight,
    HiOutlineShieldCheck,
    HiOutlineX
} from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import EmployeeSelect from '../../components/EmployeeSelect';

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = date.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
};

export default function ExitManagement() {
    const [exits, setExits] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [systemSettings, setSystemSettings] = useState({
        workWeekType: '5-Day Week',
        applyFiftyPercentRule: false,
        gratuityTimeline: 30,
        noticePeriodDays: 30
    });

    const location = useLocation();
    const navigate = useNavigate();

    // Sync with query params
    const queryTab = new URLSearchParams(location.search).get('tab') || 'pending';
    const [activeTab, setActiveTab] = useState(queryTab); // pending, checklist, fnf, closed

    // Submit Resignation Modal State
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newRequestForm, setNewRequestForm] = useState({
        employeeId: '',
        exitReason: 'resignation',
        resignationDate: new Date().toISOString().split('T')[0],
        lastWorkingDay: '',
        noticePeriodRequired: 30,
        noticePeriodServed: 30,
        remarks: '',
        nomineeName: '',
        nomineeRelationship: '',
        nomineeBankAccount: '',
        nomineeIFSC: '',
        deathCertificateNumber: '',
        eventDate: ''
    });

    // F&F Settlement Panel State
    const [selectedExit, setSelectedExit] = useState(null);
    const [gratuityData, setGratuityData] = useState(null);
    const [ffCalculation, setFFCalculation] = useState(null);
    const [selectedFilterDept, setSelectedFilterDept] = useState('All Departments');
    const [initiatedByFilter, setInitiatedByFilter] = useState('all');
    const [subClosedTab, setSubClosedTab] = useState('completed'); // 'completed' or 'rejected'

    // F&F Calculations override / payment form
    const [ffForm, setFnfForm] = useState({
        pendingSalary: 0,
        leaveEncashment: 0,
        gratuityAmount: 0,
        otherEarnings: 0,
        noticePeriodRecovery: 0,
        loanRecovery: 0,
        advanceRecovery: 0,
        otherDeductions: 0,
        netFFPayable: 0,

        // Nominee fields
        nomineeName: '',
        nomineeRelationship: '',
        nomineeBankAccount: '',
        nomineeIFSC: '',

        // Checklist override options
        checklistOverrideReason: '',

        // Payment tracking fields
        paymentMode: 'Bank Transfer',
        transactionReference: ''
    });

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setSelectedExit(null);
        setGratuityData(null);
        setFFCalculation(null);
        navigate(`?tab=${newTab}`, { replace: true });
    };

    useEffect(() => {
        const t = new URLSearchParams(location.search).get('tab');
        if (t) setActiveTab(t);
    }, [location.search]);

    const fetchExits = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/exit');
            setExits(data.data || []);
        } catch (err) {
            console.error('Failed to fetch exits:', err);
        }
        setLoading(false);
    };

    const fetchEmployeesChoices = async () => {
        try {
            const { data } = await api.get('/employees?limit=1000');
            // Filter to keep active only
            const activeEmps = (data.data || []).filter(e => e.status === 'Active');
            setEmployees(activeEmps);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSettings = async () => {
        try {
            const { data } = await api.get('/settings');
            if (data.data) {
                setSystemSettings({
                    workWeekType: data.data.workWeekType || '5-Day Week',
                    applyFiftyPercentRule: data.data.applyFiftyPercentRule === true || data.data.applyFiftyPercentRule === 'true',
                    gratuityTimeline: Number(data.data.gratuityTimeline || 30),
                    noticePeriodDays: Number(data.data.noticePeriodDays || 30)
                });

                // Update new request form notice periods defaults
                setNewRequestForm(prev => ({
                    ...prev,
                    noticePeriodRequired: Number(data.data.noticePeriodDays || 30),
                    noticePeriodServed: Number(data.data.noticePeriodDays || 30)
                }));
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchExits();
        fetchEmployeesChoices();
        fetchSettings();
    }, []);

    // Calculate notice days served when resignation date or LWD changes
    useEffect(() => {
        if (newRequestForm.resignationDate && newRequestForm.lastWorkingDay) {
            const resDate = new Date(newRequestForm.resignationDate);
            const lwdDate = new Date(newRequestForm.lastWorkingDay);
            const diffTime = lwdDate.getTime() - resDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            setNewRequestForm(prev => ({
                ...prev,
                noticePeriodServed: diffDays > 0 ? diffDays : 0
            }));
        }
    }, [newRequestForm.resignationDate, newRequestForm.lastWorkingDay]);

    const handleSubmitResignation = async (e) => {
        e.preventDefault();
        if (!newRequestForm.employeeId) return toast.error('Please select an employee');
        const isDeathCase = ['death', 'permanent_disablement'].includes(newRequestForm.exitReason);
        if (!isDeathCase && !newRequestForm.lastWorkingDay) {
            return toast.error('Please select a Last Working Day');
        }
        if (isDeathCase && !newRequestForm.eventDate) {
            return toast.error('Please select the Date of Death/Disablement');
        }

        try {
            const payload = {
                ...newRequestForm,
                remarks: newRequestForm.remarks ? newRequestForm.remarks.trim() : ''
            };
            if (isEditing) {
                await api.put(`/exit/${editingId}`, payload);
                toast.success('Exit request updated successfully!');
            } else {
                await api.post('/exit/resignation', payload);
                toast.success('Resignation / Exit request registered successfully!');
            }
            setShowSubmitModal(false);
            fetchExits();
            // Reset Form
            setNewRequestForm({
                employeeId: '',
                exitReason: 'resignation',
                resignationDate: new Date().toISOString().split('T')[0],
                lastWorkingDay: '',
                noticePeriodRequired: systemSettings.noticePeriodDays || 30,
                noticePeriodServed: systemSettings.noticePeriodDays || 30,
                remarks: '',
                nomineeName: '',
                nomineeRelationship: '',
                nomineeBankAccount: '',
                nomineeIFSC: '',
                deathCertificateNumber: '',
                eventDate: '',
                initiatedBy: 'admin'
            });
            setIsEditing(false);
            setEditingId(null);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit exit request');
        }
    };

    const handleStartEdit = (ex) => {
        setIsEditing(true);
        setEditingId(ex.exitRequestDetails?._id || ex._id);
        const empId = ex.employee?._id || ex.employeeId?._id || '';
        const empObj = employees.find(e => e._id === empId) || ex.employee;
        if (empObj && empObj.department) {
            setSelectedFilterDept(empObj.department);
        } else {
            setSelectedFilterDept('All Departments');
        }
        setNewRequestForm({
            employeeId: ex.employee?._id || ex.employeeId?._id || '',
            exitReason: ex.reason || ex.exitRequestDetails?.exitReason || 'resignation',
            resignationDate: ex.resignationDate ? String(ex.resignationDate).split('T')[0] : (ex.exitRequestDetails?.resignationDate ? String(ex.exitRequestDetails.resignationDate).split('T')[0] : ''),
            lastWorkingDay: ex.expectedLastWorkingDay ? String(ex.expectedLastWorkingDay).split('T')[0] : (ex.exitRequestDetails?.lastWorkingDay ? String(ex.exitRequestDetails.lastWorkingDay).split('T')[0] : ''),
            noticePeriodRequired: ex.exitRequestDetails?.noticePeriodRequired || 30,
            noticePeriodServed: ex.exitRequestDetails?.noticePeriodServed !== undefined ? ex.exitRequestDetails.noticePeriodServed : 0,
            remarks: ex.exitRequestDetails?.remarks || '',
            nomineeName: ex.exitRequestDetails?.nomineeName || '',
            nomineeRelationship: ex.exitRequestDetails?.nomineeRelationship || '',
            nomineeBankAccount: ex.exitRequestDetails?.nomineeBankAccount || '',
            nomineeIFSC: ex.exitRequestDetails?.nomineeIFSC || '',
            deathCertificateNumber: ex.exitRequestDetails?.deathCertificateNumber || '',
            eventDate: ex.exitRequestDetails?.eventDate ? String(ex.exitRequestDetails.eventDate).split('T')[0] : '',
            initiatedBy: ex.exitRequestDetails?.initiatedBy || ex.initiatedBy || 'employee'
        });
        setShowSubmitModal(true);
    };

    const updateStatus = async (id, targetStatus, rejectionReason = '') => {
        try {
            await api.put(`/exit/${id}/status`, { status: targetStatus, rejectionReason });
            toast.success(`Exits updated successfully`);
            fetchExits();
        } catch (err) {
            toast.error('Failed to update status');
        }
    };

    const handleProceedToFF = (ex) => {
        const list = ex.clearanceChecklist || {};
        const allCleared = list.itAssetsReturned &&
            list.idCardReturned &&
            list.accessCardReturned &&
            list.knowledgeTransfer &&
            list.emailHandoverDone &&
            list.leavesSettled &&
            list.financeCleared &&
            list.itAdminClearance;

        if (!allCleared) {
            Swal.fire({
                title: 'Clearance Checklist Pending',
                text: 'All assets and clearances must be successfully returned and checked before moving this exit to the Full & Final (F&F) Settlement phase.',
                icon: 'warning',
                confirmButtonColor: '#6C5CE7',
                confirmButtonText: 'Understood'
            });
            return;
        }

        updateStatus(ex._id, 'F&F Pending');
    };

    const handleReject = (id) => {
        Swal.fire({
            title: 'Reject Exit Request',
            input: 'textarea',
            inputLabel: 'Rejection Reason / Suggestion',
            inputPlaceholder: 'Please type the reason for rejection here...',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Submit Rejection',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Please enter a valid rejection reason or suggestions for the employee';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                updateStatus(id, 'Rejected', result.value);
            }
        });
    };

    const updateChecklist = async (id, currentList, field, val) => {
        try {
            const updatedList = { ...currentList, [field]: val };
            await api.put(`/exit/${id}/checklist`, updatedList);
            fetchExits();
        } catch (err) {
            toast.error('Failed to update checklist item');
        }
    };

    // Load full calculations for detailed panel
    const selectExitForFF = async (exitRecord) => {
        setSelectedExit(exitRecord);
        try {
            const empId = exitRecord.employee._id;

            const calcRes = await api.get(`/exit/ff-calculation/${empId}`);
            const gratRes = await api.get(`/exit/gratuity-check/${empId}`);

            const ffDetails = calcRes.data.data;
            const gratDetails = gratRes.data.data;

            setFFCalculation(ffDetails);
            setGratuityData(gratDetails);

            // Map values to Form
            setFnfForm({
                pendingSalary: ffDetails.pendingSalary,
                leaveEncashment: ffDetails.leaveEncashment,
                gratuityAmount: ffDetails.gratuityAmount,
                otherEarnings: 0,
                noticePeriodRecovery: ffDetails.noticePeriodRecovery,
                loanRecovery: ffDetails.loanRecovery,
                advanceRecovery: ffDetails.advanceRecovery,
                otherDeductions: 0,
                netFFPayable: ffDetails.pendingSalary + ffDetails.leaveEncashment + ffDetails.gratuityAmount - ffDetails.loanRecovery - ffDetails.advanceRecovery - ffDetails.noticePeriodRecovery,

                nomineeName: exitRecord.exitRequestDetails?.nomineeName || '',
                nomineeRelationship: exitRecord.exitRequestDetails?.nomineeRelationship || '',
                nomineeBankAccount: exitRecord.exitRequestDetails?.nomineeBankAccount || '',
                nomineeIFSC: exitRecord.exitRequestDetails?.nomineeIFSC || '',

                checklistOverrideReason: '',
                paymentMode: 'Bank Transfer',
                transactionReference: ''
            });

        } catch (err) {
            toast.error(err.response?.data?.message || 'Error fetching F&F calculations');
        }
    };

    // Dynamic Net Payable update on inputs override change
    const handleFFFormChange = (updatedFields) => {
        const updated = { ...ffForm, ...updatedFields };

        // Enforce validations
        // Gratuity cannot be below formula value unless misconduct
        if (gratuityData && gratuityData.eligibilityStatus !== 'not_eligible') {
            const formulaVal = ffCalculation?.gratuityAmount || 0;
            if (updated.gratuityAmount < formulaVal) {
                // Warning note but let form change, we validate on Submit/Approve!
            }
        }

        // Notice period cap: recovery cannot exceed 2 months basic salary
        if (ffCalculation) {
            const maxCap = ffCalculation.basic * 2;
            if (updated.noticePeriodRecovery > maxCap) {
                updated.noticePeriodRecovery = maxCap;
                toast.warning(`Notice Period recovery capped at 2 months basic salary (₹${maxCap})`);
            }
        }

        const earningsSum = Number(updated.pendingSalary || 0) + Number(updated.leaveEncashment || 0) + Number(updated.gratuityAmount || 0) + Number(updated.otherEarnings || 0);
        const deductionsSum = Number(updated.noticePeriodRecovery || 0) + Number(updated.loanRecovery || 0) + Number(updated.advanceRecovery || 0) + Number(updated.otherDeductions || 0);
        updated.netFFPayable = earningsSum - deductionsSum;

        setFnfForm(updated);
    };

    const handleApproveFF = async () => {
        // Enforce nominee details for death cases
        if (selectedExit?.reason === 'death') {
            if (!ffForm.nomineeBankAccount || !ffForm.nomineeIFSC) {
                return toast.error('Nominee Bank account and IFSC are mandatory for death cases.');
            }
        }

        // Gratuity limit check
        const formulaVal = ffCalculation?.gratuityAmount || 0;
        if (selectedExit?.reason !== 'termination_misconduct' && ffForm.gratuityAmount < formulaVal) {
            return toast.error(`Gratuity amount cannot be set below the formula value of ₹${formulaVal}.`);
        }

        try {
            await api.post('/exit/ff-approve', {
                exitRequestId: selectedExit.exitRequestDetails._id,
                approvedAmounts: ffForm
            });
            toast.success('F&F calculation approved and locked!');
            setSelectedExit(null);
            fetchExits();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error approving F&F');
        }
    };

    const handleMarkPaid = async () => {
        if (!ffForm.transactionReference || ffForm.transactionReference.trim() === '') {
            return toast.error('Please enter the Transaction Reference Number');
        }
        try {
            await api.post('/exit/mark-paid', {
                exitRequestId: selectedExit.exitRequestDetails._id,
                paymentMode: ffForm.paymentMode,
                transactionReference: ffForm.transactionReference,
                paymentDate: new Date()
            });
            toast.success('F&F Settlement recorded as Paid!');
            setSelectedExit(null);
            fetchExits();
        } catch (err) {
            toast.error('Failed to submit F&F payment tracking');
        }
    };

    const handleCompleteExit = async (exitReqId) => {
        try {
            await api.post('/exit/complete', { exitRequestId: exitReqId });
            toast.success('Exit process completed successfully. Employee active master deactivated.');
            fetchExits();
        } catch (err) {
            toast.error('Failed to complete exit process.');
        }
    };

    const checkOverdue = (lwdString) => {
        const lwd = new Date(lwdString);
        lwd.setDate(lwd.getDate() + 30);
        const today = new Date();
        const diff = lwd - today;
        const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
            return { overdue: true, text: `Overdue by ${Math.abs(diffDays)} Days` };
        }
        return { overdue: false, text: `${diffDays} Days Remaining` };
    };

    const filtered = exits.filter(e => {
        let tabMatch = false;
        if (activeTab === 'pending') tabMatch = e.status === 'Pending';
        else if (activeTab === 'checklist') tabMatch = e.status === 'Checklist Pending';
        else if (activeTab === 'fnf') tabMatch = e.status === 'F&F Pending';
        else if (activeTab === 'closed') {
            if (subClosedTab === 'completed') {
                tabMatch = e.status === 'Completed';
            } else {
                tabMatch = e.status === 'Rejected';
            }
        }
        else tabMatch = true;

        if (!tabMatch) return false;

        const initiator = e.exitRequestDetails?.initiatedBy || e.initiatedBy || 'employee';
        if (initiatedByFilter === 'employee') return initiator === 'employee';
        if (initiatedByFilter === 'admin') return initiator === 'admin';
        return true;
    });

    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

    const handleViewExitHistory = (ex) => {
        const d = ex.exitRequestDetails;
        const ff = ex.ffSettlement;
        const cl = ex.clearanceChecklist || {};

        const fd = (date) => date ? new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A';
        const fmtAmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

        const clItems = [
            { label: 'IT Assets Returned', val: cl.itAssetsReturned },
            { label: 'ID Card Returned', val: cl.idCardReturned },
            { label: 'Access Card Returned', val: cl.accessCardReturned },
            { label: 'Knowledge Transfer', val: cl.knowledgeTransfer },
            { label: 'Email Handover Done', val: cl.emailHandoverDone },
            { label: 'Leaves Settled', val: cl.leavesSettled },
            { label: 'Finance Clearance', val: cl.financeCleared },
            { label: 'IT Admin Clearance', val: cl.itAdminClearance },
        ];
        const clHtml = clItems.map(i => `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;"><span>${i.label}</span><span style="font-weight:700;color:${i.val ? '#15803d' : '#b91c1c'};">${i.val ? '✅ Done' : '❌ Pending'}</span></div>`).join('');

        const ffHtml = ff ? `
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:14px;">
                <div style="font-weight:700;color:#15803d;margin-bottom:8px;font-size:13px;">💰 F&F Settlement Details</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;font-size:12px;">
                    <div style="color:#334155;">Pending Salary</div><div style="font-weight:600;text-align:right;">${fmtAmt(ff.pendingSalary)}</div>
                    <div style="color:#334155;">Leave Encashment</div><div style="font-weight:600;text-align:right;">${fmtAmt(ff.leaveEncashment)}</div>
                    <div style="color:#334155;">Gratuity Amount</div><div style="font-weight:600;text-align:right;">${fmtAmt(ff.gratuityAmount)}</div>
                    <div style="color:#334155;">Other Earnings</div><div style="font-weight:600;text-align:right;">${fmtAmt(ff.otherEarnings)}</div>
                    <div style="color:#334155;border-top:1px solid #d1fae5;padding-top:4px;">Notice Period Recovery</div><div style="font-weight:600;text-align:right;color:#dc2626;border-top:1px solid #d1fae5;padding-top:4px;">- ${fmtAmt(ff.noticePeriodRecovery)}</div>
                    <div style="color:#334155;">Loan Recovery</div><div style="font-weight:600;text-align:right;color:#dc2626;">- ${fmtAmt(ff.loanRecovery)}</div>
                    <div style="color:#334155;">Advance Recovery</div><div style="font-weight:600;text-align:right;color:#dc2626;">- ${fmtAmt(ff.advanceRecovery)}</div>
                    <div style="color:#334155;">Other Deductions</div><div style="font-weight:600;text-align:right;color:#dc2626;">- ${fmtAmt(ff.otherDeductions)}</div>
                </div>
                <div style="border-top:2px solid #15803d;margin-top:8px;padding-top:8px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:13px;color:#14532d;">NET F&F PAYABLE</span>
                    <span style="font-weight:800;font-size:16px;color:#15803d;">${fmtAmt(ff.netFFPayable)}</span>
                </div>
                <div style="margin-top:8px;font-size:11px;color:#64748b;">
                    Payment Status: <b style="color:${ff.paymentStatus === 'paid' ? '#15803d' : ff.paymentStatus === 'processed' ? '#b45309' : '#dc2626'};">${(ff.paymentStatus || 'Pending').toUpperCase()}</b>
                    ${ff.paymentMode ? ` | Mode: <b>${ff.paymentMode}</b>` : ''}
                    ${ff.transactionReference ? ` | Ref: <b>${ff.transactionReference}</b>` : ''}
                    ${ff.paymentDate ? ` | Date: <b>${fd(ff.paymentDate)}</b>` : ''}
                </div>
            </div>
        ` : '<div style="color:#94a3b8;font-size:12px;font-style:italic;margin-bottom:14px;">F&F settlement not yet processed.</div>';

        const statusColor = { 'Pending': '#d97706', 'Checklist Pending': '#0369a1', 'F&F Pending': '#7c3aed', 'Completed': '#15803d', 'Rejected': '#dc2626' };

        Swal.fire({
            title: `Exit History — ${ex.employee?.firstName} ${ex.employee?.lastName}`,
            width: '680px',
            html: `
                <div style="text-align:left;font-size:13px;max-height:520px;overflow-y:auto;padding-right:4px;">
                    <!-- Header Info -->
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;">
                        <div>
                            <div style="font-weight:700;color:#1e293b;font-size:15px;">${ex.employee?.firstName} ${ex.employee?.lastName}</div>
                            <div style="color:#64748b;font-size:12px;">${ex.employee?.employeeCode} | Exit Reason: <b style="text-transform:capitalize;">${(ex.reason || '').replace(/_/g, ' ')}</b></div>
                        </div>
                        <span style="padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:${ex.status === 'Completed' ? '#d1fae5' : ex.status === 'Rejected' ? '#fee2e2' : '#f1f5f9'};color:${statusColor[ex.status] || '#334155'};">${ex.status}</span>
                    </div>

                    <!-- Stage 1: Resignation -->
                    <div style="margin-bottom:14px;padding-left:12px;border-left:3px solid #6366f1;">
                        <div style="font-weight:700;color:#4338ca;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">📋 Stage 1: Exit Request</div>
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;">
                            <div style="color:#64748b;">Resignation Date</div><div style="font-weight:600;">${fd(ex.resignationDate)}</div>
                            <div style="color:#64748b;">Expected LWD</div><div style="font-weight:600;">${fd(ex.expectedLastWorkingDay)}</div>
                            <div style="color:#64748b;">Notice Period Required</div><div style="font-weight:600;">${d?.noticePeriodRequired || 30} Days</div>
                            <div style="color:#64748b;">Notice Period Served</div><div style="font-weight:600;">${d?.noticePeriodServed ?? 0} Days</div>
                            <div style="color:#64748b;">Initiated By</div><div style="font-weight:600;text-transform:capitalize;">${(d?.initiatedBy || 'employee')}</div>
                            <div style="color:#64748b;">DOJ</div><div style="font-weight:600;">${fd(ex.employee?.dateOfJoining)}</div>
                        </div>
                        ${d?.remarks ? `<div style="margin-top:6px;background:#f1f5f9;border-radius:6px;padding:8px;font-size:12px;color:#475569;"><b>Remarks / Resignation Letter:</b><br/>${d.remarks}</div>` : ''}
                        ${d?.rejectionReason ? `<div style="margin-top:6px;background:#fff5f5;border:1px solid #fecaca;border-radius:6px;padding:8px;font-size:12px;color:#991b1b;"><b>Rejection Reason:</b><br/>${d.rejectionReason}</div>` : ''}
                    </div>

                    <!-- Stage 2: Clearance Checklist -->
                    <div style="margin-bottom:14px;padding-left:12px;border-left:3px solid #0ea5e9;">
                        <div style="font-weight:700;color:#0369a1;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">✅ Stage 2: Clearance Checklist</div>
                        ${clHtml}
                    </div>

                    <!-- Stage 3: F&F Settlement -->
                    <div style="margin-bottom:14px;padding-left:12px;border-left:3px solid #10b981;">
                        <div style="font-weight:700;color:#059669;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">💰 Stage 3: F&F Settlement</div>
                        ${ffHtml}
                    </div>

                    <!-- Timeline Summary -->
                    <div style="padding-left:12px;border-left:3px solid #f59e0b;">
                        <div style="font-weight:700;color:#b45309;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">📅 Timeline</div>
                        <div style="font-size:12px;color:#334155;">
                            <div>Request Filed: <b>${fd(d?.createdAt || ex.resignationDate)}</b></div>
                            ${ff?.approvedOn ? `<div>F&F Approved: <b>${fd(ff.approvedOn)}</b></div>` : ''}
                            ${ff?.paymentDate ? `<div>Payment Date: <b>${fd(ff.paymentDate)}</b></div>` : ''}
                        </div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Close',
            confirmButtonColor: '#6366f1'
        });
    };

    const handleDownloadDoc = async (ex, type, docTitle) => {
        try {
            const id = ex.exitRequestDetails?._id || ex._id;
            toast.info(`Generating ${docTitle}...`);
            const res = await api.get(`/exit/documents/${id}?type=${type}`, { responseType: 'blob' });
            const blob = new Blob([res.data], { type: 'application/pdf' });
            const fileUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = fileUrl;
            const empCode = ex.employee?.employeeCode || 'EMP';
            link.download = `${type}_${empCode}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => window.URL.revokeObjectURL(fileUrl), 10000);
            toast.success(`${docTitle} downloaded successfully!`);
        } catch (err) {
            console.error('Download error:', err);
            toast.error(err.response?.data?.message || `Failed to download ${docTitle}`);
        }
    };

    return (
        <div className="animate-fadeIn" style={{ paddingBottom: 50 }}>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
                <div>
                    <h1>Exit Management</h1>
                    <p>Process employee resignations, exit checklists, and full & final (F&F) settlements</p>
                </div>
                <div>
                    <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => {
                        setIsEditing(false);
                        setEditingId(null);
                        setSelectedFilterDept('All Departments');
                        setNewRequestForm({
                            employeeId: '',
                            exitReason: 'resignation',
                            resignationDate: new Date().toISOString().split('T')[0],
                            lastWorkingDay: '',
                            noticePeriodRequired: systemSettings.noticePeriodDays || 30,
                            noticePeriodServed: systemSettings.noticePeriodDays || 30,
                            remarks: '',
                            nomineeName: '',
                            nomineeRelationship: '',
                            nomineeBankAccount: '',
                            nomineeIFSC: '',
                            deathCertificateNumber: '',
                            eventDate: '',
                            initiatedBy: 'admin'
                        });
                        setShowSubmitModal(true);
                    }}>
                        <HiOutlinePlus /> File Resignation / Exit
                    </button>
                </div>
            </div>

            <div className="tabs" style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center' }} onClick={() => handleTabChange('pending')}>Requests & Approvals</button>
                <button className={`tab ${activeTab === 'checklist' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center' }} onClick={() => handleTabChange('checklist')}>Exit Checklists & Assets</button>
                <button className={`tab ${activeTab === 'fnf' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center' }} onClick={() => handleTabChange('fnf')}>F&F Settlements & Gratuity</button>
                <button className={`tab ${activeTab === 'closed' ? 'active' : ''}`} style={{ flex: '1 1 auto', textAlign: 'center' }} onClick={() => handleTabChange('closed')}>Completed/Rejected Exits</button>
            </div>

            {/* Inner Sub-tabs for Completed/Rejected Exits */}
            {activeTab === 'closed' && (
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                    marginBottom: '20px',
                    borderBottom: '2px solid var(--border-color)',
                    paddingBottom: '4px'
                }}>
                    <button
                        onClick={() => setSubClosedTab('completed')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: subClosedTab === 'completed' ? '#6C5CE7' : 'var(--text-secondary)',
                            fontWeight: subClosedTab === 'completed' ? '700' : '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '8px 16px',
                            position: 'relative',
                            outline: 'none'
                        }}
                    >
                        Completed Exits
                        {subClosedTab === 'completed' && (
                            <div style={{ position: 'absolute', bottom: '-6px', left: 0, right: 0, height: '3px', background: '#6C5CE7', borderRadius: '2px' }} />
                        )}
                    </button>
                    <button
                        onClick={() => setSubClosedTab('rejected')}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: subClosedTab === 'rejected' ? '#EF4444' : 'var(--text-secondary)',
                            fontWeight: subClosedTab === 'rejected' ? '700' : '500',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '8px 16px',
                            position: 'relative',
                            outline: 'none'
                        }}
                    >
                        Rejected Exits
                        {subClosedTab === 'rejected' && (
                            <div style={{ position: 'absolute', bottom: '-6px', left: 0, right: 0, height: '3px', background: '#EF4444', borderRadius: '2px' }} />
                        )}
                    </button>
                </div>
            )}

            {/* INITIATOR FILTER BAR */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '20px',
                background: 'var(--bg-secondary)',
                padding: '4px',
                borderRadius: '8px',
                width: '100%',
                maxWidth: 'fit-content',
                border: '1px solid var(--border-color)'
            }}>
                {[
                    { val: 'all', label: 'All Exits' },
                    { val: 'employee', label: 'Employee Requests' },
                    { val: 'admin', label: 'Admin-Initiated' }
                ].map(opt => (
                    <button
                        key={opt.val}
                        onClick={() => setInitiatedByFilter(opt.val)}
                        style={{
                            flex: '1 1 auto',
                            border: 'none',
                            padding: '6px 16px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            background: initiatedByFilter === opt.val ? 'var(--primary-color, #6C5CE7)' : 'transparent',
                            color: initiatedByFilter === opt.val ? '#FFFFFF' : 'var(--text-secondary, #4B5563)',
                        }}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {!selectedExit && (
                    <div className="card" style={{ flex: '1 1 600px', minWidth: 0, padding: 0 }}>
                        {loading ? <div style={{ padding: 20 }}>Loading...</div> : (
                            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                            <th style={{ padding: 12, textAlign: 'left', width: activeTab === 'pending' ? '25%' : (activeTab === 'checklist' ? '15%' : '18%') }}>Employee</th>
                                            <th style={{ padding: 12, textAlign: 'left', width: activeTab === 'pending' ? '15%' : (activeTab === 'checklist' ? '10%' : '12%') }}>Resignation Date</th>
                                            <th style={{ padding: 12, textAlign: 'left', width: activeTab === 'pending' ? '15%' : (activeTab === 'checklist' ? '8%' : '12%') }}>Reason</th>
                                            <th style={{ padding: 12, textAlign: 'left', width: activeTab === 'pending' ? '15%' : (activeTab === 'checklist' ? '9%' : '12%') }}>Expected LWD</th>
                                            <th style={{ padding: 12, textAlign: 'left', width: activeTab === 'pending' ? '12%' : (activeTab === 'checklist' ? '10%' : '10%') }}>Status</th>
                                            {activeTab === 'checklist' && <th style={{ padding: 12, textAlign: 'left', width: '36%' }}>Clearance Items Checklist</th>}
                                            {['fnf', 'closed'].includes(activeTab) && <th style={{ padding: 12, textAlign: 'left', width: '24%' }}>Net F&F Status</th>}
                                            <th style={{ padding: 12, textAlign: 'right', width: activeTab === 'pending' ? '18%' : (activeTab === 'checklist' ? '12%' : '12%') }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)' }}>No records found in this stage</td></tr>
                                        ) : filtered.map(ex => {
                                            const isDeathCase = ['death', 'permanent_disablement'].includes(ex.reason);
                                            return (
                                                <tr key={ex._id} style={{ borderBottom: '1px solid var(--border-color)', background: selectedExit?._id === ex._id ? 'var(--bg-secondary)' : 'transparent' }}>
                                                    <td style={{ padding: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                            <div style={{ fontWeight: 600 }}>{ex.employee?.firstName} {ex.employee?.lastName}</div>
                                                            {(() => {
                                                                const isAdm = (ex.exitRequestDetails?.initiatedBy || ex.initiatedBy) === 'admin';
                                                                return (
                                                                    <span style={{
                                                                        fontSize: '9px',
                                                                        padding: '1px 5px',
                                                                        borderRadius: '4px',
                                                                        fontWeight: 'bold',
                                                                        background: isAdm ? '#EEF2FF' : '#ECFDF5',
                                                                        color: isAdm ? '#4F46E5' : '#10B981',
                                                                        border: isAdm ? '1px solid #C7D2FE' : '1px solid #A7F3D0'
                                                                    }}>
                                                                        {isAdm ? 'Admin' : 'Employee'}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{ex.employee?.employeeCode}</div>
                                                    </td>
                                                    <td style={{ padding: 12 }}>{formatDate(ex.resignationDate)}</td>
                                                    <td style={{ padding: 12 }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => Swal.fire({
                                                                title: 'Exit Request Details',
                                                                html: `
                                                            <div style="text-align: left; font-family: sans-serif; font-size: 14px; color: #334155; line-height: 1.6;">
                                                                <p style="margin: 0 0 8px 0; text-align: left;"><strong>Employee:</strong> ${ex.employee?.firstName} ${ex.employee?.lastName} (${ex.employee?.employeeCode})</p>
                                                                <p style="margin: 0 0 8px 0; text-align: left;"><strong>Reason Category:</strong> <span style="text-transform: capitalize;">${ex.reason?.replace(/_/g, ' ')}</span></p>
                                                                <p style="margin: 0 0 8px 0; text-align: left;"><strong>Exit Status:</strong> ${ex.status}</p>
                                                                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 12px 0;" />
                                                                
                                                                <p style="font-weight: 600; margin: 0 0 6px 0; text-align: left;">Resignation Statement / Letter Details:</p>
                                                                <div style="text-align: left; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; font-style: italic; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; font-size: 13px; color: #475569; margin-bottom: 12px;">${(ex.exitRequestDetails?.resignationLetter || ex.exitRequestDetails?.remarks || '').trim() || 'No resignation letter details logged.'}</div>

                                                                ${ex.exitRequestDetails?.earlyReleaseRequest?.trim() ? `
                                                                    <p style="font-weight: 600; margin: 0 0 6px 0; text-align: left;">Early Release Request Detail:</p>
                                                                    <div style="text-align: left; background: #fffbeb; border: 1px solid #fde68a; padding: 12px; border-radius: 8px; font-style: italic; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; font-size: 13px; color: #92400e; margin-bottom: 12px;">${ex.exitRequestDetails.earlyReleaseRequest}</div>
                                                                ` : ''}

                                                                ${(ex.exitRequestDetails?.remarks && false) ? `
                                                                    <p style="font-weight: 600; margin: 0 0 6px 0; text-align: left;">Extra Remarks:</p>
                                                                    <div style="text-align: left; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px; font-style: italic; white-space: pre-wrap; word-break: break-word; overflow-wrap: break-word; font-size: 13px; color: #334155;">${ex.exitRequestDetails.remarks}</div>
                                                                ` : ''}
                                                            </div>
                                                        `,
                                                                confirmButtonText: 'Great, Understood',
                                                                confirmButtonColor: '#4f46e5'
                                                            })}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                padding: 0,
                                                                color: '#4f46e5',
                                                                textDecoration: 'underline',
                                                                cursor: 'pointer',
                                                                textTransform: 'capitalize',
                                                                fontWeight: 500,
                                                                textAlign: 'left'
                                                            }}
                                                        >
                                                            {ex.reason?.replace(/_/g, ' ')}
                                                        </button>
                                                    </td>
                                                    <td style={{ padding: 12, fontWeight: 600 }}>{formatDate(ex.expectedLastWorkingDay)}</td>
                                                    <td style={{ padding: 12 }}>
                                                        {(() => {
                                                            let badgeStyle = { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600, display: 'inline-block', textTransform: 'capitalize' };
                                                            if (ex.status === 'Completed') {
                                                                badgeStyle = { ...badgeStyle, background: '#D1FAE5', color: '#065F46' };
                                                            } else if (ex.status === 'Rejected') {
                                                                badgeStyle = { ...badgeStyle, background: '#FEE2E2', color: '#991B1B' };
                                                            } else if (ex.status === 'F&F Pending') {
                                                                badgeStyle = { ...badgeStyle, background: '#FEF3C7', color: '#92400E' };
                                                            } else if (ex.status === 'Checklist Pending') {
                                                                badgeStyle = { ...badgeStyle, background: '#E0F2FE', color: '#075985' };
                                                            } else {
                                                                badgeStyle = { ...badgeStyle, background: '#F3F4F6', color: '#374151' };
                                                            }
                                                            return (
                                                                <span style={badgeStyle}>
                                                                    {ex.status}
                                                                </span>
                                                            );
                                                        })()}
                                                    </td>

                                                    {activeTab === 'checklist' && (
                                                        <td style={{ padding: 12 }}>
                                                            <div style={{ display: 'flex', gap: '20px' }}>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.itAssetsReturned} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'itAssetsReturned', e.target.checked)} />
                                                                        Assets Returned
                                                                    </label>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.idCardReturned} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'idCardReturned', e.target.checked)} />
                                                                        ID Card Returned
                                                                    </label>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.accessCardReturned} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'accessCardReturned', e.target.checked)} />
                                                                        Access Card Returned
                                                                    </label>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.knowledgeTransfer} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'knowledgeTransfer', e.target.checked)} />
                                                                        KT Completed
                                                                    </label>
                                                                </div>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.emailHandoverDone} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'emailHandoverDone', e.target.checked)} />
                                                                        Email Handover Done
                                                                    </label>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.leavesSettled} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'leavesSettled', e.target.checked)} />
                                                                        Leaves Settled
                                                                    </label>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.financeCleared} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'financeCleared', e.target.checked)} />
                                                                        Finance Clearance
                                                                    </label>
                                                                    <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                                                        <input type="checkbox" checked={!!ex.clearanceChecklist?.itAdminClearance} onChange={e => updateChecklist(ex._id, ex.clearanceChecklist, 'itAdminClearance', e.target.checked)} />
                                                                        IT Admin Clearance
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}

                                                    {['fnf', 'closed'].includes(activeTab) && (
                                                        <td style={{ padding: 12, fontWeight: 700 }}>
                                                            {ex.exitRequestDetails?.clearanceStatus === 'Cleared' ? (
                                                                <span style={{ color: '#10b981' }}>Clearance Ok</span>
                                                            ) : (
                                                                <span style={{ color: '#f59e0b' }}>Checked Pending</span>
                                                            )}
                                                        </td>
                                                    )}

                                                    <td style={{ padding: 12, textAlign: 'right' }}>
                                                        {ex.status === 'Pending' && (
                                                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                                                                <button className="btn btn-sm btn-primary" onClick={() => updateStatus(ex._id, 'Checklist Pending')}>Approve</button>
                                                                <button className="btn btn-sm btn-secondary" onClick={() => handleStartEdit(ex)}>Edit</button>
                                                                <button className="btn btn-sm btn-secondary" style={{ color: '#ef4444' }} onClick={() => handleReject(ex._id)}>Reject</button>
                                                            </div>
                                                        )}
                                                        {activeTab === 'checklist' && (
                                                            <button className="btn btn-sm btn-primary" onClick={() => handleProceedToFF(ex)}>Proceed to F&F</button>
                                                        )}
                                                        {activeTab === 'fnf' && (
                                                            <button className="btn btn-sm btn-primary" onClick={() => selectExitForFF(ex)}>
                                                                {selectedExit?._id === ex._id ? 'Reviewing' : 'Calculate F&F'}
                                                            </button>
                                                        )}
                                                        {activeTab === 'closed' && (
                                                            ex.status === 'Rejected' ? (
                                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                                    <button
                                                                        className="btn btn-sm btn-secondary"
                                                                        style={{ color: '#6366f1', fontWeight: 600 }}
                                                                        onClick={() => handleViewExitHistory(ex)}
                                                                    >
                                                                        📋 History
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-sm btn-secondary"
                                                                        style={{ color: '#ef4444', fontWeight: 600 }}
                                                                        onClick={() => {
                                                                            Swal.fire({
                                                                                title: 'Rejection Details',
                                                                                html: `<div style="text-align: left; font-size: 14px; line-height: 1.5;">
                                                                             <strong>Employee:</strong> ${ex.employee?.firstName} ${ex.employee?.lastName || ''}<br/>
                                                                             <strong>Employee Code:</strong> ${ex.employee?.employeeCode || 'N/A'}<br/>
                                                                             <strong>Reason for Rejection:</strong><br/>
                                                                             <span style="display: block; margin-top: 8px; padding: 10px; background: #FEF2F2; border-left: 4px solid #EF4444; border-radius: 4px; color: #991B1B;">
                                                                                 ${ex.exitRequestDetails?.rejectionReason || 'No details provided.'}
                                                                             </span>
                                                                         </div>`,
                                                                                confirmButtonColor: '#6C5CE7',
                                                                                confirmButtonText: 'Close'
                                                                            });
                                                                        }}
                                                                    >
                                                                        View Reason
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                                                    <button
                                                                        className="btn btn-sm btn-secondary"
                                                                        style={{ color: '#6366f1', fontWeight: 600 }}
                                                                        onClick={() => handleViewExitHistory(ex)}
                                                                    >
                                                                        📋 History
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDownloadDoc(ex, 'ff_letter', 'F&F Settlement Letter')}
                                                                        className="btn btn-sm btn-secondary"
                                                                        title="F&F Letter"
                                                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                                                    >
                                                                        <HiOutlineDocumentDownload /> F&F
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDownloadDoc(ex, 'experience_letter', 'Experience Certificate')}
                                                                        className="btn btn-sm btn-secondary"
                                                                        title="Experience Letter"
                                                                    >
                                                                        Exp
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDownloadDoc(ex, 'relieving_letter', 'Relieving Letter')}
                                                                        className="btn btn-sm btn-secondary"
                                                                        title="Relieving Letter"
                                                                    >
                                                                        Rel
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {selectedExit && activeTab === 'fnf' && ffCalculation && gratuityData && (
                    <div style={{ flex: '1 1 100%', background: 'var(--bg-primary)', padding: 24, borderRadius: 12, border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                            <h3>F&F Settlement Process</h3>
                            <button className="btn btn-sm btn-secondary" onClick={() => setSelectedExit(null)}>← Back to List</button>
                        </div>

                        {/* SECTION A: EMPLOYEE EXIT SUMMARY */}
                        <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{selectedExit.employee?.firstName} {selectedExit.employee?.lastName}</div>
                            <div>DOJ: {new Date(gratuityData.doj).toLocaleDateString('en-IN')}</div>
                            <div>LWD: {new Date(gratuityData.lwd).toLocaleDateString('en-IN')}</div>
                            <div style={{ marginTop: 4 }}><strong>Service Tenure:</strong> {gratuityData.servicePeriod}</div>
                            <div><strong>Notice Period served:</strong> {selectedExit.exitRequestDetails?.noticePeriodServed} / {selectedExit.exitRequestDetails?.noticePeriodRequired} Days</div>
                        </div>

                        {/* SECTION B: GRATUITY ELIGIBILITY CHECK */}
                        <div style={{ marginBottom: 16 }}>
                            <h4>Gratuity Eligibility Details</h4>
                            {gratuityData.eligibilityStatus === 'not_eligible' && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', padding: 12, borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <HiOutlineBan size={18} />
                                    <span>{gratuityData.eligibilityReason}</span>
                                </div>
                            )}
                            {gratuityData.eligibilityStatus === 'waived_death_disablement' && (
                                <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', color: '#047857', padding: 12, borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <HiOutlineCheckCircle size={18} />
                                    <span>{gratuityData.eligibilityReason}</span>
                                </div>
                            )}
                            {gratuityData.eligibilityStatus === 'eligible' && (
                                <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', color: '#047857', padding: 12, borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <HiOutlineCheckCircle size={18} />
                                    <span>{gratuityData.eligibilityReason}</span>
                                </div>
                            )}

                            {/* Wage ceiling rule Warning */}
                            {ffCalculation.showWageWarning && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', color: '#b45309', padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
                                    <HiOutlineExclamation style={{ marginRight: 6 }} />
                                    Basic salary is below 50% of gross. As per Labour Code 50% wage rule, calculations are based on ₹{ffCalculation.effectiveBasic} (50% of Gross).
                                </div>
                            )}

                            {/* Gratuity Ticker countdown */}
                            {selectedExit.exitRequestDetails && (
                                <div style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: 4, display: 'inline-block', fontWeight: 600, color: checkOverdue(gratuityData.lwd).overdue ? '#ef4444' : '#10b981' }}>
                                    {checkOverdue(gratuityData.lwd).text}
                                </div>
                            )}
                        </div>

                        {/* SECTION C: GRATUITY CALCULATION BREAKDOWN */}
                        {gratuityData.eligibilityStatus !== 'not_eligible' && (
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: 16, background: '#1e293b', color: '#fff', marginBottom: 16, fontSize: 13 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>Effective Basic used</span>
                                    <span>{fmt(ffCalculation.effectiveBasic)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <span>Completed Rounded years</span>
                                    <span>{ffCalculation.completedYearsRounded} years</span>
                                </div>
                                <div style={{ borderTop: '1px solid #475569', margin: '8px 0', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                                    <span>Calculated Gratuity (Statutory)</span>
                                    <span>{fmt(ffCalculation.gratuityAmount)}</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <HiOutlineShieldCheck />
                                    {ffCalculation.gratuityAmount <= 2000000 ? (
                                        <span style={{ color: '#34d399' }}>Tax-exempt u/s 10(10) of Income Tax Act</span>
                                    ) : (
                                        <span style={{ color: '#fb923c' }}>Amount exceeding ₹20,00,000 is taxable</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SECTION D: F&F SETTLEMENT DETAILS & CONTROLS */}
                        <div>
                            <h4>Settlement Statement Inputs</h4>
                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Pending Days Salary (Worked but unpaid)</label>
                                <input type="number" className="form-control" value={ffForm.pendingSalary} onChange={e => handleFFFormChange({ pendingSalary: Number(e.target.value) })} readOnly={ffCalculation?.isLocked} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Leave Encashment Amount</label>
                                <input type="number" className="form-control" value={ffForm.leaveEncashment} onChange={e => handleFFFormChange({ leaveEncashment: Number(e.target.value) })} readOnly={ffCalculation?.isLocked} />
                                <small style={{ color: 'var(--text-tertiary)' }}>Pending Earned Leaves: {ffCalculation.earnedLeaves} Days</small>
                            </div>

                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Gratuity Amount</label>
                                <input type="number" className="form-control" value={ffForm.gratuityAmount} onChange={e => handleFFFormChange({ gratuityAmount: Number(e.target.value) })} readOnly={selectedExit.reason === 'termination_misconduct' || ffCalculation?.isLocked} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Other Adhoc Earnings</label>
                                <input type="number" className="form-control" value={ffForm.otherEarnings} onChange={e => handleFFFormChange({ otherEarnings: Number(e.target.value) })} readOnly={ffCalculation?.isLocked} />
                            </div>

                            <h5 style={{ marginTop: 16 }}>Deductions & Recoveries</h5>
                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Notice Period Recovery shortfall</label>
                                <input type="number" className="form-control" value={ffForm.noticePeriodRecovery} onChange={e => handleFFFormChange({ noticePeriodRecovery: Number(e.target.value) })} readOnly={ffCalculation?.isLocked} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Outstanding Loan Recovery</label>
                                <input type="number" className="form-control" value={ffForm.loanRecovery} readOnly style={{ opacity: 0.8 }} />
                                <small style={{ color: 'var(--text-tertiary)' }}>Auto-fetched outstanding loan logs</small>
                            </div>

                            <div className="form-group" style={{ marginBottom: 10 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Outstanding Advance Salary Recovery</label>
                                <input type="number" className="form-control" value={ffForm.advanceRecovery} readOnly style={{ opacity: 0.8 }} />
                            </div>

                            <div className="form-group" style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ fontSize: 12 }}>Other Adhoc Deductions (e.g. Asset loss)</label>
                                <input type="number" className="form-control" value={ffForm.otherDeductions} onChange={e => handleFFFormChange({ otherDeductions: Number(e.target.value) })} readOnly={ffCalculation?.isLocked} />
                            </div>

                            {/* Nominee details for death case */}
                            {selectedExit.reason === 'death' && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                                    <h5 style={{ margin: 0, marginBottom: 8, color: '#d97706' }}>Nominee Information (Required)</h5>
                                    <div className="form-group" style={{ marginBottom: 8 }}>
                                        <label style={{ fontSize: 11 }}>Nominee Name</label>
                                        <input className="form-control form-control-sm" value={ffForm.nomineeName} onChange={e => setFnfForm({ ...ffForm, nomineeName: e.target.value })} disabled={ffCalculation?.isLocked} />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label style={{ fontSize: 11 }}>Nominee Relationship</label>
                                            <input className="form-control form-control-sm" value={ffForm.nomineeRelationship} onChange={e => setFnfForm({ ...ffForm, nomineeRelationship: e.target.value })} disabled={ffCalculation?.isLocked} />
                                        </div>
                                        <div className="form-group">
                                            <label style={{ fontSize: 11 }}>Nominee Bank Account</label>
                                            <input className="form-control form-control-sm" value={ffForm.nomineeBankAccount} onChange={e => setFnfForm({ ...ffForm, nomineeBankAccount: e.target.value })} disabled={ffCalculation?.isLocked} />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ marginTop: 8 }}>
                                        <label style={{ fontSize: 11 }}>Nominee Bank IFSC</label>
                                        <input className="form-control form-control-sm" value={ffForm.nomineeIFSC} onChange={e => setFnfForm({ ...ffForm, nomineeIFSC: e.target.value })} disabled={ffCalculation?.isLocked} />
                                    </div>
                                </div>
                            )}

                            {/* F&F Net Total Summary Table */}
                            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 16 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                                    <span>NET F&F PAYABLE :</span>
                                    <span style={{ color: ffForm.netFFPayable >= 0 ? '#10b981' : '#ef4444' }}>{fmt(ffForm.netFFPayable)}</span>
                                </div>
                                {ffForm.netFFPayable < 0 && (
                                    <div style={{ marginTop: 10, color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
                                        ⚠️ Employee owes money to company. Coordinate recovery before completing exit.
                                    </div>
                                )}
                            </div>

                            {/* Checklist warnings and HR override option */}
                            {selectedExit.exitRequestDetails?.clearanceStatus !== 'Cleared' && (
                                <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 11, color: '#b45309' }}>
                                    ⚠️ Clearance checklist is incomplete! Please provide override explanation below:
                                    <input className="form-control form-control-sm" style={{ marginTop: 4 }} placeholder="e.g. Cleared pending IT review override" value={ffForm.checklistOverrideReason} onChange={e => setFnfForm({ ...ffForm, checklistOverrideReason: e.target.value })} disabled={ffCalculation?.isLocked} />
                                </div>
                            )}

                            <button className="btn btn-primary" style={{ width: '100%', marginBottom: 12, opacity: ffCalculation?.isLocked ? 0.7 : 1 }} onClick={handleApproveFF} disabled={ffCalculation?.isLocked}>
                                {ffCalculation?.isLocked ? 'Approved & Locked' : 'Approve & Lock F&F Details'}
                            </button>

                            {/* Payment details form when approved */}
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                                <h5>Record Payment Details</h5>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label style={{ fontSize: 11 }}>Payment Mode</label>
                                        <select className="form-control form-control-sm" value={ffForm.paymentMode} onChange={e => setFnfForm({ ...ffForm, paymentMode: e.target.value })}>
                                            <option>Bank Transfer</option>
                                            <option>Cheque</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label style={{ fontSize: 11 }}>Trans Reference No.</label>
                                        <input className="form-control form-control-sm" placeholder="TXN183739" value={ffForm.transactionReference} onChange={e => setFnfForm({ ...ffForm, transactionReference: e.target.value })} />
                                    </div>
                                </div>
                                <button className="btn btn-success btn-sm" style={{ width: '100%', marginTop: 10 }} onClick={handleMarkPaid}>
                                    Mark Paid & Record Complete
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 8 }} onClick={() => handleCompleteExit(selectedExit.exitRequestDetails._id)}>
                                    Mark Exit Route Finished
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Submit resignation Modal */}
            {showSubmitModal && (() => {
                const disabledIfEmployeeInitiated = isEditing && (newRequestForm.initiatedBy === 'employee' || !newRequestForm.initiatedBy);
                return (
                    <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: 650, maxHeight: '90vh', overflowY: 'auto' }}>
                            <button
                                type="button"
                                onClick={() => setShowSubmitModal(false)}
                                style={{
                                    position: 'absolute',
                                    top: '16px',
                                    right: '16px',
                                    width: '42px',
                                    height: '42px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease-in-out',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f1f5f9';
                                    e.currentTarget.style.color = '#334155';
                                    e.currentTarget.style.transform = 'scale(1.02)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#f8fafc';
                                    e.currentTarget.style.color = '#64748b';
                                    e.currentTarget.style.transform = 'scale(1)';
                                }}
                            >
                                <HiOutlineX size={20} />
                            </button>
                            <div className="modal-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingRight: '60px' }}>
                                <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                    {isEditing ? 'Edit Exit Request' : 'Submit Resignation / Exit Request'}
                                </h2>
                                <p style={{ fontSize: 13, margin: '6px 0 0 0', color: '#64748b' }}>
                                    {isEditing ? 'Update the details of this exit request' : 'Register resignation, retirement, termination or event request'}
                                </p>
                            </div>
                            <form onSubmit={handleSubmitResignation}>
                                <div className="modal-body">
                                    {(() => {
                                        // 1. Get unique departments list
                                        const uniqueDepts = ['All Departments', ...new Set(employees.map(e => e.department).filter(Boolean))];

                                        // 2. Filter employees by selected department
                                        const filteredEmployeesForSelect = [];
                                        employees.forEach(e => {
                                            if (selectedFilterDept === 'All Departments' || e.department === selectedFilterDept) {
                                                filteredEmployeesForSelect.push(e);
                                            }
                                        });

                                        // 3. Make sure current selected employee is always included in the selection list (especially for edit mode)
                                        if (newRequestForm.employeeId && !filteredEmployeesForSelect.some(e => e._id === newRequestForm.employeeId)) {
                                            const editingEmp = exits.find(ex => (ex.employee?._id || ex.employeeId?._id || ex.employee) === newRequestForm.employeeId)?.employee;
                                            if (editingEmp) {
                                                filteredEmployeesForSelect.push(editingEmp);
                                            }
                                        }

                                        return (
                                            <div className="form-row">
                                                <div className="form-group" style={{ flex: '1 1 200px' }}>
                                                    <label className="form-label">Filter by Department</label>
                                                    <select
                                                        className="form-control"
                                                        disabled={disabledIfEmployeeInitiated}
                                                        value={selectedFilterDept}
                                                        onChange={e => {
                                                            setSelectedFilterDept(e.target.value);
                                                            // If the current selected employee is not in the new filtered department, reset employee selection
                                                            const targetDept = e.target.value;
                                                            if (targetDept !== 'All Departments') {
                                                                const currentEmp = employees.find(emp => emp._id === newRequestForm.employeeId);
                                                                if (!currentEmp || currentEmp.department !== targetDept) {
                                                                    setNewRequestForm(prev => ({ ...prev, employeeId: '' }));
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {uniqueDepts.map(d => (
                                                            <option key={d} value={d}>{d}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="form-group" style={{ flex: '1 1 200px' }}>
                                                    <label className="form-label">Employee</label>
                                                    <EmployeeSelect
                                                        employees={filteredEmployeesForSelect}
                                                        value={newRequestForm.employeeId}
                                                        disabled={disabledIfEmployeeInitiated}
                                                        onChange={val => {
                                                            setNewRequestForm({ ...newRequestForm, employeeId: val });
                                                            // Auto-select department of target employee if they selected an employee
                                                            if (val) {
                                                                const emp = employees.find(e => e._id === val);
                                                                if (emp && emp.department) {
                                                                    setSelectedFilterDept(emp.department);
                                                                }
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="form-row">
                                        <div className="form-group" style={{ flex: !['death', 'permanent_disablement'].includes(newRequestForm.exitReason) ? '1 1 200px' : '1 1 100%' }}>
                                            <label className="form-label">Exit Reason Category</label>
                                            <select className="form-control" disabled={disabledIfEmployeeInitiated} value={newRequestForm.exitReason} onChange={e => setNewRequestForm({ ...newRequestForm, exitReason: e.target.value })}>
                                                <option value="resignation">Resignation</option>
                                                <option value="retirement">Retirement / Superannuation</option>
                                                <option value="termination_non_misconduct">Termination (Non-misconduct)</option>
                                                <option value="termination_misconduct">Termination (Misconduct)</option>
                                                <option value="fixed_term_end">Fixed-Term Contract End</option>
                                                <option value="death">Death</option>
                                                <option value="permanent_disablement">Permanent Disablement</option>
                                            </select>
                                        </div>

                                        {!['death', 'permanent_disablement'].includes(newRequestForm.exitReason) && (
                                            <div className="form-group">
                                                <label className="form-label">Resignation/Event Submission Date</label>
                                                <input type="date" className="form-control" disabled={disabledIfEmployeeInitiated} value={newRequestForm.resignationDate} onChange={e => setNewRequestForm({ ...newRequestForm, resignationDate: e.target.value })} />
                                            </div>
                                        )}
                                    </div>

                                    {!['death', 'permanent_disablement'].includes(newRequestForm.exitReason) && (
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Expected Last Working Day (LWD)</label>
                                                <input type="date" className="form-control" value={newRequestForm.lastWorkingDay} onChange={e => setNewRequestForm({ ...newRequestForm, lastWorkingDay: e.target.value })} />
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Notice Period Served (Days)</label>
                                                <input type="number" className="form-control" disabled={disabledIfEmployeeInitiated} value={newRequestForm.noticePeriodServed} onChange={e => setNewRequestForm({ ...newRequestForm, noticePeriodServed: e.target.value === '' ? '' : Number(e.target.value) })} />
                                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, display: 'block' }}>Auto-calculated, editable</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="form-group">
                                        <label className="form-label">Remarks / Description Notes</label>
                                        <textarea className="form-control" disabled={disabledIfEmployeeInitiated} placeholder="Explain relocation, health issues, termination logs etc." value={newRequestForm.remarks} onChange={e => setNewRequestForm({ ...newRequestForm, remarks: e.target.value })} />
                                    </div>

                                    {newRequestForm.exitReason === 'termination_misconduct' && (
                                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: 16, borderRadius: 8, marginTop: 16 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#b91c1c', fontWeight: '600', marginBottom: 6 }}>
                                                <HiOutlineExclamation size={18} />
                                                <h4 style={{ margin: 0, color: '#b91c1c', fontSize: '14px' }}>Gratuity Forfeiture Warning</h4>
                                            </div>
                                            <p style={{ fontSize: 11, color: '#7f1d1d', margin: 0 }}>
                                                Gratuity is NOT payable for termination due to misconduct as per the Payment of Gratuity Act, 1972. Gratuity will be set to ₹0 and locked in the F&F calculations.
                                            </p>
                                        </div>
                                    )}

                                    {/* Custom Nominee death certification fields */}
                                    {['death', 'permanent_disablement'].includes(newRequestForm.exitReason) && (
                                        <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: 16, borderRadius: 8, marginTop: 16 }}>
                                            <h4 style={{ margin: 0, marginBottom: 8, color: '#b91c1c' }}>Death / Permanent Disablement Case Rules</h4>
                                            <p style={{ fontSize: 11, color: '#7f1d1d', marginBottom: 12 }}>
                                                As per Payment of Gratuity Act, gratuity is payable within 30 days regardless of service period. No minimum service requirement applies.
                                            </p>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label className="form-label">Nominee Name</label>
                                                    <input className="form-control" value={newRequestForm.nomineeName} onChange={e => setNewRequestForm({ ...newRequestForm, nomineeName: e.target.value })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Nominee Relationship</label>
                                                    <input className="form-control" value={newRequestForm.nomineeRelationship} onChange={e => setNewRequestForm({ ...newRequestForm, nomineeRelationship: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="form-row">
                                                <div className="form-group">
                                                    <label className="form-label">Nominee Bank Account</label>
                                                    <input className="form-control" value={newRequestForm.nomineeBankAccount} onChange={e => setNewRequestForm({ ...newRequestForm, nomineeBankAccount: e.target.value })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Nominee Bank IFSC</label>
                                                    <input className="form-control" value={newRequestForm.nomineeIFSC} onChange={e => setNewRequestForm({ ...newRequestForm, nomineeIFSC: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="form-row" style={{ marginTop: 10 }}>
                                                <div className="form-group">
                                                    <label className="form-label">Date of Death/Disablement</label>
                                                    <input type="date" className="form-control" value={newRequestForm.eventDate} onChange={e => setNewRequestForm({ ...newRequestForm, eventDate: e.target.value })} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Death Certificate Number</label>
                                                    <input className="form-control" value={newRequestForm.deathCertificateNumber} onChange={e => setNewRequestForm({ ...newRequestForm, deathCertificateNumber: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="modal-footer" style={{ marginTop: 20 }}>
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary">
                                        {isEditing ? 'Save Changes' : 'File Exit Request'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
