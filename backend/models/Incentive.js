const mongoose = require('mongoose');

const incentiveSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    incentiveType: { type: String, required: true },
    amount: { type: Number, required: true },
    target: { type: String },
    achievement: { type: String },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    remarks: { type: String },
    status: { type: String, enum: ['Pending', 'Approved', 'Paid'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Incentive', incentiveSchema);
