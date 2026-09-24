const mongoose = require('mongoose');

const helpdeskTicketSchema = new mongoose.Schema({
    ticketNumber: { type: String },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    subject: { type: String, required: true, maxlength: 200, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpdeskCategory' },
    description: { type: String, required: true, maxlength: 2000 },
    attachments: [{
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number
    }],
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    status: {
        type: String,
        enum: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_FOR_EMPLOYEE', 'RESOLVED', 'CLOSED', 'REOPENED'],
        default: 'OPEN'
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: Date,
    resolvedAt: Date,
    closedAt: Date,
    reopenedAt: Date,
    feedback: {
        rating: { type: Number, min: 1, max: 5 },
        comment: String,
        submittedAt: Date
    }
}, { timestamps: true });

// Indexes — ticketNumber unique defined here only (not in field def above)
helpdeskTicketSchema.index({ ticketNumber: 1 }, { unique: true, sparse: true });
helpdeskTicketSchema.index({ employeeId: 1 });
helpdeskTicketSchema.index({ status: 1 });
helpdeskTicketSchema.index({ priority: 1 });
helpdeskTicketSchema.index({ assignedTo: 1 });
helpdeskTicketSchema.index({ categoryId: 1 });
helpdeskTicketSchema.index({ createdAt: -1 });

// Pre-save: generate ticketNumber
helpdeskTicketSchema.pre('save', async function (next) {
    if (this.ticketNumber) return next();
    try {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            ticketNumber: { $regex: `^HR-${year}-` }
        });
        this.ticketNumber = `HR-${year}-${String(count + 1).padStart(5, '0')}`;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('HelpdeskTicket', helpdeskTicketSchema);
