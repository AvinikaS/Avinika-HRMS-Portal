const router = require('express').Router();
const {
    applyLeave, getMyLeaves, getLeaveBalance, getPendingLeaves, approveLeave, rejectLeave,
    getAllLeaves, adjustLeaveBalance, getBalanceHistory
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.post('/', applyLeave);
router.get('/my', getMyLeaves);
router.get('/balance', getLeaveBalance);
router.get('/balance-history', getBalanceHistory);
router.get('/pending', authorize('SuperAdmin', 'HRAdmin', 'Manager'), getPendingLeaves);
router.get('/all', authorize('SuperAdmin', 'HRAdmin'), getAllLeaves);
router.post('/adjust-balance', authorize('SuperAdmin', 'HRAdmin'), adjustLeaveBalance);
router.put('/:id/approve', authorize('SuperAdmin', 'HRAdmin', 'Manager'), approveLeave);
router.put('/:id/reject', authorize('SuperAdmin', 'HRAdmin', 'Manager'), rejectLeave);

module.exports = router;
