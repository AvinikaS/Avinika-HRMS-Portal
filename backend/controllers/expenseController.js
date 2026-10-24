const { ExpenseClaim } = require('../models/ExpenseClaim.model');
const { ExpenseCategory } = require('../models/ExpenseCategory.model');
const ExpenseHistory = require('../models/ExpenseHistory.model');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Payroll = require('../models/Payroll');
const notificationHelper = require('../utils/notificationHelper');
const { deleteFromCloudinary } = require('../config/cloudinary');

// ========================
// HELPERS
// ========================

const addHistory = async (expenseId, action, performedBy, role, comment = null, oldValue = null, newValue = null) => {
    await ExpenseHistory.create({
        expenseId,
        action,
        performedBy,
        performedByRole: role,
        comment,
        oldValue,
        newValue
    });
};

const VALID_TRANSITIONS = {
    DRAFT: ['SUBMITTED', 'CANCELLED'],
    SUBMITTED: ['HR_APPROVED', 'CORRECTION_REQUIRED', 'REJECTED', 'CANCELLED'],
    HR_APPROVED: ['SUPER_ADMIN_APPROVED', 'CORRECTION_REQUIRED', 'REJECTED'],
    CORRECTION_REQUIRED: ['SUBMITTED'],
    SUPER_ADMIN_APPROVED: ['PAYMENT_PENDING'],
    PAYMENT_PENDING: ['PAID'],
    REJECTED: [],
    PAID: [],
    CANCELLED: []
};

const validateTransition = (from, to) => {
    return VALID_TRANSITIONS[from] && VALID_TRANSITIONS[from].includes(to);
};

// ========================
// EMPLOYEE ROUTES
// ========================

