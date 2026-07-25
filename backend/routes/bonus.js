const express = require('express');
const router = express.Router();
const bonusController = require('../controllers/bonusController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', bonusController.getBonuses);
router.post('/', authorize('SuperAdmin', 'HRAdmin'), bonusController.createBonus);
router.post('/bulk', authorize('SuperAdmin', 'HRAdmin'), bonusController.createBulkBonus);
router.post('/bulk-action', authorize('SuperAdmin', 'HRAdmin'), bonusController.bulkAction);
router.put('/:id/status', authorize('SuperAdmin', 'HRAdmin'), bonusController.updateBonusStatus);
router.put('/:id', authorize('SuperAdmin', 'HRAdmin'), bonusController.updateBonus);
router.delete('/:id', authorize('SuperAdmin', 'HRAdmin'), bonusController.deleteBonus);

module.exports = router;
