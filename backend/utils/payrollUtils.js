const Holiday = require('../models/Holiday');

/**
 * Payroll calculation mein call karo
 * Mahine ke saare paid holidays ki dates fetch karta hai
 */
exports.getPaidHolidayDatesForMonth = async (year, month) => {
    const holidays = await Holiday.find({
        year: parseInt(year),
        month: parseInt(month),
        isActive: true,
        type: { $in: ['Public', 'Government', 'Company'] },
    }).select('date');

    return holidays.map((h) => h.date.toISOString().split('T')[0]);
};

/**
 * Attendance mark karte waqt call karo
 * Check karta hai ki di gayi date holiday hai ya nahi
 */
exports.isHolidayDate = async (dateString) => {
    const holiday = await Holiday.findOne({
        date: new Date(dateString),
        isActive: true,
        type: { $in: ['Public', 'Government', 'Company'] },
    });

    return { isHoliday: !!holiday, holiday };
};
