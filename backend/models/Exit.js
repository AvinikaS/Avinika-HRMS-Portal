const mongoose = require('mongoose');

const exitSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    // Resignation
    resignationDate: { type: Date, required: true, default: Date.now },
    reason: { type: String, required: true },
    expectedLastWorkingDay: { type: Date },
    approvedLastWorkingDay: { type: Date },

    // Workflow tracking
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Checklist Pending', 'F&F Pending', 'Completed', 'Rejected'],
        default: 'Pending'
    },

    // Clearance Checklist
    clearanceChecklist: {
        itAssetsReturned: { type: Boolean, default: false },
        idCardReturned: { type: Boolean, default: false },
        financeCleared: { type: Boolean, default: false },
        knowledgeTransfer: { type: Boolean, default: false }
    },

    // F&F Calculations
    fnfDetails: {
        leaveEncashmentDays: { type: Number, default: 0 },
        leaveEncashmentAmount: { type: Number, default: 0 },

        noticePeriodRecovery: { type: Number, default: 0 },
        noticePeriodBuyout: { type: Number, default: 0 },

        outstandingLoans: { type: Number, default: 0 },

        gratuityAmount: { type: Number, default: 0 }, // If > 5 years
        otherEarnings: { type: Number, default: 0 },
        otherDeductions: { type: Number, default: 0 },

        grossFnF: { type: Number, default: 0 },
        taxDeducted: { type: Number, default: 0 },
        netPayable: { type: Number, default: 0 }
    },

    adminRemarks: { type: String }

}, { timestamps: true });

module.exports = mongoose.model('Exit', exitSchema);
