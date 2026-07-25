const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Send a notification to a specific user or users with certain roles
 * @param {Object} options
 * @param {String} options.recipientId - Target User ID
 * @param {Array<String>} [options.roles] - Target User Roles (e.g. ['SuperAdmin', 'HRAdmin'])
 * @param {String} options.title - Notification Title
 * @param {String} options.message - Notification Message
 * @param {String} [options.type] - 'info', 'success', 'warning', 'error'
 * @param {String} [options.link] - Redirect Route Link
 */
exports.createNotification = async ({ recipientId, roles, title, message, type = 'info', link }) => {
    try {
        let recipientIds = [];

        if (recipientId) {
            recipientIds.push(recipientId);
        } else if (roles && roles.length > 0) {
            const users = await User.find({ role: { $in: roles } }).select('_id');
            recipientIds = users.map(u => u._id);
        }

        const notificationsToCreate = recipientIds.map(userId => ({
            recipient: userId,
            title,
            message,
            type,
            link
        }));

        if (notificationsToCreate.length > 0) {
            await Notification.insertMany(notificationsToCreate);

            // Push real-time WebSocket unreadCount update
            try {
                const socketManager = require('../config/socket');
                for (const userId of recipientIds) {
                    await socketManager.sendUnreadCountUpdate(userId);
                }
            } catch (socketErr) {
                console.error('Failed to push live socket update inside createNotification:', socketErr);
            }
        }
    } catch (err) {
        console.error('Failed to create notification(s):', err);
    }
};

/**
 * Send a notification to a user associated with an Employee ID
 * @param {Object} options
 * @param {String} options.employeeId - Employee Model ID
 * @param {String} options.title - Notification Title
 * @param {String} options.message - Notification Message
 * @param {String} [options.type] - 'info', 'success', 'warning', 'error'
 * @param {String} [options.link] - Redirect Route Link
 */
exports.createNotificationForEmployee = async ({ employeeId, title, message, type = 'info', link }) => {
    try {
        const user = await User.findOne({ employeeId }).select('_id');
        if (user) {
            await exports.createNotification({ recipientId: user._id, title, message, type, link });
        }
    } catch (err) {
        console.error('Failed to send employee notification:', err);
    }
};
