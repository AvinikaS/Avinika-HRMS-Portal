const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        const userRole = req.user?.role?.trim();
        const allowedRoles = roles.map(r => r.trim());

        console.log('--- Auth Debug ---');
        console.log('Target roles:', allowedRoles);
        console.log('User role:', userRole);
        console.log('Match found:', allowedRoles.includes(userRole));

        if (!userRole || !allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Role '${userRole || 'undefined'}' is not authorized`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
