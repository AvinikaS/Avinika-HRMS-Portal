const mongoose = require('mongoose');

const gratuityCalculationSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    exitRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExitRequest', required: true },
    doj: { type: Date, required: true },
    lwd: { type: Date, required: true },
    totalServiceYears: { type: Number, required: true },
    totalServiceMonths: { type: Number, required: true },
    totalServiceDays: { type: Number, required: true },
    fifthYearDaysCount: { type: Number, default: 0 },
    workWeekType: { type: String, enum: ['5day', '6day'], required: true },
    eligibilityStatus: { type: String, enum: ['eligible', 'not_eligible', 'waived_death_disablement'], required: true },
    eligibilityReason: { type: String },
    lastDrawnBasic: { type: Number, default: 0 },
    grossSalaryForWageRule: { type: Number, default: 0 },
    effectiveBasicForCalculation: { type: Number, default: 0 },
    completedYearsRounded: { type: Number, default: 0 },
    gratuityAmount: { type: Number, default: 0 },
    taxExemptAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    paymentDueDate: { type: Date, required: true },
    paymentStatus: { type: String, enum: ['pending', 'processed', 'paid'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('GratuityCalculation', gratuityCalculationSchema);
