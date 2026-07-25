const Incentive = require('../models/Incentive');

exports.getIncentives = async (req, res) => {
    try {
        const query = req.user.role === 'Employee' ? { employee: req.user._id } : {};
        const incentives = await Incentive.find(query).populate('employee', 'firstName lastName employeeCode department profileImage');
        res.json({ success: true, data: incentives });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createIncentive = async (req, res) => {
    try {
        const incentive = new Incentive(req.body);
        await incentive.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: incentive.employee,
                title: 'Incentive Allocated',
                message: `A new incentive of ₹${incentive.amount} (${incentive.incentiveType}) has been allocated to you for ${incentive.month} ${incentive.year}.`,
                type: 'success',
                link: '/my-profile'
            });
        } catch (notifErr) {
            console.error('Notification error on incentive create:', notifErr);
        }

        res.status(201).json({ success: true, data: incentive, message: 'Incentive added successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.createBulkIncentive = async (req, res) => {
    try {
        const { employeeIds, incentiveType, amount, target, achievement, month, year, remarks } = req.body;
        if (!employeeIds || employeeIds.length === 0) return res.status(400).json({ success: false, message: 'No employees selected' });

        const toCreate = employeeIds.map(empId => ({
            employee: empId, incentiveType, amount, target, achievement, month, year, remarks, status: 'Pending'
        }));
        await Incentive.insertMany(toCreate);

        try {
            const notificationHelper = require('../utils/notificationHelper');
            for (const empId of employeeIds) {
                await notificationHelper.createNotificationForEmployee({
                    employeeId: empId,
                    title: 'Incentive Allocated',
                    message: `A new incentive of ₹${amount} (${incentiveType}) has been allocated to you for ${month} ${year}.`,
                    type: 'success',
                    link: '/my-profile'
                });
            }
        } catch (notifErr) {
            console.error('Notification error on bulk incentive create:', notifErr);
        }

        res.status(201).json({ success: true, message: `Incentive added for ${employeeIds.length} employees` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateIncentiveStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const incentive = await Incentive.findById(req.params.id);
        if (!incentive) return res.status(404).json({ success: false, message: 'Incentive not found' });
        incentive.status = status;
        await incentive.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: incentive.employee,
                title: 'Incentive Status Updated',
                message: `Your incentive of ₹${incentive.amount} (${incentive.incentiveType}) status has been updated to ${status}.`,
                type: status === 'Approved' || status === 'Paid' ? 'success' : 'info',
                link: '/my-profile'
            });
        } catch (notifErr) {
            console.error('Notification error on incentive status update:', notifErr);
        }

        res.json({ success: true, message: `Incentive marked as ${status}` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.bulkAction = async (req, res) => {
    try {
        const { ids, action } = req.body;
        if (!ids || !ids.length) return res.status(400).json({ success: false, message: 'No records selected' });
        if (action === 'Approve') {
            await Incentive.updateMany({ _id: { $in: ids } }, { status: 'Approved' });
        } else if (action === 'Delete') {
            await Incentive.deleteMany({ _id: { $in: ids }, status: { $ne: 'Paid' } });
        }
        res.json({ success: true, message: 'Bulk action completed' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateIncentive = async (req, res) => {
    try {
        const incentive = await Incentive.findById(req.params.id);
        if (!incentive) return res.status(404).json({ success: false, message: 'Incentive not found' });
        if (incentive.status === 'Approved' || incentive.status === 'Paid') return res.status(403).json({ success: false, message: 'Cannot edit approved/paid incentive' });

        const updated = await Incentive.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.json({ success: true, data: updated, message: 'Incentive updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.deleteIncentive = async (req, res) => {
    try {
        const inc = await Incentive.findById(req.params.id);
        if (!inc) return res.status(404).json({ success: false, message: 'Incentive not found' });
        if (inc.status === 'Paid' || inc.status === 'Approved') return res.status(403).json({ success: false, message: 'Cannot delete approved/paid incentive' });

        await inc.deleteOne();
        res.json({ success: true, message: 'Incentive deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

