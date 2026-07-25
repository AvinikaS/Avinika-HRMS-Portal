const express = require('express');
const router = express.Router();
const advanceController = require('../controllers/advanceSalaryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', advanceController.getAdvances);
router.post('/', advanceController.applyAdvance);
router.put('/:id/status', authorize('SuperAdmin', 'HRAdmin'), advanceController.updateAdvanceStatus);
router.put('/:id', advanceController.updateAdvance);
router.delete('/:id', advanceController.deleteAdvance);

module.exports = router;
