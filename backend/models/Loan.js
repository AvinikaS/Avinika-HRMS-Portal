const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    // Loan Details
    loanCategory: { type: String, required: true },
    amount: { type: Number, required: true },
    expectedMonth: { type: Number, required: true },
    expectedYear: { type: Number, required: true },
    emiStartMonth: { type: Number, required: true },
    emiStartYear: { type: Number, required: true },
    repaymentTerms: { type: Number, required: true }, // in months

    // Interest
    interestType: { type: String, enum: ['No Interest', 'Flat Interest'], default: 'No Interest' },
    interestRate: { type: Number, default: 0 },

    // Auto-calculated totals
    totalRepayment: { type: Number, required: true },
    emiAmount: { type: Number, required: true },
    outstandingAmount: { type: Number, required: true },

    // Metadata
    reason: { type: String },
    documentUrl: { type: String },
    disbursalMode: { type: String, enum: ['Payroll System', 'Outside Payroll', 'Cash', 'Bank Transfer'] },

    // Status Flow
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Disbursed', 'In Progress', 'Closed', 'Cancelled'],
        default: 'Pending'
    },

    // Histories
    history: [{
        status: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now },
        remark: String
    }],

    recoveryHistory: [{
        month: Number,
        year: Number,
        amountDeducted: Number,
        overrideType: { type: String, enum: ['None', 'Skip', 'Prepay'], default: 'None' },
        deductedAt: { type: Date, default: Date.now }
    }],

    // For specific month overrides setup by HR (cleared after month is over)
    currentOverride: {
        month: Number,
        year: Number,
        overrideType: { type: String, enum: ['Skip', 'Prepay'] }
    }
}, { timestamps: true });

module.exports = mongoose.model('Loan', loanSchema);
