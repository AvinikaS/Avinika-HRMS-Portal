const User = require('../models/User');
const Employee = require('../models/Employee');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('../utils/emailService');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

// POST /api/auth/login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' });
        }
        const user = await User.findOne({ email }).populate('employeeId');
        if (!user || !(await user.matchPassword(password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account is deactivated' });
        }
        await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
        res.json({
            success: true,
            token: generateToken(user._id),
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                employeeId: user.employeeId,
                profileImage: user.profileImage // Only use User's explicit image explicitly uploaded by employee
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/auth/register
exports.register = async (req, res) => {
    try {
        const { email, password, role, employeeId } = req.body;
        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ success: false, message: 'User already exists' });
        const user = await User.create({ email, password, role: role || 'Employee', employeeId });
        res.status(201).json({
            success: true,
            token: generateToken(user._id),
            user: { id: user._id, email: user.email, role: user.role }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('employeeId').select('-password');
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Please provide current and new password' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({ success: false, message: 'New password must be different from current password' });
        }
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            // Using 400 instead of 401 to prevent frontend interceptor from logging out the user
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
        user.password = newPassword;
        await user.save();
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/auth/seed
exports.seedAdmin = async (req, res) => {
    try {
        const adminExists = await User.findOne({ role: 'SuperAdmin' });
        if (adminExists) return res.status(400).json({ success: false, message: 'Super Admin already exists' });
        const admin = await User.create({
            email: 'admin@hrms.com',
            password: 'admin123',
            role: 'SuperAdmin'
        });
        res.status(201).json({
            success: true,
            message: 'Super Admin created',
            credentials: { email: 'admin@hrms.com', password: 'admin123' }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/auth/profile-image
exports.uploadProfileImage = async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) {
            return res.status(400).json({ success: false, message: 'Please upload an image' });
        }
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Delete old image from Cloudinary if exists
        if (user.profileImage) {
            const oldPublicId = getPublicIdFromUrl(user.profileImage);
            await deleteFromCloudinary(oldPublicId);
        }

        // Save on User record
        user.profileImage = imageUrl;
        await user.save();

        res.json({ success: true, message: 'Profile image uploaded', profileImage: imageUrl });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/auth/profile-image
exports.deleteProfileImage = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Delete from Cloudinary
        if (user.profileImage) {
            const publicId = getPublicIdFromUrl(user.profileImage);
            await deleteFromCloudinary(publicId);
            user.profileImage = null;
            await user.save();
        }

        res.json({ success: true, message: 'Profile image deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Please provide your email address' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });
        if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated' });

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        user.resetOtp = otp;
        user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        user.otpAttempts = 0;
        await user.save();

        // Send OTP via email
        try {
            await sendOtpEmail(email, otp);
        } catch (emailErr) {
            console.error('Email send failed:', emailErr.message);
            // Still return success so user knows OTP was generated (for dev/testing, log OTP)
            console.log(`[DEV] OTP for ${email}: ${otp}`);
        }

        res.json({ success: true, message: 'OTP sent to your email address' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP are required' });

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        // Check attempts
        if (user.otpAttempts >= 3) {
            user.resetOtp = undefined;
            user.otpExpiry = undefined;
            user.otpAttempts = 0;
            await user.save();
            return res.status(429).json({ success: false, message: 'Too many attempts. Please request a new OTP.' });
        }

        // Check expiry
        if (!user.resetOtp || !user.otpExpiry || new Date() > user.otpExpiry) {
            user.resetOtp = undefined;
            user.otpExpiry = undefined;
            user.otpAttempts = 0;
            await user.save();
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        // Verify OTP
        if (user.resetOtp !== otp) {
            user.otpAttempts += 1;
            await user.save();
            const remaining = 3 - user.otpAttempts;
            return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining} attempt(s) remaining.` });
        }

        // OTP is valid — generate a temporary reset token
        const resetToken = jwt.sign({ id: user._id, purpose: 'reset' }, process.env.JWT_SECRET, { expiresIn: '10m' });

        // Clear OTP (one-time use)
        user.resetOtp = undefined;
        user.otpExpiry = undefined;
        user.otpAttempts = 0;
        await user.save();

        res.json({ success: true, message: 'OTP verified successfully', resetToken });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;
        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        // Verify reset token
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        } catch {
            return res.status(401).json({ success: false, message: 'Reset session expired. Please start over.' });
        }
        if (decoded.purpose !== 'reset') {
            return res.status(401).json({ success: false, message: 'Invalid reset token' });
        }

        const user = await User.findById(decoded.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.password = newPassword; // pre-save hook will hash it
        await user.save();

        console.log(`[SECURITY] Password reset for: ${user.email}`);
        res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
