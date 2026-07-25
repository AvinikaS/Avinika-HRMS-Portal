const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { protect, authorize } = require('../middleware/auth');
const Setting = require('../models/Setting');

// Get all settings
router.get('/', protect, async (req, res) => {
    try {
        const settings = await Setting.find({});
        const data = {};
        settings.forEach(s => data[s.key] = s.value);
        res.json({ success: true, data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Save settings
router.post('/', protect, authorize('SuperAdmin', 'HRAdmin'), async (req, res) => {
    try {
        const config = req.body;
        for (const [key, value] of Object.entries(config)) {
            await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
        }
        res.json({ success: true, message: 'Settings saved successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/logo', protect, authorize('SuperAdmin', 'HRAdmin'), async (req, res) => {
    try {
        const { base64Image } = req.body;
        if (!base64Image) return res.status(400).json({ success: false, message: 'No image provided' });

        const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ success: false, message: 'Invalid base64 format' });
        }

        const buffer = Buffer.from(matches[2], 'base64');

        const assetsDir = path.join(__dirname, '..', 'assets');
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir);
        }

        const logoPath = path.join(assetsDir, 'logo.png');

        fs.writeFileSync(logoPath, buffer);

        res.json({ success: true, message: 'Logo updated successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Also provide an endpoint to check if logo exists so frontend can show it
router.delete('/logo', protect, authorize('SuperAdmin', 'HRAdmin'), async (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
        if (fs.existsSync(logoPath)) {
            fs.unlinkSync(logoPath);
        }
        res.json({ success: true, message: 'Logo removed successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/logo/exists', protect, (req, res) => {
    const logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (fs.existsSync(logoPath)) {
        // Convert to base64 to send back to frontend to preview
        const buffer = fs.readFileSync(logoPath);
        const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
        res.json({ success: true, hasLogo: true, logoData: base64Image });
    } else {

        const oldLogoPath = path.join(__dirname, '..', 'assets', 'avinikalogo.png');
        if (fs.existsSync(oldLogoPath)) {
            const buffer = fs.readFileSync(oldLogoPath);
            const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
            res.json({ success: true, hasLogo: true, logoData: base64Image });
        } else {
            res.json({ success: true, hasLogo: false });
        }
    }
});

module.exports = router;

