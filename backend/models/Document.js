const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    name: { type: String, required: true },
    type: { type: String, default: 'Other' },
    fileUrl: { type: String, required: true },
    fileSize: Number,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    rejectionReason: String
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
