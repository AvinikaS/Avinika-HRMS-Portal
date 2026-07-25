import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { HiOutlineCheck, HiOutlineArrowRight, HiOutlineArrowLeft, HiOutlineX, HiOutlineCamera, HiOutlineUpload, HiOutlineTrash } from 'react-icons/hi';
import { FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import Swal from 'sweetalert2';

export default function EmployeeWizard({ onClose, onSuccess, initialData }) {
    const [step, setStep] = useState(1);

    // Default form state
    const [form, setForm] = useState({
        firstName: '', lastName: '', dateOfBirth: '', gender: '',
        mobile: '', personalEmail: '', address: '',
        employeeId: '',
        designation: '', department: '', employmentType: '',
        dateOfJoining: '', manager: '', workLocation: '', workEmail: '',

        basic: 0, hra: 0, specialAllowance: 0, conveyance: 0, medicalAllowance: 0, otherAllowance: 0, gross: 0,
        paymentMode: '', taxRegime: 'New regime (FY 2025-26)', form12BBSubmitted: 'Not applicable',
        inv80c: 0, inv80d: 0, inv80e: 0, homeLoanInterest: 0, hraClaimed: 0, other80: 0,
        pfCalculationType: 'actual_wage',
        pfEmployee: 0, pfEmployer: 0, esicEmployee: 0, tds: 0, otherDeduction: 0, totalDeductions: 0, netSalary: 0, salaryEffectiveFrom: '',

        accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', branchName: '', accountType: '',
        pan: '', aadhaar: '', uan: '', esicIPNumber: ''
    });

    const [monthlyTDS, setMonthlyTDS] = useState(0);
    const [manualOverrides, setManualOverrides] = useState({ pfEmployee: false, esicEmployee: false, tds: false });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(initialData?.profileImage || null);
    const [showImageMenu, setShowImageMenu] = useState(false);
    const [taxBreakdown, setTaxBreakdown] = useState(null);
    const [departmentList, setDepartmentList] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (initialData) {
            setForm(prev => ({
                ...prev,
                firstName: initialData.firstName || '',
                lastName: initialData.lastName || '',
                dateOfBirth: initialData.dateOfBirth ? initialData.dateOfBirth.split('T')[0] : '',
                gender: initialData.gender || '',
                mobile: initialData.phone || '',
                personalEmail: initialData.personalEmail || initialData.email || '',
                workEmail: initialData.workEmail || '',
                address: initialData.address || '',
                employeeId: initialData.employeeCode || '',
                designation: initialData.designation || '',
                department: initialData.department || '',
                employmentType: initialData.employmentType || '',
                dateOfJoining: initialData.dateOfJoining ? initialData.dateOfJoining.split('T')[0] : '',
                manager: initialData.manager || '',
                workLocation: initialData.workLocation || '',

                basic: initialData.basic || initialData.salary?.basic || 0,
                hra: initialData.hra || initialData.salary?.hra || 0,
                specialAllowance: initialData.specialAllowance || initialData.salary?.allowances?.special || 0,
                conveyance: initialData.conveyance || initialData.salary?.allowances?.travel || 0,
                medicalAllowance: initialData.medicalAllowance || initialData.salary?.allowances?.food || 0,
                otherAllowance: initialData.otherAllowance || initialData.salary?.allowances?.other || 0,
                gross: initialData.gross || 0,

                paymentMode: initialData.paymentMode || 'Bank Transfer',
                taxRegime: initialData.taxRegime || 'New regime (FY 2025-26)',
                form12BBSubmitted: initialData.form12BBSubmitted || 'Not applicable',

                inv80c: initialData.inv80c || 0,
                inv80d: initialData.inv80d || 0,
                inv80e: initialData.inv80e || 0,
                homeLoanInterest: initialData.homeLoanInterest || 0,
                hraClaimed: initialData.hraClaimed || 0,
                other80: initialData.other80 || 0,

                pfCalculationType: initialData.pfCalculationType || 'actual_wage',
                pfEmployee: initialData.pfEmployee || 0,
                pfEmployer: initialData.pfEmployer || 0,
                esicEmployee: initialData.esicEmployee || 0,
                tds: initialData.tds || 0,
                otherDeduction: initialData.otherDeduction || 0,

                accountHolderName: initialData.accountHolderName || '',
                accountNumber: initialData.accountNumber || initialData.bankDetails?.accountNumber || '',
                ifscCode: initialData.ifscCode || initialData.bankDetails?.ifscCode || '',
                bankName: initialData.bankName || initialData.bankDetails?.bankName || '',
                branchName: initialData.branchName || '',
                accountType: initialData.accountType || '',

                pan: initialData.pan || initialData.complianceDetails?.panNumber || '',
                aadhaar: initialData.aadhaar || '',
                uan: initialData.uan || initialData.complianceDetails?.uanNumber || '',
                esicIPNumber: initialData.esicIPNumber || initialData.complianceDetails?.esicNumber || ''
            }));
        }
    }, [initialData]);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const res = await api.get('/departments');
                if (res.data && res.data.success) {
                    setDepartmentList(res.data.data);
                }
            } catch (err) {
                console.error("Error fetching departments:", err);
            }
        };
        fetchDepartments();

        // Prevent mouse wheel from unintentionally changing number inputs when focused
        const handleWheel = () => {
            if (document.activeElement && document.activeElement.type === 'number') {
                document.activeElement.blur();
            }
        };
        window.addEventListener('wheel', handleWheel, { passive: true });
        return () => window.removeEventListener('wheel', handleWheel);
    }, []);

    const steps = [
        { num: 1, label: 'Personal & Job' },
        { num: 2, label: 'Salary & Tax' },
        { num: 3, label: 'Bank & Statutory' }
    ];

    // Recalculations
    useEffect(() => {
        const b = Number(form.basic) || 0;
        const h = Number(form.hra) || 0;
        const s = Number(form.specialAllowance) || 0;
        const c = Number(form.conveyance) || 0;
        const m = Number(form.medicalAllowance) || 0;
        const o = Number(form.otherAllowance) || 0;

        const gross = b + h + s + c + m + o;

        // Auto deductions
        let pfc = form.pfCalculationType || 'actual_wage';
        let pfWage = 0;
        if (pfc === 'actual_wage') pfWage = b;
        else if (pfc === 'pf_ceiling') pfWage = Math.min(b, 15000);

        const autoPfEmp = Math.round(pfWage * 0.12);
        const pfEmp = manualOverrides.pfEmployee ? (Number(form.pfEmployee) || 0) : autoPfEmp;
        const pfEmpr = autoPfEmp; // Default matching. Can also be overridden conceptually but keeping UI simple.
        const autoEsic = gross <= 21000 ? Math.round(gross * 0.0075) : 0;
        const esic = manualOverrides.esicEmployee ? (Number(form.esicEmployee) || 0) : autoEsic;

        // TDS Calculation (FY 2025-26)
        let annualGross = gross * 12;
        let taxableIncome = annualGross;
        let annualTds = 0;
        const isNew = form.taxRegime.includes('New');

        let rawTax = 0;
        let cessAmt = 0;
        let ded12BB = 0;

        if (isNew) {
            taxableIncome -= 75000; // std ded
            if (taxableIncome > 1200000) {
                let ti = taxableIncome;
                if (ti > 2400000) { rawTax += (ti - 2400000) * 0.30; ti = 2400000; }
                if (ti > 2000000) { rawTax += (ti - 2000000) * 0.25; ti = 2000000; }
                if (ti > 1600000) { rawTax += (ti - 1600000) * 0.20; ti = 1600000; }
                if (ti > 1200000) { rawTax += (ti - 1200000) * 0.15; ti = 1200000; }
                if (ti > 800000) { rawTax += (ti - 800000) * 0.10; ti = 800000; }
                if (ti > 400000) { rawTax += (ti - 400000) * 0.05; ti = 400000; }
                cessAmt = rawTax * 0.04;
                annualTds = rawTax + cessAmt;
            }
        } else {
            taxableIncome -= 50000; // std ded
            if (form.form12BBSubmitted === 'Yes') {
                ded12BB += Math.min(Number(form.inv80c) || 0, 150000);
                ded12BB += Math.min(Number(form.inv80d) || 0, 250000);
                ded12BB += (Number(form.inv80e) || 0);
                ded12BB += Math.min(Number(form.homeLoanInterest) || 0, 200000);
                ded12BB += (Number(form.hraClaimed) || 0);
                ded12BB += (Number(form.other80) || 0);
                taxableIncome -= ded12BB;
            }
            if (taxableIncome > 500000) {
                let ti = taxableIncome;
                if (ti > 1000000) { rawTax += (ti - 1000000) * 0.30; ti = 1000000; }
                if (ti > 500000) { rawTax += (ti - 500000) * 0.20; ti = 500000; }
                if (ti > 250000) { rawTax += (ti - 250000) * 0.05; ti = 250000; }
                cessAmt = rawTax * 0.04;
                annualTds = rawTax + cessAmt;
            }
        }

        const autoMonthlyTax = Math.max(0, Math.round(annualTds / 12));
        const monthlyTax = manualOverrides.tds ? (Number(form.tds) || 0) : autoMonthlyTax;
        setMonthlyTDS(autoMonthlyTax);

        if (annualGross > 0) {
            setTaxBreakdown({
                regime: form.taxRegime,
                annualGross,
                stdDed: isNew ? 75000 : 50000,
                ded12BB,
                taxableIncome: Math.max(0, taxableIncome),
                rawTax,
                cessAmt,
                annualTds,
                monthlyTds: monthlyTax
            });
        } else {
            setTaxBreakdown(null);
        }

        const totalDed = pfEmp + esic + monthlyTax + (Number(form.otherDeduction) || 0);
        const net = gross - totalDed;

        setForm(prev => ({
            ...prev,
            gross,
            pfEmployee: manualOverrides.pfEmployee ? prev.pfEmployee : pfEmp,
            pfEmployer: pfEmpr,
            esicEmployee: manualOverrides.esicEmployee ? prev.esicEmployee : esic,
            tds: manualOverrides.tds ? prev.tds : monthlyTax,
            totalDeductions: totalDed,
            netSalary: net
        }));
    }, [
        form.basic, form.hra, form.specialAllowance, form.conveyance, form.medicalAllowance, form.otherAllowance,
        form.taxRegime, form.form12BBSubmitted, form.inv80c, form.inv80d, form.inv80e, form.homeLoanInterest, form.hraClaimed, form.other80, form.otherDeduction,
        manualOverrides.pfEmployee, manualOverrides.esicEmployee, manualOverrides.tds,
        form.pfEmployee, form.esicEmployee, form.tds, form.pfCalculationType
    ]);

    const handleChange = (e) => {
        let val = e.target.value;
        if (e.target.name === 'pfCalculationType') {
            if (val === 'pf_ceiling' && Number(form.basic) <= 15000 && Number(form.basic) > 0) {
                toast.warn("Basic salary is already below ₹15,000, so Actual Wage and PF Ceiling will produce the same result.");
            }
        }

        setForm(prev => ({ ...prev, [e.target.name]: val }));
        const resetTriggers = ['basic', 'hra', 'specialAllowance', 'conveyance', 'medicalAllowance', 'otherAllowance', 'taxRegime', 'form12BBSubmitted', 'inv80c', 'inv80d', 'inv80e', 'homeLoanInterest', 'hraClaimed', 'other80', 'pfCalculationType'];
        if (resetTriggers.includes(e.target.name)) {
            setManualOverrides({ pfEmployee: false, esicEmployee: false, tds: false });
        }
    };

    const handleManualChange = (e) => {
        setManualOverrides(p => ({ ...p, [e.target.name]: true }));
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setShowImageMenu(false);
        }
    };

    const handleDeleteImage = async () => {
        setShowImageMenu(false);
        const result = await Swal.fire({
            title: 'Delete Profile Image?',
            text: "Are you sure you want to remove this employee's profile picture?",
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#f1f5f9',
            confirmButtonText: 'Delete',
            cancelButtonText: '<span style="color: #475569; font-weight: 600;">Cancel</span>',
            reverseButtons: true,
            customClass: {
                confirmButton: 'swal-delete-btn'
            }
        });

        if (result.isConfirmed) {
            if (initialData?._id && imagePreview === initialData.profileImage) {
                const toastId = toast.loading('Removing profile image...');
                try {
                    await api.delete('/employees/' + initialData._id + '/profile-image');
                    toast.update(toastId, { render: 'Profile image deleted successfully!', type: 'success', isLoading: false, autoClose: 3000 });
                } catch (err) {
                    console.error(err);
                    return toast.update(toastId, { render: 'Failed to remove image', type: 'error', isLoading: false, autoClose: 3000 });
                }
            }
            setImagePreview(null);
            setImageFile(null);
        }
    };

    const handleNext = () => {
        // Basic Validations
        if (step === 1) {
            if (!form.firstName || !form.lastName || !form.dateOfBirth || !form.gender || !form.mobile || !form.employeeId || !form.designation || !form.department || !form.employmentType || !form.dateOfJoining) {
                return toast.error('Please fill all required (*) fields in Step 1');
            }
            if (form.mobile.length !== 10) return toast.error('Mobile number must be 10 digits');
        }
        if (step === 2) {
            if (!form.basic || !form.paymentMode) return toast.error('Basic salary and payment mode are required');
        }
        setStep(s => s + 1);
    };

    const handlePrev = () => setStep(s => s - 1);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.accountHolderName || !form.accountNumber || !form.ifscCode || !form.bankName || !form.pan) {
            return toast.error('Please fill all required bank and statutory details');
        }
        if (form.ifscCode.length !== 11) return toast.error('IFSC code must be exactly 11 characters');
        if (form.pan.length !== 10) return toast.error('PAN must be exactly 10 characters');
        if (form.aadhaar && form.aadhaar.length !== 12) return toast.error('Aadhaar must be 12 digits');
        if ((form.pfCalculationType === 'actual_wage' || form.pfCalculationType === 'pf_ceiling') && !form.uan) {
            return toast.error('UAN is required for employees enrolled in PF.');
        }

        setIsSubmitting(true);
        const submitToastId = toast.loading('Saving employee details...');

        try {
            let res;
            if (initialData && initialData._id) {
                res = await api.put('/employees/' + initialData._id, { ...form, email: form.personalEmail || `${form.firstName.toLowerCase()}@hr.com`, phone: form.mobile });
            } else {
                res = await api.post('/employees', { ...form, email: form.personalEmail || `${form.firstName.toLowerCase()}@hr.com`, phone: form.mobile });
            }
            if (imageFile) {
                toast.update(submitToastId, { render: 'Finalizing setup... Please wait', type: 'info', isLoading: true });
                const { uploadToCloudinary } = await import('../utils/cloudinaryUpload');
                const uploadResult = await uploadToCloudinary(imageFile, 'hrms/profiles');
                await api.put('/employees/' + res.data.data._id + '/profile-image', { imageUrl: uploadResult.url });
                res.data.data.profileImage = uploadResult.url;
            }
            toast.update(submitToastId, { render: initialData ? 'Employee updated successfully!' : 'Employee created successfully via Wizard!', type: 'success', isLoading: false, autoClose: 3000 });
            if (onSuccess) onSuccess(res.data.data);
            setStep(4); // Move to summary screen
        } catch (err) {
            toast.update(submitToastId, { render: err.response?.data?.message || 'Error creating employee', type: 'error', isLoading: false, autoClose: 4000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddAnother = () => {
        setForm({
            firstName: '', lastName: '', dateOfBirth: '', gender: '',
            mobile: '', personalEmail: '', address: '',
            employeeId: '',
            designation: '', department: '', employmentType: '',
            dateOfJoining: '', manager: '', workLocation: '', workEmail: '',

            basic: 0, hra: 0, specialAllowance: 0, conveyance: 0, medicalAllowance: 0, otherAllowance: 0, gross: 0,
            paymentMode: '', taxRegime: 'New regime (FY 2025-26)', form12BBSubmitted: 'Not applicable',
            inv80c: 0, inv80d: 0, inv80e: 0, homeLoanInterest: 0, hraClaimed: 0, other80: 0,
            pfEmployee: 0, pfEmployer: 0, esicEmployee: 0, tds: 0, otherDeduction: 0, totalDeductions: 0, netSalary: 0, salaryEffectiveFrom: '',

            accountHolderName: '', accountNumber: '', ifscCode: '', bankName: '', branchName: '', accountType: '',
            pan: '', aadhaar: '', uan: '', esicIPNumber: ''
        });
        setStep(1);
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 9999, overflowY: 'auto', padding: '20px 0' }}>
            <div className="modal" style={{ maxWidth: 900, width: '90%', margin: '0 auto', background: '#fff', borderRadius: 12 }}>
                <div className="modal-header" style={{ padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: 20, margin: 0, color: '#1e293b' }}>Add Employee</h2>
                    <button className="btn btn-icon" onClick={onClose} style={{ width: 32, height: 32, border: '1px solid #cbd5e1', backgroundColor: '#f1f5f9', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 32 }}><FaTimes size={15} style={{ color: '#475569' }} /></button>
                </div>

                {step < 4 && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 16px', background: '#f8fafc', overflowX: 'hidden' }}>
                        {steps.map((st, i) => (
                            <React.Fragment key={st.num}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 0, maxWidth: 120 }}>
                                    <div style={{
                                        width: 32, height: 32, minWidth: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontWeight: 'bold', fontSize: 14, color: '#fff',
                                        background: step > st.num ? '#059669' : step === st.num ? '#3b82f6' : '#cbd5e1'
                                    }}>
                                        {step > st.num ? <HiOutlineCheck size={18} /> : st.num}
                                    </div>
                                    <div style={{ fontSize: 11, marginTop: 6, fontWeight: 500, color: step >= st.num ? '#334155' : '#94a3b8', textAlign: 'center', wordBreak: 'break-word', lineHeight: 1.3, width: '100%', padding: '0 4px' }}>
                                        {st.label}
                                    </div>
                                </div>
                                {i < 2 && (
                                    <div style={{ flex: 1, height: 3, background: step > st.num ? '#059669' : '#e2e8f0', marginTop: 14, maxWidth: 60, minWidth: 10 }}></div>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <div className="modal-body" style={{ padding: '30px' }}>
                    {step === 1 && (
                        <div className="animate-fadeIn">
                            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 20 }}>1. Personal Information</h3>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30, marginTop: 10 }}>
                                <div style={{ position: 'relative', width: 110, height: 110, marginBottom: 15 }}>
                                    {imagePreview ? (
                                        <img src={imagePreview} alt="Profile" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: '#94a3b8', fontWeight: 'bold', border: '4px solid #fff', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
                                            {form.firstName ? form.firstName.charAt(0).toUpperCase() : '👤'}
                                        </div>
                                    )}
                                    {imagePreview ? (
                                        <div style={{ position: 'absolute', bottom: 0, right: -5 }}>
                                            <div onClick={() => setShowImageMenu(!showImageMenu)} style={{ background: '#fff', border: '2px solid #4f46e5', color: '#4f46e5', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.2s', zIndex: 10 }}>
                                                <HiOutlineCamera size={20} />
                                            </div>
                                        </div>
                                    ) : (
                                        <label style={{ position: 'absolute', bottom: 0, right: -5, background: '#fff', border: '2px solid #4f46e5', color: '#4f46e5', width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.15)', transition: 'all 0.2s', zIndex: 10 }} title="Upload HR Approved Photo">
                                            <HiOutlineCamera size={20} />
                                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                                        </label>
                                    )}
                                    {/* Dropdown menu: always centered below profile image */}
                                    {showImageMenu && (
                                        <div style={{ position: 'absolute', top: 118, left: '50%', transform: 'translateX(-50%)', background: '#fff', borderRadius: 8, boxShadow: '0 4px 15px rgba(0,0,0,0.12)', padding: '8px 0', width: 160, zIndex: 200, border: '1px solid #e2e8f0' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', fontSize: 13, cursor: 'pointer', color: '#1e293b', margin: 0 }}>
                                                <HiOutlineUpload size={16} /> Upload Image
                                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageChange} />
                                            </label>
                                            <div onClick={handleDeleteImage} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 15px', fontSize: 13, cursor: 'pointer', color: '#ef4444' }}>
                                                <HiOutlineTrash size={16} /> Delete Image
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 500, color: '#1e293b' }}>Employee Profile Photo</span>
                            </div>

                            <div className="form-row">
                                <div className="form-group"><label>First Name *</label><input type="text" name="firstName" className="form-control" placeholder="e.g. John" value={form.firstName} onChange={handleChange} /></div>
                                <div className="form-group"><label>Last Name *</label><input type="text" name="lastName" className="form-control" placeholder="e.g. Doe" value={form.lastName} onChange={handleChange} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Date of Birth *</label><input type="date" name="dateOfBirth" className="form-control" value={form.dateOfBirth} onChange={handleChange} /></div>
                                <div className="form-group">
                                    <label>Gender *</label>
                                    <select name="gender" className="form-control" value={form.gender} onChange={handleChange}>
                                        <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Mobile (10 digits) *</label><input type="text" name="mobile" className="form-control" placeholder="9876543210" value={form.mobile} onChange={handleChange} maxLength="10" /></div>
                                <div className="form-group"><label>Personal Email</label><input type="email" name="personalEmail" className="form-control" placeholder="john.doe@gmail.com" value={form.personalEmail} onChange={handleChange} /></div>
                            </div>
                            <div className="form-group"><label>Address</label><textarea name="address" className="form-control" rows="2" placeholder="123, Main Street, City" value={form.address} onChange={handleChange}></textarea></div>

                            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 10, margin: '30px 0 20px' }}>Job Details</h3>
                            <div className="form-row">
                                <div className="form-group"><label>Employee ID *</label><input type="text" name="employeeId" className="form-control" placeholder="e.g. EMP0001" value={form.employeeId} onChange={handleChange} /></div>
                                <div className="form-group"><label>Designation *</label><input type="text" name="designation" className="form-control" placeholder="e.g. Software Engineer" value={form.designation} onChange={handleChange} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Department *</label>
                                    <select name="department" className="form-control" value={form.department} onChange={handleChange}>
                                        <option value="">Select Option</option>
                                        {departmentList.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Employment Type *</label>
                                    <select name="employmentType" className="form-control" value={form.employmentType} onChange={handleChange}>
                                        <option value="">Select Option</option>
                                        {['Full-time', 'Part-time', 'Contract', 'Intern', 'Probation'].map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Date of Joining *</label><input type="date" name="dateOfJoining" className="form-control" value={form.dateOfJoining} onChange={handleChange} /></div>
                                <div className="form-group"><label>Reporting Manager</label><input type="text" name="manager" className="form-control" placeholder="e.g. Jane Smith" value={form.manager} onChange={handleChange} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Work Location</label><input type="text" name="workLocation" className="form-control" placeholder="e.g. Mumbai HQ / WFH" value={form.workLocation} onChange={handleChange} /></div>
                                <div className="form-group"><label>Official Email</label><input type="email" name="workEmail" className="form-control" placeholder="john.doe@company.com" value={form.workEmail} onChange={handleChange} /></div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-fadeIn">
                            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 20 }}>2. Salary Structure & Tax (Monthly)</h3>

                            <div className="wizard-salary-grid">
                                <div>
                                    <h4 style={{ marginBottom: 15, color: '#334155' }}>Earnings</h4>
                                    <div className="form-group wizard-earn-row" style={{ marginBottom: 10 }}>
                                        <label className="wizard-earn-label">Basic salary (₹) *</label>
                                        <input type="number" name="basic" className="form-control" value={form.basic} onChange={(e) => {
                                            setForm(p => ({ ...p, basic: e.target.value, hra: Math.round(Number(e.target.value) * 0.4) }));
                                        }} />
                                    </div>
                                    <div className="form-group wizard-earn-row" style={{ marginBottom: 10 }}>
                                        <label className="wizard-earn-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>HRA (₹) <span style={{ background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", fontSize: 10, borderRadius: 10, fontWeight: "bold" }}>Auto 40%</span></label>
                                        <input type="number" name="hra" className="form-control" value={form.hra} onChange={handleChange} />
                                    </div>
                                    <div className="form-group wizard-earn-row" style={{ marginBottom: 10 }}>
                                        <label className="wizard-earn-label">Special allow. (₹)</label>
                                        <input type="number" name="specialAllowance" className="form-control" value={form.specialAllowance} onChange={handleChange} />
                                    </div>
                                    <div className="form-group wizard-earn-row" style={{ marginBottom: 10 }}>
                                        <label className="wizard-earn-label">Conveyance (₹)</label>
                                        <input type="number" name="conveyance" className="form-control" value={form.conveyance} onChange={handleChange} />
                                    </div>
                                    <div className="form-group wizard-earn-row" style={{ marginBottom: 10 }}>
                                        <label className="wizard-earn-label">Medical allow. (₹)</label>
                                        <input type="number" name="medicalAllowance" className="form-control" value={form.medicalAllowance} onChange={handleChange} />
                                    </div>
                                    <div className="form-group wizard-earn-row" style={{ marginBottom: 10 }}>
                                        <label className="wizard-earn-label">Other earnings (₹)</label>
                                        <input type="number" name="otherAllowance" className="form-control" value={form.otherAllowance} onChange={handleChange} />
                                    </div>

                                    <div style={{ marginTop: 20, padding: 15, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                            <span>Gross Salary</span>
                                            <span style={{ color: '#0f172a' }}>₹ {form.gross.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginTop: 20 }}>
                                        <label>Payment Mode *</label>
                                        <select name="paymentMode" className="form-control" value={form.paymentMode} onChange={handleChange}>
                                            <option value="">Select Option</option>
                                            <option value="Bank Transfer">Bank Transfer</option>
                                            <option value="Cash">Cash</option>
                                            <option value="Cheque">Cheque</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ marginBottom: 15, color: '#334155' }}>Taxes & Config</h4>
                                    <div className="form-group">
                                        <label>Tax Regime *</label>
                                        <select name="taxRegime" className="form-control" value={form.taxRegime} onChange={(e) => {
                                            if (e.target.value.includes('New')) setForm(p => ({ ...p, taxRegime: e.target.value, form12BBSubmitted: 'Not applicable' }));
                                            else setForm(p => ({ ...p, taxRegime: e.target.value }));
                                        }}>
                                            <option value="New regime (FY 2025-26)">New regime (FY 2025-26)</option>
                                            <option value="Old regime">Old regime</option>
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>Form 12BB Submitted</label>
                                        <select name="form12BBSubmitted" disabled={form.taxRegime.includes('New')} className="form-control" value={form.form12BBSubmitted} onChange={handleChange}>
                                            <option value="Not applicable">Not applicable</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>

                                    {form.taxRegime.includes('New') && (
                                        <div style={{ padding: 10, background: '#e0f2fe', color: '#0369a1', fontSize: 13, borderRadius: 6, marginBottom: 15 }}>
                                            No exemptions are applicable under the New Regime (80C, HRA, 80D, 80E, home loan). Only a standard deduction of ₹75,000 applies. Form 12BB is not applicable.
                                        </div>
                                    )}

                                    {form.taxRegime.includes('Old') && form.form12BBSubmitted === 'Yes' && (
                                        <div style={{ marginTop: 20, marginBottom: 15, padding: 15, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                                            <h5 style={{ marginBottom: 15, color: '#334155', fontWeight: 600 }}>Form 12BB Declarations</h5>
                                            <div className="wizard-12bb-grid">
                                                <div className="form-group" style={{ marginBottom: 15 }}>
                                                    <label style={{ fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>80C — LIC/PPF/ELSS/EPF (₹/yr)</label>
                                                    <input type="number" name="inv80c" className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} value={form.inv80c} onChange={handleChange} />
                                                    <small style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>Max ₹1,50,000</small>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 15 }}>
                                                    <label style={{ fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>80D — Medical insurance (₹/yr)</label>
                                                    <input type="number" name="inv80d" className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} value={form.inv80d} onChange={handleChange} />
                                                    <small style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>Self: max ₹25,000</small>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 15 }}>
                                                    <label style={{ fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>80E — Education loan interest (₹/yr)</label>
                                                    <input type="number" name="inv80e" className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} value={form.inv80e} onChange={handleChange} />
                                                    <small style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>No upper limit</small>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 8 }}>
                                                    <label style={{ fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>Sec 24(b) — Home loan interest (₹/yr)</label>
                                                    <input type="number" name="homeLoanInterest" className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} value={form.homeLoanInterest} onChange={handleChange} />
                                                    <small style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>Max ₹2,00,000</small>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 8 }}>
                                                    <label style={{ fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>HRA — Sec 10(13A) (₹/yr)</label>
                                                    <input type="number" name="hraClaimed" className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} value={form.hraClaimed} onChange={handleChange} />
                                                    <small style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>Actual rent - 10% basic</small>
                                                </div>
                                                <div className="form-group" style={{ marginBottom: 8 }}>
                                                    <label style={{ fontSize: 11, marginBottom: 6, fontWeight: 'bold' }}>80G / 80TTA / others (₹/yr)</label>
                                                    <input type="number" name="other80" className="form-control" style={{ padding: '6px 10px', fontSize: 13 }} value={form.other80} onChange={handleChange} />
                                                    <small style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 4 }}>Donations, savings interest etc.</small>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h4 style={{ marginBottom: 15, marginTop: 25, color: '#334155' }}>Deductions (Monthly) & Breakdowns</h4>

                            <div className="form-group" style={{ marginBottom: 15 }}>
                                <label style={{ fontSize: 13, marginBottom: 6, fontWeight: 'bold' }}>PF Calculation Type *</label>
                                <select name="pfCalculationType" className="form-control" value={form.pfCalculationType} onChange={handleChange}>
                                    <option value="actual_wage">Actual Wage (12% of actual basic)</option>
                                    <option value="pf_ceiling">PF Ceiling (12% of ₹15,000 capped)</option>
                                    <option value="not_applicable">Not Applicable</option>
                                </select>
                            </div>

                            <div className="wizard-pf-grid" style={{ marginBottom: 15 }}>
                                <div className="form-group">
                                    <label style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}>
                                        PF employee (₹)
                                        <span style={{ background: '#d1fae5', color: '#047857', padding: '2px 6px', fontSize: 10, borderRadius: 10, fontWeight: 'bold' }}>
                                            {form.pfCalculationType === 'not_applicable' ? '0%' : '12% of PF Wage'}
                                        </span>
                                    </label>
                                    <input type="number" name="pfEmployee" className="form-control" value={form.pfEmployee} onChange={handleManualChange} disabled={form.pfCalculationType === 'not_applicable'} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}>ESIC employee (₹) <span style={{ background: '#d1fae5', color: '#047857', padding: '2px 6px', fontSize: 10, borderRadius: 10, fontWeight: 'bold' }}>0.75%</span></label>
                                    <input type="number" name="esicEmployee" className="form-control" value={form.esicEmployee} onChange={handleManualChange} />
                                </div>
                            </div>

                            <div className="wizard-pf-grid" style={{ marginBottom: 20 }}>
                                <div className="form-group">
                                    <label style={{ fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, color: '#1e293b' }}>TDS / month (₹) <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', fontSize: 10, borderRadius: 10, fontWeight: 'bold' }}>Slab auto</span></label>
                                    <input type="number" name="tds" className="form-control" value={form.tds} onChange={handleManualChange} style={{ fontWeight: 'bold', color: '#dc2626' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: 13, marginBottom: 6, color: '#1e293b' }}>Other deduction (₹)</label>
                                    <input type="number" name="otherDeduction" className="form-control" value={form.otherDeduction} onChange={handleChange} />
                                </div>
                            </div>

                            {taxBreakdown && (
                                <div style={{ marginTop: 20, width: '100%' }}>
                                    <div style={{ background: '#212121', color: '#f8fafc', borderRadius: 8, padding: 24, fontSize: 13, letterSpacing: '0.2px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Regime</span> <span>{taxBreakdown.regime.includes('Old') ? 'Old regime' : 'New regime'}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Annual gross income</span> <span>₹{taxBreakdown.annualGross.toLocaleString('en-IN')}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Standard deduction (₹{taxBreakdown.stdDed.toLocaleString('en-IN')})</span> <span>-₹{taxBreakdown.stdDed.toLocaleString('en-IN')}</span></div>
                                        {taxBreakdown.ded12BB > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, color: '#34d399' }}><span>Form 12BB Total Deductions</span> <span>-₹{taxBreakdown.ded12BB.toLocaleString('en-IN')}</span></div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Taxable income</span> <span>₹{taxBreakdown.taxableIncome.toLocaleString('en-IN')}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><span>Income tax</span> <span>₹{taxBreakdown.rawTax.toLocaleString('en-IN')}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, borderBottom: '1px solid #404040', paddingBottom: 10 }}><span>Health & education cess (4%)</span> <span>₹{taxBreakdown.cessAmt.toLocaleString('en-IN')}</span></div>
                                        <div style={{ marginTop: 15, fontWeight: 'bold', fontSize: 14 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span>Annual TDS</span> <span>₹{taxBreakdown.annualTds.toLocaleString('en-IN')}</span></div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Monthly TDS</span> <span style={{ color: '#f87171' }}>₹{taxBreakdown.monthlyTds.toLocaleString('en-IN')}/mo</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="wizard-net-salary-card">
                                <div style={{ fontSize: 14 }}><b>Total Deductions:</b><br /><span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>₹{form.totalDeductions.toLocaleString('en-IN')}</span></div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 13, color: '#047857', fontWeight: 600, marginBottom: 2 }}>Net Salary</div>
                                    <div style={{ fontSize: 26, fontWeight: 'bold', color: '#047857' }}>₹{form.netSalary.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: 12, color: '#6b7280' }}>/ month</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-fadeIn">
                            <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: 10, marginBottom: 20 }}>3. Bank & Statutory Details</h3>

                            <h4 style={{ color: '#475569', marginBottom: 15 }}>Bank Information</h4>
                            <div className="form-row">
                                <div className="form-group"><label>Account Holder Name *</label><input type="text" name="accountHolderName" className="form-control" placeholder="As per bank records" value={form.accountHolderName} onChange={handleChange} /></div>
                                <div className="form-group"><label>Account Number *</label><input type="text" name="accountNumber" className="form-control" placeholder="000012345678" value={form.accountNumber} onChange={handleChange} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>IFSC Code *</label>
                                    <input type="text" name="ifscCode" className="form-control" placeholder="SBIN0001234" maxLength="11" onInput={e => e.target.value = e.target.value.toUpperCase()} value={form.ifscCode} onChange={handleChange} />
                                    <small style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#64748b' }}>11 characters</small>
                                </div>
                                <div className="form-group"><label>Bank Name *</label><input type="text" name="bankName" className="form-control" placeholder="State Bank of India" value={form.bankName} onChange={handleChange} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group"><label>Branch Name</label><input type="text" name="branchName" className="form-control" placeholder="MG Road Branch" value={form.branchName} onChange={handleChange} /></div>
                                <div className="form-group">
                                    <label>Account Type</label>
                                    <select name="accountType" className="form-control" value={form.accountType} onChange={handleChange}>
                                        <option value="">Select</option>
                                        <option value="Savings">Savings</option>
                                        <option value="Current">Current</option>
                                        <option value="Salary Account">Salary Account</option>
                                    </select>
                                </div>
                            </div>

                            <h4 style={{ color: '#475569', marginBottom: 15, marginTop: 30 }}>Statutory Information</h4>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>PAN Number *</label>
                                    <input type="text" name="pan" className="form-control" placeholder="ABCDE1234F" maxLength="10" onInput={e => e.target.value = e.target.value.toUpperCase()} value={form.pan} onChange={handleChange} />
                                    <small style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#64748b' }}>Required for TDS deduction</small>
                                </div>
                                <div className="form-group"><label>Aadhaar Number</label><input type="text" name="aadhaar" className="form-control" placeholder="1234 5678 9012" maxLength="12" value={form.aadhaar} onChange={handleChange} /></div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>UAN (Universal Account Number)</label>
                                    <input type="text" name="uan" className="form-control" placeholder="100XXXXXXXXX" value={form.uan} onChange={handleChange} />
                                    <small style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#64748b' }}>Required for PF ECR filing</small>
                                </div>
                                <div className="form-group">
                                    <label>ESIC IP Number</label>
                                    <input type="text" name="esicIPNumber" className="form-control" placeholder="If applicable" value={form.esicIPNumber} onChange={handleChange} />
                                    <small style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#64748b' }}>Applicable if Gross ≤ ₹21,000 {form.gross <= 21000 && <strong style={{ color: '#ef4444' }}>(Required)</strong>}</small>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="wizard-footer">
                    {step > 1 ? (
                        <button className="btn btn-secondary" onClick={handlePrev} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <HiOutlineArrowLeft /> Back
                        </button>
                    ) : <div></div>}

                    {step < 3 ? (
                        <button className="btn btn-primary" onClick={handleNext} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            Next Step <HiOutlineArrowRight />
                        </button>
                    ) : (
                        <button className="btn btn-success" onClick={handleSubmit} disabled={isSubmitting} style={{ background: isSubmitting ? '#9ca3af' : '#059669', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: 8, fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center', cursor: isSubmitting ? 'not-allowed' : 'pointer' }}>
                            <HiOutlineCheck size={20} /> {isSubmitting ? 'Processing...' : 'Save & Finalize'}
                        </button>
                    )}
                </div>
            </div >
        </div >
    );
}
