const mongoose = require('mongoose');

const form16Schema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    financialYear: { type: String, required: true },
    assessmentYear: { type: String, required: true },
    pan: { type: String },
    taxRegime: { type: String },
    form12BBSubmitted: { type: Boolean, default: false },

    // Part A
    employerTAN: { type: String },
    employerPAN: { type: String },
    quarterlyTDS: [{
        quarter: String,
        period: String,
        deducted: { type: Number, default: 0 },
        deposited: { type: Number, default: 0 },
        receiptNumber: String
    }],
    totalTDSDeducted: { type: Number, default: 0 },
    totalTDSDeposited: { type: Number, default: 0 },

    // Part B
    annualBasic: { type: Number, default: 0 },
    annualHRA: { type: Number, default: 0 },
    annualSpecialAllowance: { type: Number, default: 0 },
    annualConveyance: { type: Number, default: 0 },
    annualMedical: { type: Number, default: 0 },
    annualOtherAllowance: { type: Number, default: 0 },
    annualBonus: { type: Number, default: 0 },
    annualIncentive: { type: Number, default: 0 },
    grossSalary: { type: Number, default: 0 },

    // Section 16
    standardDeduction: { type: Number, default: 0 },

    // Chapter VI-A
    deduction80C: { type: Number, default: 0 },
    deduction80D: { type: Number, default: 0 },
    deduction80E: { type: Number, default: 0 },
    homeLoanInterest: { type: Number, default: 0 },
    hraExemption: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    totalChapterVIA: { type: Number, default: 0 },

    // Tax Computation
    taxableIncome: { type: Number, default: 0 },
    taxOnIncome: { type: Number, default: 0 },
    cess: { type: Number, default: 0 },
    rebate87A: { type: Number, default: 0 },
    netTaxPayable: { type: Number, default: 0 },
    balanceTaxPayable: { type: Number, default: 0 },

    // Meta
    status: { type: String, enum: ['not_generated', 'generated', 'sent_to_employee'], default: 'not_generated' },
    generatedOn: { type: Date },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    sentOn: { type: Date },
    pdfPath: { type: String },
    cloudinaryPublicId: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Form16', form16Schema);
