const mongoose = require('mongoose');

const ffSettlementSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    exitRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExitRequest', required: true },
    pendingSalary: { type: Number, default: 0 },
    leaveEncashment: { type: Number, default: 0 },
    gratuityAmount: { type: Number, default: 0 },
    otherEarnings: { type: Number, default: 0 },
    noticePeriodRecovery: { type: Number, default: 0 },
    loanRecovery: { type: Number, default: 0 },
    advanceRecovery: { type: Number, default: 0 },
    otherDeductions: { type: Number, default: 0 },
    netFFPayable: { type: Number, default: 0 },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedOn: { type: Date },
    paymentStatus: { type: String, enum: ['pending', 'processed', 'paid'], default: 'pending' },
    paymentDate: { type: Date },
    paymentMode: { type: String, enum: ['Bank Transfer', 'Cheque'] },
    transactionReference: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('FFSettlement', ffSettlementSchema);
