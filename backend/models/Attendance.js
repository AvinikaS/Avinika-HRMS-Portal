const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: Date, required: true },
    checkIn: Date,
    checkOut: Date,
    status: {
        type: String,
        enum: ['Present', 'Absent', 'Half-Day', 'Late', 'On Leave', 'Holiday', 'Weekend'],
        default: 'Present'
    },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    totalHours: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    // Security fields
    latitude: Number,
    longitude: Number,
    faceMatchScore: Number,
    livenessStatus: { type: String, enum: ['Passed', 'Failed', 'Skipped'], default: 'Skipped' },
    attendanceSelfiePath: String,
    ipAddress: String,
    notes: String
}, { timestamps: true });

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
