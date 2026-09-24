import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { HiOutlineArrowLeft, HiOutlineUpload, HiOutlineX, HiOutlineExclamation, HiOutlineDocumentText } from 'react-icons/hi';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

export default function CreateExpense() {
    const navigate = useNavigate();
    const fileInputRef = useRef();

    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState({
        categoryId: '',
        expenseDate: new Date().toISOString().split('T')[0],
        expenseEndDate: '',
        amountClaimed: '',
        description: '',
        vendor: '',
        location: '',
        businessPurpose: '',
        notes: '',
        customCategoryName: ''
    });
    const [isMultiDay, setIsMultiDay] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [receipts, setReceipts] = useState([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [removingIndex, setRemovingIndex] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [policyWarning, setPolicyWarning] = useState(null);
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    const [confirmDuplicate, setConfirmDuplicate] = useState(false);
    const [descLength, setDescLength] = useState(0);

    useEffect(() => {
        api.get('/expenses/categories').then(({ data }) => {
            if (data.success) setCategories(data.data);
        }).catch(() => { });
    }, []);

    // When category changes, update selected category info
    useEffect(() => {
        if (form.categoryId) {
            const cat = categories.find(c => c._id === form.categoryId);
            setSelectedCategory(cat || null);
        } else {
            setSelectedCategory(null);
        }
    }, [form.categoryId, categories]);

    // Policy warning when amount changes
    useEffect(() => {
        if (selectedCategory && form.amountClaimed) {
            if (selectedCategory.maxAmount && Number(form.amountClaimed) > selectedCategory.maxAmount) {
                setPolicyWarning(`This expense of ₹${form.amountClaimed} exceeds the configured limit of ₹${selectedCategory.maxAmount} for ${selectedCategory.name}.`);
            } else {
                setPolicyWarning(null);
            }
        } else {
            setPolicyWarning(null);
        }
    }, [form.amountClaimed, selectedCategory]);

    // Duplicate check when date + category + amount are all set
    useEffect(() => {
        const { categoryId, expenseDate, amountClaimed } = form;
        if (!categoryId || !expenseDate || !amountClaimed || Number(amountClaimed) <= 0) {
            setDuplicateWarning(null);
            return;
        }
        const checkDuplicate = async () => {
            try {
                const { data } = await api.post('/expenses/duplicate-check', { categoryId, expenseDate, amountClaimed: Number(amountClaimed) });
                setDuplicateWarning(data.duplicate || null);
            } catch { }
        };
        const t = setTimeout(checkDuplicate, 600);
        return () => clearTimeout(t);
    }, [form.categoryId, form.expenseDate, form.amountClaimed]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
        if (name === 'description') setDescLength(value.length);
    };

    const uploadToCloudinary = async (file) => {
        try {
            // Get upload signature
            const { data: sigData } = await api.post('/upload/signature', { folder: 'hrms/expenses' });
            const { signature, timestamp, folder, cloudName, apiKey } = sigData.data;

            const fd = new FormData();
            fd.append('file', file);
            fd.append('api_key', apiKey);
            fd.append('timestamp', timestamp);
            fd.append('signature', signature);
            fd.append('folder', folder);

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
                { method: 'POST', body: fd }
            );
            const result = await response.json();
            if (result.error) throw new Error(result.error.message);

            return {
                fileName: file.name,
                fileUrl: result.secure_url,
                publicId: result.public_id,
                fileType: file.type,
                fileSize: file.size,
                uploadedAt: new Date().toISOString()
            };
        } catch (err) {
            toast.error(`Failed to upload ${file.name}: ` + err.message);
            return null;
        }
    };

    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        const validFiles = files.filter(file => {
            if (!ALLOWED_TYPES.includes(file.type)) {
                toast.error(`${file.name}: Only PDF, JPG, JPEG, PNG allowed.`);
                return false;
            }
            if (file.size > MAX_FILE_SIZE) {
                toast.error(`${file.name}: File size must be under 5MB.`);
                return false;
            }
            return true;
        });

        if (!validFiles.length) return;

        setUploadingFile(true);
        const uploadPromises = validFiles.map(file => uploadToCloudinary(file));
        const results = await Promise.all(uploadPromises);
        
        const successfulUploads = results.filter(r => r !== null);
        if (successfulUploads.length > 0) {
            setReceipts(prev => [...prev, ...successfulUploads]);
            toast.success(`${successfulUploads.length} receipt(s) uploaded successfully!`);
        }
        setUploadingFile(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveReceipt = async (index, publicId) => {
        setRemovingIndex(index);
        try {
            if (publicId) {
                await api.delete('/upload/file', { data: { publicId } });
            }
            setReceipts(prev => prev.filter((_, i) => i !== index));
            toast.success('Receipt removed.');
        } catch (err) {
            toast.error('Failed to remove receipt from server.');
        }
        setRemovingIndex(null);
    };

    const validateForm = () => {
        if (!form.categoryId) { toast.error('Please select a category.'); return false; }
        if (selectedCategory?.name === 'Other' && (!form.customCategoryName || form.customCategoryName.trim().length < 2)) {
            toast.error('Please specify the custom category name.');
            return false;
        }
        if (!form.expenseDate) { toast.error('Please enter expense date.'); return false; }
        if (!form.amountClaimed || Number(form.amountClaimed) <= 0) { toast.error('Please enter a valid amount.'); return false; }
        if (!form.description || form.description.trim().length < 5) { toast.error('Please enter a description (min 5 chars).'); return false; }
        return true;
    };

    const saveDraft = async () => {
        if (!validateForm()) return;
        setSaving(true);
        try {
            const payload = { ...form, expenseEndDate: isMultiDay ? form.expenseEndDate : null, amountClaimed: Number(form.amountClaimed), receipts };
            const { data } = await api.post('/expenses', payload);
            if (data.success) {
                toast.success('Draft saved successfully!');
                navigate(`/expenses/${data.data._id}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save draft.');
        }
        setSaving(false);
    };

    const submitClaim = async () => {
        if (!validateForm()) return;
        if (selectedCategory?.receiptRequired && receipts.length === 0) {
            toast.error(`Receipt is required for "${selectedCategory.name}" category.`);
            return;
        }
        if (duplicateWarning && !confirmDuplicate) {
            toast.warn('A similar claim already exists. Please confirm to proceed.');
            return;
        }

        setSubmitting(true);
        try {
            // Create first
            const payload = { ...form, expenseEndDate: isMultiDay ? form.expenseEndDate : null, amountClaimed: Number(form.amountClaimed), receipts };
            const { data: createData } = await api.post('/expenses', payload);
            if (!createData.success) throw new Error(createData.message);

            // Then submit
            const { data: submitData } = await api.post(`/expenses/${createData.data._id}/submit`);
            if (submitData.success) {
                toast.success(`Claim ${createData.data.claimNumber} submitted successfully!`);
                navigate(`/expenses/${createData.data._id}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to submit claim.');
        }
        setSubmitting(false);
    };

    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/expenses')}>
                        <HiOutlineArrowLeft />
                    </button>
                    <div>
                        <h1>New Expense Claim</h1>
                        <p>Fill in the details for your expense reimbursement</p>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
                {/* Main Form */}
                <div className="card" style={{ flex: '1 1 min(100%, 500px)' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Expense Details</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                        {/* Multiple Days Checkbox */}
                        <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, marginBottom: -8 }}>
                            <input
                                type="checkbox"
                                id="isMultiDay"
                                checked={isMultiDay}
                                onChange={(e) => {
                                    setIsMultiDay(e.target.checked);
                                    if (!e.target.checked) setForm(f => ({ ...f, expenseEndDate: '' }));
                                }}
                                style={{ width: 16, height: 16, cursor: 'pointer' }}
                            />
                            <label htmlFor="isMultiDay" style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>Multiple Days / Multi-Day Expense</label>
                        </div>

                        {/* Expense Date */}
                        <div className="form-group" style={!isMultiDay ? { gridColumn: '1 / -1' } : {}}>
                            <label className="form-label">{isMultiDay ? 'From Date *' : 'Expense Date *'}</label>
                            <input
                                type="date"
                                name="expenseDate"
                                className="form-control"
                                value={form.expenseDate}
                                onChange={handleChange}
                            />
                        </div>

                        {/* Expense End Date */}
                        {isMultiDay && (
                            <div className="form-group">
                                <label className="form-label">To Date (Optional)</label>
                                <input
                                    type="date"
                                    name="expenseEndDate"
                                    className="form-control"
                                    value={form.expenseEndDate}
                                    min={form.expenseDate}
                                    onChange={handleChange}
                                />
                            </div>
                        )}

                        {/* Category */}
                        <div className="form-group">
                            <label className="form-label">Category *</label>
                            <select name="categoryId" className="form-control" value={form.categoryId} onChange={handleChange}>
                                <option value="">Select Category</option>
                                {categories.map(c => (
                                    <option key={c._id} value={c._id}>{c.name}</option>
                                ))}
                            </select>
                            {selectedCategory && (
                                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
                                    {selectedCategory.receiptRequired && <span style={{ color: 'var(--danger)' }}>⚠ Receipt required</span>}
                                    {selectedCategory.maxAmount && <span style={{ marginLeft: 8 }}>Max: ₹{selectedCategory.maxAmount.toLocaleString('en-IN')}</span>}
                                </div>
                            )}
                        </div>

                        {/* Custom Category Name (conditionally rendered) */}
                        {selectedCategory?.name === 'Other' && (
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Specify Expense Category *</label>
                                <input
                                    type="text"
                                    name="customCategoryName"
                                    className="form-control"
                                    value={form.customCategoryName}
                                    onChange={handleChange}
                                    placeholder="e.g. Software, Meals"
                                />
                            </div>
                        )}

                        {/* Amount */}
                        <div className="form-group">
                            <label className="form-label">Amount (₹) *</label>
                            <input
                                type="number"
                                name="amountClaimed"
                                className="form-control"
                                value={form.amountClaimed}
                                onChange={handleChange}
                                min={1}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Vendor */}
                        <div className="form-group">
                            <label className="form-label">Vendor / Merchant</label>
                            <input type="text" name="vendor" className="form-control" value={form.vendor} onChange={handleChange} placeholder="e.g. Ola, Swiggy, Hotel ABC" />
                        </div>

                        {/* Location */}
                        <div className="form-group">
                            <label className="form-label">Location</label>
                            <input type="text" name="location" className="form-control" value={form.location} onChange={handleChange} placeholder="City / Place" />
                        </div>

                        {/* Business Purpose */}
                        <div className="form-group">
                            <label className="form-label">Business Purpose</label>
                            <input type="text" name="businessPurpose" className="form-control" value={form.businessPurpose} onChange={handleChange} placeholder="Client meeting, site visit, etc." />
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group" style={{ marginTop: 8 }}>
                        <label className="form-label">Description * <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 400 }}>({descLength}/2000)</span></label>
                        <textarea
                            name="description"
                            className="form-control"
                            value={form.description}
                            onChange={handleChange}
                            rows={3}
                            maxLength={2000}
                            placeholder="Describe the expense in detail..."
                            style={{ resize: 'vertical' }}
                        />
                    </div>

                    {/* Notes */}
                    <div className="form-group">
                        <label className="form-label">Additional Notes</label>
                        <textarea
                            name="notes"
                            className="form-control"
                            value={form.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Any additional information..."
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>

                {/* Right panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: '1 1 340px', maxWidth: '100%' }}>
                    {/* Receipt Upload */}
                    <div className="card">
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>
                            Receipt {selectedCategory?.receiptRequired && <span style={{ color: 'var(--danger)', fontWeight: 400, fontSize: 12 }}>* Required</span>}
                        </h3>

                        {receipts.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                                {receipts.map((r, i) => (
                                    <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-primary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                            <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--primary-50)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <HiOutlineDocumentText size={20} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {r.fileName}
                                                </p>
                                                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                    {(r.fileSize / 1024).toFixed(1)} KB
                                                </p>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                                            <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}>
                                                View
                                            </a>
                                            <button className="btn-icon" onClick={() => handleRemoveReceipt(i, r.publicId)} disabled={removingIndex === i} style={{ color: 'var(--danger)' }} title="Remove file">
                                                {removingIndex === i ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <HiOutlineX size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border-color)', borderRadius: 8, padding: '24px 16px',
                                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                                background: 'var(--bg-secondary)'
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            {uploadingFile ? (
                                <><div className="spinner" style={{ margin: '0 auto 8px' }} /><p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Uploading...</p></>
                            ) : (
                                <>
                                    <HiOutlineUpload size={24} style={{ color: 'var(--text-tertiary)', marginBottom: 8 }} />
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>Click to upload {receipts.length > 0 ? 'more receipts' : 'receipt'}</p>
                                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>PDF, JPG, PNG — max 5MB</p>
                                </>
                            )}
                        </div>
                        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={handleFileChange} />
                    </div>

                    {/* Policy Warning */}
                    {policyWarning && (
                        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                <HiOutlineExclamation size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                                <p style={{ margin: 0, fontSize: 13, color: '#92400e' }}>{policyWarning}</p>
                            </div>
                        </div>
                    )}

                    {/* Duplicate Warning */}
                    {duplicateWarning && (
                        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444', borderRadius: 8, padding: '12px 16px' }}>
                            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#7f1d1d', fontWeight: 600 }}>⚠ Possible Duplicate</p>
                            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#991b1b' }}>
                                A similar expense claim ({duplicateWarning.claimNumber}) already exists for this date, amount and category.
                            </p>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#7f1d1d' }}>
                                <input type="checkbox" checked={confirmDuplicate} onChange={e => setConfirmDuplicate(e.target.checked)} />
                                I confirm this is a different expense
                            </label>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                            className="btn btn-primary"
                            onClick={submitClaim}
                            disabled={submitting || saving || uploadingFile}
                            style={{ width: '100%' }}
                        >
                            {submitting ? 'Submitting...' : 'Submit Claim'}
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={saveDraft}
                            disabled={submitting || saving || uploadingFile}
                            style={{ width: '100%' }}
                        >
                            {saving ? 'Saving...' : 'Save as Draft'}
                        </button>
                        <button className="btn btn-secondary" onClick={() => navigate('/expenses')} style={{ width: '100%' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
