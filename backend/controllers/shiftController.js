const Shift = require('../models/Shift');

exports.createShift = async (req, res) => {
    try {
        const shift = await Shift.create(req.body);
        res.status(201).json({ success: true, data: shift });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getShifts = async (req, res) => {
    try {
        const shifts = await Shift.find().sort({ name: 1 });
        res.json({ success: true, data: shifts });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateShift = async (req, res) => {
    try {
        const shift = await Shift.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
        res.json({ success: true, data: shift });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteShift = async (req, res) => {
    try {
        await Shift.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Shift deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
