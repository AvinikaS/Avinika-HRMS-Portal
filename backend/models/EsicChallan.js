const mongoose = require('mongoose');

const esicChallanSchema = new mongoose.Schema({
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    contributionPeriod: { type: String, required: true },
    amount: { type: Number, default: 0 },
    challanNumber: { type: String },
    paymentDate: { type: Date },
    transactionId: { type: String },
    status: { type: String, enum: ['Not Generated', 'Generated', 'Payment Pending', 'Paid', 'Completed'], default: 'Not Generated' }
}, { timestamps: true });

esicChallanSchema.index({ month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('EsicChallan', esicChallanSchema);
