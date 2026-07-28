const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const { processMonthlyPayroll } = require('../services/payrollService');
const { sendBirthdayEmail } = require('../utils/emailService');

// Middleware to verify Vercel Cron Secret (Optional but recommended)
const verifyCron = (req, res, next) => {
    // Vercel officially sends the CRON_SECRET as a Bearer token
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ success: false, message: 'Unauthorized Cron Request' });
    }
    next();
};

// 1. Daily Birthdays
// GET /api/cron/birthdays
router.get('/birthdays', verifyCron, async (req, res) => {
    console.log('[CRON] Checking for employee birthdays via Vercel Cron...');
    try {
        // Evaluate in IST context approx
        const today = new Date();
        const month = today.getMonth() + 1; // 1-12
        const day = today.getDate(); // 1-31

        const employees = await Employee.find({
            status: 'Active',
            dateOfBirth: { $exists: true, $ne: null }
        });

        const birthdayBoysAndGirls = employees.filter(emp => {
            const dob = new Date(emp.dateOfBirth);
            return (dob.getMonth() + 1 === month) && (dob.getDate() === day);
        });

        for (const emp of birthdayBoysAndGirls) {
            await sendBirthdayEmail(emp.email, `${emp.firstName} ${emp.lastName}`);
        }

        res.status(200).json({
            success: true,
            message: `Sent ${birthdayBoysAndGirls.length} birthday emails.`
        });
    } catch (err) {
        console.error('[CRON] Error in birthday email job:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Daily Absent Detection
// GET /api/cron/absent
router.get('/absent', verifyCron, async (req, res) => {
    console.log('[CRON] Starting daily absent detection check via Vercel Cron...');
    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        if (today.getDay() === 0) {
            return res.status(200).json({ success: true, message: 'Skipped: Sunday' });
        }

        const isHoliday = await Holiday.findOne({ date: { $gte: today, $lt: tomorrow } });
        if (isHoliday) {
            return res.status(200).json({ success: true, message: 'Skipped: Holiday' });
        }

        const employees = await Employee.find({ status: 'Active' });
        let markedAbsent = 0;

        for (const emp of employees) {
            const attExists = await Attendance.findOne({
                employee: emp._id,
                date: { $gte: today, $lt: tomorrow }
            });
            if (attExists) continue;

            const onLeave = await Leave.findOne({
                employee: emp._id,
                status: 'Approved',
                startDate: { $lte: new Date() },
                endDate: { $gte: today }
            });
            if (onLeave) continue;

            await Attendance.create({
                employee: emp._id,
                date: today,
                status: 'Absent',
                notes: 'Automatically marked absent (Vercel Cron)'
            });
            markedAbsent++;
        }

        res.status(200).json({ success: true, message: `Marked ${markedAbsent} employees absent.` });
    } catch (err) {
        console.error('[CRON] Error in absent detection job:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Monthly Payroll
// GET /api/cron/payroll
router.get('/payroll', verifyCron, async (req, res) => {
    console.log('[CRON] Starting automated monthly payroll via Vercel Cron...');
    try {
        const now = new Date();
        let month = now.getMonth();
        let year = now.getFullYear();

        if (month === 0) {
            month = 12;
            year -= 1;
        }

        const results = await processMonthlyPayroll(month, year);
        res.status(200).json({ success: true, message: `Automated payroll completed for ${results.length} records.` });
    } catch (err) {
        console.error('[CRON] Error in automated payroll generation:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
