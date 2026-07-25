const express = require('express');
const router = express.Router();
const { getDepartments, createDepartment, updateDepartment, deleteDepartment } = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getDepartments);
router.post('/', protect, authorize('SuperAdmin', 'HRAdmin'), createDepartment);
router.put('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), updateDepartment);
router.delete('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), deleteDepartment);

module.exports = router;
