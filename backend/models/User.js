const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
        type: String,
        enum: ['SuperAdmin', 'HRAdmin', 'Recruiter', 'Manager', 'Employee'],
        default: 'Employee'
    },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    profileImage: String,
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    resetOtp: String,
    otpExpiry: Date,
    otpAttempts: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
