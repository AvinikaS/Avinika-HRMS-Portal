const mongoose = require('mongoose');

const attendanceRegularizationSchema = new mongoose.Schema({
    regularizationNumber: { type: String, unique: true, sparse: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    attendanceDate: { type: Date, required: true },
    existingAttendanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance' },
    requestedCheckIn: { type: String, required: true },
    requestedCheckOut: { type: String, required: true },
    attendanceType: {
        type: String,
        enum: ['FULL_DAY', 'HALF_DAY', 'WFH', 'ON_DUTY', 'OTHER'],
        default: 'FULL_DAY'
    },
    reason: {
        type: String,
        enum: [
            'FORGOT_CHECK_IN',
            'FORGOT_CHECK_OUT',
            'FORGOT_BOTH',
            'BIOMETRIC_ISSUE',
            'GPS_ISSUE',
            'FACE_VERIFICATION_ISSUE',
            'SYSTEM_TECHNICAL_ISSUE',
            'OTHER'
        ],
        required: true
    },
    comment: String,
    attachments: [{
        fileName: String,
        fileUrl: String,
        publicId: String,
        fileType: String,
        fileSize: Number,
        uploadedAt: { type: Date, default: Date.now }
    }],
    status: {
        type: String,
        enum: [
            'DRAFT',
            'PENDING_HR_REVIEW',
            'INFORMATION_REQUIRED',
            'APPROVED',
            'REJECTED',
            'CANCELLED'
        ],
        default: 'DRAFT'
    },
    hrAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hrAdminReviewedAt: Date,
    hrAdminComment: String,
    rejectionReason: String,
    informationRequestNote: String,

    payrollStatus: {
        type: String,
        enum: ['NOT_CHECKED', 'PAYROLL_OPEN', 'PAYROLL_PROCESSED'],
        default: 'NOT_CHECKED'
    },
    payrollAdjustmentCreated: { type: Boolean, default: false },
    payrollAdjustmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollAdjustment' },

    helpdeskTicketId: { type: mongoose.Schema.Types.ObjectId, ref: 'HelpdeskTicket' },
    submittedAt: Date
}, { timestamps: true });

attendanceRegularizationSchema.index({ employeeId: 1 });
attendanceRegularizationSchema.index({ attendanceDate: 1 });
attendanceRegularizationSchema.index({ status: 1 });
attendanceRegularizationSchema.index({ createdAt: -1 });

attendanceRegularizationSchema.pre('save', async function (next) {
    if (this.regularizationNumber) return next();
    try {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({
            regularizationNumber: { $regex: `^AR-${year}-` }
        });
        this.regularizationNumber = `AR-${year}-${String(count + 1).padStart(5, '0')}`;
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('AttendanceRegularization', attendanceRegularizationSchema);
