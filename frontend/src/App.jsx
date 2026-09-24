import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layout
import Sidebar from './components/Layout/Sidebar';
import Topbar from './components/Layout/Topbar';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leaves from './pages/Leaves';
import Payroll from './pages/Payroll';
import Recruitment from './pages/Recruitment';
import Performance from './pages/Performance';
import Settings from './pages/Settings';
import Documents from './pages/Documents';
import DocumentApprovals from './pages/DocumentApprovals';
import CareersPage from './pages/CareersPage';
import LandingPage from './pages/LandingPage';
import ForgotPassword from './pages/ForgotPassword';
import FeaturesPage from './pages/Features';
import RecruitmentInfoPage from './pages/RecruitmentInfo';
import AboutPage from './pages/About';
import ContactPage from './pages/Contact';

// Payroll Sub-Modules
import BonusModule from './pages/payroll/BonusModule';
import IncentiveModule from './pages/payroll/IncentiveModule';
import AdvanceSalary from './pages/payroll/AdvanceSalary';
import LoanManagement from './pages/payroll/LoanManagement';
import IncomeTax from './pages/payroll/IncomeTax';
import ComplianceReports from './pages/payroll/ComplianceReports';
import BankAdvice from './pages/payroll/BankAdvice';
import ExitManagement from './pages/payroll/ExitManagement';
import Resignation from './pages/SelfService/Resignation';
import MyHelpdesk from './pages/helpdesk/MyHelpdesk';
import CreateTicket from './pages/helpdesk/CreateTicket';
import TicketDetail from './pages/helpdesk/TicketDetail';
import AdminHelpdeskDashboard from './pages/helpdesk/AdminHelpdeskDashboard';
import AdminAllTickets from './pages/helpdesk/AdminAllTickets';
import AdminTicketDetail from './pages/helpdesk/AdminTicketDetail';

// Expense & Reimbursement
import ExpenseDashboard from './pages/expense/ExpenseDashboard';
import MyExpenses from './pages/expense/MyExpenses';
import CreateExpense from './pages/expense/CreateExpense';
import ExpenseDetail from './pages/expense/ExpenseDetail';
import HRAdminExpenses from './pages/expense/admin/HRAdminExpenses';
import HRAdminExpenseDetail from './pages/expense/admin/HRAdminExpenseDetail';
import SuperAdminExpenseDashboard from './pages/expense/admin/SuperAdminExpenseDashboard';
import SuperAdminExpenseAll from './pages/expense/admin/SuperAdminExpenseAll';
import SuperAdminExpenseDetail from './pages/expense/admin/SuperAdminExpenseDetail';
import ExpenseCategories from './pages/expense/admin/ExpenseCategories';

