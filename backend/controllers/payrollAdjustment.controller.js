const PayrollAdjustment = require('../models/PayrollAdjustment.model');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const User = require('../models/User');

const SUPERADMIN_THRESHOLD = 5000;

// Helper to get Employee from User
const getEmployeeFromUser = async (user) => {
    let employee = null;
    if (user.employeeId) employee = await Employee.findById(user.employeeId);
    if (!employee) employee = await Employee.findOne({ userId: user._id });
    if (!employee && user.email) employee = await Employee.findOne({ email: user.email.toLowerCase() });
    return employee;
};

// GET /api/hradmin/payroll-adjustments
exports.getHRAdminAdjustments = async (req, res) => {
    try {
        const { page = 1, limit = 50, status, employeeId, adjustmentType, adjustmentPayrollMonth, department, year, month, search } = req.query;
        const query = {};

        if (status) query.status = status;
        if (employeeId) query.employeeId = employeeId;
        if (adjustmentType) query.adjustmentType = adjustmentType;
        if (adjustmentPayrollMonth) query.adjustmentPayrollMonth = adjustmentPayrollMonth;

        let empFilter = {};
        if (department) empFilter.department = department;
        if (search && search.trim()) {
            const sRegex = { $regex: search.trim(), $options: 'i' };
            empFilter.$or = [
                { firstName: sRegex },
                { lastName: sRegex },
                { employeeCode: sRegex }
            ];
        }

        if (department || (search && search.trim())) {
            const emps = await Employee.find(empFilter).select('_id');
            const empIds = emps.map(e => e._id);
            if (search && search.trim()) {
                const sRegex = { $regex: search.trim(), $options: 'i' };
                query.$or = [
                    { adjustmentNumber: sRegex },
                    { employeeId: { $in: empIds } },
                    { payslipLabel: sRegex }
                ];
            } else {
                query.employeeId = { $in: empIds };
            }
        }

        if (year && month) {
            query.adjustmentPayrollMonth = `${year}-${String(month).padStart(2, '0')}`;
        } else if (year) {
            query.adjustmentPayrollMonth = { $regex: `^${year}` };
        } else if (month) {
            query.adjustmentPayrollMonth = { $regex: `-${String(month).padStart(2, '0')}$` };
        }

        // Auto-heal adjustments generated from already-approved regularizations
        const AttendanceRegularization = require('../models/AttendanceRegularization.model');
        const pendingArrears = await PayrollAdjustment.find({
            sourceType: 'ATTENDANCE_REGULARIZATION',
            status: 'PENDING_HR_APPROVAL'
        });
        for (const pAdj of pendingArrears) {
            if (pAdj.sourceId) {
                const reg = await AttendanceRegularization.findById(pAdj.sourceId);
                if (reg && reg.status === 'APPROVED') {
                    pAdj.status = pAdj.amount > 5000 ? 'PENDING_SUPERADMIN_APPROVAL' : 'APPROVED';
                    pAdj.hrApprovedBy = reg.hrAdminId || pAdj.createdBy;
                    pAdj.hrApprovedAt = reg.hrAdminReviewedAt || pAdj.updatedAt || new Date();
                    await pAdj.save();
                }
            }
        }

        const count = await PayrollAdjustment.countDocuments(query);
        const records = await PayrollAdjustment.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('employeeId', 'firstName lastName employeeCode department designation basic gross profileImage')
            .populate('createdBy', 'firstName lastName role')
            .populate('hrApprovedBy', 'firstName lastName')
            .populate('superAdminApprovedBy', 'firstName lastName');

        res.json({
            success: true,
            data: records,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/hradmin/payroll-adjustments/:id/approve
exports.approveHRAdminAdjustment = async (req, res) => {
    try {
        const { comment } = req.body;
        const adj = await PayrollAdjustment.findById(req.params.id);

        if (!adj) return res.status(404).json({ success: false, message: 'Adjustment not found' });

        if (!['DRAFT', 'PENDING_HR_APPROVAL'].includes(adj.status)) {
            return res.status(400).json({ success: false, message: `Cannot approve adjustment in status ${adj.status}` });
        }

        adj.hrApprovedBy = req.user._id;
        adj.hrApprovedAt = new Date();
        if (comment) adj.comment = (adj.comment ? adj.comment + ' | ' : '') + comment;

        if (adj.amount > SUPERADMIN_THRESHOLD) {
            adj.status = 'PENDING_SUPERADMIN_APPROVAL';
        } else {
            adj.status = 'APPROVED';
        }

        await adj.save();

        res.json({
            success: true,
            message: adj.status === 'PENDING_SUPERADMIN_APPROVAL'
                ? `HR approved. Amount ₹${adj.amount} exceeds ₹${SUPERADMIN_THRESHOLD} threshold and now requires SuperAdmin approval.`
                : 'Payroll adjustment approved successfully',
            data: adj
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/hradmin/payroll-adjustments/:id/reject
exports.rejectHRAdminAdjustment = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ success: false, message: 'Rejection reason is required' });
        }

        const adj = await PayrollAdjustment.findById(req.params.id);
        if (!adj) return res.status(404).json({ success: false, message: 'Adjustment not found' });

        if (adj.status === 'APPLIED') {
            return res.status(400).json({ success: false, message: 'Applied adjustments cannot be rejected' });
        }

        adj.status = 'REJECTED';
        adj.rejectionReason = reason;
        await adj.save();

        res.json({ success: true, message: 'Adjustment rejected', data: adj });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/hradmin/payroll-adjustments/manual
exports.createManualAdjustment = async (req, res) => {
    try {
        const {
            employeeId,
            adjustmentType,
            direction,
            amount,
            originalPayrollMonth,
            adjustmentPayrollMonth,
            reason,
            comment,
            payslipLabel
        } = req.body;

        if (!employeeId || !adjustmentType || !direction || !amount || !originalPayrollMonth || !adjustmentPayrollMonth || !reason) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        if (Number(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
        }

        // DUPLICATE PREVENTION: Check if same employee + adjustmentType + adjustmentPayrollMonth + reason already exists
        const existing = await PayrollAdjustment.findOne({
            employeeId,
            adjustmentType,
            adjustmentPayrollMonth,
            reason,
            status: { $nin: ['REJECTED', 'CANCELLED'] }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Adjustment already exists for this source record.'
            });
        }

        // Check if payroll for adjustmentPayrollMonth is already finalized
        const [adjYear, adjMonth] = adjustmentPayrollMonth.split('-').map(Number);
        if (adjYear && adjMonth) {
            const payrollRec = await Payroll.findOne({
                employee: employeeId,
                month: adjMonth,
                year: adjYear,
                status: 'Paid'
            });

            if (payrollRec) {
                return res.status(400).json({
                    success: false,
                    message: `Payroll for ${adjustmentPayrollMonth} is finalized. Update adjustmentPayrollMonth to an open month.`
                });
            }
        }

        const label = payslipLabel || (direction === 'CREDIT'
            ? `${adjustmentType.replace(/_/g, ' ')} – ${originalPayrollMonth}`
            : `Previous Month Overpayment Recovery – ${originalPayrollMonth}`);

        const adj = new PayrollAdjustment({
            employeeId,
            adjustmentType,
            direction,
            amount: Number(amount),
            originalPayrollMonth,
            adjustmentPayrollMonth,
            sourceType: req.user.role === 'SuperAdmin' ? 'MANUAL_SUPERADMIN' : 'MANUAL_HR',
            reason,
            comment,
            status: 'PENDING_HR_APPROVAL',
            createdBy: req.user._id,
            createdByRole: req.user.role,
            payslipLabel: label
        });

        await adj.save();

        res.status(201).json({
            success: true,
            message: 'Manual payroll adjustment created and submitted for approval',
            data: adj
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ==========================================
// SUPER ADMIN ENDPOINTS
// ==========================================

// GET /api/superadmin/payroll-adjustments/all
exports.getAllAdjustmentsSuperAdmin = async (req, res) => {
    return exports.getHRAdminAdjustments(req, res);
};

// GET /api/superadmin/payroll-adjustments/pending-approval
exports.getPendingSuperAdminAdjustments = async (req, res) => {
    try {
        const { page = 1, limit = 50, department, year, month, search } = req.query;
        const query = { status: 'PENDING_SUPERADMIN_APPROVAL' };

        let empFilter = {};
        if (department) empFilter.department = department;
        if (search && search.trim()) {
            const sRegex = { $regex: search.trim(), $options: 'i' };
            empFilter.$or = [
                { firstName: sRegex },
                { lastName: sRegex },
                { employeeCode: sRegex }
            ];
        }

        if (department || (search && search.trim())) {
            const emps = await Employee.find(empFilter).select('_id');
            const empIds = emps.map(e => e._id);
            if (search && search.trim()) {
                const sRegex = { $regex: search.trim(), $options: 'i' };
                query.$or = [
                    { adjustmentNumber: sRegex },
                    { employeeId: { $in: empIds } },
                    { payslipLabel: sRegex }
                ];
            } else {
                query.employeeId = { $in: empIds };
            }
        }

        if (year && month) {
            query.adjustmentPayrollMonth = `${year}-${String(month).padStart(2, '0')}`;
        } else if (year) {
            query.adjustmentPayrollMonth = { $regex: `^${year}` };
        } else if (month) {
            query.adjustmentPayrollMonth = { $regex: `-${String(month).padStart(2, '0')}$` };
        }

        const count = await PayrollAdjustment.countDocuments(query);
        const records = await PayrollAdjustment.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('employeeId', 'firstName lastName employeeCode department designation profileImage')
            .populate('createdBy', 'firstName lastName role')
            .populate('hrApprovedBy', 'firstName lastName');

        res.json({
            success: true,
            data: records,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit)
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/superadmin/payroll-adjustments/:id/approve
exports.approveSuperAdminAdjustment = async (req, res) => {
    try {
        const { comment } = req.body;
        const adj = await PayrollAdjustment.findById(req.params.id);

        if (!adj) return res.status(404).json({ success: false, message: 'Adjustment not found' });

        if (adj.status !== 'PENDING_SUPERADMIN_APPROVAL' && adj.status !== 'PENDING_HR_APPROVAL') {
            return res.status(400).json({ success: false, message: `Cannot approve adjustment in status ${adj.status}` });
        }

        adj.status = 'APPROVED';
        adj.superAdminApprovedBy = req.user._id;
        adj.superAdminApprovedAt = new Date();
        if (comment) adj.comment = (adj.comment ? adj.comment + ' | ' : '') + comment;

        await adj.save();

        res.json({ success: true, message: 'Adjustment approved by SuperAdmin', data: adj });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/superadmin/payroll-adjustments/:id/reject
exports.rejectSuperAdminAdjustment = async (req, res) => {
    return exports.rejectHRAdminAdjustment(req, res);
};

// ==========================================
// EMPLOYEE ENDPOINTS
// ==========================================

// GET /api/payroll-adjustments/my
exports.getMyAdjustments = async (req, res) => {
    try {
        const employee = await getEmployeeFromUser(req.user);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

        const records = await PayrollAdjustment.find({ employeeId: employee._id })
            .sort({ createdAt: -1 });

        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
