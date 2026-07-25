const router = require('express').Router();
const { generatePayroll, getAllPayroll, getMyPayslips, markAsPaid, downloadPayslip } = require('../controllers/payrollController');
const { protect, authorize } = require('../middleware/auth');
const payrollController = require('../controllers/payrollController');
const esicController = require('../controllers/esicController');
const pfController = require('../controllers/pfController');

router.use(protect);
router.post('/generate', authorize('SuperAdmin', 'HRAdmin'), generatePayroll);
router.get('/', authorize('SuperAdmin', 'HRAdmin'), getAllPayroll);

// Form 24Q Routes
const form24qCtrl = require('../controllers/form24qController');
router.get('/form24q', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.getSummary);
router.post('/form24q/challan', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.saveChallan);
router.put('/form24q/challan/:id', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.updateChallan);
router.get('/form24q/annexure2', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.getAnnexure2);
router.post('/form24q/generate', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.generateReturn);
router.get('/form24q/available-payrolls', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.getAvailablePayrollsForMonth);
router.post('/form24q/filing-details', authorize('SuperAdmin', 'HRAdmin'), form24qCtrl.saveFilingDetails);

// ESIC Routes
const esicCtrl = require('../controllers/esicController');
router.get('/esic-challan/period-summary/export', authorize('SuperAdmin', 'HRAdmin'), esicCtrl.exportPeriodSummaryPdf);
router.get('/esic-challan/period-summary', authorize('SuperAdmin', 'HRAdmin'), esicCtrl.getPeriodSummary);
router.get('/esic-challan', authorize('SuperAdmin', 'HRAdmin'), esicCtrl.getSummary);
router.post('/esic-challan/payment-details', authorize('SuperAdmin', 'HRAdmin'), esicCtrl.updatePaymentDetails);

// PF Challan Routes
router.get('/pf-challan', protect, authorize('SuperAdmin', 'HRAdmin'), pfController.getChallanSummary);
router.post('/pf-challan/generate', protect, authorize('SuperAdmin', 'HRAdmin'), pfController.generateEcr);
router.get('/pf-challan/ecr-file', protect, authorize('SuperAdmin', 'HRAdmin'), pfController.downloadEcrFile);
router.post('/pf-challan/payment-details', protect, authorize('SuperAdmin', 'HRAdmin'), pfController.updatePaymentDetails);
router.get('/pf-challans', protect, authorize('SuperAdmin', 'HRAdmin'), pfController.getChallansList);
router.get('/pf-challan/export', protect, authorize('SuperAdmin', 'HRAdmin'), pfController.exportPdf);

router.get('/my', getMyPayslips);
router.get('/:id/download', downloadPayslip);
router.put('/:id/pay', authorize('SuperAdmin', 'HRAdmin'), markAsPaid);

// Form 16 Routes
const form16Ctrl = require('../controllers/form16Controller');
router.get('/form16/my', form16Ctrl.getMyForm16s);
router.get('/form16', authorize('SuperAdmin', 'HRAdmin'), form16Ctrl.getForm16List);
router.post('/form16/generate', authorize('SuperAdmin', 'HRAdmin'), form16Ctrl.generateForm16);
router.get('/form16/download/:employeeId', authorize('SuperAdmin', 'HRAdmin', 'Employee'), form16Ctrl.downloadForm16);
router.post('/form16/send', authorize('SuperAdmin', 'HRAdmin'), form16Ctrl.sendToEmployee);

module.exports = router;
