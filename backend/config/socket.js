const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
const userSockets = new Map(); // maps userId (string) -> Array of socket.id

exports.initSocket = (server) => {
    io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE"],
            credentials: true
        }
    });

    io.on('connection', async (socket) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (token) {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decoded.id.toString();
                socket.userId = userId;

                if (!userSockets.has(userId)) {
                    userSockets.set(userId, []);
                }
                userSockets.get(userId).push(socket.id);
                console.log(`Socket connected: ${socket.id} for user ${userId}`);

                // Send initial unread count on successful socket connection
                const Notification = require('../models/Notification');
                const unreadCount = await Notification.countDocuments({ recipient: decoded.id, isRead: false });
                socket.emit('unread_count_update', { unreadCount });
            }
        } catch (err) {
            console.error('Socket connection authentication error:', err.message);
        }

        socket.on('disconnect', () => {
            if (socket.userId && userSockets.has(socket.userId)) {
                const sockets = userSockets.get(socket.userId);
                const index = sockets.indexOf(socket.id);
                if (index !== -1) {
                    sockets.splice(index, 1);
                }
                if (sockets.length === 0) {
                    userSockets.delete(socket.userId);
                }
            }
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

exports.getIO = () => {
    return io || null;
};

// Push real-time unreadCount to a specific user
exports.sendUnreadCountUpdate = async (userId) => {
    try {
        const userIdStr = userId.toString();
        const sockets = userSockets.get(userIdStr);
        if (sockets && sockets.length > 0 && io) {
            const Notification = require('../models/Notification');
            const unreadCount = await Notification.countDocuments({ recipient: userId, isRead: false });

            for (const socketId of sockets) {
                io.to(socketId).emit('unread_count_update', { unreadCount });
            }
        }
    } catch (err) {
        console.error('Failed to send unread count update:', err);
    }
};

// Push real-time update to users with specific roles
exports.sendUnreadCountUpdateToRoles = async (roles) => {
    try {
        const User = require('../models/User');
        const users = await User.find({ role: { $in: roles } }).select('_id');
        for (const u of users) {
            await exports.sendUnreadCountUpdate(u._id);
        }
    } catch (err) {
        console.error('Failed to send role socket update:', err);
    }
};
