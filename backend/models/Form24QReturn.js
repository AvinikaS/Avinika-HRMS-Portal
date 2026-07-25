const mongoose = require('mongoose');

const form24QReturnSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    financialYear: { type: String, required: true }, // e.g., "2025-26"
    quarter: { type: Number, required: true, min: 1, max: 4 },
    receiptNumber: { type: String, required: true },
    dateOfFiling: { type: Date, default: Date.now },
    status: { type: String, enum: ['Filed', 'Pending'], default: 'Filed' }
}, { timestamps: true });

module.exports = mongoose.model('Form24QReturn', form24QReturnSchema);
