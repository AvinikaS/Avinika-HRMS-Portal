const express = require('express');
const router = express.Router();
const incentiveController = require('../controllers/incentiveController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', incentiveController.getIncentives);
router.post('/', authorize('SuperAdmin', 'HRAdmin'), incentiveController.createIncentive);
router.post('/bulk', authorize('SuperAdmin', 'HRAdmin'), incentiveController.createBulkIncentive);
router.post('/bulk-action', authorize('SuperAdmin', 'HRAdmin'), incentiveController.bulkAction);
router.put('/:id/status', authorize('SuperAdmin', 'HRAdmin'), incentiveController.updateIncentiveStatus);
router.put('/:id', authorize('SuperAdmin', 'HRAdmin'), incentiveController.updateIncentive);
router.delete('/:id', authorize('SuperAdmin', 'HRAdmin'), incentiveController.deleteIncentive);

module.exports = router;