// Self-Service
import MyAttendance from './pages/SelfService/MyAttendance';
import MyLeaves from './pages/SelfService/MyLeaves';
import MyPayslips from './pages/SelfService/MyPayslips';
import MyProfile from './pages/SelfService/MyProfile';
import MyDocuments from './pages/SelfService/MyDocuments';
import MyPerformance from './pages/SelfService/MyPerformance';
import MyLoansAndAdvances from './pages/SelfService/MyLoansAndAdvances';
import EmployeeDashboard from './pages/SelfService/EmployeeDashboard';
import Holidays from './pages/Holidays';
import HolidayCalendar from './pages/SelfService/HolidayCalendar';
function ProtectedRoute({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
    return user ? children : <Navigate to="/login" />;
}

const pageTitles = {
    '/': 'Dashboard',
    '/employees': 'Employees',
    '/attendance': 'Attendance',
    '/leaves': 'Leave Management',
    '/payroll': 'Payroll',
    '/recruitment': 'Recruitment',
    '/performance': 'Performance',
    '/settings': 'Settings',
    '/documents': 'Documents',
    '/my-attendance': 'My Attendance',
    '/my-leaves': 'My Leaves',
    '/my-payslips': 'My Payslips',
    '/my-profile': 'My Profile',
    '/my-documents': 'My Documents',
    '/my-performance': 'My Performance',
    '/my-loans': 'Loans & Advances',
    '/holidays': 'Holiday Management',
    '/holiday-calendar': 'Holiday Calendar',
    '/payroll/bonus': 'Bonus Master',
    '/payroll/incentives': 'Incentives',
    '/payroll/advances': 'Advance Salary',
    '/payroll/loans': 'Loan Management',
    '/payroll/tax': 'Income Tax',
    '/payroll/reports': 'Compliance Reports',
    '/payroll/bank-advice': 'Bank Advice File',
    '/exit-management': 'Exit Management',
    '/document-approvals': 'Document Approvals',
    '/resignation': 'Offboarding & Resignation',
    '/helpdesk': 'My Helpdesk',
    '/helpdesk/create': 'Raise Support Ticket',
    '/admin/helpdesk': 'Helpdesk Dashboard',
    '/admin/helpdesk/tickets': 'All Helpdesk Tickets',
    // Expense Module
    '/expenses': 'Expense & Reimbursement',
    '/expenses/my': 'My Expenses',
    '/expenses/create': 'New Expense Claim',
    '/admin/expenses/pending': 'Expense Approvals',
    '/superadmin/expenses': 'Expense Management',
    '/superadmin/expenses/pending': 'Pending Approvals',
    '/superadmin/expenses/all': 'All Expense Claims',
    '/superadmin/expenses/categories': 'Expense Categories',
};

function AppLayout() {
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { user, isAdmin, isManager } = useAuth();

    const location = useLocation();
    const title = pageTitles[location.pathname] || 'HRMS Portal';

    return (
        <div className="app-layout">
            <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
            <div className={`main-content ${collapsed ? 'collapsed' : ''}`}>
                <Topbar collapsed={collapsed} setMobileOpen={setMobileOpen} title={title} />
                <div className="page-content">
                    <Routes>
                        {/* Admin/Manager Routes */}
                        {(isAdmin || isManager) ? (
                            <>
                                <Route path="/" element={<Dashboard />} />
                                <Route path="/employees" element={<Employees />} />
                                <Route path="/attendance" element={<Attendance />} />
                                <Route path="/leaves" element={<Leaves />} />
                                <Route path="/payroll" element={<Payroll />} />
                                <Route path="/payroll/bonus" element={<BonusModule />} />
                                <Route path="/payroll/incentives" element={<IncentiveModule />} />
                                <Route path="/payroll/advances" element={<AdvanceSalary />} />
                                <Route path="/payroll/loans" element={<LoanManagement />} />
                                <Route path="/payroll/reports" element={<ComplianceReports />} />
                                <Route path="/payroll/bank-advice" element={<BankAdvice />} />
                                <Route path="/exit-management" element={<ExitManagement />} />
                                <Route path="/recruitment" element={<Recruitment />} />
                                <Route path="/performance" element={<Performance />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/documents" element={<Documents />} />
                                <Route path="/document-approvals" element={<DocumentApprovals />} />
                                <Route path="/holidays" element={<Holidays />} />
                                {/* Admin Helpdesk */}
                                <Route path="/admin/helpdesk" element={<AdminHelpdeskDashboard />} />
                                <Route path="/admin/helpdesk/tickets" element={<AdminAllTickets />} />
                                <Route path="/admin/helpdesk/tickets/:id" element={<AdminTicketDetail />} />
                                {/* Expense Approvals - HR Admin */}
                                <Route path="/admin/expenses/pending" element={<HRAdminExpenses />} />
                                <Route path="/admin/expenses/:id" element={<HRAdminExpenseDetail />} />
                                {/* Expense Management - Super Admin */}
                                <Route path="/superadmin/expenses" element={<SuperAdminExpenseDashboard />} />
                                <Route path="/superadmin/expenses/pending" element={<SuperAdminExpenseAll />} />
                                <Route path="/superadmin/expenses/all" element={<SuperAdminExpenseAll />} />
                                <Route path="/superadmin/expenses/categories" element={<ExpenseCategories />} />
                                <Route path="/superadmin/expenses/:id" element={<SuperAdminExpenseDetail />} />
                            </>
                        ) : null}

                        {/* Self-Service Routes (available to all) */}
                        <Route path={isAdmin || isManager ? '/my-attendance' : '/my-attendance'} element={<MyAttendance />} />
                        <Route path="/my-leaves" element={<MyLeaves />} />
                        <Route path="/my-payslips" element={<MyPayslips />} />
                        <Route path="/my-profile" element={<MyProfile />} />
                        <Route path="/my-documents" element={<MyDocuments />} />
                        <Route path="/payroll/tax" element={<IncomeTax />} />
                        <Route path="/my-performance" element={<MyPerformance />} />
                        <Route path="/my-loans" element={<MyLoansAndAdvances />} />
                        <Route path="/resignation" element={<Resignation />} />
                        <Route path="/holiday-calendar" element={<HolidayCalendar />} />
                        {/* Employee Helpdesk */}
                        <Route path="/helpdesk" element={<MyHelpdesk />} />
                        <Route path="/helpdesk/create" element={<CreateTicket />} />
                        <Route path="/helpdesk/tickets/:id" element={<TicketDetail />} />
                        {/* Employee Expense & Reimbursement */}
                        <Route path="/expenses" element={<ExpenseDashboard />} />
                        <Route path="/expenses/my" element={<MyExpenses />} />
                        <Route path="/expenses/create" element={<CreateExpense />} />
                        <Route path="/expenses/:id" element={<ExpenseDetail />} />
                        {/* Employee-only default */}
                        {!isAdmin && !isManager && <Route path="/" element={<EmployeeDashboard />} />}

                        <Route path="*" element={<Navigate to="/" />} />
                    </Routes>
                </div>
            </div>
        </div>
    );
}

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

export default function App() {
    return (
        <AuthProvider>
            <Router>
                <ScrollToTop />
                <AppRoutes />
                <ToastContainer position="top-right" autoClose={3000} hideProgressBar closeOnClick pauseOnHover />
            </Router>
        </AuthProvider>
    );
}

function AppRoutes() {
    const { user, loading } = useAuth();
    if (loading) return <div className="page-loader"><div className="spinner"></div></div>;
    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/forgot-password" element={user ? <Navigate to="/" /> : <ForgotPassword />} />
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/careers/:slug" element={<CareersPage />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/recruitment-info" element={<RecruitmentInfoPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            {user ? (
                <Route path="/*" element={<ProtectedRoute><AppLayout /></ProtectedRoute>} />
            ) : (
                <>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </>
            )}
        </Routes>
    );
}
