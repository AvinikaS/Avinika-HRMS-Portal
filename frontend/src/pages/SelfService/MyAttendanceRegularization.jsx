import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { toast } from 'react-toastify';
import {
    HiOutlineClock, HiOutlineCheckCircle, HiOutlineXCircle,
    HiOutlineExclamationCircle, HiOutlinePlus, HiOutlineEye,
    HiOutlineCalendar, HiOutlineFilter, HiOutlineRefresh
} from 'react-icons/hi';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MyAttendanceRegularization() {
    const tabsBarRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') === 'history' ? 'history' : 'pending';

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(tabFromUrl); // 'pending' or 'history'
    const [statusFilter, setStatusFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [years, setYears] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchFiltersData = async () => {
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
            const params = {
                page,
                limit: 15,
                scope: activeTab === 'pending' ? 'pending' : 'history',
                year: yearFilter,
                month: monthFilter
            };

            if (statusFilter) {
                params.status = statusFilter;
            }

            const res = await api.get('/attendance/regularization/my', { params });
            if (res.data.success) {
                setRecords(res.data.data);
                setTotalPages(res.data.pages || 1);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to load regularization records');
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
    }, [page, activeTab, statusFilter, yearFilter, monthFilter]);

    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setStatusFilter('');
        setPage(1);
        if (newTab === 'history') {
            setSearchParams({ tab: 'history' });
        } else {
            setSearchParams({});
        }
        if (tabsBarRef.current) {
            tabsBarRef.current.scrollTo({
                left: newTab === 'history' ? tabsBarRef.current.scrollWidth : 0,
                behavior: 'smooth'
            });
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'DRAFT':
                return <span className="badge badge-secondary" style={{ background: '#6b7280', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Draft</span>;
            case 'PENDING_HR_REVIEW':
                return <span className="badge badge-info" style={{ background: '#2563eb', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Pending HR Review</span>;
            case 'INFORMATION_REQUIRED':
                return <span className="badge badge-warning" style={{ background: '#d97706', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Info Required</span>;
            case 'APPROVED':
                return <span className="badge badge-success" style={{ background: '#16a34a', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Approved</span>;
            case 'REJECTED':
                return <span className="badge badge-danger" style={{ background: '#dc2626', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Rejected</span>;
            case 'CANCELLED':
                return <span className="badge badge-secondary" style={{ background: '#9ca3af', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>Cancelled</span>;
            default:
                return <span className="badge">{status}</span>;
        }
    };

    return (
        <div className="page-container my-reg-page" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
            <style>{`
                .my-reg-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                }
                .my-reg-new-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    background: #3b82f6;
                    color: #fff;
                    padding: 10px 18px;
                    border-radius: 8px;
                    font-weight: 600;
                    text-decoration: none;
                    white-space: nowrap;
                    transition: background 0.15s ease;
                }
                .my-reg-new-btn:hover {
                    background: #2563eb;
                }
                .my-reg-tabs-bar {
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
                .my-reg-tabs-bar::-webkit-scrollbar {
                    height: 4px;
                }
                .my-reg-tabs-bar::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .my-reg-tabs-bar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .my-reg-tab-btn {
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
                    white-space: nowrap;
                }
                .my-reg-tab-btn.active {
                    color: #2563eb;
                    border-bottom: 3px solid #2563eb;
                }
                .my-reg-filters-card {
                    background: #fff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 16px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 14px;
                    align-items: flex-end;
                    flex-wrap: wrap;
                }
                .my-reg-filter-group {
                    min-width: 140px;
                    flex: 1;
                }
                .my-reg-filter-group label {
                    font-size: 12px;
                    font-weight: 600;
                    color: #64748b;
                    display: block;
                    margin-bottom: 6px;
                }
                .my-reg-filter-group select {
                    width: 100%;
                    height: 42px;
                    padding: 0 12px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    font-size: 14px;
                    background-color: #fff;
                    box-sizing: border-box;
                    color: #1e293b;
                }
                .my-reg-filter-row-pair {
                    display: flex;
                    gap: 12px;
                    flex: 2;
                    min-width: 280px;
                }
                .my-reg-filter-actions {
                    display: flex;
                    gap: 8px;
                    margin-left: auto;
                }
                .my-reg-filter-btn {
                    height: 42px;
                    padding: 0 16px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    background: #fff;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    white-space: nowrap;
                    color: #475569;
                    transition: all 0.15s ease;
                }
                .my-reg-filter-btn:hover {
                    background: #f8fafc;
                    border-color: #94a3b8;
                }
                .my-reg-table-wrapper {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: thin;
                }
                .my-reg-table-wrapper::-webkit-scrollbar {
                    height: 5px;
                }
                .my-reg-table-wrapper::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .my-reg-table-wrapper::-webkit-scrollbar-track {
                    background: #f8fafc;
                }

                @media (max-width: 768px) {
                    .my-reg-header {
                        flex-direction: column;
                        align-items: stretch;
                        gap: 12px;
                        margin-bottom: 16px;
                    }
                    .my-reg-new-btn {
                        width: 100%;
                        padding: 12px 16px;
                    }
                    .my-reg-tabs-bar {
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
                    .my-reg-tabs-bar::-webkit-scrollbar {
                        display: block !important;
                        height: 4px !important;
                    }
                    .my-reg-tabs-bar::-webkit-scrollbar-thumb {
                        background: #94a3b8 !important;
                        border-radius: 4px !important;
                    }
                    .my-reg-tabs-bar::-webkit-scrollbar-track {
                        background: #e2e8f0 !important;
                        border-radius: 4px !important;
                    }
                    .my-reg-tab-btn {
                        border-bottom: none !important;
                        border-radius: 8px !important;
                        padding: 8px 14px !important;
                        font-size: 13px !important;
                        margin-bottom: 0 !important;
                        color: #64748b !important;
                        background: transparent !important;
                    }
                    .my-reg-tab-btn.active {
                        background: #fff !important;
                        color: #2563eb !important;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important;
                    }
                    .my-reg-filters-card {
                        flex-direction: column;
                        align-items: stretch;
                        padding: 14px;
                        gap: 12px;
                    }
                    .my-reg-filter-group {
                        min-width: 100%;
                        width: 100%;
                    }
                    .my-reg-filter-row-pair {
                        min-width: 100%;
                        width: 100%;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 10px;
                    }
                    .my-reg-filter-actions {
                        margin-left: 0;
                        width: 100%;
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 8px;
                    }
                    .my-reg-filter-actions.single-btn {
                        grid-template-columns: 1fr;
                    }
                    .my-reg-filter-btn {
                        width: 100%;
                    }
                    .my-reg-table-wrapper::-webkit-scrollbar {
                        display: block !important;
                        height: 5px !important;
                    }
                    .my-reg-table-wrapper::-webkit-scrollbar-thumb {
                        background: #94a3b8 !important;
                        border-radius: 4px !important;
                    }
                    .my-reg-table-wrapper::-webkit-scrollbar-track {
                        background: #e2e8f0 !important;
                        border-radius: 4px !important;
                    }
                }
            `}</style>

            {/* Header section */}
            <div className="my-reg-header">
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                        My Attendance Regularizations
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
                        Submit requests to correct missed check-ins, check-outs, or attendance errors
                    </p>
                </div>
                <Link
                    to="/my-regularizations/create"
                    className="my-reg-new-btn"
                >
                    <HiOutlinePlus size={18} /> New Regularization Request
                </Link>
            </div>

            {/* Tabs */}
            <div className="my-reg-tabs-bar" ref={tabsBarRef}>
                <button
                    onClick={() => handleTabChange('pending')}
                    className={`my-reg-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                >
                    ⏳ Pending, Draft & Info Required
                </button>
                <button
                    onClick={() => handleTabChange('history')}
                    className={`my-reg-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                >
                    ✅ Approved & Rejected
                </button>
            </div>

            {/* Filter toolbar */}
            <div className="card my-reg-filters-card">
                <div className="my-reg-filter-group">
                    <label>Status</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                    >
                        {activeTab === 'pending' ? (
                            <>
                                <option value="">All Statuses</option>
                                <option value="DRAFT">Draft</option>
                                <option value="PENDING_HR_REVIEW">Pending HR Review</option>
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

                <div className="my-reg-filter-row-pair">
                    <div className="my-reg-filter-group">
                        <label>Year</label>
                        <select
                            value={yearFilter}
                            onChange={(e) => { setYearFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Years</option>
                            {(years.length > 0 ? years : [new Date().getFullYear(), new Date().getFullYear() - 1]).map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="my-reg-filter-group">
                        <label>Month</label>
                        <select
                            value={monthFilter}
                            onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
                        >
                            <option value="">All Months</option>
                            {MONTHS.map((m, i) => (
                                <option key={i} value={i + 1}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className={`my-reg-filter-actions ${(yearFilter || monthFilter || statusFilter) ? '' : 'single-btn'}`}>
                    {(yearFilter || monthFilter || statusFilter) && (
                        <button
                            onClick={() => {
                                setStatusFilter('');
                                setYearFilter('');
                                setMonthFilter('');
                                setPage(1);
                            }}
                            className="my-reg-filter-btn"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        onClick={fetchRecords}
                        className="my-reg-filter-btn"
                    >
                        <HiOutlineRefresh size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Records Content */}
            <div className="card" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Loading records...</div>
                ) : records.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                        <HiOutlineCalendar size={48} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#334155' }}>No attendance regularization requests match the selected filters.</h3>
                        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 16px 0' }}>If you forgot to check in or out, click below to raise a correction request.</p>
                        <Link to="/my-regularizations/create" className="btn btn-primary" style={{ padding: '8px 16px', textDecoration: 'none', background: '#3b82f6', color: '#fff', borderRadius: '6px' }}>
                            New Request
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Horizontally Scrolling Table (Same as Admin) */}
                        <div className="my-reg-table-wrapper">
                            <table style={{ width: '100%', minWidth: '820px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Reg No</th>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Attendance Date</th>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Requested Times</th>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Type</th>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Reason</th>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Status</th>
                                        <th style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>Submitted</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {records.map(r => (
                                        <tr key={r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#3b82f6', whiteSpace: 'nowrap' }}>
                                                {r.regularizationNumber || 'AR-DRAFT'}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                                {new Date(r.attendanceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                                    {r.requestedCheckIn} - {r.requestedCheckOut}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                                {r.attendanceType === 'FULL_DAY' ? 'Full Day' : r.attendanceType === 'HALF_DAY' ? 'Half Day' : r.attendanceType}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap' }}>
                                                {r.reason ? r.reason.replace(/_/g, ' ') : 'N/A'}
                                            </td>
                                            <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                                {getStatusBadge(r.status)}
                                            </td>
                                            <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>
                                                {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-IN') : 'Not Submitted'}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                <Link
                                                    to={`/my-regularizations/${r._id}`}
                                                    state={{ fromTab: activeTab }}
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#3b82f6', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap' }}
                                                >
                                                    <HiOutlineEye size={16} /> View
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '14px 16px',
                                borderTop: '1px solid #e2e8f0',
                                background: '#fff',
                                flexWrap: 'wrap',
                                gap: '10px'
                            }}>
                                <span style={{ fontSize: '13px', color: '#64748b' }}>
                                    Page {page} of {totalPages}
                                </span>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            background: page <= 1 ? '#f1f5f9' : '#fff',
                                            color: page <= 1 ? '#94a3b8' : '#334155',
                                            cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Previous
                                    </button>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            background: page >= totalPages ? '#f1f5f9' : '#fff',
                                            color: page >= totalPages ? '#94a3b8' : '#334155',
                                            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '500'
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
