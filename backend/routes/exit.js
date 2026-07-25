const express = require('express');
const router = express.Router();
const exitController = require('../controllers/exitController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Employee Self-Service / Request submission
router.get('/resignation-status', exitController.getResignationStatus);
router.post('/resignation', exitController.submitResignation);

// Admin Exit Management Routes
router.get('/', authorize('SuperAdmin', 'HRAdmin'), exitController.getAllExits);
router.put('/:id', authorize('SuperAdmin', 'HRAdmin'), exitController.updateExitRequest);
router.put('/:id/status', authorize('SuperAdmin', 'HRAdmin'), exitController.updateExitStatus);
router.put('/:id/checklist', authorize('SuperAdmin', 'HRAdmin'), exitController.updateChecklist);
router.put('/:id/fnf', authorize('SuperAdmin', 'HRAdmin'), exitController.calculateFnFLegacy); // legacy wrapper

// Core Exit calculations & workflow endpoints
router.get('/gratuity-check/:employeeId', authorize('SuperAdmin', 'HRAdmin'), exitController.gratuityCheck);
router.get('/ff-calculation/:employeeId', authorize('SuperAdmin', 'HRAdmin'), exitController.getFFCalculation);
router.post('/ff-approve', authorize('SuperAdmin', 'HRAdmin'), exitController.approveFF);
router.post('/mark-paid', authorize('SuperAdmin', 'HRAdmin'), exitController.markPaid);
router.post('/complete', authorize('SuperAdmin', 'HRAdmin'), exitController.completeExit);

// Document Generation PDF endpoint (supports both self-service types and admin ID downloads)
router.get('/documents/:typeOrId', (req, res, next) => {
    const knownTypes = ['ff-letter', 'experience-letter', 'relieving-letter', 'gratuity-sheet', 'ff_letter', 'experience_letter', 'relieving_letter', 'gratuity_sheet'];
    if (knownTypes.includes(req.params.typeOrId)) {
        return exitController.downloadSelfDocument(req, res, next);
    } else {
        return authorize('SuperAdmin', 'HRAdmin')(req, res, () => {
            exitController.generateDocument(req, res, next);
        });
    }
});

module.exports = router;
