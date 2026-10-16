const mongoose = require('mongoose');

const attendanceAuditLogSchema = new mongoose.Schema({
    attendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
    regularizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'AttendanceRegularization' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    action: {
        type: String,
        enum: [
            'CHECKED_IN', 'CHECKED_OUT', 'ATTENDANCE_CREATED',
            'ATTENDANCE_UPDATED', 'STATUS_CHANGED',
            'REGULARIZATION_DRAFT_CREATED',
            'REGULARIZATION_SUBMITTED', 'REGULARIZATION_RESUBMITTED', 'REGULARIZATION_APPROVED',
            'REGULARIZATION_REJECTED', 'REGULARIZATION_CANCELLED', 'REGULARIZATION_INFO_REQUIRED', 'ADMIN_CORRECTION',
            'PAYROLL_SYNC', 'PAYROLL_SYNC_FAILED'
        ],
        required: true
    },
    previousValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByRole: { type: String },
    reason: String,
    source: { type: String, default: 'SYSTEM' },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

attendanceAuditLogSchema.index({ attendanceId: 1, timestamp: -1 });
attendanceAuditLogSchema.index({ employeeId: 1, date: 1 });

module.exports = mongoose.model('AttendanceAuditLog', attendanceAuditLogSchema);