// POST /api/expenses  — Create draft
exports.createExpense = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });
        if (employee.status === 'Terminated / Ex-Employee') {
            return res.status(403).json({ success: false, message: 'Ex-employees / terminated employees cannot submit expense claims.' });
        }

        const { categoryId, customCategoryName, expenseDate, expenseEndDate, amountClaimed, description, vendor, location, businessPurpose, notes, receipts } = req.body;

        // Validate expense date — not future
        const expDate = new Date(expenseDate);

        // Check category exists
        const category = await ExpenseCategory.findById(categoryId);
        if (!category || !category.isActive) {
            return res.status(400).json({ success: false, message: 'Invalid or inactive expense category.' });
        }

        // Policy checks
        let exceedsPolicy = false;
        let policyWarning = null;

        if (category.maxAmount && amountClaimed > category.maxAmount) {
            exceedsPolicy = true;
            policyWarning = `This expense of ₹${amountClaimed} exceeds the configured limit of ₹${category.maxAmount} for ${category.name}.`;
        }

        // Monthly limit check
        if (category.monthlyLimit) {
            const monthStart = new Date(expDate.getFullYear(), expDate.getMonth(), 1);
            const monthEnd = new Date(expDate.getFullYear(), expDate.getMonth() + 1, 0, 23, 59, 59);
            const monthSum = await ExpenseClaim.aggregate([
                {
                    $match: {
                        employeeId: employee._id,
                        categoryId: category._id,
                        expenseDate: { $gte: monthStart, $lte: monthEnd },
                        status: { $nin: ['CANCELLED', 'REJECTED'] }
                    }
                },
                { $group: { _id: null, total: { $sum: '$amountClaimed' } } }
            ]);
            const currentTotal = monthSum.length > 0 ? monthSum[0].total : 0;
            if (currentTotal + Number(amountClaimed) > category.monthlyLimit) {
                policyWarning = (policyWarning ? policyWarning + ' ' : '') +
                    `Monthly limit of ₹${category.monthlyLimit} for ${category.name} may be exceeded.`;
            }
        }

        // Duplicate detection
        const normalizedDate = new Date(expenseDate);
        normalizedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(normalizedDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const duplicate = await ExpenseClaim.findOne({
            employeeId: employee._id,
            categoryId,
            amountClaimed: Number(amountClaimed),
            expenseDate: { $gte: normalizedDate, $lt: nextDay },
            status: { $nin: ['CANCELLED', 'REJECTED'] }
        });

        const claim = await ExpenseClaim.create({
            employeeId: employee._id,
            categoryId,
            customCategoryName: customCategoryName || null,
            expenseDate: expDate,
            expenseEndDate: expenseEndDate ? new Date(expenseEndDate) : null,
            amountClaimed: Number(amountClaimed),
            currency: 'INR',
            description,
            vendor,
            location,
            businessPurpose,
            notes,
            receipt: receipts && receipts.length > 0 ? receipts[0] : null,
            receipts: receipts || [],
            exceedsPolicy,
            status: 'DRAFT'
        });

        await addHistory(claim._id, 'CREATED', req.user._id, req.user.role, 'Expense claim created as draft');

        return res.status(201).json({
            success: true,
            data: claim,
            duplicate: duplicate ? { claimNumber: duplicate.claimNumber, _id: duplicate._id } : null,
            policyWarning
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/submit
exports.submitExpense = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const claim = await ExpenseClaim.findById(req.params.id).populate('categoryId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (String(claim.employeeId) !== String(employee._id)) return res.status(403).json({ success: false, message: 'Forbidden.' });

        if (!['DRAFT', 'CORRECTION_REQUIRED'].includes(claim.status)) {
            return res.status(400).json({ success: false, message: `Cannot submit a claim with status '${claim.status}'.` });
        }

        const category = claim.categoryId;

        // Receipt required check
        if (category.receiptRequired && (!claim.receipts || claim.receipts.length === 0)) {
            // Check legacy receipt for backward compatibility
            if (!claim.receipt || !claim.receipt.fileUrl) {
                return res.status(400).json({ success: false, message: `Receipt is required for "${category.name}" category.` });
            }
        }

        claim.status = 'SUBMITTED';
        claim.submittedAt = new Date();
        await claim.save();

        await addHistory(claim._id, 'SUBMITTED', req.user._id, req.user.role, 'Employee submitted expense claim');

        // Notify HR Admins
        try {
            await notificationHelper.createNotification({
                roles: ['HRAdmin', 'SuperAdmin'],
                title: 'New Expense Claim Submitted',
                message: `${employee.firstName} ${employee.lastName} submitted expense claim ${claim.claimNumber} for ₹${claim.amountClaimed}.`,
                type: 'info',
                link: `/admin/expenses/pending`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/my
exports.getMyExpenses = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const { page = 1, limit = 10, status, categoryId, dateFrom, dateTo, search } = req.query;
        const query = { employeeId: employee._id };

        if (status) {
            if (status.includes(',')) query.status = { $in: status.split(',') };
            else query.status = status;
        }
        if (categoryId) query.categoryId = categoryId;
        if (dateFrom || dateTo) {
            query.expenseDate = {};
            if (dateFrom) query.expenseDate.$gte = new Date(dateFrom);
            if (dateTo) query.expenseDate.$lte = new Date(dateTo);
        }
        if (search) {
            query.$or = [
                { claimNumber: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { vendor: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await ExpenseClaim.countDocuments(query);
        const claims = await ExpenseClaim.find(query)
            .populate('categoryId', 'name code')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ success: true, data: claims, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/my/summary
exports.getMyExpenseSummary = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const agg = await ExpenseClaim.aggregate([
            { $match: { employeeId: employee._id } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalClaimed: { $sum: '$amountClaimed' },
                    totalApproved: { $sum: { $ifNull: ['$amountApproved', 0] } },
                    totalPaid: {
                        $sum: {
                            $cond: [{ $eq: ['$status', 'PAID'] }, { $ifNull: ['$payment.paidAmount', '$amountApproved', 0] }, 0]
                        }
                    }
                }
            }
        ]);

        const summary = {
            total: 0, draft: 0, submitted: 0, hrApproved: 0, superAdminApproved: 0,
            correctionRequired: 0, rejected: 0, paymentPending: 0, paid: 0, cancelled: 0,
            totalAmountClaimed: 0, totalAmountApproved: 0, totalAmountPaid: 0
        };

        agg.forEach(r => {
            summary.total += r.count;
            summary.totalAmountClaimed += r.totalClaimed;
            summary.totalAmountApproved += r.totalApproved;
            if (r._id === 'DRAFT') summary.draft = r.count;
            else if (r._id === 'SUBMITTED') summary.submitted = r.count;
            else if (r._id === 'HR_APPROVED') summary.hrApproved = r.count;
            else if (r._id === 'SUPER_ADMIN_APPROVED') summary.superAdminApproved = r.count;
            else if (r._id === 'CORRECTION_REQUIRED') summary.correctionRequired = r.count;
            else if (r._id === 'REJECTED') summary.rejected = r.count;
            else if (r._id === 'PAYMENT_PENDING') summary.paymentPending = r.count;
            else if (r._id === 'PAID') { summary.paid = r.count; summary.totalAmountPaid += r.totalPaid; }
            else if (r._id === 'CANCELLED') summary.cancelled = r.count;
        });

        res.json({ success: true, data: summary });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/:id (employee view - owns only)
exports.getExpenseDetail = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const claim = await ExpenseClaim.findById(req.params.id)
            .populate('categoryId', 'name code receiptRequired maxAmount')
            .populate('hrAdminId', 'email')
            .populate('superAdminId', 'email');

        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (String(claim.employeeId) !== String(employee._id)) {
            return res.status(403).json({ success: false, message: 'Forbidden.' });
        }

        const history = await ExpenseHistory.find({ expenseId: claim._id })
            .sort({ createdAt: 1 })
            .populate('performedBy', 'email role');

        // Enrich hr/superadmin names
        let hrAdminName = null;
        let superAdminName = null;
        if (claim.hrAdminId) {
            const empH = await Employee.findOne({ userId: claim.hrAdminId._id }).select('firstName lastName');
            hrAdminName = empH ? `${empH.firstName} ${empH.lastName}` : claim.hrAdminId.email;
        }
        if (claim.superAdminId) {
            const empS = await Employee.findOne({ userId: claim.superAdminId._id }).select('firstName lastName');
            superAdminName = empS ? `${empS.firstName} ${empS.lastName}` : claim.superAdminId.email;
        }

        res.json({
            success: true,
            data: { ...claim.toObject(), hrAdminName, superAdminName },
            history
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/expenses/:id (employee edit - DRAFT or CORRECTION_REQUIRED only)
exports.updateExpense = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const claim = await ExpenseClaim.findById(req.params.id);
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (String(claim.employeeId) !== String(employee._id)) return res.status(403).json({ success: false, message: 'Forbidden.' });
        if (!['DRAFT', 'SUBMITTED', 'CORRECTION_REQUIRED'].includes(claim.status)) {
            return res.status(400).json({ success: false, message: 'Claim cannot be edited in its current status.' });
        }

        const allowedFields = ['categoryId', 'customCategoryName', 'expenseDate', 'expenseEndDate', 'amountClaimed', 'description', 'vendor', 'location', 'businessPurpose', 'notes', 'receipt', 'receipts'];
        allowedFields.forEach(f => {
            if (req.body[f] !== undefined) claim[f] = req.body[f];
        });

        await claim.save();
        await addHistory(claim._id, 'STATUS_CHANGED', req.user._id, req.user.role, 'Employee updated claim details');

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/cancel
exports.cancelExpense = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const claim = await ExpenseClaim.findById(req.params.id);
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (String(claim.employeeId) !== String(employee._id)) return res.status(403).json({ success: false, message: 'Forbidden.' });

        if (!validateTransition(claim.status, 'CANCELLED')) {
            return res.status(400).json({ success: false, message: `Cannot cancel claim with status '${claim.status}'.` });
        }

        claim.status = 'CANCELLED';
        await claim.save();
        await addHistory(claim._id, 'CANCELLED', req.user._id, req.user.role, 'Employee cancelled the claim');

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const claim = await ExpenseClaim.findById(req.params.id);
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (String(claim.employeeId) !== String(employee._id)) return res.status(403).json({ success: false, message: 'Forbidden.' });

        if (!['DRAFT', 'SUBMITTED'].includes(claim.status)) {
            return res.status(400).json({ success: false, message: 'Only Draft or Submitted claims can be deleted.' });
        }

        if (claim.status === 'DRAFT') {
            if (claim.receipts && claim.receipts.length > 0) {
                for (const rcpt of claim.receipts) {
                    if (rcpt.publicId) await deleteFromCloudinary(rcpt.publicId);
                }
            }
            if (claim.receipt && claim.receipt.publicId) {
                await deleteFromCloudinary(claim.receipt.publicId);
            }

            await ExpenseHistory.deleteMany({ expenseId: claim._id });
            await claim.deleteOne();
            return res.json({ success: true, message: 'Claim deleted successfully.' });
        } else {
            claim.status = 'CANCELLED';
            claim.notes = (claim.notes || '') + '\n[Deleted by employee]';
            await claim.save();
            await addHistory(claim._id, 'CANCELLED', req.user._id, req.user.role, 'Employee deleted the submitted claim');
            return res.json({ success: true, message: 'Submitted claim was cancelled instead of deleted so admins can view it.' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/resubmit
exports.resubmitExpense = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const claim = await ExpenseClaim.findById(req.params.id).populate('categoryId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (String(claim.employeeId) !== String(employee._id)) return res.status(403).json({ success: false, message: 'Forbidden.' });

        if (claim.status !== 'CORRECTION_REQUIRED') {
            return res.status(400).json({ success: false, message: 'Only claims requiring correction can be resubmitted.' });
        }

        // Apply any updates from body
        const allowedFields = ['categoryId', 'customCategoryName', 'expenseDate', 'amountClaimed', 'description', 'vendor', 'location', 'businessPurpose', 'notes', 'receipt', 'receipts'];
        allowedFields.forEach(f => {
            if (req.body[f] !== undefined) claim[f] = req.body[f];
        });

        // Receipt required check
        const category = await ExpenseCategory.findById(claim.categoryId);
        if (category && category.receiptRequired && (!claim.receipts || claim.receipts.length === 0)) {
            if (!claim.receipt || !claim.receipt.fileUrl) {
                return res.status(400).json({ success: false, message: `Receipt is required for "${category.name}" category.` });
            }
        }

        // Clear correction/rejection info
        claim.correctionReason = undefined;
        claim.status = 'SUBMITTED';
        claim.submittedAt = new Date();
        await claim.save();

        await addHistory(claim._id, 'RESUBMITTED', req.user._id, req.user.role, 'Employee resubmitted claim after correction');

        // Notify HR Admins
        try {
            await notificationHelper.createNotification({
                roles: ['HRAdmin', 'SuperAdmin'],
                title: 'Expense Claim Resubmitted',
                message: `${employee.firstName} ${employee.lastName} resubmitted claim ${claim.claimNumber} after corrections.`,
                type: 'info',
                link: `/admin/expenses/pending`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/categories (employee — active only)
exports.getCategories = async (req, res) => {
    try {
        const categories = await ExpenseCategory.find({ isActive: true }).sort({ name: 1 });
        const otherIndex = categories.findIndex(c => c.name === 'Other');
        if (otherIndex > -1) {
            const [other] = categories.splice(otherIndex, 1);
            categories.push(other);
        }
        res.json({ success: true, data: categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/duplicate-check
exports.duplicateCheck = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee profile not found.' });

        const { categoryId, expenseDate, amountClaimed } = req.body;
        if (!categoryId || !expenseDate || !amountClaimed) {
            return res.json({ success: true, duplicate: null });
        }

        const normalizedDate = new Date(expenseDate);
        normalizedDate.setHours(0, 0, 0, 0);
        const nextDay = new Date(normalizedDate);
        nextDay.setDate(nextDay.getDate() + 1);

        const duplicate = await ExpenseClaim.findOne({
            employeeId: employee._id,
            categoryId,
            amountClaimed: Number(amountClaimed),
            expenseDate: { $gte: normalizedDate, $lt: nextDay },
            status: { $nin: ['CANCELLED', 'REJECTED'] }
        }).populate('categoryId', 'name');

        res.json({ success: true, duplicate: duplicate ? { claimNumber: duplicate.claimNumber, _id: duplicate._id, status: duplicate.status } : null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ========================
// HR ADMIN ROUTES
// ========================

// GET /api/expenses/hradmin/pending
exports.hrAdminGetPending = async (req, res) => {
    try {
        const { page = 1, limit = 10, categoryId, search, dateFrom, dateTo, status } = req.query;
        const query = { status: { $in: ['SUBMITTED', 'CORRECTION_REQUIRED'] } };

        if (status && status !== 'all') {
            if (status === 'PENDING') query.status = 'SUBMITTED';
            else if (status === 'CORRECTION_REQUIRED') query.status = 'CORRECTION_REQUIRED';
        }

        if (categoryId) query.categoryId = categoryId;
        if (dateFrom || dateTo) {
            query.expenseDate = {};
            if (dateFrom) query.expenseDate.$gte = new Date(dateFrom);
            if (dateTo) query.expenseDate.$lte = new Date(dateTo);
        }

        if (search) {
            const emps = await Employee.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            query.$or = [
                { claimNumber: { $regex: search, $options: 'i' } },
                { employeeId: { $in: emps.map(e => e._id) } }
            ];
        }

        const total = await ExpenseClaim.countDocuments(query);
        const claims = await ExpenseClaim.find(query)
            .populate('employeeId', 'firstName lastName employeeCode department designation')
            .populate('categoryId', 'name code')
            .sort({ submittedAt: 1 }) // oldest first
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ success: true, data: claims, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/hradmin/history
exports.hrAdminGetHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, categoryId, employeeId, dateFrom, dateTo } = req.query;
        const query = { status: { $in: ['HR_APPROVED', 'SUPER_ADMIN_APPROVED', 'REJECTED', 'PAYMENT_PENDING', 'PAID', 'CANCELLED'] } };

        if (status && status !== 'all') {
            if (status.includes(',')) query.status = { $in: status.split(',') };
            else query.status = status;
        }
        if (categoryId) query.categoryId = categoryId;
        if (employeeId) query.employeeId = employeeId;
        if (dateFrom || dateTo) {
            query.expenseDate = {};
            if (dateFrom) query.expenseDate.$gte = new Date(dateFrom);
            if (dateTo) query.expenseDate.$lte = new Date(dateTo);
        }

        query.$and = [
            { $or: [{ status: { $ne: 'CANCELLED' } }, { status: 'CANCELLED', submittedAt: { $ne: null } }] }
        ];

        const total = await ExpenseClaim.countDocuments(query);
        const claims = await ExpenseClaim.find(query)
            .populate('employeeId', 'firstName lastName employeeCode department')
            .populate('categoryId', 'name code')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ success: true, data: claims, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/hradmin/:id — detail view
exports.hrAdminGetDetail = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id)
            .populate('employeeId', 'firstName lastName employeeCode department designation')
            .populate('categoryId', 'name code receiptRequired maxAmount monthlyLimit')
            .populate('hrAdminId', 'email')
            .populate('superAdminId', 'email');

        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

        const history = await ExpenseHistory.find({ expenseId: claim._id })
            .sort({ createdAt: 1 })
            .populate('performedBy', 'email role');

        res.json({ success: true, data: claim, history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/hradmin/approve
exports.hrAdminApprove = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'SUBMITTED') {
            return res.status(400).json({ success: false, message: `Cannot approve claim with status '${claim.status}'.` });
        }

        const { comment } = req.body;
        claim.hrAdminId = req.user._id;
        claim.hrAdminReviewedAt = new Date();
        claim.hrAdminComment = comment || null;
        claim.status = 'HR_APPROVED';
        await claim.save();

        await addHistory(claim._id, 'HR_APPROVED', req.user._id, req.user.role, comment || 'HR Admin approved the claim');

        // Notify Super Admins
        try {
            await notificationHelper.createNotification({
                roles: ['SuperAdmin'],
                title: 'Expense Claim — HR Approved',
                message: `Claim ${claim.claimNumber} from ${claim.employeeId.firstName} ${claim.employeeId.lastName} is pending your review.`,
                type: 'info',
                link: `/superadmin/expenses/pending`
            });
        } catch { }

        // Notify Employee
        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Claim — HR Approved',
                message: `Your claim ${claim.claimNumber} has been approved by HR and is now pending Super Admin review.`,
                type: 'success',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/hradmin/reject
exports.hrAdminReject = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'SUBMITTED') {
            return res.status(400).json({ success: false, message: `Cannot reject claim with status '${claim.status}'.` });
        }

        const { reason, attachments } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
        }

        claim.hrAdminId = req.user._id;
        claim.hrAdminReviewedAt = new Date();
        claim.rejectionReason = reason;
        if (attachments) claim.rejectionAttachments = attachments;
        claim.status = 'REJECTED';
        claim.resolvedAt = new Date();
        await claim.save();

        await addHistory(claim._id, 'REJECTED', req.user._id, req.user.role, reason);

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Claim Rejected',
                message: `Your claim ${claim.claimNumber} has been rejected by HR. Reason: ${reason}`,
                type: 'error',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/hradmin/correction
exports.hrAdminRequestCorrection = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'SUBMITTED') {
            return res.status(400).json({ success: false, message: `Cannot request correction for claim with status '${claim.status}'.` });
        }

        const { reason, attachments } = req.body;
        if (!reason || !reason.trim()) {
            return res.status(400).json({ success: false, message: 'Correction reason is required.' });
        }

        claim.hrAdminId = req.user._id;
        claim.hrAdminReviewedAt = new Date();
        claim.correctionReason = reason;
        if (attachments) claim.correctionAttachments = attachments;
        claim.status = 'CORRECTION_REQUIRED';
        await claim.save();

        await addHistory(claim._id, 'CORRECTION_REQUESTED', req.user._id, req.user.role, reason);

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Claim — Correction Required',
                message: `Your claim ${claim.claimNumber} requires corrections: ${reason}`,
                type: 'warning',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ========================
// SUPER ADMIN ROUTES
// ========================

// GET /api/expenses/superadmin/dashboard
exports.superAdminDashboard = async (req, res) => {
    try {
        const allStatuses = ['SUBMITTED', 'HR_APPROVED', 'SUPER_ADMIN_APPROVED', 'CORRECTION_REQUIRED', 'REJECTED', 'PAYMENT_PENDING', 'PAID', 'CANCELLED'];
        const counts = await Promise.all(allStatuses.map(s => {
            if (s === 'CANCELLED') return ExpenseClaim.countDocuments({ status: s, submittedAt: { $ne: null } });
            return ExpenseClaim.countDocuments({ status: s });
        }));
        const statusMap = {};
        allStatuses.forEach((s, i) => { statusMap[s] = counts[i]; });

        const matchCondition = { $and: [{ status: { $ne: 'DRAFT' } }, { $or: [{ status: { $ne: 'CANCELLED' } }, { status: 'CANCELLED', submittedAt: { $ne: null } }] }] };

        const totalClaimed = await ExpenseClaim.aggregate([{ $match: matchCondition }, { $group: { _id: null, t: { $sum: '$amountClaimed' } } }]);
        const totalApproved = await ExpenseClaim.aggregate([{ $match: { amountApproved: { $ne: null } } }, { $group: { _id: null, t: { $sum: '$amountApproved' } } }]);
        const totalPaid = await ExpenseClaim.aggregate([{ $match: { status: 'PAID' } }, { $group: { _id: null, t: { $sum: '$payment.paidAmount' } } }]);
        const pendingReimbursement = await ExpenseClaim.aggregate([{ $match: { status: { $in: ['SUPER_ADMIN_APPROVED', 'PAYMENT_PENDING'] } } }, { $group: { _id: null, t: { $sum: '$amountApproved' } } }]);

        const byCategory = await ExpenseClaim.aggregate([
            { $match: matchCondition },
            { $group: { _id: '$categoryId', count: { $sum: 1 }, amount: { $sum: '$amountClaimed' } } },
            { $lookup: { from: 'expensecategories', localField: '_id', foreignField: '_id', as: 'cat' } },
            { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
            { $project: { category: { $ifNull: ['$cat.name', 'Uncategorized'] }, count: 1, amount: 1 } },
            { $sort: { count: -1 } }
        ]);

        const recentClaims = await ExpenseClaim.find(matchCondition)
            .populate('employeeId', 'firstName lastName employeeCode')
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        const pendingApprovals = await ExpenseClaim.find({ status: 'HR_APPROVED' })
            .populate('employeeId', 'firstName lastName employeeCode department')
            .populate('categoryId', 'name')
            .sort({ updatedAt: 1 })
            .limit(10);

        res.json({
            success: true,
            data: {
                ...statusMap,
                total: counts.reduce((a, b) => a + b, 0),
                totalAmountClaimed: totalClaimed[0]?.t || 0,
                totalAmountApproved: totalApproved[0]?.t || 0,
                totalAmountPaid: totalPaid[0]?.t || 0,
                pendingReimbursementAmount: pendingReimbursement[0]?.t || 0,
                byCategory,
                recentClaims,
                pendingApprovals
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/superadmin/pending
exports.superAdminGetPending = async (req, res) => {
    try {
        const { page = 1, limit = 10, categoryId, search, dateFrom, dateTo, status } = req.query;
        const query = { status: { $in: ['HR_APPROVED', 'CORRECTION_REQUIRED'] } };

        if (status && status !== 'all') {
            if (status === 'PENDING') query.status = 'HR_APPROVED';
            else if (status === 'CORRECTION_REQUIRED') query.status = 'CORRECTION_REQUIRED';
        }

        if (categoryId) query.categoryId = categoryId;
        if (dateFrom || dateTo) {
            query.expenseDate = {};
            if (dateFrom) query.expenseDate.$gte = new Date(dateFrom);
            if (dateTo) query.expenseDate.$lte = new Date(dateTo);
        }
        if (search) {
            const emps = await Employee.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            query.$or = [
                { claimNumber: { $regex: search, $options: 'i' } },
                { employeeId: { $in: emps.map(e => e._id) } }
            ];
        }

        const total = await ExpenseClaim.countDocuments(query);
        const claims = await ExpenseClaim.find(query)
            .populate('employeeId', 'firstName lastName employeeCode department designation')
            .populate('categoryId', 'name code')
            .sort({ updatedAt: 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ success: true, data: claims, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/superadmin/all
exports.superAdminGetAll = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, categoryId, employeeId, paymentMethod, dateFrom, dateTo, search } = req.query;
        const excludeSA = ['DRAFT', 'SUBMITTED', 'CORRECTION_REQUIRED', 'HR_APPROVED'];
        const query = { status: { $nin: excludeSA } };

        if (status) {
            if (status.includes(',')) query.status = { $in: status.split(',').filter(s => !excludeSA.includes(s)) };
            else if (!excludeSA.includes(status)) query.status = status;
        }
        if (categoryId) query.categoryId = categoryId;
        if (employeeId) query.employeeId = employeeId;
        if (paymentMethod) query['payment.method'] = paymentMethod;
        if (dateFrom || dateTo) {
            query.expenseDate = {};
            if (dateFrom) query.expenseDate.$gte = new Date(dateFrom);
            if (dateTo) query.expenseDate.$lte = new Date(dateTo);
        }
        if (search) {
            const emps = await Employee.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            query.$or = [
                { claimNumber: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { employeeId: { $in: emps.map(e => e._id) } }
            ];
        }

        query.$and = [
            { $or: [{ status: { $ne: 'CANCELLED' } }, { status: 'CANCELLED', submittedAt: { $ne: null } }] }
        ];

        const total = await ExpenseClaim.countDocuments(query);
        const claims = await ExpenseClaim.find(query)
            .populate('employeeId', 'firstName lastName employeeCode department designation')
            .populate('categoryId', 'name code')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        res.json({ success: true, data: claims, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/expenses/superadmin/:id — full detail
exports.superAdminGetDetail = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id)
            .populate('employeeId', 'firstName lastName employeeCode department designation')
            .populate('categoryId', 'name code receiptRequired maxAmount monthlyLimit')
            .populate('hrAdminId', 'email')
            .populate('superAdminId', 'email');

        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });

        const history = await ExpenseHistory.find({ expenseId: claim._id })
            .sort({ createdAt: 1 })
            .populate('performedBy', 'email role');

        let hrAdminName = null, superAdminName = null;
        if (claim.hrAdminId) {
            const e = await Employee.findOne({ userId: claim.hrAdminId._id }).select('firstName lastName');
            hrAdminName = e ? `${e.firstName} ${e.lastName}` : claim.hrAdminId.email;
        }
        if (claim.superAdminId) {
            const e = await Employee.findOne({ userId: claim.superAdminId._id }).select('firstName lastName');
            superAdminName = e ? `${e.firstName} ${e.lastName}` : claim.superAdminId.email;
        }

        res.json({ success: true, data: { ...claim.toObject(), hrAdminName, superAdminName }, history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/superadmin/approve
exports.superAdminApprove = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'HR_APPROVED') {
            return res.status(400).json({ success: false, message: `Cannot approve claim with status '${claim.status}'.` });
        }

        let { approvedAmount, comment } = req.body;
        approvedAmount = Number(approvedAmount);

        if (!approvedAmount || approvedAmount <= 0) {
            return res.status(400).json({ success: false, message: 'Approved amount must be a positive number.' });
        }
        if (approvedAmount > claim.amountClaimed) {
            return res.status(400).json({ success: false, message: 'Approved amount cannot exceed claimed amount.' });
        }
        if (approvedAmount !== claim.amountClaimed && (!comment || !comment.trim())) {
            return res.status(400).json({ success: false, message: 'Comment is required when approved amount differs from claimed amount.' });
        }

        const oldAmount = claim.amountClaimed;
        claim.superAdminId = req.user._id;
        claim.superAdminReviewedAt = new Date();
        claim.superAdminComment = comment || null;
        claim.amountApproved = approvedAmount;
        claim.status = 'SUPER_ADMIN_APPROVED';
        await claim.save();

        await addHistory(claim._id, 'SUPER_ADMIN_APPROVED', req.user._id, req.user.role, comment || 'Super Admin approved');
        if (approvedAmount !== oldAmount) {
            await addHistory(claim._id, 'AMOUNT_CHANGED', req.user._id, req.user.role, comment, oldAmount, approvedAmount);
        }

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Claim — Fully Approved!',
                message: `Your claim ${claim.claimNumber} has been approved for ₹${approvedAmount}. Payment will be processed soon.`,
                type: 'success',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/superadmin/reject
exports.superAdminReject = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'HR_APPROVED') {
            return res.status(400).json({ success: false, message: `Cannot reject claim with status '${claim.status}'.` });
        }

        const { reason, attachments } = req.body;
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Rejection reason is required.' });

        claim.superAdminId = req.user._id;
        claim.superAdminReviewedAt = new Date();
        claim.rejectionReason = reason;
        if (attachments) claim.rejectionAttachments = attachments;
        claim.status = 'REJECTED';
        claim.resolvedAt = new Date();
        await claim.save();

        await addHistory(claim._id, 'REJECTED', req.user._id, req.user.role, reason);

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Claim Rejected',
                message: `Your claim ${claim.claimNumber} has been rejected. Reason: ${reason}`,
                type: 'error',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/superadmin/correction
exports.superAdminRequestCorrection = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'HR_APPROVED') {
            return res.status(400).json({ success: false, message: `Cannot request correction for claim with status '${claim.status}'.` });
        }

        const { reason, attachments } = req.body;
        if (!reason || !reason.trim()) return res.status(400).json({ success: false, message: 'Correction reason is required.' });

        claim.superAdminId = req.user._id;
        claim.superAdminReviewedAt = new Date();
        claim.correctionReason = reason;
        if (attachments) claim.correctionAttachments = attachments;
        claim.status = 'CORRECTION_REQUIRED';
        // Reset HR review so it restarts from Step 1
        claim.hrAdminId = undefined;
        claim.hrAdminReviewedAt = undefined;
        claim.hrAdminComment = undefined;
        await claim.save();

        await addHistory(claim._id, 'CORRECTION_REQUESTED', req.user._id, req.user.role, reason);

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Claim — Correction Required',
                message: `Super Admin has requested corrections on your claim ${claim.claimNumber}: ${reason}`,
                type: 'warning',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/payment/initiate
exports.initiatePayment = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status !== 'SUPER_ADMIN_APPROVED') {
            return res.status(400).json({ success: false, message: `Cannot initiate payment for claim with status '${claim.status}'.` });
        }

        const { method, payrollMonth, remarks, attachments } = req.body;
        if (!['BANK_TRANSFER', 'PAYROLL', 'CASH', 'OTHER'].includes(method)) {
            return res.status(400).json({ success: false, message: 'Invalid payment method.' });
        }

        if (method === 'PAYROLL') {
            if (!payrollMonth || !/^\d{4}-\d{2}$/.test(payrollMonth)) {
                return res.status(400).json({ success: false, message: 'Valid payroll month (YYYY-MM) is required for PAYROLL payment method.' });
            }

            // Check employee payroll record for that month
            const [yearStr, monthStr] = payrollMonth.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            const payrollRecord = await Payroll.findOne({
                employee: claim.employeeId._id,
                year,
                month
            });

            if (!payrollRecord) {
                return res.status(400).json({
                    success: false,
                    message: `No payroll record found for ${claim.employeeId.firstName} ${claim.employeeId.lastName} for ${payrollMonth}. Please generate payroll first or select a different payment method.`
                });
            }

            if (payrollRecord.status === 'Paid') {
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                return res.status(400).json({
                    success: false,
                    message: `Payroll for ${monthNames[month - 1]} ${year} is already finalized. Select a different payment method or an open payroll month.`
                });
            }
        }

        claim.status = 'PAYMENT_PENDING';
        claim.payment = {
            method,
            processedBy: req.user._id,
            payrollMonth: method === 'PAYROLL' ? payrollMonth : undefined,
            remarks,
            paymentAttachments: method !== 'PAYROLL' && attachments ? attachments : undefined
        };
        await claim.save();

        await addHistory(claim._id, 'PAYMENT_INITIATED', req.user._id, req.user.role, `Payment method: ${method}${payrollMonth ? `, Payroll Month: ${payrollMonth}` : ''}`);

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Payment Initiated',
                message: `Payment for your claim ${claim.claimNumber} of ₹${claim.amountApproved} has been initiated via ${method.replace('_', ' ')}.`,
                type: 'info',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/:id/payment/confirm
exports.confirmPayment = async (req, res) => {
    try {
        const claim = await ExpenseClaim.findById(req.params.id).populate('employeeId');
        if (!claim) return res.status(404).json({ success: false, message: 'Claim not found.' });
        if (claim.status === 'PAID') {
            return res.status(400).json({ success: false, message: 'This claim has already been paid.' });
        }
        if (claim.status !== 'PAYMENT_PENDING') {
            return res.status(400).json({ success: false, message: `Cannot confirm payment for claim with status '${claim.status}'.` });
        }

        const { paidAmount, paymentDate, transactionReference, remarks } = req.body;

        // Payroll integration
        if (claim.payment && claim.payment.method === 'PAYROLL') {
            // Prevent double payment
            if (claim.payment.payrollEntryId) {
                return res.status(400).json({ success: false, message: 'Reimbursement has already been added to payroll.' });
            }

            const payrollMonth = claim.payment.payrollMonth;
            const [yearStr, monthStr] = payrollMonth.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr);

            const payrollRecord = await Payroll.findOne({
                employee: claim.employeeId._id,
                year,
                month
            });

            if (!payrollRecord) {
                return res.status(400).json({ success: false, message: 'Payroll record not found. Cannot process payroll payment.' });
            }

            if (payrollRecord.status === 'Paid') {
                return res.status(400).json({ success: false, message: 'Payroll for this month is already finalized. Cannot add reimbursement.' });
            }

            // Add reimbursement to expenseReimbursement (never modifying existing salary components)
            const reimbursementAmount = claim.amountApproved;
            payrollRecord.earnings.expenseReimbursement = (payrollRecord.earnings.expenseReimbursement || 0) + reimbursementAmount;
            payrollRecord.grossSalary = (payrollRecord.grossSalary || 0) + reimbursementAmount;
            payrollRecord.netSalary = (payrollRecord.netSalary || 0) + reimbursementAmount;
            await payrollRecord.save();

            claim.payment.payrollEntryId = payrollRecord._id;
        }

        // Complete payment fields
        claim.payment.paidAmount = paidAmount || claim.amountApproved;
        claim.payment.paymentDate = paymentDate ? new Date(paymentDate) : new Date();
        claim.payment.transactionReference = transactionReference || null;
        if (remarks) claim.payment.remarks = remarks;
        claim.status = 'PAID';
        claim.resolvedAt = new Date();
        await claim.save();

        await addHistory(claim._id, 'PAID', req.user._id, req.user.role, `Payment confirmed. Method: ${claim.payment.method}. Amount: ₹${claim.payment.paidAmount}`);

        try {
            await notificationHelper.createNotificationForEmployee({
                employeeId: claim.employeeId._id,
                title: 'Expense Reimbursement Paid!',
                message: `Your claim ${claim.claimNumber} of ₹${claim.payment.paidAmount} has been successfully paid via ${claim.payment.method.replace('_', ' ')}.`,
                type: 'success',
                link: `/expenses/${claim._id}`
            });
        } catch { }

        res.json({ success: true, data: claim });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ========================
// CATEGORY MANAGEMENT (Super Admin)
// ========================

// GET /api/expenses/superadmin/categories
exports.adminGetCategories = async (req, res) => {
    try {
        const categories = await ExpenseCategory.find().sort({ name: 1 });
        const otherIndex = categories.findIndex(c => c.name === 'Other');
        if (otherIndex > -1) {
            const [other] = categories.splice(otherIndex, 1);
            categories.push(other);
        }
        res.json({ success: true, data: categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/expenses/superadmin/categories
exports.adminCreateCategory = async (req, res) => {
    try {
        const { name, code, description, receiptRequired, maxAmount, monthlyLimit } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'Category name is required.' });

        const existing = await ExpenseCategory.findOne({ name: { $regex: `^${name.trim()}$`, $options: 'i' } });
        if (existing) return res.status(400).json({ success: false, message: 'A category with this name already exists.' });

        const category = await ExpenseCategory.create({
            name: name.trim(),
            code: code ? code.toUpperCase().trim() : name.toUpperCase().replace(/[^A-Z0-9]/g, '_').trim(),
            description,
            receiptRequired: receiptRequired !== undefined ? receiptRequired : true,
            maxAmount: maxAmount || null,
            monthlyLimit: monthlyLimit || null,
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, data: category });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/expenses/superadmin/categories/:id
exports.adminUpdateCategory = async (req, res) => {
    try {
        const category = await ExpenseCategory.findById(req.params.id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });

        const { name, description, receiptRequired, maxAmount, monthlyLimit, isActive } = req.body;

        if (name && name.trim() !== category.name) {
            const existing = await ExpenseCategory.findOne({
                name: { $regex: `^${name.trim()}$`, $options: 'i' },
                _id: { $ne: category._id }
            });
            if (existing) return res.status(400).json({ success: false, message: 'A category with this name already exists.' });
        }

        if (name !== undefined) category.name = name.trim();
        if (description !== undefined) category.description = description;
        if (receiptRequired !== undefined) category.receiptRequired = receiptRequired;
        if (maxAmount !== undefined) category.maxAmount = maxAmount || null;
        if (monthlyLimit !== undefined) category.monthlyLimit = monthlyLimit || null;
        if (isActive !== undefined) category.isActive = isActive;
        category.updatedBy = req.user._id;

        await category.save();
        res.json({ success: true, data: category });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
