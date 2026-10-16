const mongoose = require('mongoose');

const attendanceVerificationLogSchema = new mongoose.Schema({
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    attemptTime: { type: Date, default: Date.now },
    step: {
        type: String,
        enum: [
            'LOCATION_VERIFIED',
            'LIVENESS_PASSED',
            'LIVENESS_FAILED',
            'FACE_VERIFICATION_FAILED',
            'CHECKIN_SUCCESSFUL',
            'CHECKIN_FAILED',
            'ATTEMPT_ABANDONED'
        ],
        required: true
    },
    latitude: Number,
    longitude: Number,
    distance: Number,
    allowedRadius: Number,
    isLocationAllowed: { type: Boolean, default: true },
    livenessStatus: { type: String, default: 'Incomplete' },
    faceMatchScore: Number,
    ipAddress: String,
    statusMessage: String
}, { timestamps: true });

attendanceVerificationLogSchema.index({ employeeId: 1, date: 1, attemptTime: -1 });

module.exports = mongoose.model('AttendanceVerificationLog', attendanceVerificationLogSchema);
