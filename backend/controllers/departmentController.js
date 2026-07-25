const Department = require('../models/Department');

exports.getDepartments = async (req, res) => {
    try {
        const departments = await Department.find().sort({ name: 1 });
        res.json({ success: true, count: departments.length, data: departments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createDepartment = async (req, res) => {
    try {
        console.log('Creating department:', req.body);
        const department = await Department.create(req.body);
        res.status(201).json({ success: true, data: department });
    } catch (err) {
        console.error('Create department error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Department already exists' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateDepartment = async (req, res) => {
    try {
        const department = await Department.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.json({ success: true, data: department });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Department name already exists' });
        }
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteDepartment = async (req, res) => {
    try {
        const department = await Department.findByIdAndDelete(req.params.id);
        if (!department) {
            return res.status(404).json({ success: false, message: 'Department not found' });
        }
        res.json({ success: true, message: 'Department deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
