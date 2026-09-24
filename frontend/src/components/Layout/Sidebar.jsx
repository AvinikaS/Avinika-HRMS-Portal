import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineViewGrid, HiOutlineUserGroup, HiOutlineClock, HiOutlineCalendar,
    HiOutlineCurrencyDollar, HiOutlineBriefcase, HiOutlineChartBar,
    HiOutlineDocumentText, HiOutlineCog, HiOutlineChevronLeft, HiOutlineChevronRight,
    HiOutlineClipboardCheck, HiOutlineUser, HiOutlineCash, HiOutlineCreditCard, HiOutlineGift, HiOutlineTrendingUp, HiOutlineChevronDown, HiOutlineChevronUp,
    HiOutlineSupport
} from 'react-icons/hi';

const adminNavItems = [
    { section: 'Main' },
    { path: '/', label: 'Dashboard', icon: HiOutlineViewGrid },
    { section: 'HR Management' },
    { path: '/employees', label: 'Employees', icon: HiOutlineUserGroup },
    { path: '/attendance', label: 'Attendance', icon: HiOutlineClock },
    { path: '/leaves', label: 'Leave Management', icon: HiOutlineCalendar },
    {
        label: 'Payroll', icon: HiOutlineCurrencyDollar, children: [
            { path: '/payroll', label: 'Payroll Processing' },
            { path: '/payroll/bank-advice', label: 'Bank Advice File' },
            { path: '/payroll/bonus', label: 'Bonus' },
            { path: '/payroll/incentives', label: 'Incentive' },
            { path: '/payroll/loans', label: 'Loan' },
            { path: '/payroll/advances', label: 'Advance Salary' },
            { path: '/payroll/tax', label: 'Income Tax & Form 16' },
            { path: '/payroll/reports?tab=pf', label: 'PF Challan' },
            { path: '/payroll/reports?tab=esic', label: 'ESIC Challan' },
            { path: '/payroll/reports?tab=form24q', label: 'Form 24Q' },
        ]
    },
    {
        label: 'Exit Management', icon: HiOutlineClipboardCheck, children: [
            { path: '/exit-management?tab=pending', label: 'Resignation' },
            { path: '/exit-management?tab=checklist', label: 'Exit Checklist & Assets' },
            { path: '/exit-management?tab=fnf', label: 'F&F Settlement & Gratuity' },
        ]
    },
    { path: '/performance', label: 'Performance', icon: HiOutlineChartBar },
    { section: 'Recruitment' },
    { path: '/recruitment', label: 'Recruitment', icon: HiOutlineBriefcase },
    { section: 'System' },
    {
        label: 'Documents', icon: HiOutlineDocumentText, children: [
            { path: '/documents', label: 'Employee Vault' },
            { path: '/document-approvals', label: 'Approvals & Pending' },
        ]
    },
    { path: '/settings', label: 'Settings', icon: HiOutlineCog },
    { path: '/holidays', label: 'Holidays', icon: HiOutlineCalendar },
    { section: 'Helpdesk' },
    {
        label: 'HR Helpdesk', icon: HiOutlineSupport, children: [
            { path: '/admin/helpdesk', label: 'Dashboard' },
            { path: '/admin/helpdesk/tickets', label: 'All Tickets' },
        ]
    },
    { section: 'Expense' },
    {
        label: 'Expense Management', icon: HiOutlineCash, children: [
            { path: '/superadmin/expenses', label: 'Dashboard' },
            { path: '/superadmin/expenses/pending', label: 'Pending Approval' },
            { path: '/superadmin/expenses/all', label: 'All Expenses' },
            { path: '/superadmin/expenses/categories', label: 'Categories' },
            { path: '/admin/expenses/pending', label: 'Expense Approvals' },
        ]
    },
    { section: 'Account' },
    { path: '/my-profile', label: 'My Profile', icon: HiOutlineUser },
];

