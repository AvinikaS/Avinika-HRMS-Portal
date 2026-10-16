import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import {
    HiOutlineShieldCheck, HiOutlineCheck,
    HiOutlineX, HiOutlineRefresh, HiOutlineSearch
} from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function SuperAdminPayrollAdjustments() {
    const [pendingAdjustments, setPendingAdjustments] = useState([]);
    const [allAdjustments, setAllAdjustments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'all'
    const tabsBarRef = useRef(null);

    // Filter states
    const [search, setSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [years, setYears] = useState([]);

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

    const fetchPending = async () => {
        try {
            const params = {
                department: deptFilter,
                year: yearFilter,
                month: monthFilter,
                search: search.trim()
            };
            const res = await api.get('/superadmin/payroll-adjustments/pending-approval', { params });
            if (res.data.success) {
                setPendingAdjustments(res.data.data);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load pending adjustments');
        }
    };

    const fetchAll = async () => {
        try {
            const params = {
                department: deptFilter,
                year: yearFilter,
                month: monthFilter,
                search: search.trim()
            };
            const res = await api.get('/superadmin/payroll-adjustments/all', { params });
            if (res.data.success) {
                setAllAdjustments(res.data.data);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load all adjustments');
        }
    };

    const loadData = async () => {
        setLoading(true);
        await Promise.all([fetchPending(), fetchAll()]);
        setLoading(false);
    };

    useEffect(() => {
        fetchFiltersData();
    }, []);

    useEffect(() => {
        loadData();
    }, [deptFilter, yearFilter, monthFilter]);

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        if (tabsBarRef.current) {
            tabsBarRef.current.scrollTo({
                left: newTab === 'all' ? tabsBarRef.current.scrollWidth : 0,
                behavior: 'smooth'
            });
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await api.post(`/superadmin/payroll-adjustments/${id}/approve`);
            if (res.data.success) {
                toast.success('Adjustment approved by SuperAdmin!');
                loadData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Approval failed');
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt('Enter rejection reason:');
        if (!reason) return;
        try {
            const res = await api.post(`/superadmin/payroll-adjustments/${id}/reject`, { reason });
            if (res.data.success) {
                toast.success('Adjustment rejected');
                loadData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rejection failed');
        }
    };

    // Client-side search and filtering for snappy instant responsiveness
    const filterList = (list) => {
        return list.filter(adj => {
            if (deptFilter && adj.employeeId?.department !== deptFilter) {
                return false;
            }
            if (yearFilter) {
                const adjY = adj.adjustmentPayrollMonth?.startsWith(String(yearFilter));
                const origY = adj.originalPayrollMonth?.startsWith(String(yearFilter));
                if (!adjY && !origY) return false;
            }
            if (monthFilter) {
                const mStr = `-${String(monthFilter).padStart(2, '0')}`;
                const adjM = adj.adjustmentPayrollMonth?.endsWith(mStr);
                const origM = adj.originalPayrollMonth?.endsWith(mStr);
                if (!adjM && !origM) return false;
            }
            if (search.trim()) {
                const q = search.trim().toLowerCase();
                const adjNo = (adj.adjustmentNumber || '').toLowerCase();
                const empName = `${adj.employeeId?.firstName || ''} ${adj.employeeId?.lastName || ''}`.toLowerCase();
                const empCode = (adj.employeeId?.employeeCode || '').toLowerCase();
                const label = (adj.payslipLabel || '').toLowerCase();
                if (!adjNo.includes(q) && !empName.includes(q) && !empCode.includes(q) && !label.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    };

    const displayedPending = filterList(pendingAdjustments);
    const displayedAll = filterList(allAdjustments);

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_APPROVAL':
            case 'PENDING_SUPERADMIN_APPROVAL':
                return <span style={{ background: '#fef3c7', color: '#b45309', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Pending SuperAdmin</span>;
            case 'APPROVED':
                return <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Approved</span>;
            case 'REJECTED':
                return <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Rejected</span>;
            case 'PAID_IN_PAYROLL':
            case 'APPLIED':
                return <span style={{ background: '#f3e8ff', color: '#7e22ce', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Paid in Payroll</span>;
            case 'CANCELLED':
                return <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>Cancelled</span>;
            default:
                return <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>{status}</span>;
        }
    };

    return (
        <div className="page-container sa-adj-page">
            <style>{`
                .sa-adj-page {
                    padding: 24px;
                }
                .sa-adj-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    gap: 16px;
                }
                .sa-adj-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .sa-adj-sub {
                    color: #64748b;
                    font-size: 14px;
                    margin: 4px 0 0 0;
                }
                .sa-adj-tabs-bar {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #e2e8f0;
                    overflow-x: auto;
                    overflow-y: hidden;
                    white-space: nowrap;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: thin;
                    scroll-behavior: smooth;
                }
                .sa-adj-tabs-bar::-webkit-scrollbar {
                    height: 4px;
                }
                .sa-adj-tabs-bar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .sa-adj-tabs-bar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .sa-adj-tab-btn {
                    padding: 10px 18px;
                    border: none;
                    background: none;
                    font-size: 14px;
                    font-weight: 700;
                    color: #64748b;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: -2px;
                    border-bottom: 3px solid transparent;
                    transition: all 0.2s ease;
                }
                .sa-adj-tab-btn.active {
                    color: #7c3aed;
                    border-bottom: 3px solid #7c3aed;
                }

                /* Filters Toolbar */
                .sa-adj-filters-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 14px 16px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    flex-wrap: wrap;
                }
                .sa-adj-search-box {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: #fff;
                    border: 1px solid #cbd5e1;
                    border-radius: 6px;
                    padding: 7px 12px;
                    flex: 2 1 240px;
                    min-width: 0;
                    box-sizing: border-box;
                }
                .sa-adj-search-input {
                    border: none;
                    outline: none;
                    font-size: 13.5px;
                    width: 100%;
                    min-width: 0;
                    color: #1e293b;
                    background: transparent;
                }
                .sa-adj-search-input::placeholder {
                    color: #94a3b8;
                    font-size: 13px;
                }
                .sa-adj-select {
                    width: 100%;
                    box-sizing: border-box;
                    padding: 8px 12px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    font-size: 14px;
                    background: #fff;
                    color: #1e293b;
                    outline: none;
                }
                .sa-adj-filter-full {
                    flex: 1 1 150px;
                    min-width: 130px;
                }
                .sa-adj-filter-item {
                    flex: 1 1 120px;
                    min-width: 110px;
                }
                .sa-adj-filter-row-pair {
                    display: flex;
                    gap: 12px;
                    flex: 2 1 240px;
                }
                .sa-adj-filter-actions {
                    margin-left: auto;
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }

                .sa-adj-item-card {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 14px;
                    margin-bottom: 12px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                }

                @media (min-width: 769px) {
                    .sa-adj-cards-mobile {
                        display: none !important;
                    }
                    .sa-adj-table-desktop {
                        display: block !important;
                    }
                }

                @media (max-width: 768px) {
                    .sa-adj-page {
                        padding: 12px 14px !important;
                    }
                    .sa-adj-header {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 12px !important;
                        margin-bottom: 14px !important;
                    }
                    .sa-adj-title-wrapper {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    .sa-adj-title {
                        font-size: 18px !important;
                        line-height: 1.3;
                    }
                    .sa-adj-sub {
                        font-size: 12px !important;
                        margin-top: 4px !important;
                    }
                    .sa-adj-tabs-bar {
                        background: #f1f5f9 !important;
                        border-bottom: none !important;
                        border-radius: 10px !important;
                        padding: 4px !important;
                        gap: 6px !important;
                        margin-bottom: 14px !important;
                    }
                    .sa-adj-tab-btn {
                        border-bottom: none !important;
                        border-radius: 8px !important;
                        padding: 8px 14px !important;
                        font-size: 13px !important;
                        margin-bottom: 0 !important;
                        color: #64748b !important;
                    }
                    .sa-adj-tab-btn.active {
                        background: #ffffff !important;
                        color: #7c3aed !important;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                    }

                    /* Filters on Mobile */
                    .sa-adj-filters-card {
                        padding: 12px !important;
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 10px !important;
                    }
                    .sa-adj-search-box {
                        width: 100% !important;
                        box-sizing: border-box !important;
                        flex: none !important;
                        padding: 7px 10px !important;
                    }
                    .sa-adj-search-input {
                        font-size: 13px !important;
                        min-width: 0 !important;
                    }
                    .sa-adj-search-input::placeholder {
                        font-size: 12.5px !important;
                    }
                    .sa-adj-select {
                        font-size: 13px !important;
                        padding: 7px 10px !important;
                    }
                    .sa-adj-filter-full {
                        width: 100% !important;
                        flex: none !important;
                    }
                    .sa-adj-filter-row-pair {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 10px !important;
                        width: 100% !important;
                        flex: none !important;
                    }
                    .sa-adj-filter-item {
                        width: 100% !important;
                        flex: none !important;
                    }
                    .sa-adj-filter-actions {
                        margin-left: 0 !important;
                        width: 100% !important;
                        display: flex !important;
                        justify-content: stretch !important;
                        gap: 8px !important;
                    }
                    .sa-adj-filter-actions button {
                        flex: 1 !important;
                        justify-content: center !important;
                    }

                    .sa-adj-table-desktop {
                        display: none !important;
                    }
                    .sa-adj-cards-mobile {
                        display: block !important;
                        padding: 10px !important;
                    }
                }
            `}</style>

            {/* Header */}
            <div className="sa-adj-header">
                <div style={{ flex: 1 }}>
                    <div className="sa-adj-title-wrapper">
                        <h1 className="sa-adj-title">
                            <HiOutlineShieldCheck color="#7c3aed" size={24} style={{ flexShrink: 0 }} />
                            <span>SuperAdmin Payroll Adjustment Approvals</span>
                        </h1>
                    </div>
                    <p className="sa-adj-sub">
                        Final approval authority for high-value (&gt;₹5,000) salary adjustments & platform audit
                    </p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="sa-adj-tabs-bar" ref={tabsBarRef}>
                <button
                    onClick={() => handleTabChange('pending')}
                    className={`sa-adj-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                >
                    ⏳ High-Value Pending Approvals ({displayedPending.length})
                </button>
                <button
                    onClick={() => handleTabChange('all')}
                    className={`sa-adj-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                >
                    📑 All System Adjustments ({displayedAll.length})
                </button>
            </div>

            {/* Filter Toolbar */}
            <div className="card sa-adj-filters-card">
                {/* Search Bar (Name, Code, Adj No) */}
                <div className="sa-adj-search-box">
                    <HiOutlineSearch size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
                    <input
                        type="text"
                        placeholder="Search name, code, or Adj No..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="sa-adj-search-input"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 4px', fontSize: '16px', lineHeight: 1 }}
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* Department */}
                <div className="sa-adj-filter-full">
                    <select
                        value={deptFilter}
                        onChange={(e) => setDeptFilter(e.target.value)}
                        className="sa-adj-select"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d, i) => (
                            <option key={i} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                {/* Year & Month Pair */}
                <div className="sa-adj-filter-row-pair">
                    <div className="sa-adj-filter-item">
                        <select
                            value={yearFilter}
                            onChange={(e) => setYearFilter(e.target.value)}
                            className="sa-adj-select"
                        >
                            <option value="">All Years</option>
                            {(years.length > 0 ? years : [new Date().getFullYear(), new Date().getFullYear() - 1]).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sa-adj-filter-item">
                        <select
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="sa-adj-select"
                        >
                            <option value="">All Months</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Actions */}
                <div className="sa-adj-filter-actions">
                    {(search || deptFilter || yearFilter || monthFilter) && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearch('');
                                setDeptFilter('');
                                setYearFilter('');
                                setMonthFilter('');
                            }}
                            className="btn btn-outline"
                            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: '13px', fontWeight: '600' }}
                        >
                            Reset
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={loadData}
                        className="btn btn-outline"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                        <HiOutlineRefresh size={16} /> Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading adjustment records...</div>
            ) : activeTab === 'pending' ? (
                /* Pending High-Value Approvals Tab */
                <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
                    {displayedPending.length === 0 ? (
                        <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                            {pendingAdjustments.length === 0
                                ? '✅ No high-value adjustments currently pending SuperAdmin approval.'
                                : 'No matching pending adjustments found for the selected filters.'}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="sa-adj-table-desktop" style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '650px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                                            <th style={{ padding: '12px 16px' }}>Adj No</th>
                                            <th style={{ padding: '12px 16px' }}>Employee</th>
                                            <th style={{ padding: '12px 16px' }}>Type</th>
                                            <th style={{ padding: '12px 16px' }}>Direction</th>
                                            <th style={{ padding: '12px 16px' }}>Amount</th>
                                            <th style={{ padding: '12px 16px' }}>HR Approved By</th>
                                            <th style={{ padding: '12px 16px' }}>Months</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedPending.map(adj => (
                                            <tr key={adj._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: '600', color: '#7c3aed' }}>{adj.adjustmentNumber}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{adj.employeeId?.firstName} {adj.employeeId?.lastName}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{adj.employeeId?.employeeCode} • {adj.employeeId?.department}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{adj.adjustmentType?.replace(/_/g, ' ')}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        background: adj.direction === 'CREDIT' ? '#dcfce7' : '#fee2e2',
                                                        color: adj.direction === 'CREDIT' ? '#15803d' : '#b91c1c',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '700'
                                                    }}>
                                                        {adj.direction}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontWeight: '800', color: '#7c3aed', fontSize: '15px' }}>₹{Number(adj.amount).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>{adj.hrApprovedBy?.firstName || 'HR Admin'}</td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#64748b' }}>{adj.originalPayrollMonth} ➔ {adj.adjustmentPayrollMonth}</td>
                                                <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                        <button onClick={() => handleApprove(adj._id)} className="btn btn-sm btn-success" style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <HiOutlineCheck size={16} /> Approve
                                                        </button>
                                                        <button onClick={() => handleReject(adj._id)} className="btn btn-sm btn-danger" style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                            <HiOutlineX size={16} /> Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card-Based View */}
                            <div className="sa-adj-cards-mobile">
                                {displayedPending.map(adj => (
                                    <div key={adj._id} className="sa-adj-item-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: '700', color: '#7c3aed', fontSize: '14px' }}>{adj.adjustmentNumber}</span>
                                            <span style={{
                                                background: adj.direction === 'CREDIT' ? '#dcfce7' : '#fee2e2',
                                                color: adj.direction === 'CREDIT' ? '#15803d' : '#b91c1c',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                fontSize: '11px',
                                                fontWeight: '700'
                                            }}>
                                                {adj.direction}
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>
                                                    {adj.employeeId?.firstName} {adj.employeeId?.lastName}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                    {adj.employeeId?.employeeCode || 'EMP'} {adj.employeeId?.department ? `• ${adj.employeeId.department}` : ''}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '17px', fontWeight: '800', color: '#7c3aed' }}>
                                                    ₹{Number(adj.amount).toLocaleString('en-IN')}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginBottom: '10px' }}>
                                            <div>
                                                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Type</span>
                                                <b style={{ color: '#334155' }}>{adj.adjustmentType?.replace(/_/g, ' ')}</b>
                                            </div>
                                            <div>
                                                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Months</span>
                                                <b style={{ color: '#334155' }}>{adj.originalPayrollMonth} ➔ {adj.adjustmentPayrollMonth}</b>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => handleApprove(adj._id)}
                                                style={{ flex: 1, padding: '9px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                                            >
                                                <HiOutlineCheck size={16} /> Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(adj._id)}
                                                style={{ flex: 1, padding: '9px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
                                            >
                                                <HiOutlineX size={16} /> Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* All Adjustments Tab */
                <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
                    {displayedAll.length === 0 ? (
                        <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b' }}>
                            {allAdjustments.length === 0
                                ? 'No adjustments recorded yet.'
                                : 'No matching adjustments found for the selected filters.'}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="sa-adj-table-desktop" style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '650px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                                            <th style={{ padding: '12px 16px' }}>Adj No</th>
                                            <th style={{ padding: '12px 16px' }}>Employee</th>
                                            <th style={{ padding: '12px 16px' }}>Type</th>
                                            <th style={{ padding: '12px 16px' }}>Direction</th>
                                            <th style={{ padding: '12px 16px' }}>Amount</th>
                                            <th style={{ padding: '12px 16px' }}>Status</th>
                                            <th style={{ padding: '12px 16px' }}>Payslip Label</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedAll.map(adj => (
                                            <tr key={adj._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px', fontWeight: '600', color: '#7c3aed' }}>{adj.adjustmentNumber}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{adj.employeeId?.firstName} {adj.employeeId?.lastName}</div>
                                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{adj.employeeId?.employeeCode} • {adj.employeeId?.department}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{adj.adjustmentType?.replace(/_/g, ' ')}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        background: adj.direction === 'CREDIT' ? '#dcfce7' : '#fee2e2',
                                                        color: adj.direction === 'CREDIT' ? '#15803d' : '#b91c1c',
                                                        padding: '2px 8px',
                                                        borderRadius: '4px',
                                                        fontSize: '11px',
                                                        fontWeight: '700'
                                                    }}>
                                                        {adj.direction}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontWeight: '700' }}>₹{Number(adj.amount).toLocaleString('en-IN')}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {getStatusBadge(adj.status)}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{adj.payslipLabel}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card-Based View */}
                            <div className="sa-adj-cards-mobile">
                                {displayedAll.map(adj => (
                                    <div key={adj._id} className="sa-adj-item-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: '700', color: '#7c3aed', fontSize: '14px' }}>{adj.adjustmentNumber}</span>
                                            {getStatusBadge(adj.status)}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <div>
                                                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>
                                                    {adj.employeeId?.firstName} {adj.employeeId?.lastName}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                    {adj.employeeId?.employeeCode || 'EMP'} {adj.employeeId?.department ? `• ${adj.employeeId.department}` : ''}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '16px', fontWeight: '800', color: adj.direction === 'CREDIT' ? '#16a34a' : '#dc2626' }}>
                                                    {adj.direction === 'CREDIT' ? '+' : '-'} ₹{Number(adj.amount).toLocaleString('en-IN')}
                                                </div>
                                                <span style={{
                                                    background: adj.direction === 'CREDIT' ? '#dcfce7' : '#fee2e2',
                                                    color: adj.direction === 'CREDIT' ? '#15803d' : '#b91c1c',
                                                    padding: '1px 6px',
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    fontWeight: '700'
                                                }}>
                                                    {adj.direction}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', marginBottom: adj.payslipLabel ? '6px' : 0 }}>
                                            <div>
                                                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Type</span>
                                                <b style={{ color: '#334155' }}>{adj.adjustmentType?.replace(/_/g, ' ')}</b>
                                            </div>
                                            <div>
                                                <span style={{ color: '#64748b', display: 'block', fontSize: '10px', textTransform: 'uppercase' }}>Months</span>
                                                <b style={{ color: '#334155' }}>{adj.originalPayrollMonth} ➔ {adj.adjustmentPayrollMonth}</b>
                                            </div>
                                        </div>

                                        {adj.payslipLabel && (
                                            <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', background: '#fff', padding: '4px 6px', borderLeft: '2px solid #7c3aed' }}>
                                                <span style={{ color: '#64748b', fontSize: '11px' }}>Label: </span>
                                                <b>{adj.payslipLabel}</b>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
