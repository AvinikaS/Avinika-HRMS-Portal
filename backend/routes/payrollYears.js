const express = require('express');
const router = express.Router();
const { getYears, createYear, updateYear, deleteYear } = require('../controllers/payrollYearController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getYears);
router.post('/', protect, authorize('SuperAdmin', 'HRAdmin'), createYear);
router.put('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), updateYear);
router.delete('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), deleteYear);

module.exports = router;
