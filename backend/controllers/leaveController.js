const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
const LeaveBalanceHistory = require('../models/LeaveBalanceHistory');

// POST /api/leaves
exports.applyLeave = async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason } = req.body;
        const start = new Date(startDate); const end = new Date(endDate);
        const today = new Date(); today.setHours(0, 0, 0, 0);

        if (start < today) {
            return res.status(400).json({ success: false, message: 'Start date cannot be in the past' });
        }
        if (end < start) {
            return res.status(400).json({ success: false, message: 'End date cannot be earlier than start date' });
        }

        let totalDays = 0;
        let curr = new Date(start);
        while (curr <= end) {
            if (curr.getDay() !== 0) { // 0 is Sunday
                totalDays++;
            }
            curr.setDate(curr.getDate() + 1);
        }
        const employee = await Employee.findById(req.user.employeeId);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
        if (employee.status === 'Terminated / Ex-Employee') {
            return res.status(403).json({ success: false, message: 'Ex-employees are not eligible to apply for leaves.' });
        }
        const balanceKey = leaveType.toLowerCase();
        if (employee.leaveBalance[balanceKey] !== undefined && employee.leaveBalance[balanceKey] < totalDays && balanceKey !== 'unpaid') {
            return res.status(400).json({ success: false, message: `Insufficient ${leaveType} leave balance. Available: ${employee.leaveBalance[balanceKey]}` });
        }
        const leave = await Leave.create({ employee: req.user.employeeId, leaveType, startDate: start, endDate: end, totalDays, reason });

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotification({
                roles: ['SuperAdmin', 'HRAdmin'],
                title: 'New Leave Request',
                message: `${employee.firstName} ${employee.lastName} applied for ${totalDays} day(s) of ${leaveType} leave starting ${start.toLocaleDateString('en-IN')}.`,
                type: 'info',
                link: '/leaves'
            });
        } catch (notifErr) {
            console.error('Notification error:', notifErr);
        }

        res.status(201).json({ success: true, data: leave });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/leaves/my
