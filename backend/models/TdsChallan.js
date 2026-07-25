const mongoose = require('mongoose');

const challanSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    financialYear: { type: String, required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    bsrCode: { type: String, required: true },
    challanSerial: { type: String, required: true },
    depositDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    interest: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    mappedEmployees: [{
        employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        amount: { type: Number, required: true }
    }]
}, { timestamps: true });

module.exports = mongoose.model('TdsChallan', challanSchema);
