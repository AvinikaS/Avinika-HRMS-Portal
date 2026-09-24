const mongoose = require('mongoose');

const expenseHistorySchema = new mongoose.Schema({
    expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpenseClaim', required: true },
    action: {
        type: String,
        enum: [
            'CREATED', 'SUBMITTED', 'HR_APPROVED', 'SUPER_ADMIN_APPROVED',
            'CORRECTION_REQUESTED', 'RESUBMITTED', 'REJECTED',
            'PAYMENT_INITIATED', 'PAID', 'CANCELLED',
            'AMOUNT_CHANGED', 'STATUS_CHANGED'
        ],
        required: true
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByRole: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    comment: String
}, { timestamps: true });

expenseHistorySchema.index({ expenseId: 1, createdAt: 1 });

module.exports = mongoose.model('ExpenseHistory', expenseHistorySchema);
