const PayrollYear = require('../models/PayrollYear');

exports.getYears = async (req, res) => {
    try {
        const years = await PayrollYear.find().sort({ year: -1 });
        res.json({ success: true, count: years.length, data: years });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createYear = async (req, res) => {
    try {
        console.log('Create Year Request Body:', req.body);
        const year = await PayrollYear.create(req.body);
        res.status(201).json({ success: true, data: year });
    } catch (err) {
        console.error('Create Year Error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Year already exists' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateYear = async (req, res) => {
    try {
        console.log('Update Year Request Body:', req.body, 'ID:', req.params.id);
        const year = await PayrollYear.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!year) {
            return res.status(404).json({ success: false, message: 'Year not found' });
        }
        res.json({ success: true, data: year });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Year already exists' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteYear = async (req, res) => {
    try {
        const year = await PayrollYear.findByIdAndDelete(req.params.id);
        if (!year) {
            return res.status(404).json({ success: false, message: 'Year not found' });
        }
        res.json({ success: true, message: 'Year deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
