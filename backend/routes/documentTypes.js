const express = require('express');
const router = express.Router();
const { getDocumentTypes, createDocumentType, updateDocumentType, deleteDocumentType } = require('../controllers/documentTypeController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getDocumentTypes);
router.post('/', protect, authorize('SuperAdmin', 'HRAdmin'), createDocumentType);
router.put('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), updateDocumentType);
router.delete('/:id', protect, authorize('SuperAdmin', 'HRAdmin'), deleteDocumentType);

module.exports = router;
