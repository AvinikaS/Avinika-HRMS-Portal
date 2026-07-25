import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { HiOutlineX, HiOutlinePencil, HiOutlineTrash, HiOutlineCog } from 'react-icons/hi';

export function useYearManager() {
    const [years, setYears] = useState([]);
    const [showYearModal, setShowYearModal] = useState(false);

    const fetchYears = async () => {
        try {
            const { data } = await api.get('/payroll-years');
            setYears(data.data || []);
        } catch { }
    };

    useEffect(() => {
        fetchYears();
    }, []);

    return { years, showYearModal, setShowYearModal, fetchYears };
}

export function YearManagerModal({ showYearModal, setShowYearModal, years, fetchYears }) {
    const [yearForm, setYearForm] = useState({ year: '' });
    const [editingYear, setEditingYear] = useState(null);
    const [yearLoading, setYearLoading] = useState(false);

    if (!showYearModal) return null;

    return (
        <div className="modal-overlay" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                <div className="modal-header">
                    <h2>Manage Payroll Years</h2>
                    <button className="btn btn-icon btn-secondary" onClick={() => { setShowYearModal(false); setEditingYear(null); setYearForm({ year: '' }); }}><HiOutlineX /></button>
                </div>
                <div className="modal-body">
                    <form onSubmit={async (e) => {
                        e.preventDefault();
                        setYearLoading(true);
                        try {
                            if (editingYear) {
                                await api.put(`/payroll-years/${editingYear._id}`, yearForm);
                            } else {
                                await api.post('/payroll-years', yearForm);
                            }
                            setYearForm({ year: '' });
                            setEditingYear(null);
                            fetchYears();
                        } catch (err) {
                            const msg = err.response?.data?.message || err.message || 'Operation failed';
                            toast.error(msg);
                        }
                        setYearLoading(false);
                    }} style={{ marginBottom: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 12 }}>
                        <div className="form-group">
                            <label className="form-label">Year (YYYY)</label>
                            <input type="number" className="form-control" value={yearForm.year} onChange={e => setYearForm({ year: e.target.value })} required placeholder="e.g. 2025" min="2000" max="2100" />
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="submit" className="btn btn-primary" disabled={yearLoading} style={{ flex: 1 }}>
                                {editingYear ? 'Update Year' : 'Add Year'}
                            </button>
                            {editingYear && (
                                <button type="button" className="btn btn-secondary" onClick={() => { setEditingYear(null); setYearForm({ year: '' }); }}>Cancel</button>
                            )}
                        </div>
                    </form>

                    <div style={{ maxHeight: 300, overflowY: 'auto', overflowX: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'auto' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                    <th style={{ padding: 10, fontSize: 12 }}>Year</th>
                                    <th style={{ padding: 10, fontSize: 12, textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {years.length === 0 ? (
                                    <tr><td colSpan="2" style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No years added yet.</td></tr>
                                ) : years.map(y => (
                                    <tr key={y._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: 10, fontWeight: 600 }}>{y.year}</td>
                                        <td style={{ padding: 10, textAlign: 'right' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditingYear(y); setYearForm({ year: y.year }); }} style={{ marginRight: 6, fontSize: 10 }}>
                                                <HiOutlinePencil size={12} style={{ marginRight: 4 }} /> Edit
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={async () => {
                                                const _swalRes = await Swal.fire({ title: 'Please Confirm', text: `Delete ${y.year} year?`, icon: 'warning', showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#ef4444' });
                                                if (!_swalRes.isConfirmed) return;
                                                try { await api.delete(`/payroll-years/${y._id}`); fetchYears(); } catch { }
                                            }} style={{ color: '#ef4444', fontSize: 10 }}>
                                                <HiOutlineTrash size={12} style={{ marginRight: 4 }} /> Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function YearSelectDropdown({ value, onChange, years, setShowYearModal }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select className="form-control" style={{ width: 120 }} value={value} onChange={e => onChange(e.target.value)}>
                <option value="">All Years</option>
                {years.map(y => <option key={y._id} value={y.year}>{y.year}</option>)}
                {years.length === 0 && <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>}
            </select>
            <button className="btn btn-icon btn-secondary" onClick={() => setShowYearModal(true)} title="Manage Years" style={{ flexShrink: 0, width: '42px', minWidth: '42px', padding: 0, display: 'flex', justifyContent: 'center' }}>
                <HiOutlineCog />
            </button>
        </div>
    );
}