exports.getMyLeaves = async (req, res) => {
    try {
        const { month, year } = req.query;
        const query = { employee: req.user.employeeId };
        const filters = [];
        if (month && !isNaN(parseInt(month))) filters.push({ $eq: [{ $month: '$startDate' }, parseInt(month)] });
        if (year && !isNaN(parseInt(year))) filters.push({ $eq: [{ $year: '$startDate' }, parseInt(year)] });

        if (filters.length > 0) {
            query.$expr = { $and: filters };
        }
        const leaves = await Leave.find(query).populate('approvedBy', 'firstName lastName').sort({ createdAt: -1 });
        res.json({ success: true, data: leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/leaves/balance
exports.getLeaveBalance = async (req, res) => {
    try {
        const employee = await Employee.findById(req.user.employeeId).select('leaveBalance');
        res.json({ success: true, data: employee ? employee.leaveBalance : {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/leaves/pending  (Admin/Manager)
exports.getPendingLeaves = async (req, res) => {
    try {
        const { month, year } = req.query;
        const query = { status: 'Pending' };
        const filters = [];
        if (month && !isNaN(parseInt(month))) filters.push({ $eq: [{ $month: '$startDate' }, parseInt(month)] });
        if (year && !isNaN(parseInt(year))) filters.push({ $eq: [{ $year: '$startDate' }, parseInt(year)] });

        if (filters.length > 0) {
            query.$expr = { $and: filters };
        }
        const leaves = await Leave.find(query)
            .populate({ path: 'employee', select: 'firstName lastName employeeCode department designation profileImage' })
            .sort({ createdAt: -1 });
        res.json({ success: true, data: leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/leaves/:id/approve
exports.approveLeave = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
        leave.status = 'Approved';
        leave.approvedBy = req.user.employeeId;
        leave.approverComments = req.body.comments || '';
        await leave.save();
        // Deduct leave balance
        const employee = await Employee.findById(leave.employee);
        const key = leave.leaveType.toLowerCase();
        if (employee && employee.leaveBalance[key] !== undefined) {
            employee.leaveBalance[key] = Math.max(0, employee.leaveBalance[key] - leave.totalDays);
            await employee.save();
        }

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: leave.employee,
                title: 'Leave Request Approved',
                message: `Your request for ${leave.totalDays} day(s) of ${leave.leaveType} leave starting ${new Date(leave.startDate).toLocaleDateString('en-IN')} has been approved.`,
                type: 'success',
                link: '/my-leaves'
            });
        } catch (notifErr) {
            console.error('Notification error:', notifErr);
        }

        res.json({ success: true, data: leave });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/leaves/:id/reject
exports.rejectLeave = async (req, res) => {
    try {
        const leave = await Leave.findById(req.params.id);
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
        leave.status = 'Rejected';
        leave.approvedBy = req.user.employeeId;
        leave.approverComments = req.body.comments || '';
        await leave.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            const reasonText = req.body.comments ? ` Reason: ${req.body.comments}` : '';
            await notificationHelper.createNotificationForEmployee({
                employeeId: leave.employee,
                title: 'Leave Request Rejected',
                message: `Your request for ${leave.totalDays} day(s) of ${leave.leaveType} leave starting ${new Date(leave.startDate).toLocaleDateString('en-IN')} has been rejected.${reasonText}`,
                type: 'error',
                link: '/my-leaves'
            });
        } catch (notifErr) {
            console.error('Notification error:', notifErr);
        }

        res.json({ success: true, data: leave });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// GET /api/leaves/all  (Admin)
exports.getAllLeaves = async (req, res) => {
    try {
        const { status, month, year, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status) query.status = status;
        const filters = [];
        if (month && !isNaN(parseInt(month))) filters.push({ $eq: [{ $month: '$startDate' }, parseInt(month)] });
        if (year && !isNaN(parseInt(year))) filters.push({ $eq: [{ $year: '$startDate' }, parseInt(year)] });

        if (filters.length > 0) {
            query.$expr = { $and: filters };
        }
        const leaves = await Leave.find(query)
            .populate('employee', 'firstName lastName employeeCode department profileImage')
            .populate('approvedBy', 'firstName lastName')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit).limit(parseInt(limit));
        const total = await Leave.countDocuments(query);
        res.json({ success: true, data: leaves, total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/leaves/adjust-balance (Admin override)
exports.adjustLeaveBalance = async (req, res) => {
    try {
        const { employeeIds, leaveType, operation, amount } = req.body;
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({ success: false, message: 'Please select at least one employee.' });
        }
        if (!leaveType) {
            return res.status(400).json({ success: false, message: 'Please select a leave type.' });
        }
        if (amount === undefined || isNaN(Number(amount))) {
            return res.status(400).json({ success: false, message: 'Please enter a valid amount.' });
        }

        const amtValue = Number(amount);
        const typesToUpdate = leaveType === 'all' ? ['casual', 'sick', 'earned', 'other'] : [leaveType.toLowerCase()];

        for (const empId of employeeIds) {
            const employee = await Employee.findById(empId);
            if (!employee) continue;

            if (!employee.leaveBalance) {
                employee.leaveBalance = { casual: 12, sick: 12, earned: 15, unpaid: 0, other: 0 };
            }

            for (const type of typesToUpdate) {
                if (employee.leaveBalance[type] === undefined) {
                    employee.leaveBalance[type] = 0;
                }

                const beforeVal = employee.leaveBalance[type];

                if (operation === 'add') {
                    employee.leaveBalance[type] = Math.max(0, employee.leaveBalance[type] + amtValue);
                } else { // operation === 'set'
                    employee.leaveBalance[type] = Math.max(0, amtValue);
                }

                const afterVal = employee.leaveBalance[type];

                // Save Audit Log
                await LeaveBalanceHistory.create({
                    employee: empId,
                    leaveType: type.charAt(0).toUpperCase() + type.slice(1),
                    operation,
                    amount: amtValue,
                    beforeBalance: beforeVal,
                    afterBalance: afterVal,
                    adjustedBy: req.user.id
                });
            }

            employee.markModified('leaveBalance');
            await employee.save();

            try {
                const notificationHelper = require('../utils/notificationHelper');
                const typeText = leaveType === 'all' ? 'All Leave Balances' : `${leaveType.toUpperCase()} leave balance`;
                const adjustmentText = operation === 'add'
                    ? `${amtValue >= 0 ? '+' : ''}${amtValue} day(s) adjusted`
                    : `set to ${amtValue} day(s)`;

                await notificationHelper.createNotificationForEmployee({
                    employeeId: empId,
                    title: 'Leave Balance Adjusted',
                    message: `Your ${typeText} has been adjusted: ${adjustmentText}.`,
                    type: 'info',
                    link: '/my-leaves'
                });
            } catch (notifErr) {
                console.error('Notification error on adjustment:', notifErr);
            }
        }

        res.json({ success: true, message: `Adjusted leave balance successfully for ${employeeIds.length} employee(s).` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/leaves/balance-history
exports.getBalanceHistory = async (req, res) => {
    try {
        let employeeId;
        const userRole = req.user.role;

        if (userRole === 'SuperAdmin' || userRole === 'HRAdmin') {
            employeeId = req.query.employeeId;
        } else {
            employeeId = req.user.employeeId;
        }

        const filter = {};
        if (employeeId) {
            filter.employee = employeeId;
        }

        const history = await LeaveBalanceHistory.find(filter)
            .populate('employee', 'firstName lastName employeeCode department')
            .populate('adjustedBy', 'email role')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

