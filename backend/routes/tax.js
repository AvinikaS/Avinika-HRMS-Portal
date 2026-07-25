const express = require('express');
const router = express.Router();
const taxController = require('../controllers/taxController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/profile/:employeeId?', taxController.getEmployeeTaxProfile);
router.post('/declarations', taxController.updateTaxDeclarations);

module.exports = router;
