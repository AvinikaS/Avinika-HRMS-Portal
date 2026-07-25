const router = require('express').Router();
const { login, register, getMe, changePassword, seedAdmin, uploadProfileImage, deleteProfileImage, forgotPassword, verifyOtp, resetPassword } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

router.post('/login', login);
router.post('/register', protect, authorize('SuperAdmin', 'HRAdmin'), register);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.put('/profile-image', protect, uploadProfileImage);
router.delete('/profile-image', protect, deleteProfileImage);
router.post('/seed', seedAdmin);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
