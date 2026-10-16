const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router.get('/', loanController.getLoans);
router.post('/', loanController.applyLoan);
router.put('/:id/status', loanController.updateLoanStatus);
router.put('/:id/settle', authorize('SuperAdmin', 'HRAdmin'), loanController.settleLoan);
router.put('/:id/restructure', authorize('SuperAdmin', 'HRAdmin'), loanController.changeRepaymentTerm);
router.put('/:id/override', authorize('SuperAdmin', 'HRAdmin'), loanController.overrideEMI);
router.put('/:id', loanController.updateLoan);
router.delete('/:id', loanController.deleteLoan);

module.exports = router;
