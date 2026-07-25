const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Notification = require('../models/Notification');
const socketManager = require('../config/socket');

// GET /api/notifications
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ success: true, data: notifications });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/notifications/read-all
router.put('/read-all', protect, async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user.id, isRead: false }, { isRead: true });

        // Push socket unread count update
        try {
            await socketManager.sendUnreadCountUpdate(req.user.id);
        } catch (socketErr) {
            console.error('Socket count update error:', socketErr);
        }

        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.id },
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        // Push socket unread count update
        try {
            await socketManager.sendUnreadCountUpdate(req.user.id);
        } catch (socketErr) {
            console.error('Socket count update error:', socketErr);
        }

        res.json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', protect, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user.id });
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        // Push socket unread count update
        try {
            await socketManager.sendUnreadCountUpdate(req.user.id);
        } catch (socketErr) {
            console.error('Socket count update error:', socketErr);
        }

        res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
