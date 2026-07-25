import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { HiOutlineDocumentText, HiChevronDown, HiSelector, HiOutlineExclamationCircle } from 'react-icons/hi';
import Form16Module from './Form16Module';

const EmployeeSearchDrop = ({ employees, value, onChange }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedEmp = employees.find(e => e._id === value);
    const filtered = employees.filter(e =>
        (e.firstName + ' ' + e.lastName).toLowerCase().includes(search.toLowerCase()) ||
        (e.employeeCode || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="custom-search-drop" ref={ref} style={{ position: 'relative', width: '100%' }}>
            <div
                onClick={() => setOpen(!open)}
                className="form-control"
                style={{ height: '42px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: '#fff', border: open ? '1px solid var(--primary)' : '1px solid #cbd5e1' }}
            >
                {selectedEmp ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {selectedEmp.profileImage ? (
                            <img src={selectedEmp.profileImage} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold' }}>
                                {selectedEmp.firstName.charAt(0)}{selectedEmp.lastName?.charAt(0)}
                            </div>
                        )}
                        <span style={{ fontWeight: 600 }}>{selectedEmp.firstName} {selectedEmp.lastName}</span>
                    </div>
                ) : (
                    <span style={{ color: '#94a3b8' }}>Select Employee...</span>
                )}
                <HiChevronDown color="#64748b" />
            </div>

            {open && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#fff', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 50, padding: 8 }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Type to search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ marginBottom: 8 }}
                        autoFocus
                    />
                    <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                        {filtered.map(emp => (
                            <div
                                key={emp._id}
                                onClick={() => { onChange(emp._id); setOpen(false); setSearch(''); }}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderRadius: 6, background: value === emp._id ? 'var(--primary-light)' : 'transparent', color: value === emp._id ? 'var(--primary)' : 'inherit' }}
                                onMouseEnter={e => e.currentTarget.style.background = value === emp._id ? 'var(--primary-light)' : '#f8fafc'}
                                onMouseLeave={e => e.currentTarget.style.background = value === emp._id ? 'var(--primary-light)' : 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {emp.profileImage ? (
                                        <img src={emp.profileImage} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: value === emp._id ? 'var(--primary)' : '#94a3b8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 'bold' }}>
                                            {emp.firstName.charAt(0)}{emp.lastName?.charAt(0)}
                                        </div>
                                    )}
                                    <span style={{ fontWeight: 600 }}>{emp.firstName} {emp.lastName}</span>
                                </div>
                                <span style={{ fontSize: 12, color: value === emp._id ? 'var(--primary)' : '#94a3b8' }}>{emp.employeeCode}</span>
                            </div>
                        ))}
                        {filtered.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No employees found</div>}
                    </div>
                </div>
            )}
        </div>
    );
};

