const router = require('express').Router();
const { checkIn, checkOut, getMyAttendance, getTodayStatus, getAllAttendance, verifyLocation, getEmployeeAttendance } = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.post('/checkin', checkIn);
router.post('/verify-location', verifyLocation);
router.post('/checkout', checkOut);
router.get('/my', getMyAttendance);
router.get('/today', getTodayStatus);
router.get('/all', authorize('SuperAdmin', 'HRAdmin', 'Manager'), getAllAttendance);
router.get('/employee/:id', authorize('SuperAdmin', 'HRAdmin', 'Manager'), getEmployeeAttendance);

module.exports = router;
