const mongoose = require('mongoose');

const helpdeskMessageSchema = new mongoose.Schema({
    ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpdeskTicket', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderRole: {
        type: String,
        enum: ['EMPLOYEE', 'HR_ADMIN', 'SUPER_ADMIN', 'SYSTEM']
    },
    message: { type: String, maxlength: 5000 },
    messageType: {
        type: String,
        enum: ['PUBLIC_REPLY', 'INTERNAL_NOTE', 'SYSTEM_EVENT'],
        default: 'PUBLIC_REPLY'
    },
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number
    }]
}, { timestamps: true });

// Compound index for ordered conversation retrieval
helpdeskMessageSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model('HelpdeskMessage', helpdeskMessageSchema);