const employeeNavItems = [
    { section: 'Self Service' },
    { path: '/', label: 'My Dashboard', icon: HiOutlineViewGrid },
    { path: '/my-attendance', label: 'My Attendance', icon: HiOutlineClock },
    { path: '/my-leaves', label: 'My Leaves', icon: HiOutlineCalendar },
    { path: '/my-payslips', label: 'My Payslips', icon: HiOutlineCurrencyDollar },
    { path: '/my-profile', label: 'My Profile', icon: HiOutlineUser },
    { path: '/my-documents', label: 'My Documents', icon: HiOutlineDocumentText },
    { path: '/my-loans', label: 'Loans & Advances', icon: HiOutlineCurrencyDollar },
    { path: '/payroll/tax', label: 'Tax Declarations', icon: HiOutlineDocumentText },
    { path: '/my-performance', label: 'Performance', icon: HiOutlineClipboardCheck },
    { path: '/holiday-calendar', label: 'Holiday Calendar', icon: HiOutlineCalendar },
    { path: '/resignation', label: 'Resignation', icon: HiOutlineChevronRight },
    { section: 'Support' },
    { path: '/helpdesk', label: 'HR Helpdesk', icon: HiOutlineSupport },
    { path: '/expenses', label: 'Expense & Reimbursement', icon: HiOutlineCash },
];

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
    const { user, isAdmin, isManager } = useAuth();
    const location = useLocation();
    const [expanded, setExpanded] = useState({});

    let navItems = isAdmin || isManager ? adminNavItems : employeeNavItems;

    // Filter SuperAdmin specific routes for HRAdmin
    if (user?.role === 'HRAdmin') {
        navItems = navItems.map(item => {
            if (item.label === 'Expense Management' && item.children) {
                return {
                    ...item,
                    children: item.children.filter(child => !child.path.startsWith('/superadmin/'))
                };
            }
            return item;
        });
    }

    // Filter HRAdmin specific routes for SuperAdmin
    if (user?.role === 'SuperAdmin') {
        navItems = navItems.map(item => {
            if (item.label === 'Expense Management' && item.children) {
                return {
                    ...item,
                    children: item.children.filter(child => child.path !== '/admin/expenses/pending')
                };
            }
            return item;
        });
    }

    return (
        <>
            <div className={`mobile-overlay ${mobileOpen ? 'active' : ''}`} onClick={() => setMobileOpen(false)} />
            <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-logo">
                    <div className="logo-icon">H</div>
                    <span className="logo-text">HRMS Portal</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item, i) => {
                        if (item.section) return <div key={i} className="nav-section-title">{item.section}</div>;

                        if (item.children) {
                            const isActiveGroup = item.children.some(child => location.pathname === child.path.split('?')[0]);
                            const isExpanded = expanded[item.label] !== undefined ? expanded[item.label] : isActiveGroup;

                            return (
                                <div key={i}>
                                    <div
                                        className={`nav-item ${isActiveGroup ? 'active-group' : ''}`}
                                        onClick={() => setExpanded({ ...expanded, [item.label]: !isExpanded })}
                                        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span className="nav-icon"><item.icon /></span>
                                            <span className="nav-text">{item.label}</span>
                                        </div>
                                        {!collapsed && (isExpanded ? <HiOutlineChevronUp size={14} /> : <HiOutlineChevronDown size={14} />)}
                                    </div>
                                    {isExpanded && !collapsed && (
                                        <div className="submenu" style={{ background: 'rgba(0,0,0,0.02)', padding: '4px 0' }}>
                                            {item.children.map(child => {
                                                const searchParams = new URLSearchParams(location.search);
                                                let currentTab = searchParams.get('tab');
                                                if (!currentTab) {
                                                    if (location.pathname === '/exit-management') currentTab = 'pending';
                                                    if (location.pathname === '/payroll/reports') currentTab = 'pf';
                                                }
                                                const childPathOnly = child.path.split('?')[0];
                                                const childQuery = child.path.split('?')[1];
                                                const childTargetTab = childQuery ? new URLSearchParams(childQuery).get('tab') : null;

                                                const isChildActive = childTargetTab
                                                    ? location.pathname === childPathOnly && currentTab === childTargetTab
                                                    : location.pathname === childPathOnly && !currentTab;

                                                return (
                                                    <NavLink
                                                        key={child.label}
                                                        to={child.path}
                                                        className={() => `nav-item ${isChildActive ? 'active' : ''}`}
                                                        style={{ paddingLeft: '48px', margin: '2px 12px', fontSize: '13px', minHeight: '36px' }}
                                                        onClick={() => setMobileOpen(false)}
                                                    >
                                                        <span className="nav-text">{child.label}</span>
                                                    </NavLink>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                end={item.path === '/'}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                                onClick={() => setMobileOpen(false)}
                            >
                                <span className="nav-icon"><item.icon /></span>
                                <span className="nav-text">{item.label}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? <HiOutlineChevronRight size={20} /> : <HiOutlineChevronLeft size={20} />}
                </button>
            </aside>
        </>
    );
}
