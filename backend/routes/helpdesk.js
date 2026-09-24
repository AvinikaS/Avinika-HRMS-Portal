const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const {
    createTicket, getMyTickets, getMyTicketSummary, getMyTicketDetail,
    updateMyTicket, deleteMyTicket,
    employeeReply, employeeCloseTicket, employeeReopenTicket, submitFeedback,
    getCategories,
    adminDashboard, adminGetAllTickets, adminGetTicketDetail,
    adminUpdateStatus, adminUpdatePriority, adminAssignTicket,
    adminReply, adminInternalNote,
    getHRUsers, adminGetCategories, adminCreateCategory, adminUpdateCategory
} = require('../controllers/helpdeskController');

router.use(protect);

// ============================
// PUBLIC (all authenticated)
// ============================
router.get('/categories', getCategories);

// ============================
// EMPLOYEE ROUTES
// ============================
router.post('/tickets', createTicket);
router.get('/tickets/my', getMyTickets);
router.get('/tickets/my/summary', getMyTicketSummary);
router.get('/tickets/:id', getMyTicketDetail);
router.put('/tickets/:id', updateMyTicket);
router.delete('/tickets/:id', deleteMyTicket);
router.post('/tickets/:id/reply', employeeReply);
router.post('/tickets/:id/close', employeeCloseTicket);
router.post('/tickets/:id/reopen', employeeReopenTicket);
router.post('/tickets/:id/feedback', submitFeedback);

// ============================
// ADMIN ROUTES (SuperAdmin + HRAdmin only)
// ============================
const adminOnly = authorize('SuperAdmin', 'HRAdmin');

router.get('/admin/dashboard', adminOnly, adminDashboard);
router.get('/admin/tickets', adminOnly, adminGetAllTickets);
router.get('/admin/tickets/:id', adminOnly, adminGetTicketDetail);
router.patch('/admin/tickets/:id/status', adminOnly, adminUpdateStatus);
router.patch('/admin/tickets/:id/priority', adminOnly, adminUpdatePriority);
router.patch('/admin/tickets/:id/assign', adminOnly, adminAssignTicket);
router.post('/admin/tickets/:id/reply', adminOnly, adminReply);
router.post('/admin/tickets/:id/internal-note', adminOnly, adminInternalNote);
router.get('/admin/hr-users', adminOnly, getHRUsers);
router.get('/admin/categories', adminOnly, adminGetCategories);
router.post('/admin/categories', adminOnly, adminCreateCategory);
router.patch('/admin/categories/:id', adminOnly, adminUpdateCategory);

module.exports = router;
