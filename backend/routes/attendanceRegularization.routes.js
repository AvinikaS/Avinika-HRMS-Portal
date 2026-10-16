const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceRegularization.controller');

// EMPLOYEE ROUTES
router.post('/attendance/regularization', protect, ctrl.submitRegularization);
router.post('/attendance/regularization/:id/submit', protect, ctrl.submitDraftRegularization);
router.get('/attendance/regularization/my', protect, ctrl.getMyRegularizations);
router.get('/attendance/regularization/:id', protect, ctrl.getRegularizationById);
router.post('/attendance/regularization/:id/respond', protect, ctrl.respondToInformationRequest);
router.post('/attendance/regularization/:id/cancel', protect, ctrl.cancelRegularization);
router.get('/attendance/audit/:attendanceId', protect, ctrl.getAttendanceAuditLogs);

// HR ADMIN ROUTES
router.get('/hradmin/regularization/pending', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getPendingRegularizations);
router.get('/hradmin/regularization/all', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getAllRegularizationsAdmin);
router.get('/hradmin/regularization/:id', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getRegularizationDetailAdmin);
router.post('/hradmin/regularization/:id/approve', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.approveRegularization);
router.post('/hradmin/regularization/:id/reject', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.rejectRegularization);
router.post('/hradmin/regularization/:id/request-info', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.requestInfoRegularization);
router.get('/hradmin/attendance/audit/:employeeId', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getEmployeeAuditLogsAdmin);

// SUPER ADMIN / HR ADMIN ROUTES
router.get('/superadmin/regularization/all', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getAllRegularizationsAdmin);
router.post('/superadmin/regularization/:id/override', protect, authorize('SuperAdmin'), ctrl.overrideRegularization);
router.get('/superadmin/attendance/audit/:employeeId', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getEmployeeAuditLogsAdmin);

module.exports = router;
