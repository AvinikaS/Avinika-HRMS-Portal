const cron = require('node-cron');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');
const { processMonthlyPayroll } = require('../services/payrollService');

/**
 * Initialize all scheduled jobs
 */
const initCronJobs = () => {
    // 1. Daily Absent Detection
    // Run daily at 3:00 PM (15:00)
    cron.schedule('0 15 * * *', async () => {
        console.log('[CRON] Starting daily absent detection check at 3:00 PM...');
        try {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

            // Skip if Sunday
            if (today.getDay() === 0) {
                console.log('[CRON] Skipping absent detection: Today is Sunday.');
                return;
            }

            // Skip if Holiday
            const isHoliday = await Holiday.findOne({ date: { $gte: today, $lt: tomorrow } });
            if (isHoliday) {
                console.log(`[CRON] Skipping absent detection: Today is a Holiday (${isHoliday.name}).`);
                return;
            }

            const employees = await Employee.find({ status: 'Active' });

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
                    notes: 'Automatically marked absent at 3:00 PM'
                });

                console.log(`[CRON] Marked ${emp.firstName} ${emp.lastName} as Absent.`);
            }
            console.log('[CRON] Daily absent detection check completed.');
        } catch (err) {
            console.error('[CRON] Error in absent detection job:', err.message);
        }
    });

    // 2. Monthly Payroll Generation
    // Run on the 1st of every month at 00:00 (Midnight)
    cron.schedule('0 0 1 * *', async () => {
        console.log('[CRON] Starting automated monthly payroll generation...');
        try {
            const now = new Date();
            // Monthly payroll usually generated for the PREVIOUS month
            let month = now.getMonth();
            let year = now.getFullYear();

            if (month === 0) { // If January, set to Dec of previous year
                month = 12;
                year -= 1;
            }

            const results = await processMonthlyPayroll(month, year);
            console.log(`[CRON] Automated payroll for ${month}/${year} completed: ${results.length} records.`);
        } catch (err) {
            console.error('[CRON] Error in automated payroll generation:', err.message);
        }
    });

    // 3. Daily Birthday Emails
    // Run daily at 8:00 AM ('0 8 * * *')
    cron.schedule('0 8 * * *', async () => {
        console.log('[CRON] Checking for employee birthdays...');
        try {
            // Evaluated in IST context 
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

            const { sendBirthdayEmail } = require('./emailService');

            for (const emp of birthdayBoysAndGirls) {
                await sendBirthdayEmail(emp.email, `${emp.firstName} ${emp.lastName}`);
            }

            if (birthdayBoysAndGirls.length > 0) {
                console.log(`[CRON] Sent ${birthdayBoysAndGirls.length} birthday emails today!`);
            } else {
                console.log('[CRON] No birthdays today.');
            }
        } catch (err) {
            console.error('[CRON] Error in birthday email job:', err.message);
        }
    }, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });

    console.log('[CRON] All scheduled jobs initialized (Daily Absent, Monthly Payroll, Birthdays).');
};

module.exports = { initCronJobs };
