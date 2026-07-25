const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/holidayController');
const { protect, authorize } = require('../middleware/auth');

// ── Public/Employee (logged-in) ──────────────────────────────
router.get('/employee', protect, ctrl.getEmployeeHolidays);
router.get('/check-date', protect, ctrl.checkHolidayByDate);
router.get('/upcoming', protect, ctrl.getUpcomingHolidays);

// ── Admin / HR only ──────────────────────────────────────────
router.get('/payroll-data', protect, authorize('SuperAdmin', 'HRAdmin'), ctrl.getHolidaysForPayroll);
router.post('/auto-fill', protect, authorize('SuperAdmin', 'HRAdmin'), ctrl.autoFillHolidays);
router.get('/', protect, ctrl.getHolidays);
router.post('/', protect, authorize('SuperAdmin', 'HRAdmin'), ctrl.createHoliday);
router.put('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), ctrl.updateHoliday);
router.delete('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), ctrl.deleteHoliday);

module.exports = router;
