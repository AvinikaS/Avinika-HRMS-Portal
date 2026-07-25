const mongoose = require('mongoose');

const incomeTaxProfileSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    financialYear: { type: String, required: true },

    // Tax Regime
    taxRegime: { type: String, enum: ['Old', 'New'], default: 'New' },

    // Declarations
    investments80C: { type: Number, default: 0 },
    medical80D: { type: Number, default: 0 },
    nps80CCD: { type: Number, default: 0 },
    educationLoan80E: { type: Number, default: 0 },
    housingLoanInterest: { type: Number, default: 0 },
    hraExemption: { type: Number, default: 0 },
    standardDeduction: { type: Number, default: 50000 },

    // Other Incomes
    otherIncome: { type: Number, default: 0 },

    // Document Proof Path
    proofs: [{
        name: String,
        url: String,
        status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' }
    }],

    // Auto-calculated variables
    annualGrossIncome: { type: Number, default: 0 },
    totalExemptions: { type: Number, default: 0 },
    taxableIncome: { type: Number, default: 0 },
    estimatedAnnualTax: { type: Number, default: 0 },
    monthlyTDS: { type: Number, default: 0 }

}, { timestamps: true });

incomeTaxProfileSchema.index({ employee: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.model('IncomeTaxProfile', incomeTaxProfileSchema);
