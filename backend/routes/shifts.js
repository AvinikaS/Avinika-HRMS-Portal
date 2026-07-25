const router = require('express').Router();
const { createShift, getShifts, updateShift, deleteShift } = require('../controllers/shiftController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/')
    .get(getShifts)
    .post(authorize('SuperAdmin', 'HRAdmin'), createShift);
router.route('/:id')
    .put(authorize('SuperAdmin', 'HRAdmin'), updateShift)
    .delete(authorize('SuperAdmin', 'HRAdmin'), deleteShift);

module.exports = router;
