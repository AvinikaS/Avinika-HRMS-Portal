const router = require('express').Router();
const { uploadDocument, getDocuments, getMyDocuments, deleteDocument, updateStatus, updateDocument, getAllDocuments } = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.get('/', authorize('SuperAdmin', 'HRAdmin'), getAllDocuments);
router.post('/', uploadDocument);
router.get('/my', getMyDocuments);
router.get('/:employeeId', getDocuments);
router.put('/:id', updateDocument);
router.put('/:id/status', authorize('SuperAdmin', 'HRAdmin'), updateStatus);
router.delete('/:id', deleteDocument);

module.exports = router;
