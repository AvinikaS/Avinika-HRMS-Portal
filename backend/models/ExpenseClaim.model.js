const mongoose = require('mongoose');

// Counter for auto-incrementing claim numbers per year
const expenseCounterSchema = new mongoose.Schema({
    _id: String,        // e.g. "EXP-2026"
    seq: { type: Number, default: 0 }
});
const ExpenseCounter = mongoose.model('ExpenseCounter', expenseCounterSchema);

const receiptSchema = new mongoose.Schema({
    fileName: String,
    fileUrl: String,
    publicId: String,
    fileType: String,
    fileSize: Number,
    uploadedAt: { type: Date, default: Date.now }
}, { _id: false });

const paymentSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: ['BANK_TRANSFER', 'PAYROLL', 'CASH', 'OTHER']
    },
    paidAmount: Number,
    paymentDate: Date,
    transactionReference: String,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: String,
    payrollMonth: String,       // format: "YYYY-MM"
    paymentAttachments: [receiptSchema],
    payrollEntryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payroll' }
}, { _id: false });

const expenseClaimSchema = new mongoose.Schema({
    claimNumber: { type: String, unique: true },

    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
    customCategoryName: { type: String, default: null },

    expenseDate: { type: Date, required: true },
    expenseEndDate: { type: Date }, // Optional end date for multi-day expenses
    amountClaimed: { type: Number, required: true, min: 1 },
    amountApproved: { type: Number, default: null },
    currency: { type: String, default: 'INR' },

    description: { type: String, required: true, maxlength: 2000 },
    vendor: String,
    location: String,
    businessPurpose: String,
    notes: String,

    receipt: { type: receiptSchema, default: null }, // Legacy
    receipts: { type: [receiptSchema], default: [] },

    exceedsPolicy: { type: Boolean, default: false },

    status: {
        type: String,
        enum: [
            'DRAFT',
            'SUBMITTED',
            'HR_APPROVED',
            'SUPER_ADMIN_APPROVED',
            'CORRECTION_REQUIRED',
            'REJECTED',
            'PAYMENT_PENDING',
            'PAID',
            'CANCELLED'
        ],
        default: 'DRAFT'
    },

    // Step 1 — HR Admin review
    hrAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hrAdminReviewedAt: Date,
    hrAdminComment: String,

    // Step 2 — Super Admin review
    superAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    superAdminReviewedAt: Date,
    superAdminComment: String,
    rejectionReason: String,
    rejectionAttachments: [receiptSchema],
    correctionReason: String,
    correctionAttachments: [receiptSchema],

    payment: { type: paymentSchema, default: null },

    submittedAt: Date,
    resolvedAt: Date
}, { timestamps: true });

// Indexes
expenseClaimSchema.index({ employeeId: 1 });
expenseClaimSchema.index({ status: 1 });
expenseClaimSchema.index({ categoryId: 1 });
expenseClaimSchema.index({ expenseDate: 1 });
expenseClaimSchema.index({ createdAt: -1 });

// Pre-save hook: generate claimNumber
expenseClaimSchema.pre('save', async function (next) {
    if (this.claimNumber) return next();
    try {
        const year = new Date().getFullYear();
        const counterId = `EXP-${year}`;
        const counter = await ExpenseCounter.findByIdAndUpdate(
            counterId,
            { $inc: { seq: 1 } },
            { new: true, upsert: true }
        );
        this.claimNumber = `EXP-${year}-${String(counter.seq).padStart(5, '0')}`;
        next();
    } catch (err) {
        next(err);
    }
});

const ExpenseClaim = mongoose.model('ExpenseClaim', expenseClaimSchema);
module.exports = { ExpenseClaim, ExpenseCounter };
