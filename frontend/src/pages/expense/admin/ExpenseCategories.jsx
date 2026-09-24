import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../../utils/api';
import { HiOutlinePlus, HiOutlineRefresh, HiOutlinePencil } from 'react-icons/hi';

export default function ExpenseCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: '', code: '', description: '',
        receiptRequired: true, maxAmount: '', monthlyLimit: '', isActive: true
    });

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/expenses/superadmin/categories');
            if (data.success) setCategories(data.data);
        } catch { }
        setLoading(false);
    };

    useEffect(() => { fetchCategories(); }, []);

    const openAdd = () => {
        setEditing(null);
        setForm({ name: '', code: '', description: '', receiptRequired: true, maxAmount: '', monthlyLimit: '', isActive: true });
        setShowModal(true);
    };

    const openEdit = (cat) => {
        setEditing(cat);
        setForm({
            name: cat.name,
            code: cat.code,
            description: cat.description || '',
            receiptRequired: cat.receiptRequired,
            maxAmount: cat.maxAmount || '',
            monthlyLimit: cat.monthlyLimit || '',
            isActive: cat.isActive
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('Category name is required.'); return; }
        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                code: form.code.trim() || undefined,
                description: form.description,
                receiptRequired: form.receiptRequired,
                maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
                monthlyLimit: form.monthlyLimit ? Number(form.monthlyLimit) : null,
                isActive: form.isActive
            };

            let data;
            if (editing) {
                ({ data } = await api.patch(`/expenses/superadmin/categories/${editing._id}`, payload));
            } else {
                ({ data } = await api.post('/expenses/superadmin/categories', payload));
            }

            if (data.success) {
                toast.success(editing ? 'Category updated!' : 'Category created!');
                setShowModal(false);
                fetchCategories();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save.');
        }
        setSaving(false);
    };

    const toggleActive = async (cat) => {
        try {
            const { data } = await api.patch(`/expenses/superadmin/categories/${cat._id}`, { isActive: !cat.isActive });
            if (data.success) { toast.success(`Category ${data.data.isActive ? 'activated' : 'deactivated'}!`); fetchCategories(); }
        } catch (err) { toast.error(err.response?.data?.message || 'Failed.'); }
    };

    return (
        <div className="animate-fadeIn">
            <div className="page-header">
                <div>
                    <h1>Expense Categories</h1>
                    <p>Manage expense categories, limits, and receipt requirements</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={fetchCategories}><HiOutlineRefresh /></button>
                    <button className="btn btn-primary" onClick={openAdd}><HiOutlinePlus /> Add Category</button>
                </div>
            </div>

            <div className="card" style={{ padding: 0 }}>
                <div className="table-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ fontSize: 15 }}>{categories.length} Categories</h3>
                </div>

                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto 16px' }} /></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Code</th>
                                    <th>Description</th>
                                    <th>Receipt Required</th>
                                    <th>Max Amount</th>
                                    <th>Monthly Limit</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categories.map(cat => (
                                    <tr key={cat._id}>
                                        <td><strong>{cat.name}</strong></td>
                                        <td><code style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{cat.code}</code></td>
                                        <td style={{ maxWidth: 200, fontSize: 12, color: 'var(--text-secondary)' }}>{cat.description || '—'}</td>
                                        <td>
                                            <span className={`badge ${cat.receiptRequired ? 'badge-danger' : 'badge-neutral'}`}>
                                                {cat.receiptRequired ? 'Required' : 'Optional'}
                                            </span>
                                        </td>
                                        <td>{cat.maxAmount ? `₹${cat.maxAmount.toLocaleString('en-IN')}` : '—'}</td>
                                        <td>{cat.monthlyLimit ? `₹${cat.monthlyLimit.toLocaleString('en-IN')}` : '—'}</td>
                                        <td>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={cat.isActive}
                                                    onChange={() => toggleActive(cat)}
                                                    style={{ width: 16, height: 16 }}
                                                />
                                                <span style={{ fontSize: 12, color: cat.isActive ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                                    {cat.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </label>
                                        </td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(cat)}>
                                                <HiOutlinePencil style={{ marginRight: 4 }} /> Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="card" style={{ width: 520, maxWidth: '90vw', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h3 style={{ marginBottom: 20 }}>{editing ? 'Edit Category' : 'Add New Category'}</h3>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Category Name *</label>
                                <input type="text" className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Code (auto-generated if empty)</label>
                                <input type="text" className="form-control" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="e.g. TRAVEL" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Max Amount (₹)</label>
                                <input type="number" className="form-control" value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))} placeholder="Leave empty for no limit" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Monthly Limit (₹)</label>
                                <input type="number" className="form-control" value={form.monthlyLimit} onChange={e => setForm(f => ({ ...f, monthlyLimit: e.target.value }))} placeholder="Leave empty for no limit" />
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="form-label">Description</label>
                                <textarea className="form-control" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
                            </div>
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                    <input type="checkbox" checked={form.receiptRequired} onChange={e => setForm(f => ({ ...f, receiptRequired: e.target.checked }))} style={{ width: 16, height: 16 }} />
                                    <span className="form-label" style={{ margin: 0 }}>Receipt Required</span>
                                </label>
                            </div>
                            {editing && (
                                <div className="form-group">
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} style={{ width: 16, height: 16 }} />
                                        <span className="form-label" style={{ margin: 0 }}>Active</span>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : editing ? 'Update Category' : 'Create Category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
