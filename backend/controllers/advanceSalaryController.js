const AdvanceSalary = require('../models/AdvanceSalary');

exports.getAdvances = async (req, res) => {
    try {
        const query = req.user.role === 'Employee' ? { employee: req.user.employeeId } : {};
        if (req.query.status) query.status = req.query.status;

        const advances = await AdvanceSalary.find(query)
            .populate('employee', 'firstName lastName employeeCode department profileImage')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: advances });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.applyAdvance = async (req, res) => {
    try {
        if (req.user.role === 'Employee') {
            const EmployeeModel = require('../models/Employee');
            const emp = await EmployeeModel.findById(req.user.employeeId);
            if (emp?.status === 'Terminated / Ex-Employee') {
                return res.status(403).json({ success: false, message: 'Ex-employees / terminated employees cannot apply for advance salary.' });
            }
        }
        const { amount, recoveryDuration } = req.body;
        const installmentAmount = Math.ceil(Number(amount) / Number(recoveryDuration));

        const advance = new AdvanceSalary({
            ...req.body,
            employee: req.user.role === 'Employee' ? req.user.employeeId : req.body.employee,
            installmentAmount,
            outstandingAmount: amount,
            history: [{ status: 'Pending', updatedBy: req.user._id, remark: 'Applied for advance salary' }]
        });

        await advance.save();

        try {
            const EmployeeModel = require('../models/Employee');
            const emp = await EmployeeModel.findById(advance.employee);
            const employeeName = emp ? `${emp.firstName} ${emp.lastName}` : 'An employee';
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotification({
                roles: ['SuperAdmin', 'HRAdmin'],
                title: 'New Advance Salary Request',
                message: `${employeeName} requested an advance salary of ₹${advance.amount} recovering over ${advance.recoveryDuration} month(s).`,
                type: 'info',
                link: '/payroll/advances'
            });
        } catch (notifErr) {
            console.error('Notification error on advance salary request:', notifErr);
        }

        res.status(201).json({ success: true, data: advance, message: 'Request submitted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

exports.updateAdvanceStatus = async (req, res) => {
    try {
        const { status, remark, disbursalMode } = req.body;
        const advance = await AdvanceSalary.findById(req.params.id);
        if (!advance) return res.status(404).json({ success: false, message: 'Not found' });

        advance.status = status;
        if (disbursalMode) advance.disbursalMode = disbursalMode;

        advance.history.push({
            status,
            updatedBy: req.user._id,
            remark: remark || `Status manually updated to ${status}`
        });

        await advance.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: advance.employee,
                title: 'Advance Salary Status Updated',
                message: `Your requested advance salary of ₹${advance.amount} status is now ${status}. ${remark ? `Details: ${remark}` : ''}`,
                type: status === 'Approved' || status === 'Disbursed' ? 'success' : 'info',
                link: '/my-loans'
            });
        } catch (notifErr) {
            console.error('Notification error on advance status update:', notifErr);
        }

        res.json({ success: true, data: advance, message: `Advance salary marked as ${status}` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Update Advance Request (Only allowable when Pending)
exports.updateAdvance = async (req, res) => {
    try {
        const adv = await AdvanceSalary.findById(req.params.id);
        if (!adv) return res.status(404).json({ success: false, message: 'Advance not found' });

        if (adv.status !== 'Pending' && req.user.role === 'Employee') {
            return res.status(403).json({ success: false, message: 'Cannot edit advance after it has been processed' });
        }

        const updatedAdv = await AdvanceSalary.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: updatedAdv, message: 'Advance request updated' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Delete Advance Request
exports.deleteAdvance = async (req, res) => {
    try {
        const adv = await AdvanceSalary.findById(req.params.id);
        if (!adv) return res.status(404).json({ success: false, message: 'Advance not found' });

        if (adv.status !== 'Pending' && req.user.role === 'Employee') {
            return res.status(403).json({ success: false, message: 'Cannot delete advance after it has been processed' });
        }

        await AdvanceSalary.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Advance request deleted' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
