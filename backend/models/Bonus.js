const mongoose = require('mongoose');

const bonusSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    bonusType: { type: String, required: true },
    amount: { type: Number, required: true },
    month: { type: Number, required: true },
    financialYear: { type: String, required: true },
    remarks: { type: String },
    status: { type: String, enum: ['Pending', 'Approved', 'Paid'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Bonus', bonusSchema);
