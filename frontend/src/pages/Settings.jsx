import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';
import api from '../utils/api';
import { HiOutlineCog, HiOutlineShieldCheck, HiOutlineClock, HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';
import EmployeeSelect from '../components/EmployeeSelect';
import * as XLSX from 'xlsx';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('general');
    const [shifts, setShifts] = useState([]);
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftForm, setShiftForm] = useState({ name: '', startTime: '', endTime: '', workingHours: 8, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
    const [editingShift, setEditingShift] = useState(null);
    const [shiftLoading, setShiftLoading] = useState(false);

    // Logo Upload State
    const [logoUrl, setLogoUrl] = useState(null);
    const [uploadingLogo, setUploadingLogo] = useState(false);

    // General Settings State
    const [generalSettings, setGeneralSettings] = useState({
        companyName: 'HRMS Portal Technologies Private Limited.',
        companyEmail: 'hr@company.com',
        companyPhone: '+91 98765 43210',
        companyWebsite: 'https://company.com',
        companyAddress: 'Plot no. 123, Business Park, Indore Madhya Pradesh, 452010',
        cin: '',
        companyPan: '',
        tan: '',
        gstNumber: '',
        workWeekType: '5-Day Week',
        applyFiftyPercentRule: false,
        gratuityTimeline: 30,
        noticePeriodDays: 30
    });
    const [savingGeneral, setSavingGeneral] = useState(false);

    // Statutory Settings State
    const [statutorySettings, setStatutorySettings] = useState({
        pfCode: '', esicCode: '', ptCode: '', finYearStart: 'April',
        epfWageCeiling: 15000, pfAdminRate: 0.5, edliRate: 0.5, epsRate: 8.33, epfEmployerRate: 3.67, epfEmployeeRate: 12,
        esicWageCeiling: 21000, esicEmployeeRate: 0.75, esicEmployerRate: 3.25, companyBanks: [{ bankName: '', accountNo: '', ifsc: '' }],
        esicWageComponents: ['Basic', 'HRA', 'Allowance', 'Incentive', 'Bonus']
    });

    // Leave Policy Setup
    const [leavePolicy, setLeavePolicy] = useState({
        plQuota: 12, clQuota: 6, slQuota: 6, cfAllowedPL: true, cfAllowedCL: false, cfAllowedSL: false, maxCfDays: 6, lapseAtYearEnd: true
    });

    // Leave balance override states
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedDept, setSelectedDept] = useState('');
    const [isBulk, setIsBulk] = useState(false);
    const [selectedEmployees, setSelectedEmployees] = useState([]);
    const [adjustEmployee, setAdjustEmployee] = useState('');
    const [adjustType, setAdjustType] = useState('casual');
    const [adjustOperation, setAdjustOperation] = useState('add');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustLoading, setAdjustLoading] = useState(false);
    const [balanceHistory, setBalanceHistory] = useState([]);
    const [historyDeptFilter, setHistoryDeptFilter] = useState('');
    const [historyYearFilter, setHistoryYearFilter] = useState('');
    const [historyMonthFilter, setHistoryMonthFilter] = useState('');
    const [historyTypeFilter, setHistoryTypeFilter] = useState('');
    const [years, setYears] = useState([]);

    // Salary Components setup
    const [salaryComponents, setSalaryComponents] = useState({
        earnings: [
            { id: 1, name: 'Basic Salary', type: 'Fixed', value: '', taxable: 'Yes' },
            { id: 2, name: 'HRA', type: '% of Basic', value: '40', taxable: 'Yes' },
            { id: 3, name: 'Special Allowance', type: 'Fixed', value: '0', taxable: 'Yes' },
            { id: 4, name: 'Conveyance Allowance', type: 'Fixed', value: '1600', taxable: 'Yes' },
            { id: 5, name: 'Medical Allowance', type: 'Fixed', value: '1250', taxable: 'Yes' }
        ],
        deductions: [
            { id: 1, name: 'PF Employee', type: '% of Basic', value: '12' },
            { id: 2, name: 'PF Employer', type: '% of Basic', value: '12' },
            { id: 3, name: 'ESIC Employee', type: '% of Gross', value: '0.75' },
            { id: 4, name: 'TDS', type: 'Auto (slab-based)', value: '-' }
        ]
    });

    useEffect(() => {
        if (activeTab === 'shifts') fetchShifts();
        if (activeTab === 'general' || activeTab === 'statutory' || activeTab === 'leave_policy') {
            fetchLogo();
            fetchSettingsData();
        }
        if (activeTab === 'leave_policy') {
            fetchEmployees();
            fetchDepartments();
            fetchBalanceHistory();
            fetchYears();
        }
    }, [activeTab]);

    const fetchEmployees = async () => {
        try {
            const { data } = await api.get('/employees?limit=1000');
            setEmployees(Array.isArray(data.data) ? data.data : []);
        } catch { }
    };

    const fetchDepartments = async () => {
        try {
            const { data } = await api.get('/departments');
            setDepartments((data.data || []).map(d => d.name));
        } catch { }
    };

    const handleAdjustBalance = async (e) => {
        e.preventDefault();
        const targets = isBulk ? selectedEmployees : (adjustEmployee ? [adjustEmployee] : []);
        if (targets.length === 0) {
            toast.error("Please select at least one employee.");
            return;
        }
        if (adjustAmount === "" || isNaN(Number(adjustAmount))) {
            toast.error("Please specify a valid amount.");
            return;
        }

        setAdjustLoading(true);
        try {
            const { data } = await api.post('/leaves/adjust-balance', {
                employeeIds: targets,
                leaveType: adjustType,
                operation: adjustOperation,
                amount: Number(adjustAmount)
            });
            toast.success(data.message || "Balance adjusted successfully");
            setAdjustAmount('');
            setSelectedEmployees([]);
            setAdjustEmployee('');
            fetchBalanceHistory();
        } catch (err) {
            toast.error(err.response?.data?.message || "Adjustment failed");
        }
        setAdjustLoading(false);
    };


    const fetchBalanceHistory = async () => {
        try {
            const { data } = await api.get('/leaves/balance-history');
            setBalanceHistory(data.data || []);
        } catch { }
    };

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/payroll-years');
            setYears(data.data || []);
        } catch { }
    };

    const getFilteredHistory = () => {
        return balanceHistory.filter(h => {
            const date = new Date(h.createdAt);
            const matchDept = !historyDeptFilter || h.employee?.department === historyDeptFilter;
            const matchYear = !historyYearFilter || date.getFullYear().toString() === historyYearFilter;
            const matchMonth = !historyMonthFilter || (date.getMonth() + 1).toString() === historyMonthFilter;
            const matchType = !historyTypeFilter || h.leaveType?.toLowerCase() === historyTypeFilter.toLowerCase();
            return matchDept && matchYear && matchMonth && matchType;
        });
    };

    const handleExportExcel = () => {
        const filteredData = getFilteredHistory();
        if (!filteredData || filteredData.length === 0) return;

        const mapForExcel = (items) => items.map(item => ({
            'Date': new Date(item.createdAt).toLocaleDateString('en-IN'),
            'Month & Year': new Date(item.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
            'Employee Code': item.employee?.employeeCode || '',
            'Employee Name': `${item.employee?.firstName || ''} ${item.employee?.lastName || ''}`.trim(),
            'Department': item.employee?.department || '',
            'Leave Type': item.leaveType,
            'Operation': item.operation === 'add' ? 'Add/Deduct' : 'Override Set',
            'Adjusted Amount (Days)': item.amount >= 0 ? `+${item.amount}` : item.amount,
            'Before Balance (Days)': item.beforeBalance,
            'After Balance (Days)': item.afterBalance,
            'Action By': item.adjustedBy?.role === 'SuperAdmin' ? 'Super Admin' : (item.adjustedBy?.role || 'Admin')
        }));

        const applyAutoWidth = (ws, mappedData) => {
            if (!mappedData || mappedData.length === 0) return;
            const keys = Object.keys(mappedData[0]);
            const cols = keys.map(key => {
                let maxLen = key.toString().length;
                for (const row of mappedData) {
                    const cellVal = row[key];
                    if (cellVal !== undefined && cellVal !== null) {
                        maxLen = Math.max(maxLen, cellVal.toString().length);
                    }
                }
                return { wch: maxLen + 3 };
            });
            ws['!cols'] = cols;
        };

        const wb = XLSX.utils.book_new();

        // 1. All sheet
        const allDataMapped = mapForExcel(filteredData);
        const wsAll = XLSX.utils.json_to_sheet(allDataMapped);
        applyAutoWidth(wsAll, allDataMapped);
        XLSX.utils.book_append_sheet(wb, wsAll, "All Adjustments");

        // 2. Casual sheet
        const casualAdjustments = filteredData.filter(h => h.leaveType?.toLowerCase() === 'casual');
        const casualDataMapped = mapForExcel(casualAdjustments);
        const wsCasual = XLSX.utils.json_to_sheet(casualDataMapped);
        applyAutoWidth(wsCasual, casualDataMapped);
        XLSX.utils.book_append_sheet(wb, wsCasual, "Casual");

        // 3. Sick sheet
        const sickAdjustments = filteredData.filter(h => h.leaveType?.toLowerCase() === 'sick');
        const sickDataMapped = mapForExcel(sickAdjustments);
        const wsSick = XLSX.utils.json_to_sheet(sickDataMapped);
        applyAutoWidth(wsSick, sickDataMapped);
        XLSX.utils.book_append_sheet(wb, wsSick, "Sick");

        // 4. Earned sheet
        const earnedAdjustments = filteredData.filter(h => h.leaveType?.toLowerCase() === 'earned');
        const earnedDataMapped = mapForExcel(earnedAdjustments);
        const wsEarned = XLSX.utils.json_to_sheet(earnedDataMapped);
        applyAutoWidth(wsEarned, earnedDataMapped);
        XLSX.utils.book_append_sheet(wb, wsEarned, "Earned");

        // 5. Other sheet
        const otherAdjustments = filteredData.filter(h => h.leaveType?.toLowerCase() === 'other');
        const otherDataMapped = mapForExcel(otherAdjustments);
        const wsOther = XLSX.utils.json_to_sheet(otherDataMapped);
        applyAutoWidth(wsOther, otherDataMapped);
        XLSX.utils.book_append_sheet(wb, wsOther, "Other");

        XLSX.writeFile(wb, `Leave_Balance_Adjustments_${new Date().getFullYear()}.xlsx`);
    };

    const fetchSettingsData = async () => {
        try {
            const { data } = await api.get('/settings');
            if (data.data) {
                setGeneralSettings(prev => ({ ...prev, ...data.data }));

                let loadedBanks = data.data.companyBanks;
                if (!loadedBanks || !loadedBanks.length) {
                    if (data.data.bankAccountNo || data.data.bankIfscCode) {
                        loadedBanks = [{ bankName: 'Default Bank', accountNo: data.data.bankAccountNo || '', ifsc: data.data.bankIfscCode || '' }];
                    } else {
                        loadedBanks = [{ bankName: '', accountNo: '', ifsc: '' }];
                    }
                }

                setStatutorySettings(prev => ({ ...prev, ...data.data, companyBanks: loadedBanks, esicWageComponents: data.data.esicWageComponents || ['Basic', 'HRA', 'Allowance', 'Incentive', 'Bonus'] }));
                setLeavePolicy(prev => ({ ...prev, ...data.data }));
            }
        } catch { }
    };

    const handleSaveSettings = async (settingsPayload) => {
        setSavingGeneral(true);
        try {
            let payload = { ...settingsPayload };
            if (payload.companyBanks) {
                payload.companyBanks = payload.companyBanks.map(b => ({ ...b, ifsc: (b.ifsc || '').toUpperCase() }));
            }
            if (payload.companyPan) payload.companyPan = payload.companyPan.toUpperCase();
            if (payload.tan) payload.tan = payload.tan.toUpperCase();
            if (payload.cin) payload.cin = payload.cin.toUpperCase();
            if (payload.gstNumber) payload.gstNumber = payload.gstNumber.toUpperCase();
            if (payload.pfCode) payload.pfCode = payload.pfCode.toUpperCase();

            await api.post('/settings', payload);
            toast.success('Settings saved successfully!');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save settings');
        }
        setSavingGeneral(false);
    };

    const fetchLogo = async () => {
        try {
            const { data } = await api.get('/settings/logo/exists');
            if (data.hasLogo) setLogoUrl(data.logoData);
        } catch { }
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return toast.error('Please upload an image file');
        if (file.size > 2 * 1024 * 1024) return toast.error('Logo should be under 2MB');

        const reader = new FileReader();
        reader.onloadend = async () => {
            setUploadingLogo(true);
            try {
                const base64Image = reader.result;
                await api.post('/settings/logo', { base64Image });
                setLogoUrl(base64Image);
                toast.success('Company logo updated successfully! This will appear on all payslips.');
            } catch (err) {
                toast.error('Failed to update company logo');
            }
            setUploadingLogo(false);
        };
        reader.readAsDataURL(file);
    };

    const handleLogoDelete = async () => {
        const res = await Swal.fire({
            title: 'Delete Logo?',
            text: 'Are you sure you want to remove the company logo? It will be removed from future payslips.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444'
        });
        if (!res.isConfirmed) return;

        try {
            await api.delete('/settings/logo');
            setLogoUrl(null);
            toast.success('Company logo removed successfully');
        } catch (err) {
            toast.error('Failed to remove company logo');
        }
    };

    const fetchShifts = async () => {
        try {
            const { data } = await api.get('/shifts');
            setShifts(data.data || []);
        } catch { }
    };

    const handleShiftSubmit = async (e) => {
        e.preventDefault();
        setShiftLoading(true);
        try {
            if (editingShift) {
                await api.put(`/shifts/${editingShift._id}`, shiftForm);
            } else {
                await api.post('/shifts', shiftForm);
            }
            setShowShiftModal(false);
            setEditingShift(null);
            setShiftForm({ name: '', startTime: '', endTime: '', workingHours: 8, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
            fetchShifts();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Operation failed');
        }
        setShiftLoading(false);
    };

    const deleteShift = async (id) => {
        const _swalRes = await Swal.fire({ title: 'Please Confirm', text: 'Delete this shift?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
        if (!_swalRes.isConfirmed) return;
        try {
            await api.delete(`/shifts/${id}`);
            fetchShifts();
        } catch { }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div><h1>Settings</h1><p>System configuration and preferences</p></div>
            </div>

            <div className="tabs" style={{ flexWrap: 'wrap', marginBottom: 24, gap: '4px' }}>
                {[
                    { key: 'general', label: 'General', icon: <HiOutlineCog size={16} /> },
                    { key: 'statutory', label: 'Statutory & Compliance', icon: <HiOutlineShieldCheck size={16} /> },
                    { key: 'salary_components', label: 'Salary Components', icon: <HiOutlinePlus size={16} /> },
                    { key: 'leave_policy', label: 'Leave Policy', icon: <HiOutlineClock size={16} /> },
                    { key: 'roles', label: 'Roles & Permissions', icon: <HiOutlineShieldCheck size={16} /> },
                    { key: 'shifts', label: 'Shift Management', icon: <HiOutlineClock size={16} /> },
                ].map(t => (
                    <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setActiveTab(t.key)}>
                        {t.icon}
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'general' && (
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Company Information</h3>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Company Name</label><input className="form-control" value={generalSettings.companyName} onChange={e => setGeneralSettings({ ...generalSettings, companyName: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Company Email</label><input className="form-control" value={generalSettings.companyEmail} onChange={e => setGeneralSettings({ ...generalSettings, companyEmail: e.target.value })} /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={generalSettings.companyPhone} onChange={e => setGeneralSettings({ ...generalSettings, companyPhone: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Website</label><input className="form-control" value={generalSettings.companyWebsite} onChange={e => setGeneralSettings({ ...generalSettings, companyWebsite: e.target.value })} /></div>
                    </div>
                    <div className="form-group"><label className="form-label">Address</label><textarea className="form-control" value={generalSettings.companyAddress} onChange={e => setGeneralSettings({ ...generalSettings, companyAddress: e.target.value })} /></div>

                    <div className="form-row">
                        <div className="form-group"><label className="form-label">CIN (Optional)</label><input className="form-control" style={{ textTransform: 'uppercase' }} placeholder="U12345MP2020PTC123456" maxLength="21" value={generalSettings.cin} onChange={e => setGeneralSettings({ ...generalSettings, cin: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Company PAN</label><input className="form-control" style={{ textTransform: 'uppercase' }} placeholder="AAACI1234A" maxLength="10" value={generalSettings.companyPan} onChange={e => setGeneralSettings({ ...generalSettings, companyPan: e.target.value })} /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">TAN</label><input className="form-control" style={{ textTransform: 'uppercase' }} placeholder="INDA12345B" maxLength="10" value={generalSettings.tan} onChange={e => setGeneralSettings({ ...generalSettings, tan: e.target.value })} /><small style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Required for Form 16 and Form 24Q filing</small></div>
                        <div className="form-group"><label className="form-label">GST Number (Optional)</label><input className="form-control" style={{ textTransform: 'uppercase' }} placeholder="23AAACI1234A1Z5" maxLength="15" value={generalSettings.gstNumber} onChange={e => setGeneralSettings({ ...generalSettings, gstNumber: e.target.value })} /></div>
                    </div>

                    <div className="form-group" style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <label className="form-label" style={{ marginBottom: 12, fontWeight: 600 }}>Company Logo (Used in Payslips and Documents)</label>
                        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                            {logoUrl ? (
                                <div style={{ background: '#1e293b', padding: '12px', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                    <img src={logoUrl} alt="Company Logo" style={{ height: 64, objectFit: 'contain' }} />
                                </div>
                            ) : (
                                <div style={{ height: 64, width: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e293b', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: 13, color: 'var(--text-tertiary)', flexShrink: 0 }}>No Logo</div>
                            )}
                            <div>
                                <div className="actions-mobile-nowrap" style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px' }}>
                                    <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', margin: 0, whiteSpace: 'nowrap' }}>
                                        {uploadingLogo ? '⏳ Uploading...' : 'Upload New Logo'}
                                        <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleLogoUpload} disabled={uploadingLogo} />
                                    </label>
                                    {logoUrl && (
                                        <button className="btn btn-danger" onClick={handleLogoDelete} disabled={uploadingLogo} style={{ whiteSpace: 'nowrap' }}>
                                            Delete Logo
                                        </button>
                                    )}
                                </div>
                                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0 }}>Recommended: PNG transparent, max 2MB.</p>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 20 }}>
                        <h3 className="card-title" style={{ marginBottom: 20 }}>Exit Policy & Gratuity Settings</h3>
                        <div className="form-row">
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Work Week Type</label>
                                <select className="form-control" value={generalSettings.workWeekType} onChange={e => setGeneralSettings({ ...generalSettings, workWeekType: e.target.value })}>
                                    <option value="5-Day Week">5-Day Week</option>
                                    <option value="6-Day Week">6-Day Week</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Default Notice Period Requirements (Days)</label>
                                <input type="number" className="form-control" value={generalSettings.noticePeriodDays} onChange={e => setGeneralSettings({ ...generalSettings, noticePeriodDays: Number(e.target.value) })} />
                            </div>
                        </div>
                        <div className="form-row" style={{ marginTop: 12 }}>
                            <div className="form-group" style={{ marginBottom: 12 }}>
                                <label className="form-label">Gratuity Statutory Payment Timeline Limit (Days)</label>
                                <input type="number" className="form-control" value={generalSettings.gratuityTimeline} onChange={e => setGeneralSettings({ ...generalSettings, gratuityTimeline: Number(e.target.value) })} />
                            </div>
                            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: 12 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                                    <input type="checkbox" checked={generalSettings.applyFiftyPercentRule} onChange={e => setGeneralSettings({ ...generalSettings, applyFiftyPercentRule: e.target.checked })} />
                                    Apply 50% Wage Rule Check (Labour Code)
                                </label>
                                <small style={{ color: 'var(--text-tertiary)', fontSize: 11, marginTop: 4 }}>
                                    If Basic salary is below 50% of monthly Gross wages, calculate Gratuity using 50% of monthly Gross.
                                </small>
                            </div>
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => handleSaveSettings(generalSettings)} disabled={savingGeneral}>
                        {savingGeneral ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            )}

            {activeTab === 'statutory' && (
                <div className="card">
                    <h3 className="card-title" style={{ marginBottom: 20 }}>Statutory Registration</h3>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">PF Establishment Code</label><input className="form-control" style={{ textTransform: 'uppercase' }} placeholder="MP/IND/0012345/000" value={statutorySettings.pfCode} onChange={e => setStatutorySettings({ ...statutorySettings, pfCode: e.target.value })} /><small style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Used in PF monthly challan generation</small></div>
                        <div className="form-group"><label className="form-label">ESIC Establishment Code</label><input className="form-control" placeholder="11-22-334455-000-1111" value={statutorySettings.esicCode} onChange={e => setStatutorySettings({ ...statutorySettings, esicCode: e.target.value })} /><small style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Used in ESIC challan generation</small></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">Professional Tax Reg. No. (Optional)</label><input className="form-control" value={statutorySettings.ptCode} onChange={e => setStatutorySettings({ ...statutorySettings, ptCode: e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">Financial Year Start</label><select className="form-control" value={statutorySettings.finYearStart} onChange={e => setStatutorySettings({ ...statutorySettings, finYearStart: e.target.value })}><option>April</option><option>January</option></select></div>
                    </div>

                    <div style={{ marginTop: 24, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="card-title" style={{ margin: 0 }}>Salary Disbursement Bank Account(s)</h3>
                        <button className="btn btn-secondary btn-sm" onClick={() => setStatutorySettings({ ...statutorySettings, companyBanks: [...statutorySettings.companyBanks, { bankName: '', accountNo: '', ifsc: '' }] })}>
                            <HiOutlinePlus /> Add Bank
                        </button>
                    </div>
                    {statutorySettings.companyBanks.map((bank, index) => (
                        <div key={index} style={{ padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: 16, position: 'relative' }}>
                            {statutorySettings.companyBanks.length > 1 && (
                                <button style={{ position: 'absolute', right: 12, top: 12, background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }} onClick={() => {
                                    const newBanks = statutorySettings.companyBanks.filter((_, i) => i !== index);
                                    setStatutorySettings({ ...statutorySettings, companyBanks: newBanks });
                                }}>
                                    <HiOutlineTrash size={18} />
                                </button>
                            )}
                            <div className="form-row" style={{ marginBottom: index === 0 ? 0 : 0 }}>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Bank Name</label>
                                    <input className="form-control" placeholder="e.g. State Bank of India" value={bank.bankName} onChange={e => {
                                        const newBanks = [...statutorySettings.companyBanks];
                                        newBanks[index].bankName = e.target.value;
                                        setStatutorySettings({ ...statutorySettings, companyBanks: newBanks });
                                    }} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Account Number</label>
                                    <input className="form-control" placeholder="1234567890" value={bank.accountNo} onChange={e => {
                                        const newBanks = [...statutorySettings.companyBanks];
                                        newBanks[index].accountNo = e.target.value;
                                        setStatutorySettings({ ...statutorySettings, companyBanks: newBanks });
                                    }} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">IFSC Code</label>
                                    <input className="form-control" style={{ textTransform: 'uppercase' }} placeholder="SBIN0001234" value={bank.ifsc} onChange={e => {
                                        const newBanks = [...statutorySettings.companyBanks];
                                        newBanks[index].ifsc = e.target.value;
                                        setStatutorySettings({ ...statutorySettings, companyBanks: newBanks });
                                    }} />
                                </div>
                            </div>
                        </div>
                    ))}

                    <h3 className="card-title" style={{ marginTop: 24, marginBottom: 16 }}>PF Contribution Settings</h3>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">EPF Wage Ceiling (₹)</label><input className="form-control" type="number" value={statutorySettings.epfWageCeiling} onChange={e => setStatutorySettings({ ...statutorySettings, epfWageCeiling: +e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">EPF Employee Rate (%)</label><input className="form-control" type="number" value={statutorySettings.epfEmployeeRate} onChange={e => setStatutorySettings({ ...statutorySettings, epfEmployeeRate: +e.target.value })} /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">EPF Employer Rate (%) <span className="badge badge-warning" style={{ fontSize: 10 }}>Statutory — Locked</span></label><input className="form-control" readOnly value={statutorySettings.epfEmployerRate} style={{ opacity: 0.7 }} /></div>
                        <div className="form-group"><label className="form-label">EPS Rate (%) <span className="badge badge-warning" style={{ fontSize: 10 }}>Statutory — Locked</span></label><input className="form-control" readOnly value={statutorySettings.epsRate} style={{ opacity: 0.7 }} /></div>
                    </div>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">PF Admin Charges Rate (%)</label><input className="form-control" type="number" value={statutorySettings.pfAdminRate} onChange={e => setStatutorySettings({ ...statutorySettings, pfAdminRate: +e.target.value })} /></div>
                        <div className="form-group"><label className="form-label">EDLI Charges Rate (%)</label><input className="form-control" type="number" value={statutorySettings.edliRate} onChange={e => setStatutorySettings({ ...statutorySettings, edliRate: +e.target.value })} /></div>
                    </div>

                    <h3 className="card-title" style={{ marginTop: 24, marginBottom: 16 }}>ESIC Contribution Settings</h3>
                    <div className="form-row">
                        <div className="form-group"><label className="form-label">ESIC Wage Ceiling (₹)</label><input className="form-control" type="number" value={statutorySettings.esicWageCeiling} onChange={e => setStatutorySettings({ ...statutorySettings, esicWageCeiling: +e.target.value })} /><small style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Gross above this makes employee ineligible</small></div>
                        <div className="form-group"><label className="form-label">ESIC Employee Rate (%) <span className="badge badge-warning" style={{ fontSize: 10 }}>Statutory — Locked</span></label><input className="form-control" readOnly value={statutorySettings.esicEmployeeRate} style={{ opacity: 0.7 }} /></div>
                        <div className="form-group"><label className="form-label">ESIC Employer Rate (%) <span className="badge badge-warning" style={{ fontSize: 10 }}>Statutory — Locked</span></label><input className="form-control" readOnly value={statutorySettings.esicEmployerRate} style={{ opacity: 0.7 }} /></div>
                    </div>

                    <div className="form-group" style={{ marginTop: 16 }}>
                        <label className="form-label" style={{ marginBottom: 12 }}>ESIC Wage Components (Select what counts towards ESIC Gross)</label>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                            {['Basic', 'HRA', 'Allowance', 'Incentive', 'Bonus', 'Overtime'].map(comp => (
                                <label key={comp} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={statutorySettings.esicWageComponents.includes(comp)} onChange={e => {
                                        const components = e.target.checked
                                            ? [...statutorySettings.esicWageComponents, comp]
                                            : statutorySettings.esicWageComponents.filter(c => c !== comp);
                                        setStatutorySettings({ ...statutorySettings, esicWageComponents: components });
                                    }} style={{ width: 16, height: 16, cursor: 'pointer' }} /> {comp}
                                </label>
                            ))}
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => handleSaveSettings(statutorySettings)} disabled={savingGeneral}>
                        {savingGeneral ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            )
            }

            {
                activeTab === 'leave_policy' && (
                    <>


                        <div className="card" style={{ marginTop: 24 }}>
                            <h3 className="card-title" style={{ marginBottom: 12 }}>Manual Leave Balance Adjustments</h3>
                            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
                                Override or add leave days directly to employee balances. You can choose single employees or select in bulk by department.
                            </p>

                            <form onSubmit={handleAdjustBalance}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Filter by Department</label>
                                        <select
                                            className="form-control"
                                            value={selectedDept}
                                            onChange={e => {
                                                setSelectedDept(e.target.value);
                                                setAdjustEmployee('');
                                                setSelectedEmployees([]);
                                            }}
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map((d, i) => <option key={i} value={d}>{d}</option>)}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <label className="form-label">Select Employee</label>
                                            <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: 'var(--primary)' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isBulk}
                                                    onChange={e => {
                                                        setIsBulk(e.target.checked);
                                                        setAdjustEmployee('');
                                                        setSelectedEmployees([]);
                                                    }}
                                                />
                                                Bulk Select Mode
                                            </label>
                                        </div>

                                        {isBulk ? (
                                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px', maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-primary)' }}>
                                                <div style={{ display: 'flex', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border-color)' }}>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-secondary"
                                                        onClick={() => setSelectedEmployees((selectedDept ? employees.filter(e => e.department === selectedDept) : employees).map(e => e._id))}
                                                    >
                                                        Select All
                                                    </button>
                                                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedEmployees([])}>Clear</button>
                                                    <span style={{ fontSize: 12, marginLeft: 'auto', alignSelf: 'center', color: 'var(--text-tertiary)' }}>{selectedEmployees.length} selected</span>
                                                </div>
                                                {(selectedDept ? employees.filter(e => e.department === selectedDept) : employees).map(e => (
                                                    <label key={e._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer', fontSize: 14 }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedEmployees.includes(e._id)}
                                                            onChange={(evt) => {
                                                                if (evt.target.checked) setSelectedEmployees([...selectedEmployees, e._id]);
                                                                else setSelectedEmployees(selectedEmployees.filter(id => id !== e._id));
                                                            }}
                                                        />
                                                        {e.firstName} {e.lastName} ({e.employeeCode})
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmployeeSelect
                                                employees={selectedDept ? employees.filter(e => e.department === selectedDept) : employees}
                                                value={adjustEmployee}
                                                onChange={setAdjustEmployee}
                                            />
                                        )}
                                    </div>
                                </div>

                                <div className="form-row" style={{ marginTop: 12 }}>
                                    <div className="form-group">
                                        <label className="form-label">Leave Type</label>
                                        <select className="form-control" value={adjustType} onChange={e => setAdjustType(e.target.value)}>
                                            <option value="casual">Casual Leave (CL)</option>
                                            <option value="sick">Sick Leave (SL)</option>
                                            <option value="earned">Earned Leave (PL)</option>
                                            <option value="other">Other Leave (Salary Paid)</option>
                                            <option value="all">All Leave Types</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Adjustment Operation</label>
                                        <select className="form-control" value={adjustOperation} onChange={e => setAdjustOperation(e.target.value)}>
                                            <option value="add">Add/Deduct Days (e.g. +5 or -2)</option>
                                            <option value="set">Set New Balance Directly</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Value (Days)</label>
                                        <input
                                            type="number"
                                            required
                                            className="form-control"
                                            placeholder="e.g. 5"
                                            value={adjustAmount}
                                            onChange={e => setAdjustAmount(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ marginTop: 24 }}
                                    disabled={adjustLoading}
                                >
                                    {adjustLoading ? 'Applying...' : 'Apply Balance Adjustments'}
                                </button>
                            </form>
                        </div>

                        <div className="card" style={{ marginTop: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div>
                                    <h3 className="card-title" style={{ margin: 0 }}>Leave Balance Adjustments History</h3>
                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                        Track and export manual leave balance overrides recorded across the HR portal.
                                    </p>
                                </div>
                                <button className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleExportExcel} disabled={getFilteredHistory().length === 0}>
                                    Export Excel Book
                                </button>
                            </div>

                            {/* Filters Bar */}
                            <div className="form-row" style={{ marginBottom: 20, background: 'var(--bg-primary)', padding: 16, borderRadius: 10, border: '1px solid var(--border-color)', gap: 12 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label" style={{ fontSize: 12 }}>Dept Filter</label>
                                    <select
                                        className="form-control form-control-sm"
                                        value={historyDeptFilter}
                                        onChange={e => setHistoryDeptFilter(e.target.value)}
                                    >
                                        <option value="">All Departments</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label" style={{ fontSize: 12 }}>Year Filter</label>
                                    <select
                                        className="form-control form-control-sm"
                                        value={historyYearFilter}
                                        onChange={e => setHistoryYearFilter(e.target.value)}
                                    >
                                        <option value="">All Years</option>
                                        {years.map(y => (
                                            <option key={y._id} value={y.year.toString()}>{y.year}</option>
                                        ))}
                                        {years.length === 0 && <option value={new Date().getFullYear().toString()}>{new Date().getFullYear()}</option>}
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label" style={{ fontSize: 12 }}>Month Filter</label>
                                    <select
                                        className="form-control form-control-sm"
                                        value={historyMonthFilter}
                                        onChange={e => setHistoryMonthFilter(e.target.value)}
                                    >
                                        <option value="">All Months</option>
                                        <option value="1">January</option>
                                        <option value="2">February</option>
                                        <option value="3">March</option>
                                        <option value="4">April</option>
                                        <option value="5">May</option>
                                        <option value="6">June</option>
                                        <option value="7">July</option>
                                        <option value="8">August</option>
                                        <option value="9">September</option>
                                        <option value="10">October</option>
                                        <option value="11">November</option>
                                        <option value="12">December</option>
                                    </select>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label" style={{ fontSize: 12 }}>Leave Type</label>
                                    <select
                                        className="form-control form-control-sm"
                                        value={historyTypeFilter}
                                        onChange={e => setHistoryTypeFilter(e.target.value)}
                                    >
                                        <option value="">All Types</option>
                                        <option value="casual">Casual Leave</option>
                                        <option value="sick">Sick Leave</option>
                                        <option value="earned">Earned Leave</option>
                                        <option value="other">Other Leave</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ position: 'relative', overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Employee</th>
                                            <th>Leave Type</th>
                                            <th>Operation</th>
                                            <th>Amount</th>
                                            <th>Old Balance</th>
                                            <th>New Balance</th>
                                            <th>Action By</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {getFilteredHistory().map(h => (
                                            <tr key={h._id}>
                                                <td>{new Date(h.createdAt).toLocaleDateString('en-IN')}</td>
                                                <td>
                                                    <span style={{ fontWeight: 600 }}>{h.employee?.firstName} {h.employee?.lastName}</span>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{h.employee?.employeeCode} – {h.employee?.department}</div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-primary`}>{h.leaveType}</span>
                                                </td>
                                                <td>
                                                    <span className={`badge ${h.operation === 'add' ? 'badge-success' : 'badge-neutral'}`}>
                                                        {h.operation === 'add' ? 'Add/Deduct' : 'Override Set'}
                                                    </span>
                                                </td>
                                                <td style={{ fontWeight: 700, color: h.amount >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                                    {h.amount >= 0 ? `+${h.amount}` : h.amount} days
                                                </td>
                                                <td>{h.beforeBalance} days</td>
                                                <td style={{ fontWeight: 700 }}>{h.afterBalance} days</td>
                                                <td>
                                                    <span style={{ fontSize: 13, fontWeight: 500 }}>
                                                        {h.adjustedBy?.role === 'SuperAdmin' ? 'Super Admin' : (h.adjustedBy?.role || 'Admin')}
                                                    </span>
                                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{h.adjustedBy?.email}</div>
                                                </td>
                                            </tr>
                                        ))}
                                        {getFilteredHistory().length === 0 && (
                                            <tr>
                                                <td colSpan="8" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-tertiary)' }}>
                                                    No leave adjustment history records found matching current filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )
            }

            {
                activeTab === 'salary_components' && (
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 20 }}>Default Earning Components</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead><tr><th>Component name</th><th>Calculation type</th><th>Default value</th><th>Taxable</th></tr></thead>
                                <tbody>
                                    {salaryComponents.earnings.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.name}</td><td>{c.type}</td><td>{c.value || 'N/A'}</td><td>{c.taxable}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="card-title" style={{ marginTop: 24, marginBottom: 16 }}>Default Deduction Components</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead><tr><th>Component name</th><th>Calculation type</th><th>Default value</th></tr></thead>
                                <tbody>
                                    {salaryComponents.deductions.map(c => (
                                        <tr key={c.id}>
                                            <td>{c.name}</td><td>{c.type}</td><td>{c.value || 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>Note: Salary components structure is currently heavily tied to the payroll engine. Complete editor functionality requires migration to generic payload builder schemas.</p>
                    </div>
                )
            }

            {
                activeTab === 'roles' && (
                    <div className="card">
                        <h3 className="card-title" style={{ marginBottom: 20 }}>Roles & Access Control</h3>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead><tr><th>Role</th><th>Employees</th><th>Attendance</th><th>Leaves</th><th>Payroll</th><th>Recruitment</th><th>Settings</th></tr></thead>
                                <tbody>
                                    {[
                                        { role: 'Super Admin', access: ['✅', '✅', '✅', '✅', '✅', '✅'] },
                                        { role: 'HR Admin', access: ['✅', '✅', '✅', '✅', '✅', '✅'] },
                                        { role: 'Recruiter', access: ['👁', '❌', '❌', '❌', '✅', '❌'] },
                                        { role: 'Manager', access: ['👁', '✅', '✅', '❌', '❌', '❌'] },
                                        { role: 'Employee', access: ['🔒', '🔒', '🔒', '🔒', '❌', '❌'] },
                                    ].map(r => (
                                        <tr key={r.role}><td style={{ fontWeight: 600 }}>{r.role}</td>{r.access.map((a, i) => <td key={i}>{a}</td>)}</tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>✅ Full · 👁 View Only · 🔒 Self Only · ❌ No Access</p>
                    </div>
                )
            }

            {
                activeTab === 'shifts' && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 className="card-title" style={{ margin: 0 }}>Shift Configuration</h3>
                            <button className="btn btn-primary btn-sm" onClick={() => { setEditingShift(null); setShiftForm({ name: '', startTime: '', endTime: '', workingHours: 8, days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] }); setShowShiftModal(true); }}>
                                <HiOutlinePlus /> Add Shift
                            </button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Shift Name</th>
                                        <th>Start Time</th>
                                        <th>End Time</th>
                                        <th>Hours</th>
                                        <th>Days</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shifts.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>No shifts configured.</td></tr>
                                    ) : shifts.map(s => (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>{s.startTime}</td>
                                            <td>{s.endTime}</td>
                                            <td>{s.workingHours}h</td>
                                            <td style={{ fontSize: 12 }}>{s.days.join(', ')}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => { setEditingShift(s); setShiftForm(s); setShowShiftModal(true); }} style={{ marginRight: 6 }}>
                                                    <HiOutlinePencil size={12} style={{ marginRight: 4 }} /> Edit
                                                </button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => deleteShift(s._id)} style={{ color: '#ef4444' }}>
                                                    <HiOutlineTrash size={12} style={{ marginRight: 4 }} /> Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }

            {
                showShiftModal && (
                    <div className="modal-overlay" onClick={() => setShowShiftModal(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
                            <div className="modal-header">
                                <h2>{editingShift ? 'Edit Shift' : 'Add New Shift'}</h2>
                                <button className="btn btn-icon btn-secondary" onClick={() => setShowShiftModal(false)}><HiOutlineX /></button>
                            </div>
                            <form onSubmit={handleShiftSubmit}>
                                <div className="modal-body">
                                    <div className="form-group">
                                        <label className="form-label">Shift Name</label>
                                        <input type="text" className="form-control" value={shiftForm.name} onChange={e => setShiftForm({ ...shiftForm, name: e.target.value })} required placeholder="e.g. General Shift" />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Start Time</label>
                                            <input type="time" className="form-control" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">End Time</label>
                                            <input type="time" className="form-control" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} required />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Working Hours</label>
                                        <input type="number" className="form-control" value={shiftForm.workingHours} onChange={e => setShiftForm({ ...shiftForm, workingHours: e.target.value })} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Working Days</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                                                <label key={day} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={shiftForm.days.includes(day)} onChange={e => {
                                                        const newDays = e.target.checked ? [...shiftForm.days, day] : shiftForm.days.filter(d => d !== day);
                                                        setShiftForm({ ...shiftForm, days: newDays });
                                                    }} />
                                                    {day}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setShowShiftModal(false)}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={shiftLoading}>
                                        {shiftLoading ? 'Processing...' : (editingShift ? 'Update Shift' : 'Create Shift')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
