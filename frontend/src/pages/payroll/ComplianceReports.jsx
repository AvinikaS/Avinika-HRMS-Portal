import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { HiOutlineDownload, HiOutlineOfficeBuilding, HiOutlineShieldCheck, HiOutlineDocumentReport } from 'react-icons/hi';
import * as XLSX from 'xlsx';
import { useLocation, useNavigate } from 'react-router-dom';
import Form24QModule from './Form24QModule';
import EsicModule from './EsicModule';
import PfModule from './PfModule';
import Form16Module from './Form16Module';

export default function ComplianceReports() {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    // FY formatting
    const [fy, setFy] = useState(() => {
        const curr = new Date();
        const y = curr.getFullYear();
        const m = curr.getMonth();
        const startY = m < 3 ? y - 1 : y;
        return `${startY}-${(startY + 1).toString().slice(2)}`;
    });

    const location = useLocation();
    const navigate = useNavigate();

    // Read from query string
    const queryTab = new URLSearchParams(location.search).get('tab') || 'pf';
    const [activeTab, setActiveTab] = useState(queryTab);

    useEffect(() => {
        const t = new URLSearchParams(location.search).get('tab');
        if (t) {
            setActiveTab(t);
            setData(null);
        }
    }, [location.search]);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const fetchReport = async () => {
        setLoading(true);
        try {
            let res;
            if (activeTab === 'pf') res = await api.get(`/reports/pf-challan?month=${month}&year=${year}`);
            if (activeTab === 'esic') res = await api.get(`/reports/esic-challan?month=${month}&year=${year}`);
            if (activeTab === 'form24q') res = await api.get(`/reports/form24q?year=${year}&quarter=${quarter}`);
            setData(res?.data);
        } catch { setData(null); }
        setLoading(false);
    };

    const handleExport = () => {
        if (!data || !data.data || data.data.length === 0) return toast.error('No data to export');
        const ws = XLSX.utils.json_to_sheet(data.data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, `${activeTab}_report_${year}.xlsx`);
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Compliance & Tax Reports</h1>
                    <p>Generate precise PF, ESIC Challans, and Form 24Q Quarterly Return files</p>
                </div>
            </div>

            <style>{`
                .premium-tab-rail::-webkit-scrollbar { display: none; }
                .premium-tab-rail { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
            <div className="premium-tab-rail" style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: '6px',
                borderRadius: '12px',
                gap: '6px',
                flexWrap: 'wrap',
                marginBottom: '24px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.06)'
            }}>
                <button
                    onClick={() => { setActiveTab('pf'); navigate('?tab=pf', { replace: true }); }}
                    style={{
                        flex: '1 1 auto',
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 20px', margin: 0,
                        border: 'none', borderRadius: '8px',
                        background: activeTab === 'pf' ? '#fff' : 'transparent',
                        color: activeTab === 'pf' ? '#4f46e5' : '#64748b',
                        fontWeight: activeTab === 'pf' ? 600 : 500,
                        boxShadow: activeTab === 'pf' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease', cursor: 'pointer', fontSize: '15px'
                    }}
                >
                    <HiOutlineOfficeBuilding size={18} /> PF Challan (ECR)
                </button>
                <button
                    onClick={() => { setActiveTab('esic'); navigate('?tab=esic', { replace: true }); }}
                    style={{
                        flex: '1 1 auto',
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 20px', margin: 0,
                        border: 'none', borderRadius: '8px',
                        background: activeTab === 'esic' ? '#fff' : 'transparent',
                        color: activeTab === 'esic' ? '#4f46e5' : '#64748b',
                        fontWeight: activeTab === 'esic' ? 600 : 500,
                        boxShadow: activeTab === 'esic' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease', cursor: 'pointer', fontSize: '15px'
                    }}
                >
                    <HiOutlineShieldCheck size={18} /> ESIC Challan Report
                </button>
                <button
                    onClick={() => { setActiveTab('form24q'); navigate('?tab=form24q', { replace: true }); }}
                    style={{
                        flex: '1 1 auto',
                        whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                        padding: '12px 20px', margin: 0,
                        border: 'none', borderRadius: '8px',
                        background: activeTab === 'form24q' ? '#fff' : 'transparent',
                        color: activeTab === 'form24q' ? '#4f46e5' : '#64748b',
                        fontWeight: activeTab === 'form24q' ? 600 : 500,
                        boxShadow: activeTab === 'form24q' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.2s ease', cursor: 'pointer', fontSize: '15px'
                    }}
                >
                    <HiOutlineDocumentReport size={18} /> Form 24Q (TDS)
                </button>
            </div>

            {activeTab === 'form24q' ? (
                <div style={{ marginTop: 24 }}>
                    <div className="card" style={{ marginBottom: 24, padding: 24, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 200px', margin: 0 }}>
                            <label className="form-label">Financial Year</label>
                            <select className="form-control" value={fy} onChange={e => setFy(e.target.value)}>
                                {(() => {
                                    const currYear = new Date().getFullYear();
                                    const currMonth = new Date().getMonth();
                                    const startFy = currMonth < 3 ? currYear - 1 : currYear;
                                    const years = [];
                                    for (let i = startFy + 1; i >= startFy - 3; i--) {
                                        years.push(i);
                                    }
                                    return years.map(y => {
                                        const val = `${y}-${(y + 1).toString().slice(2)}`;
                                        return <option key={val} value={val}>{val}</option>;
                                    });
                                })()}
                            </select>
                        </div>
                    </div>
                    <Form24QModule fy={fy} />
                </div>
            ) : activeTab === 'esic' ? (
                <div style={{ marginTop: 24 }}>
                    <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <div className="form-group" style={{ flex: '1 1 150px' }}>
                            <label className="form-label">Year</label>
                            <input type="number" className="form-control" value={year} onChange={e => setYear(Number(e.target.value))} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 150px' }}>
                            <label className="form-label">Month</label>
                            <select className="form-control" value={month} onChange={e => setMonth(e.target.value === 'All' ? 'All' : Number(e.target.value))}>
                                <option value="All">All Months</option>
                                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                    <EsicModule selectedMonth={month === 'All' ? `${year}-All` : `${year}-${month.toString().padStart(2, '0')}`} />
                </div>
            ) : activeTab === 'pf' ? (
                <div style={{ marginTop: 24 }}>
                    <PfModule />
                </div>
            ) : null}
        </div>
    );
}
