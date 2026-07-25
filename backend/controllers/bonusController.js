const Bonus = require('../models/Bonus');

// Get all bonuses
exports.getBonuses = async (req, res) => {
    try {
        const query = req.user.role === 'Employee' ? { employee: req.user._id } : {};
        const bonuses = await Bonus.find(query).populate('employee', 'firstName lastName employeeCode department profileImage');
        res.json({ success: true, data: bonuses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Create regular bonus
exports.createBonus = async (req, res) => {
    try {
        const bonus = new Bonus(req.body);
        await bonus.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: bonus.employee,
                title: 'Bonus Allocated',
                message: `A new bonus of ₹${bonus.amount} (${bonus.bonusType}) has been allocated to you for ${bonus.month} ${bonus.financialYear}.`,
                type: 'success',
                link: '/my-profile'
            });
        } catch (notifErr) {
            console.error('Notification error on bonus create:', notifErr);
        }

        res.status(201).json({ success: true, data: bonus, message: 'Bonus added successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Create bulk bonuses
exports.createBulkBonus = async (req, res) => {
    try {
        const { employeeIds, bonusType, amount, month, financialYear, remarks } = req.body;
        if (!employeeIds || employeeIds.length === 0) {
            return res.status(400).json({ success: false, message: 'No employees selected' });
        }

        const bonusesToCreate = employeeIds.map(empId => ({
            employee: empId, bonusType, amount, month, financialYear, remarks, status: 'Pending'
        }));

        await Bonus.insertMany(bonusesToCreate);

        try {
            const notificationHelper = require('../utils/notificationHelper');
            for (const empId of employeeIds) {
                await notificationHelper.createNotificationForEmployee({
                    employeeId: empId,
                    title: 'Bonus Allocated',
                    message: `A new bonus of ₹${amount} (${bonusType}) has been allocated to you for ${month} ${financialYear}.`,
                    type: 'success',
                    link: '/my-profile'
                });
            }
        } catch (notifErr) {
            console.error('Notification error on bulk bonus create:', notifErr);
        }

        res.status(201).json({ success: true, message: `Bonus added successfully for ${employeeIds.length} employees` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Update status
exports.updateBonusStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const bonus = await Bonus.findById(req.params.id);
        if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });
        bonus.status = status;
        await bonus.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: bonus.employee,
                title: 'Bonus Status Updated',
                message: `Your bonus of ₹${bonus.amount} (${bonus.bonusType}) status has been updated to ${status}.`,
                type: status === 'Approved' || status === 'Paid' ? 'success' : 'info',
                link: '/my-profile'
            });
        } catch (notifErr) {
            console.error('Notification error on bonus status update:', notifErr);
        }

        res.json({ success: true, message: `Bonus marked as ${status}` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Bulk action (Approve/Delete)
exports.bulkAction = async (req, res) => {
    try {
        const { ids, action } = req.body;
        if (!ids || !ids.length) return res.status(400).json({ success: false, message: 'No records selected' });

        if (action === 'Approve') {
            await Bonus.updateMany({ _id: { $in: ids } }, { status: 'Approved' });
        } else if (action === 'Delete') {
            // Only allow deleting Pending or Approved, but not Paid.
            await Bonus.deleteMany({ _id: { $in: ids }, status: { $ne: 'Paid' } });
        }
        res.json({ success: true, message: `Bulk action completed` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// Update bonus
exports.updateBonus = async (req, res) => {
    try {
        const bonus = await Bonus.findById(req.params.id);
        if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });
        if (bonus.status === 'Approved' || bonus.status === 'Paid') return res.status(403).json({ success: false, message: 'Cannot edit approved/paid bonus' });

        const updated = await Bonus.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        res.json({ success: true, data: updated, message: 'Bonus updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Delete bonus
exports.deleteBonus = async (req, res) => {
    try {
        const bonus = await Bonus.findById(req.params.id);
        if (!bonus) return res.status(404).json({ success: false, message: 'Bonus not found' });
        // Prevent delete if already paid/in payroll
        if (bonus.status === 'Paid' || bonus.status === 'Approved') return res.status(403).json({ success: false, message: 'Cannot delete approved/paid bonus' });

        await bonus.deleteOne();
        res.json({ success: true, message: 'Bonus deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

