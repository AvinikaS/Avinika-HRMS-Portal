const { cloudinary } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const router = require('express').Router();

// POST /api/upload/signature
// Returns a signed upload signature for direct browser-to-Cloudinary uploads.
// This way the file never passes through the backend server = no Vercel body size limit issue.
router.post('/signature', protect, (req, res) => {
    try {
        const { folder } = req.body;
        const timestamp = Math.round(new Date().getTime() / 1000);
        const uploadFolder = folder || 'hrms/misc';

        const signature = cloudinary.utils.api_sign_request(
            { timestamp, folder: uploadFolder },
            process.env.CLOUDINARY_API_SECRET
        );

        res.json({
            success: true,
            data: {
                signature,
                timestamp,
                folder: uploadFolder,
                cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                apiKey: process.env.CLOUDINARY_API_KEY
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/upload/file
// Deletes a file from Cloudinary given its public_id
router.delete('/file', protect, async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId) {
            return res.status(400).json({ success: false, message: 'publicId is required' });
        }
        const result = await cloudinary.uploader.destroy(publicId);
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
