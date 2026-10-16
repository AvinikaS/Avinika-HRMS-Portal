import React, { useState, useRef, useEffect } from 'react';

export default function EmployeeSelect({ employees, value, onChange, disabled, allowAll = true, height = '46px', style }) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedEmp = employees.find(e => e._id === value);
    const isAllSelected = value === 'ALL';

    const filtered = employees.filter(e => {
        if (!search) return true;
        const term = search.toLowerCase();
        return (
            (e.firstName || '').toLowerCase().includes(term) ||
            (e.lastName || '').toLowerCase().includes(term) ||
            (e.employeeCode || '').toLowerCase().includes(term)
        );
    });

    const getInitial = (emp) => {
        if (emp && emp.firstName) return emp.firstName.charAt(0).toUpperCase();
        return '?';
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', fontFamily: 'inherit' }}>
            {/* Main Select Button */}
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    padding: '0 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                    cursor: disabled ? 'not-allowed' : 'pointer', background: disabled ? '#f8fafc' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    height: height, minHeight: height, boxSizing: 'border-box',
                    borderColor: isOpen ? '#7c3aed' : '#cbd5e1',
                    boxShadow: isOpen ? '0 0 0 2px rgba(124, 58, 237, 0.2)' : 'none',
                    transition: 'all 0.2s', width: '100%',
                    ...style
                }}
            >
                {isAllSelected ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                            ALL
                        </div>
                        <strong style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            All Employees
                        </strong>
                    </div>
                ) : selectedEmp ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1, marginRight: '6px' }}>
                        {selectedEmp.profileImage ? (
                            <img src={selectedEmp.profileImage} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                            <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                                {getInitial(selectedEmp)}
                            </div>
                        )}
                        <strong style={{ fontSize: 13, fontWeight: 600, color: '#1f2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {selectedEmp.firstName} {selectedEmp.lastName}
                        </strong>
                        <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0, marginLeft: 'auto' }}>
                            {selectedEmp.employeeCode}
                        </span>
                    </div>
                ) : (
                    <span style={{ color: '#6b7280', fontSize: 13, fontWeight: 500 }}>Select Employee</span>
                )}

                <span style={{ flexShrink: 0, marginLeft: '4px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.2s', color: '#6b7280' }}>
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </span>
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                    background: '#fff', border: '1px solid #d1d5db', borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)', zIndex: 1000
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb' }}>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Type to search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 12px', fontSize: 13,
                                border: '1px solid #7c3aed', borderRadius: '6px',
                                outline: 'none', color: '#1f2937'
                            }}
                        />
                    </div>

                    <div style={{ maxHeight: '220px', overflowY: 'auto', padding: '4px 0' }}>
                        {allowAll && (
                            <div
                                onClick={() => { onChange('ALL'); setIsOpen(false); setSearch(''); }}
                                style={{
                                    padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    cursor: 'pointer', background: isAllSelected ? '#7c3aed' : 'transparent',
                                    color: isAllSelected ? '#fff' : '#1f2937', transition: 'background 0.1s'
                                }}
                                onMouseEnter={(e) => { if (!isAllSelected) e.currentTarget.style.background = '#f3f4f6'; }}
                                onMouseLeave={(e) => { if (!isAllSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: isAllSelected ? '#fff' : '#7c3aed', color: isAllSelected ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                                        ALL
                                    </div>
                                    <span style={{ fontSize: 13, fontWeight: isAllSelected ? 600 : 500 }}>All Employees</span>
                                </div>
                            </div>
                        )}

                        {filtered.length === 0 ? (
                            <div style={{ padding: '12px', fontSize: 13, color: '#6b7280', textAlign: 'center' }}>No employees found</div>
                        ) : (
                            filtered.map(emp => {
                                const isSelected = emp._id === value;
                                return (
                                    <div
                                        key={emp._id}
                                        onClick={() => { onChange(emp._id); setIsOpen(false); setSearch(''); }}
                                        style={{
                                            padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            cursor: 'pointer', background: isSelected ? '#7c3aed' : 'transparent',
                                            color: isSelected ? '#fff' : '#1f2937', transition: 'background 0.1s'
                                        }}
                                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f3f4f6'; }}
                                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                            {emp.profileImage ? (
                                                <img src={emp.profileImage} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                            ) : (
                                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: isSelected ? '#fff' : '#8b5cf6', color: isSelected ? '#7c3aed' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                                                    {getInitial(emp)}
                                                </div>
                                            )}
                                            <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {emp.firstName} {emp.lastName}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: 11, color: isSelected ? '#ddd6fe' : '#9ca3af', flexShrink: 0, marginLeft: '8px' }}>
                                            {emp.employeeCode}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
