const mongoose = require('mongoose');

const payrollAdjustmentSchema = new mongoose.Schema({
    adjustmentNumber: { type: String, unique: true, sparse: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    adjustmentType: {
        type: String,
        enum: [
            'ATTENDANCE_ARREAR',
            'ATTENDANCE_DEDUCTION_CORRECTION',
            'SALARY_ARREAR',
            'OVERPAYMENT_RECOVERY',
            'PAYROLL_CORRECTION',
            'LEAVE_ADJUSTMENT',
            'BONUS_ADJUSTMENT',
            'INCENTIVE_ADJUSTMENT',
            'OTHER_ADJUSTMENT'
        ],
        required: true
    },
    direction: {
        type: String,
        enum: ['CREDIT', 'DEBIT'],
        required: true
    },
    amount: { type: Number, required: true, min: 0.01 },
    originalPayrollMonth: { type: String, required: true }, // "YYYY-MM"
    adjustmentPayrollMonth: { type: String, required: true }, // "YYYY-MM"
    sourceType: {
        type: String,
        enum: [
            'ATTENDANCE_REGULARIZATION',
            'HELPDESK_TICKET',
            'MANUAL_HR',
            'MANUAL_SUPERADMIN'
        ],
        required: true
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    reason: { type: String, required: true },
    comment: String,
    status: {
        type: String,
        enum: [
            'DRAFT',
            'PENDING_HR_APPROVAL',
            'PENDING_SUPERADMIN_APPROVAL',
            'APPROVED',
            'REJECTED',
            'APPLIED',
            'CANCELLED'
        ],
        default: 'DRAFT'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByRole: String,

    hrApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hrApprovedAt: Date,

    superAdminApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    superAdminApprovedAt: Date,

    rejectionReason: String,

    appliedToPayrollId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' },
    appliedAt: Date,
    appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    payslipLabel: String
}, { timestamps: true });

payrollAdjustmentSchema.index({ employeeId: 1 });
payrollAdjustmentSchema.index({ status: 1 });
payrollAdjustmentSchema.index({ adjustmentPayrollMonth: 1 });
payrollAdjustmentSchema.index({ sourceId: 1 });
payrollAdjustmentSchema.index({ originalPayrollMonth: 1 });

payrollAdjustmentSchema.pre('save', async function (next) {
    if (this.adjustmentNumber) return next();
    try {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            adjustmentNumber: { $regex: `^PA-${year}-` }
        });
        this.adjustmentNumber = `PA-${year}-${String(count + 1).padStart(5, '0')}`;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('PayrollAdjustment', payrollAdjustmentSchema);
