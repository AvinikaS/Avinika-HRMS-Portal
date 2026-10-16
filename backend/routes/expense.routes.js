const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
    // Employee
    createExpense, submitExpense, getMyExpenses, getMyExpenseSummary,
    getExpenseDetail, updateExpense, cancelExpense, resubmitExpense, deleteExpense,
    getCategories, duplicateCheck,
    // HR Admin
    hrAdminGetPending, hrAdminGetHistory, hrAdminGetDetail,
    hrAdminApprove, hrAdminReject, hrAdminRequestCorrection,
    // Super Admin
    superAdminDashboard, superAdminGetPending, superAdminGetAll,
    superAdminGetDetail, superAdminApprove, superAdminReject,
    superAdminRequestCorrection, initiatePayment, confirmPayment,
    adminGetCategories, adminCreateCategory, adminUpdateCategory
} = require('../controllers/expenseController');

// All routes require authentication
router.use(protect);

router.use((req, res, next) => {
    console.log('[Expense Router Hit]', req.method, req.url);
    next();
});

// ========================
// PUBLIC (all authenticated)
// ========================
router.get('/categories', getCategories);
router.post('/duplicate-check', duplicateCheck);

// ========================
// EMPLOYEE ROUTES
// ========================
router.post('/', createExpense);
router.get('/my', getMyExpenses);
router.get('/my/summary', getMyExpenseSummary);

// ========================
// HR ADMIN ROUTES  (MUST come before /:id)
// ========================
const hrOnly = authorize('HRAdmin', 'SuperAdmin');

router.get('/hradmin/pending', hrOnly, hrAdminGetPending);
router.get('/hradmin/history', hrOnly, hrAdminGetHistory);
router.get('/hradmin/:id', hrOnly, hrAdminGetDetail);
router.post('/:id/hradmin/approve', hrOnly, hrAdminApprove);
router.post('/:id/hradmin/reject', hrOnly, hrAdminReject);
router.post('/:id/hradmin/correction', hrOnly, hrAdminRequestCorrection);

// ========================
// SUPER ADMIN ROUTES (MUST come before /:id)
// ========================
const superOnly = authorize('HRAdmin', 'SuperAdmin');

router.get('/superadmin/dashboard', superOnly, superAdminDashboard);
router.get('/superadmin/pending', superOnly, superAdminGetPending);
router.get('/superadmin/all', superOnly, superAdminGetAll);
router.get('/superadmin/categories', superOnly, adminGetCategories);
router.post('/superadmin/categories', superOnly, adminCreateCategory);
router.patch('/superadmin/categories/:id', superOnly, adminUpdateCategory);
router.get('/superadmin/:id', superOnly, superAdminGetDetail);
router.post('/:id/superadmin/approve', superOnly, superAdminApprove);
router.post('/:id/superadmin/reject', superOnly, superAdminReject);
router.post('/:id/superadmin/correction', superOnly, superAdminRequestCorrection);
router.post('/:id/payment/initiate', superOnly, initiatePayment);
router.post('/:id/payment/confirm', superOnly, confirmPayment);

// ========================
// EMPLOYEE PARAM ROUTES (after specific routes)
// ========================
router.get('/:id', getExpenseDetail);
router.put('/:id', updateExpense);
router.post('/:id/submit', submitExpense);
router.post('/:id/cancel', cancelExpense);
router.post('/:id/resubmit', resubmitExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