export default function IncomeTax() {
    const { user, isAdmin } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [selectedEmployee, setSelectedEmployee] = useState(user._id);
    const [financialYear, setFinancialYear] = useState(() => {
        const curr = new Date();
        const year = curr.getFullYear();
        const month = curr.getMonth();
        const startY = month < 3 ? year - 1 : year;
        return `${startY}-${(startY + 1).toString().slice(2)}`;
    });
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('declarations');

    const [formData, setFormData] = useState({
        taxRegime: 'New', investments80C: 0, medical80D: 0, nps80CCD: 0,
        educationLoan80E: 0, housingLoanInterest: 0, hraExemption: 0,
        otherIncome: 0, standardDeduction: 50000
    });

    const [profile, setProfile] = useState(null);

    // Derived Variables for Dates
    const currYear = new Date().getFullYear();
    const currMonth = new Date().getMonth();
    const currentFyStart = currMonth < 3 ? currYear - 1 : currYear;

    const empDetails = employees.find(e =>
        e._id === selectedEmployee ||
        e.user === selectedEmployee ||
        (e.user && e.user._id === selectedEmployee)
    );

    let employeeJoinFy = null;
    let formattedDoj = null;
    if (empDetails && empDetails.dateOfJoining) {
        const joinDate = new Date(empDetails.dateOfJoining);
        const joinYear = joinDate.getFullYear();
        const joinMonth = joinDate.getMonth();
        employeeJoinFy = joinMonth < 3 ? joinYear - 1 : joinYear;
        formattedDoj = joinDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    const selectedFyStartYear = parseInt(financialYear.split('-')[0], 10);

    useEffect(() => {
        if (isAdmin) {
            api.get('/employees?limit=1000').then(res => {
                const emps = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.employees || []);
                setEmployees(emps);
                if (emps.length > 0 && !selectedEmployee) {
                    setSelectedEmployee(emps[0]._id);
                }
            });
        } else {
            // For employee, fetch their info to get dateOfJoining
            api.get('/auth/me').then(res => {
                if (res.data?.user?.employeeId) {
                    setEmployees([res.data.user.employeeId]);
                }
            }).catch(() => { });
        }
    }, [isAdmin]);

    useEffect(() => {
        fetchProfile();
    }, [selectedEmployee, financialYear, user]);

    useEffect(() => {
        if (!isAdmin && user && user._id && !selectedEmployee) {
            setSelectedEmployee(user._id);
        }
    }, [user, isAdmin, selectedEmployee]);

    const fetchProfile = async () => {
        if (isAdmin && (!selectedEmployee || selectedEmployee === 'undefined')) return;
        setLoading(true);
        setProfile(null);
        setFormData({
            taxRegime: 'New',
            investments80C: 0,
            medical80D: 0,
            nps80CCD: 0,
            educationLoan80E: 0,
            housingLoanInterest: 0,
            hraExemption: 0,
            otherIncome: 0,
            standardDeduction: 50000
        });
        try {
            const url = isAdmin ? `/tax/profile/${selectedEmployee}?fy=${financialYear}` : `/tax/profile?fy=${financialYear}`;
            const { data } = await api.get(url);

            if (data && data.data) {
                setProfile(data.data);
                setFormData({
                    taxRegime: data.data.taxRegime || 'New',
                    investments80C: data.data.investments80C || 0,
                    medical80D: data.data.medical80D || 0,
                    nps80CCD: data.data.nps80CCD || 0,
                    educationLoan80E: data.data.educationLoan80E || 0,
                    housingLoanInterest: data.data.housingLoanInterest || 0,
                    hraExemption: data.data.hraExemption || 0,
                    otherIncome: data.data.otherIncome || 0,
                    standardDeduction: data.data.standardDeduction || 50000
                });
            } else {
                setProfile({
                    annualGrossIncome: 0,
                    otherIncome: 0,
                    totalExemptions: 0,
                    taxableIncome: 0,
                    estimatedAnnualTax: 0,
                    monthlyTDS: 0,
                    taxRegime: 'New'
                });
            }
        } catch (err) {
            console.error(err);
            setProfile({
                annualGrossIncome: 0,
                otherIncome: 0,
                totalExemptions: 0,
                taxableIncome: 0,
                estimatedAnnualTax: 0,
                monthlyTDS: 0,
                taxRegime: 'New'
            });
        }
        setLoading(false);
    };

    const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;



    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Income Tax Declarations & Form 16</h1>
                    <p>Manage tax regimes, investment proofs, and view estimated TDS calculations</p>
                </div>
            </div>

            {isAdmin && (
                <div className="tabs" style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className={`btn ${activeTab === 'declarations' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={() => setActiveTab('declarations')}>
                        Income Tax Declarations (Form 12BB)
                    </button>
                    <button className={`btn ${activeTab === 'form16' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: '1 1 auto', textAlign: 'center', whiteSpace: 'nowrap' }} onClick={() => setActiveTab('form16')}>
                        Form 16 Bulk Generation & Reconciliation
                    </button>
                </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="form-row" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                    {isAdmin && activeTab === 'declarations' && (
                        <div className="form-group" style={{ flex: '1 1 250px' }}>
                            <label className="form-label">Select Employee</label>
                            <EmployeeSearchDrop employees={employees} value={selectedEmployee} onChange={setSelectedEmployee} />
                        </div>
                    )}
                    <div className="form-group" style={{ flex: '1 1 200px', maxWidth: activeTab === 'form16' ? '400px' : 'none' }}>
                        <label className="form-label">Financial Year</label>
                        <div style={{ position: 'relative' }}>
                            <select
                                className="form-control"
                                style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', cursor: 'pointer', paddingRight: '36px', height: '42px' }}
                                value={financialYear}
                                onChange={(e) => setFinancialYear(e.target.value)}
                            >
                                {(() => {
                                    const maxFy = currentFyStart + 2;
                                    let minFy = currentFyStart;

                                    if (isAdmin) {
                                        // Admin can see up to 3 years back max from current, OR going all the way back to employee's join year if older
                                        minFy = employeeJoinFy !== null ? Math.min(employeeJoinFy, currentFyStart - 3) : currentFyStart - 3;
                                    } else {
                                        // Employees specifically only see choices strictly from their joining FY
                                        minFy = employeeJoinFy !== null ? employeeJoinFy : currentFyStart;
                                    }

                                    const years = [];
                                    for (let i = maxFy; i >= minFy; i--) {
                                        years.push(i);
                                    }
                                    if (years.length === 0) years.push(currentFyStart);

                                    return years.map(y => {
                                        const val = `${y}-${(y + 1).toString().slice(2)}`;
                                        return <option key={val} value={val}>{y}-{y + 1}</option>;
                                    });
                                })()}
                            </select>
                            <HiChevronDown style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }} size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {activeTab === 'form16' ? (
                <Form16Module fy={financialYear} />
            ) : (() => {
                // Conditional checks for futuristic unreleased years or years before joining
                if (selectedFyStartYear > currentFyStart) {
                    return (
                        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                                <HiOutlineExclamationCircle size={48} style={{ color: '#3b82f6', opacity: 0.8 }} />
                            </div>
                            <h3 style={{ marginBottom: 8, color: '#1e293b' }}>Coming Soon</h3>
                            <p style={{ color: '#64748b', maxWidth: 400, margin: '0 auto' }}>
                                Tax declarations and estimations for the {financialYear} financial period are not yet open or active. Please check back when this term begins.
                            </p>
                        </div>
                    );
                }

                if (employeeJoinFy !== null && selectedFyStartYear < employeeJoinFy) {
                    return (
                        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', background: '#fef2f2', border: '1px dashed #fca5a5' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                                <HiOutlineDocumentText size={48} style={{ color: '#ef4444', opacity: 0.6 }} />
                            </div>
                            <h3 style={{ marginBottom: 8, color: '#7f1d1d' }}>No Prior Records Available</h3>
                            <p style={{ color: '#991b1b', maxWidth: 400, margin: '0 auto' }}>
                                This system holds no tax data for {financialYear} because the employee wasn't employed during this period.<br /><br />
                                <strong style={{ background: '#fee2e2', padding: '4px 8px', borderRadius: 4 }}>Official Date of Joining is: {formattedDoj}</strong>
                            </p>
                        </div>
                    );
                }

                return (
                    <>
                        {loading ? <div style={{ padding: 20 }}>Loading...</div> : profile ? (
                            <div className="form-row" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                                {/* Declarations Form */}
                                <div className="card" style={{ flex: '1 1 350px' }}>
                                    <h3>Investment Declarations</h3>
                                    <hr style={{ margin: '15px 0', borderColor: '#e2e8f0' }} />
                                    <div style={{ border: 'none' }}>
                                        <div style={{ padding: '12px 16px', background: '#fff9db', border: '1px solid #fab005', borderRadius: 8, marginBottom: 20, color: '#856404', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <HiOutlineExclamationCircle size={18} />
                                            <span>These values are fetched from the <strong>Employee Profile</strong>. To change them, please edit the employee's record directly.</span>
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 20 }}>
                                            <label className="form-label">Tax Regime Selection</label>
                                            <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
                                                <label><input type="radio" disabled checked={formData.taxRegime === 'Old'} /> Old Tax Regime</label>
                                                <label><input type="radio" disabled checked={formData.taxRegime === 'New'} /> New Tax Regime</label>
                                            </div>
                                        </div>

                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Section 80C (LIC, PPF, ELSS)</label>
                                                <input type="number" className="form-control" readOnly value={formData.investments80C} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Section 80D (Medical Insurance)</label>
                                                <input type="number" className="form-control" readOnly value={formData.medical80D} />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">HRA Exemption / Rent Paid</label>
                                                <input type="number" className="form-control" readOnly value={formData.hraExemption} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Home Loan Interest (Section 24)</label>
                                                <input type="number" className="form-control" readOnly value={formData.housingLoanInterest} />
                                            </div>
                                        </div>
                                        <div className="form-row">
                                            <div className="form-group">
                                                <label className="form-label">Section 80CCD (NPS)</label>
                                                <input type="number" className="form-control" readOnly value={formData.nps80CCD} />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Any Other Income</label>
                                                <input type="number" className="form-control" readOnly value={formData.otherIncome} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                                            <button type="button" className="btn btn-primary" onClick={fetchProfile}>Refresh from HR Records</button>
                                        </div>
                                    </div>
                                </div>

                                {/* Tax Summary Widget */}
                                <div className="card" style={{ flex: '1 1 300px', background: '#f8fafc' }}>
                                    <h3>Calculated Tax Summary</h3>
                                    <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Based on FY {financialYear}</p>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ color: '#475569' }}>Annual Gross Salary:</span>
                                        <strong style={{ fontSize: 15 }}>{fmt(profile.annualGrossIncome)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                                        <span style={{ color: '#475569' }}>Other Declared Income:</span>
                                        <strong style={{ fontSize: 15 }}>+ {fmt(profile.otherIncome)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #cbd5e1' }}>
                                        <span style={{ color: '#475569' }}>Total Exemptions (incl. Standard):</span>
                                        <strong style={{ color: '#ef4444' }}>- {fmt(profile.totalExemptions)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                                        <span style={{ fontWeight: 600 }}>Net Taxable Income:</span>
                                        <strong style={{ fontSize: 16 }}>{fmt(profile.taxableIncome)}</strong>
                                    </div>

                                    <div style={{ background: '#334155', color: 'white', padding: 20, borderRadius: 8 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                                            <span style={{ opacity: 0.9 }}>Estimated Annual Tax:</span>
                                            <strong style={{ fontSize: 16 }}>{fmt(profile.estimatedAnnualTax)}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ opacity: 0.9 }}>Applicable Monthly TDS:</span>
                                            <strong style={{ fontSize: 20, color: '#38bdf8' }}>{fmt(profile.monthlyTDS)}</strong>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: 24, padding: 12, background: '#e0f2fe', borderRadius: 8, fontSize: 13, color: '#0369a1' }}>
                                        <HiOutlineDocumentText style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        The monthly TDS displayed here will be automatically deducted from your upcoming generated payrolls.
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </>
                );
            })()}
        </div>
    );
}
