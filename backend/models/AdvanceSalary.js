const mongoose = require('mongoose');

const advanceSalarySchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    amount: { type: Number, required: true },
    requestMonth: { type: Number, required: true },
    requestYear: { type: Number, required: true },

    recoveryStartMonth: { type: Number, required: true },
    recoveryStartYear: { type: Number, required: true },
    recoveryDuration: { type: Number, required: true }, // months

    reason: { type: String },
    documentUrl: { type: String },
    disbursalMode: { type: String, enum: ['Payroll System', 'Outside Payroll', 'Cash', 'Bank Transfer'] },

    // Auto-calculated
    installmentAmount: { type: Number, required: true },
    outstandingAmount: { type: Number, required: true },

    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Recovering', 'Recovered'],
        default: 'Pending'
    },

    recoveryHistory: [{
        month: Number,
        year: Number,
        amountDeducted: Number,
        deductedAt: { type: Date, default: Date.now }
    }],

    history: [{
        status: String,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedAt: { type: Date, default: Date.now },
        remark: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('AdvanceSalary', advanceSalarySchema);
