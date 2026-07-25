const Holiday = require('../models/Holiday');
const { fetchIndiaHolidays } = require('../utils/calendarificService');

// ─────────────────────────────────────────────────────────────
// GET /api/holidays?year=2025&month=10
// Admin / HR — saare holidays
// ─────────────────────────────────────────────────────────────
exports.getHolidays = async (req, res) => {
    try {
        const { year, month, date } = req.query;
        const filter = { isActive: true };

        if (date) {
            const d = new Date(date);
            filter.year = d.getFullYear();
            filter.month = d.getMonth() + 1;
        } else {
            if (year) filter.year = parseInt(year);
            if (month) filter.month = parseInt(month);
        }

        let holidays = await Holiday.find(filter).sort({ date: 1 });

        if (date) {
            const targetDateStr = new Date(date).toISOString().split('T')[0];
            holidays = holidays.filter(h => {
                const hDateStr = new Date(h.date).toISOString().split('T')[0];
                return hDateStr === targetDateStr;
            });
        }

        res.json({ success: true, count: holidays.length, data: holidays });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/holidays/employee?year=2025&month=10
// Employee — read only, public/government/company only
// ─────────────────────────────────────────────────────────────
exports.getEmployeeHolidays = async (req, res) => {
    try {
        const { year, month } = req.query;

        const filter = {
            isActive: true,
            type: { $in: ['Public', 'Government', 'Company'] },
        };
        if (year) filter.year = parseInt(year);
        if (month) filter.month = parseInt(month);

        const holidays = await Holiday.find(filter)
            .select('name date type description year month')
            .sort({ date: 1 });

        res.json({
            success: true,
            data: { holidays, total: holidays.length },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/holidays
// HR manually holiday add kare
// ─────────────────────────────────────────────────────────────
exports.createHoliday = async (req, res) => {
    try {
        const { name, date, type, description } = req.body;
        const parsedDate = new Date(date);

        const existing = await Holiday.findOne({ date: parsedDate, isActive: true });

        const holiday = await Holiday.create({
            name,
            date: parsedDate,
            type: type || 'Public',
            description: description || '',
            source: 'manual',
            year: parsedDate.getFullYear(),
            month: parsedDate.getMonth() + 1,
            createdBy: req.user?._id,
        });

        res.status(201).json({
            success: true,
            data: holiday,
            warning: existing
                ? `Note: "${existing.name}" is already marked on this date.`
                : null,
            message: 'Holiday created successfully',
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'A holiday with this name already exists on this date.',
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/holidays/:id
// HR holiday edit kare
// ─────────────────────────────────────────────────────────────
exports.updateHoliday = async (req, res) => {
    try {
        const { name, date, type, description } = req.body;
        const updateData = { name, type, description };

        if (date) {
            const d = new Date(date);
            updateData.date = d;
            updateData.year = d.getFullYear();
            updateData.month = d.getMonth() + 1;
        }

        const holiday = await Holiday.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        res.json({ success: true, data: holiday, message: 'Holiday updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/holidays/:id — Soft delete
// ─────────────────────────────────────────────────────────────
exports.deleteHoliday = async (req, res) => {
    try {
        const holiday = await Holiday.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );

        if (!holiday) {
            return res.status(404).json({ success: false, message: 'Holiday not found' });
        }

        res.json({ success: true, message: 'Holiday deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/holidays/upcoming
// ─────────────────────────────────────────────────────────────
exports.getUpcomingHolidays = async (req, res) => {
    try {
        const now = new Date();
        const holidays = await Holiday.find({
            date: { $gte: now },
            isActive: true,
        }).sort({ date: 1 }).limit(5);

        res.json({ success: true, data: holidays });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// POST /api/holidays/auto-fill
// Body: { year: 2025 }
// Calendarific API se India ke holidays fetch karo
// ─────────────────────────────────────────────────────────────
exports.autoFillHolidays = async (req, res) => {
    try {
        const year = parseInt(req.body.year) || new Date().getFullYear();

        let fetchedHolidays = [];

        try {
            fetchedHolidays = await fetchIndiaHolidays(year);
        } catch (apiErr) {
            console.error('Calendarific API error:', apiErr.message);

            if (apiErr.message.includes('CALENDARIFIC_API_KEY')) {
                return res.status(500).json({
                    success: false,
                    message: 'CALENDARIFIC_API_KEY .env mein set nahi hai. Developer se contact karo.',
                });
            }

            if (apiErr.response?.status === 429) {
                return res.status(429).json({
                    success: false,
                    message: 'Calendarific free plan ki monthly limit (1000 req) exceed ho gayi. Next month try karo ya manually add karo.',
                });
            }

            return res.status(503).json({
                success: false,
                message: 'Calendarific API se connect nahi ho paya. Internet check karo ya baad mein try karo.',
                error: apiErr.message,
            });
        }

        if (fetchedHolidays.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Calendarific ne ${year} ke liye India ka koi holiday data nahi diya.`,
            });
        }

        let addedCount = 0;
        let skippedCount = 0;
        const added = [];
        const skipped = [];

        for (const h of fetchedHolidays) {
            const parsedDate = new Date(h.date);

            const exists = await Holiday.findOne({
                date: parsedDate,
                name: { $regex: new RegExp(`^${h.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                isActive: true,
            });

            if (exists) {
                skippedCount++;
                skipped.push(h.name);
                continue;
            }

            const saved = await Holiday.create({
                name: h.name,
                date: parsedDate,
                type: h.type,
                description: h.description,
                source: 'auto',
                year: parsedDate.getFullYear(),
                month: parsedDate.getMonth() + 1,
                createdBy: req.user?._id,
            });

            added.push(saved);
            addedCount++;
        }

        res.json({
            success: true,
            message:
                addedCount > 0
                    ? `${addedCount} holidays Calendarific se auto-fill ho gaye ${year} ke liye!`
                    : `${year} ke saare holidays already present hain.`,
            data: {
                year,
                source: 'Calendarific API (India)',
                addedCount,
                skippedCount,
                added,
                skipped,
            },
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/holidays/check-date?date=2025-10-20
// Attendance module use karega
// ─────────────────────────────────────────────────────────────
exports.checkHolidayByDate = async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ success: false, message: 'date param required' });

        const holiday = await Holiday.findOne({
            date: new Date(date),
            isActive: true,
            type: { $in: ['Public', 'Government', 'Company'] },
        });

        res.json({ success: true, isHoliday: !!holiday, holiday: holiday || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/holidays/payroll-data?year=2025&month=10
// Payroll module use karega
// ─────────────────────────────────────────────────────────────
exports.getHolidaysForPayroll = async (req, res) => {
    try {
        const { year, month } = req.query;

        const holidays = await Holiday.find({
            year: parseInt(year),
            month: parseInt(month),
            isActive: true,
            type: { $in: ['Public', 'Government', 'Company'] },
        }).select('name date type');

        res.json({
            success: true,
            count: holidays.length,
            data: holidays,
            holidayDates: holidays.map((h) => h.date.toISOString().split('T')[0]),
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
