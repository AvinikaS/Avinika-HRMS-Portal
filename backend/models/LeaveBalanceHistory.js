const mongoose = require('mongoose');

const leaveBalanceHistorySchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    leaveType: { type: String, required: true }, // 'casual', 'sick', 'earned', 'other', 'all'
    operation: { type: String, enum: ['add', 'set'], required: true },
    amount: { type: Number, required: true },
    beforeBalance: { type: Number, required: true },
    afterBalance: { type: Number, required: true },
    adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The admin/HR who made the adjustments
    remarks: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('LeaveBalanceHistory', leaveBalanceHistorySchema);
