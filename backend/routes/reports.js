const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('SuperAdmin', 'HRAdmin'));

router.get('/pf-challan', reportsController.getPFReport);
router.get('/esic-challan', reportsController.getESICReport);
router.get('/form24q', reportsController.getForm24Q);
router.get('/form16', reportsController.getForm16);

module.exports = router;
