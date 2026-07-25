const router = require('express').Router();
const { getDashboardStats } = require('../controllers/dashboardController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, authorize('SuperAdmin', 'HRAdmin', 'Manager'), getDashboardStats);

module.exports = router;
