const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/payrollAdjustment.controller');

// EMPLOYEE ROUTES
router.get('/payroll-adjustments/my', protect, ctrl.getMyAdjustments);

// HR ADMIN ROUTES
router.get('/hradmin/payroll-adjustments', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getHRAdminAdjustments);
router.post('/hradmin/payroll-adjustments/manual', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.createManualAdjustment);
router.post('/hradmin/payroll-adjustments/:id/approve', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.approveHRAdminAdjustment);
router.post('/hradmin/payroll-adjustments/:id/reject', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.rejectHRAdminAdjustment);

// SUPER ADMIN / HR ADMIN ROUTES
router.get('/superadmin/payroll-adjustments/all', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getAllAdjustmentsSuperAdmin);
router.get('/superadmin/payroll-adjustments/pending-approval', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.getPendingSuperAdminAdjustments);
router.post('/superadmin/payroll-adjustments/:id/approve', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.approveSuperAdminAdjustment);
router.post('/superadmin/payroll-adjustments/:id/reject', protect, authorize('HRAdmin', 'SuperAdmin'), ctrl.rejectSuperAdminAdjustment);

module.exports = router;
