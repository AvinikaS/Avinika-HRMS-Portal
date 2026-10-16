import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import Swal from 'sweetalert2';
import {
    HiOutlineShieldCheck, HiOutlineEye, HiOutlineRefresh,
    HiOutlineFilter, HiOutlineLightningBolt
} from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SuperAdminRegularizations() {
    const { user } = useAuth();
    const isSuperAdmin = user?.role === 'SuperAdmin' || JSON.parse(localStorage.getItem('hrms_user') || '{}').role === 'SuperAdmin';

    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') === 'history' ? 'history' : 'pending';

    const tabsBarRef = useRef(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(tabFromUrl); // 'pending' or 'history'
    const [statusFilter, setStatusFilter] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [years, setYears] = useState([]);
    const [page, setPage] = useState(1);

    // Override modal
    const [selectedReq, setSelectedReq] = useState(null);
    const [overrideAction, setOverrideAction] = useState('REJECT');
    const [overrideReason, setOverrideReason] = useState('');
    const [overriding, setOverriding] = useState(false);

    const handleOpenOverride = (reqItem) => {
        setSelectedReq(reqItem);
        // Automatically select the opposite action!
        if (reqItem.status === 'APPROVED') {
            setOverrideAction('REJECT');
        } else if (reqItem.status === 'REJECTED') {
            setOverrideAction('APPROVE');
        } else {
            setOverrideAction('APPROVE');
        }
        setOverrideReason('');
    };

    const handleActionChange = (newAction) => {
        if (!selectedReq) return;
        if (selectedReq.status === 'APPROVED' && newAction === 'APPROVE') {
            Swal.fire({
                icon: 'warning',
                title: 'Already Approved!',
                text: 'This regularization request is already Approved. You can only override it to REJECT.',
                confirmButtonColor: '#7c3aed'
            });
            setOverrideAction('REJECT');
            return;
        }
        if (selectedReq.status === 'REJECTED' && newAction === 'REJECT') {
            Swal.fire({
                icon: 'warning',
                title: 'Already Rejected!',
                text: 'This regularization request is already Rejected. You can only override it to APPROVE.',
                confirmButtonColor: '#7c3aed'
            });
            setOverrideAction('APPROVE');
            return;
        }
        setOverrideAction(newAction);
    };

    const handleOverrideSubmit = async (e) => {
        e.preventDefault();
        if (!selectedReq) return;

        if (selectedReq.status === 'APPROVED' && overrideAction === 'APPROVE') {
            return Swal.fire({
                icon: 'warning',
                title: 'Already Approved!',
                text: 'This regularization request is already Approved. You cannot override-approve an already approved request. Please choose REJECT to revoke it.',
                confirmButtonColor: '#7c3aed'
            });
        }
        if (selectedReq.status === 'REJECTED' && overrideAction === 'REJECT') {
            return Swal.fire({
                icon: 'warning',
                title: 'Already Rejected!',
                text: 'This regularization request is already Rejected. You cannot override-reject an already rejected request. Please choose APPROVE to force approve it.',
                confirmButtonColor: '#7c3aed'
            });
        }

        if (!overrideReason || overrideReason.trim() === '') {
            return toast.error('Mandatory override reason is required');
        }

        setOverriding(true);
        try {
            const res = await api.post(`/superadmin/regularization/${selectedReq._id}/override`, {
                action: overrideAction,
                reason: overrideReason
            });
            if (res.data.success) {
                toast.success(res.data.message);
                setSelectedReq(null);
                setOverrideReason('');
                fetchRecords();
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Override Failed',
                text: err.response?.data?.message || 'Override failed',
                confirmButtonColor: '#7c3aed'
            });
        } finally {
            setOverriding(false);
        }
    };

    const fetchFiltersData = async () => {
        try {
            let list = [];
            const res = await api.get('/departments');
            if (res.data?.data && Array.isArray(res.data.data)) {
                list = res.data.data.map(d => typeof d === 'string' ? d : d.name).filter(Boolean);
            }
            try {
                const empDeptRes = await api.get('/employees/departments/list');
                if (empDeptRes.data?.data && Array.isArray(empDeptRes.data.data)) {
                    list = [...list, ...empDeptRes.data.data.filter(Boolean)];
                }
            } catch (e) {}
            setDepartments([...new Set(list)].sort());
        } catch (err) {
            console.error('Failed to load departments', err);
        }

        try {
            const { data } = await api.get('/payroll-years');
            if (data?.data && Array.isArray(data.data)) {
                const yearValues = data.data.map(y => typeof y === 'object' ? y.year : y).filter(Boolean);
                setYears(yearValues);
            }
        } catch (err) {
            console.error('Failed to load payroll years', err);
        }
    };

    const fetchRecords = async () => {
        setLoading(true);
        try {
            const endpoint = activeTab === 'pending'
                ? '/hradmin/regularization/pending'
                : '/superadmin/regularization/all';

            const params = {
                page,
                limit: 20,
                department: deptFilter,
                year: yearFilter,
                month: monthFilter
            };

            if (statusFilter) {
                params.status = statusFilter;
            } else if (activeTab === 'history') {
                params.scope = 'history';
            }

            const res = await api.get(endpoint, { params });

            if (res.data.success) {
                setRecords(res.data.data);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load regularizations');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFiltersData();
    }, []);

    useEffect(() => {
        const currentTab = searchParams.get('tab') === 'history' ? 'history' : 'pending';
        setActiveTab(currentTab);
        if (tabsBarRef.current) {
            tabsBarRef.current.scrollTo({
                left: currentTab === 'history' ? tabsBarRef.current.scrollWidth : 0,
                behavior: 'smooth'
            });
        }
    }, [searchParams]);

    useEffect(() => {
        fetchRecords();
    }, [page, activeTab, statusFilter, deptFilter, yearFilter, monthFilter]);

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setStatusFilter('');
        setPage(1);
        if (newTab === 'history') {
            setSearchParams({ tab: 'history' });
            if (tabsBarRef.current) {
                tabsBarRef.current.scrollTo({
                    left: tabsBarRef.current.scrollWidth,
                    behavior: 'smooth'
                });
            }
        } else {
            setSearchParams({});
            if (tabsBarRef.current) {
                tabsBarRef.current.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                });
            }
        }
    };

    return (
        <div className="page-container sa-reg-page-wrapper">
            <style>{`
                .sa-reg-page-wrapper {
                    padding: 0;
                }
                .sa-reg-header-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .sa-reg-header-sub {
                    color: #64748b;
                    font-size: 14px;
                    margin: 4px 0 0 0;
                }
                .sa-reg-tabs-bar {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #e2e8f0;
                    overflow-x: auto;
                    overflow-y: hidden !important;
                    white-space: nowrap;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: thin;
                    scroll-behavior: smooth;
                }
                .sa-reg-tabs-bar::-webkit-scrollbar {
                    height: 4px;
                }
                .sa-reg-tabs-bar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .sa-reg-tabs-bar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .sa-reg-tab-btn {
                    padding: 10px 18px;
                    font-size: 14px;
                    font-weight: 600;
                    border: none;
                    background: none;
                    cursor: pointer;
                    margin-bottom: -2px;
                    transition: all 0.15s ease-in-out;
                    flex-shrink: 0;
                    border-bottom: 3px solid transparent;
                    color: #64748b;
                }
                .sa-reg-tab-btn.active {
                    color: #7c3aed;
                    border-bottom-color: #7c3aed;
                }
                .sa-reg-filters-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 16px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 16px;
                    align-items: flex-end;
                    flex-wrap: wrap;
                }
                .sa-reg-filter-item {
                    flex: 1 1 150px;
                    min-width: 130px;
                }
                .sa-reg-filter-full {
                    flex: 1 1 150px;
                    min-width: 130px;
                }
                .sa-reg-filter-row-pair {
                    display: contents;
                }
                .sa-reg-filter-actions {
                    margin-left: auto;
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                @media (max-width: 768px) {
                    .sa-reg-page-wrapper {
                        padding: 0 !important;
                    }
                    .sa-reg-header-title {
                        font-size: 18px !important;
                    }
                    .sa-reg-header-sub {
                        font-size: 12px !important;
                    }
                    .sa-reg-tabs-bar {
                        border-bottom: none !important;
                        background: #f1f5f9 !important;
                        padding: 4px !important;
                        border-radius: 10px !important;
                        gap: 6px !important;
                        margin-bottom: 14px !important;
                        overflow-x: auto !important;
                        overflow-y: hidden !important;
                        scrollbar-width: thin !important;
                        padding-bottom: 6px !important;
                        scroll-behavior: smooth !important;
                    }
                    .sa-reg-tabs-bar::-webkit-scrollbar {
                        display: block !important;
                        height: 4px !important;
                    }
                    .sa-reg-tabs-bar::-webkit-scrollbar-thumb {
                        background: #94a3b8 !important;
                        border-radius: 4px !important;
                    }
                    .sa-reg-tabs-bar::-webkit-scrollbar-track {
                        background: #e2e8f0 !important;
                        border-radius: 4px !important;
                    }
                    .sa-reg-tab-btn {
                        border-bottom: none !important;
                        border-radius: 8px !important;
                        padding: 8px 14px !important;
                        font-size: 13px !important;
                        margin-bottom: 0 !important;
                        color: #64748b !important;
                        background: transparent !important;
                    }
                    .sa-reg-tab-btn.active {
                        border-bottom: none !important;
                        background: #ffffff !important;
                        color: #7c3aed !important;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                        font-weight: 700 !important;
                    }
                    .sa-reg-filters-card {
                        padding: 14px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 12px !important;
                    }
                    .sa-reg-filter-full {
                        width: 100% !important;
                        flex: none !important;
                        min-width: 0 !important;
                    }
                    .sa-reg-filter-row-pair {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 10px !important;
                        width: 100% !important;
                    }
                    .sa-reg-filter-item {
                        min-width: 0 !important;
                        width: 100% !important;
                        flex: none !important;
                    }
                    .sa-reg-filter-actions {
                        margin-left: 0 !important;
                        width: 100% !important;
                        display: flex !important;
                        justify-content: stretch !important;
                        gap: 8px !important;
                        margin-top: 4px !important;
                    }
                    .sa-reg-filter-actions button {
                        flex: 1 !important;
                        justify-content: center !important;
                        text-align: center !important;
                        padding: 9px 12px !important;
                    }
                }
            `}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <h1 className="sa-reg-header-title">
                        <HiOutlineShieldCheck color="#7c3aed" /> SuperAdmin Regularization Master
                    </h1>
                    <p className="sa-reg-header-sub">
                        Global audit, system overrides, and full authority over all employee attendance regularization requests
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="sa-reg-tabs-bar" ref={tabsBarRef}>
                <button
                    onClick={() => handleTabChange('pending')}
                    className={`sa-reg-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                >
                    ⏳ Pending & Info Required
                </button>
                <button
                    onClick={() => handleTabChange('history')}
                    className={`sa-reg-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                >
                    ✅ Approved & Rejected
                </button>
            </div>

            {/* Filter toolbar */}
            <div className="card sa-reg-filters-card">
                <div className="sa-reg-filter-full">
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}>
                        {activeTab === 'pending' ? (
                            <>
                                <option value="">All Statuses</option>
                                <option value="PENDING_HR_REVIEW">Pending Review</option>
                                <option value="INFORMATION_REQUIRED">Information Required</option>
                            </>
                        ) : (
                            <>
                                <option value="">All Statuses</option>
                                <option value="APPROVED">Approved</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="CANCELLED">Cancelled</option>
                            </>
                        )}
                    </select>
                </div>

                <div className="sa-reg-filter-full">
                    <select value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}>
                        <option value="">All Departments</option>
                        {departments.map((d, i) => (
                            <option key={i} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                <div className="sa-reg-filter-row-pair">
                    <div className="sa-reg-filter-item">
                        <select value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setPage(1); }} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}>
                            <option value="">All Years</option>
                            {(years.length > 0 ? years : [new Date().getFullYear(), new Date().getFullYear() - 1]).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sa-reg-filter-item">
                        <select value={monthFilter} onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff' }}>
                            <option value="">All Months</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="sa-reg-filter-actions">
                    {(deptFilter || yearFilter || monthFilter || statusFilter) && (
                        <button
                            onClick={() => {
                                setStatusFilter('');
                                setDeptFilter('');
                                setYearFilter('');
                                setMonthFilter('');
                                setPage(1);
                            }}
                            className="btn btn-outline"
                            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '14px' }}
                        >
                            Reset
                        </button>
                    )}
                    <button onClick={fetchRecords} className="btn btn-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px', cursor: 'pointer' }}>
                        <HiOutlineRefresh size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading records...</div>
                ) : records.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>No requests found.</div>
                ) : (
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', minWidth: '780px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                                    <th style={{ padding: '12px 16px' }}>Reg No</th>
                                    <th style={{ padding: '12px 16px' }}>Employee</th>
                                    <th style={{ padding: '12px 16px' }}>Date</th>
                                    <th style={{ padding: '12px 16px' }}>Reason</th>
                                    <th style={{ padding: '12px 16px' }}>Status</th>
                                    <th style={{ padding: '12px 16px' }}>Payroll Status</th>
                                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map(r => (
                                    <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#7c3aed' }}>{r.regularizationNumber}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: '600', color: '#1e293b' }}>{r.employeeId?.firstName} {r.employeeId?.lastName}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>{r.employeeId?.employeeCode} | {r.employeeId?.department}</div>
                                        </td>
                                        <td style={{ padding: '12px 16px' }}>{new Date(r.attendanceDate).toLocaleDateString('en-IN')}</td>
                                        <td style={{ padding: '12px 16px', color: '#475569' }}>{r.reason?.replace(/_/g, ' ')}</td>
                                        <td style={{ padding: '12px 16px' }}><b>{r.status}</b></td>
                                        <td style={{ padding: '12px 16px', color: r.payrollStatus === 'PAYROLL_PROCESSED' ? '#d97706' : '#16a34a', fontWeight: '600' }}>{r.payrollStatus}</td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <Link to={`/hradmin/attendance/regularization/${r._id}`} state={{ fromTab: activeTab, fromSuperAdmin: true }} style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', borderRadius: '4px', textDecoration: 'none', fontSize: '12px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                    <HiOutlineEye size={14} /> View
                                                </Link>
                                                {isSuperAdmin && ['APPROVED', 'REJECTED'].includes(r.status) && (
                                                    <button
                                                        onClick={() => handleOpenOverride(r)}
                                                        style={{ padding: '4px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <HiOutlineLightningBolt size={14} /> Override
                                                    </button>
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

            {/* Override Modal */}
            {selectedReq && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', boxSizing: 'border-box' }}>
                    <div className="card" style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '480px', boxSizing: 'border-box', overflow: 'hidden' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#7c3aed', marginBottom: '8px' }}>
                            ⚡ SuperAdmin Override — {selectedReq.regularizationNumber}
                        </h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
                            Overrides are logged permanently in the attendance audit log with your User ID and reason.
                        </p>

                        {/* Current Status Banner */}
                        <div style={{
                            marginBottom: '16px',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: selectedReq.status === 'APPROVED' ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${selectedReq.status === 'APPROVED' ? '#bbf7d0' : '#fecaca'}`,
                            boxSizing: 'border-box'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Current Status:</span>
                                <span style={{
                                    fontSize: '12px',
                                    fontWeight: '700',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: selectedReq.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                                    color: selectedReq.status === 'APPROVED' ? '#15803d' : '#b91c1c'
                                }}>
                                    {selectedReq.status}
                                </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                {selectedReq.status === 'APPROVED'
                                    ? 'ℹ️ Since this request is already Approved, the override action is set to REJECT (Revoke Approval).'
                                    : 'ℹ️ Since this request is already Rejected, the override action is set to APPROVE (Force Approval).'}
                            </div>
                        </div>

                        <form onSubmit={handleOverrideSubmit}>
                            <div style={{ marginBottom: '14px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '4px' }}>Override Action *</label>
                                <select
                                    value={overrideAction}
                                    onChange={(e) => handleActionChange(e.target.value)}
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        background: '#f8fafc',
                                        fontWeight: '500',
                                        display: 'block'
                                    }}
                                >
                                    {selectedReq.status === 'APPROVED' ? (
                                        <option value="REJECT">REJECT (Revoke Approval)</option>
                                    ) : (
                                        <option value="APPROVE">APPROVE (Correction)</option>
                                    )}
                                </select>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ fontSize: '13px', fontWeight: '600', color: '#dc2626', display: 'block', marginBottom: '4px' }}>Mandatory Audit Reason *</label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Explain why SuperAdmin override is being executed..."
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        boxSizing: 'border-box',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        display: 'block',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => setSelectedReq(null)} className="btn btn-outline" style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>Cancel</button>
                                <button type="submit" disabled={overriding} className="btn btn-primary" style={{ padding: '6px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '6px' }}>
                                    {overriding ? 'Executing Override...' : 'Execute Override'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
