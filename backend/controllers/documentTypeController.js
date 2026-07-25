const DocumentType = require('../models/DocumentType');

exports.getDocumentTypes = async (req, res) => {
    try {
        const types = await DocumentType.find().sort({ name: 1 });
        res.json({ success: true, count: types.length, data: types });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createDocumentType = async (req, res) => {
    try {
        const type = await DocumentType.create(req.body);
        res.status(201).json({ success: true, data: type });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Document type already exists' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateDocumentType = async (req, res) => {
    try {
        const type = await DocumentType.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!type) {
            return res.status(404).json({ success: false, message: 'Document type not found' });
        }
        res.json({ success: true, data: type });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Document type already exists' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteDocumentType = async (req, res) => {
    try {
        const type = await DocumentType.findByIdAndDelete(req.params.id);
        if (!type) {
            return res.status(404).json({ success: false, message: 'Document type not found' });
        }
        res.json({ success: true, message: 'Document type deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
