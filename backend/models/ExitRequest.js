const mongoose = require('mongoose');

const exitRequestSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    exitReason: {
        type: String,
        default: 'resignation'
    },
    resignationDate: { type: Date, default: Date.now },
    lastWorkingDay: { type: Date },
    noticePeriodRequired: { type: Number, default: 30 },
    noticePeriodServed: { type: Number, default: 0 },
    approvalStatus: {
        type: String,
        enum: ['draft', 'pending', 'hr_approved', 'management_approved', 'exit_initiated', 'completed', 'rejected'],
        default: 'pending'
    },
    remarks: { type: String },
    resignationLetter: { type: String },
    earlyReleaseRequest: { type: String },

    // Death / Disablement specific
    nomineeName: { type: String },
    nomineeRelationship: { type: String },
    nomineeBankAccount: { type: String },
    nomineeIFSC: { type: String },
    deathCertificateNumber: { type: String },
    eventDate: { type: Date },

    // Clearance Checklist
    clearanceChecklist: {
        assetsReturned: { type: Boolean, default: false },
        idCardReturned: { type: Boolean, default: false },
        accessCardReturned: { type: Boolean, default: false },
        ktCompleted: { type: Boolean, default: false },
        emailHandoverDone: { type: Boolean, default: false },
        leavesSettled: { type: Boolean, default: false },
        financeClearance: { type: Boolean, default: false },
        itAdminClearance: { type: Boolean, default: false }
    },
    clearanceStatus: { type: String, enum: ['Pending', 'In Progress', 'Cleared'], default: 'Pending' },
    clearanceOverrideReason: { type: String },
    initiatedBy: {
        type: String,
        enum: ['employee', 'admin'],
        default: 'employee'
    },
    adminEdited: {
        type: Boolean,
        default: false
    },
    adminEditDetails: {
        type: String
    },
    rejectionReason: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('ExitRequest', exitRequestSchema);
