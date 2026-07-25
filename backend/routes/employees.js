const router = require('express').Router();
const { getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, getDepartments, uploadEmployeeImage, deleteEmployeeImage } = require('../controllers/employeeController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/departments/list', getDepartments);
router.route('/')
    .get(getEmployees)
    .post(authorize('SuperAdmin', 'HRAdmin'), createEmployee);
router.route('/:id')
    .get(getEmployee)
    .put(authorize('SuperAdmin', 'HRAdmin', 'Manager'), updateEmployee)
    .delete(authorize('SuperAdmin', 'HRAdmin'), deleteEmployee);
router.put('/:id/profile-image', authorize('SuperAdmin', 'HRAdmin'), uploadEmployeeImage);
router.delete('/:id/profile-image', authorize('SuperAdmin', 'HRAdmin'), deleteEmployeeImage);

module.exports = router;
