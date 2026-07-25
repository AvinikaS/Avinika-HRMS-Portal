const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Holiday = require('../models/Holiday');

// Helper to format date as YYYY-MM-DD from local date components
const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to format UTC Date (from DB) as YYYY-MM-DD
const formatUTCDate = (date) => {
    return new Date(date).toISOString().split('T')[0];
};

/**
 * Calculate attendance statistics for an employee for a specific month and year.
 */
exports.getAttendanceStats = async (employeeId, month, year) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    endDate.setHours(23, 59, 59, 999); // Include the ENTIRE last day (fixes timezone boundary bug)

    // 1. Fetch data
    const [attendanceRecords, leaves, holidays] = await Promise.all([
        Attendance.find({ employee: employeeId, date: { $gte: startDate, $lte: endDate } }),
        Leave.find({
            employee: employeeId, status: 'Approved', $or: [
                { startDate: { $gte: startDate, $lte: endDate } },
                { endDate: { $gte: startDate, $lte: endDate } },
                { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
            ]
        }),
        Holiday.find({
            date: { $gte: startDate, $lte: endDate },
            isActive: true,
            type: { $in: ['Public', 'Government', 'Company'] }
        })
    ]);

    let presentDays = 0;
    let explicitAbsentDays = 0;
    let overtimeHours = 0;

    // 2. Process attendance records (Holiday-aware)
    const holidayDates = new Set(holidays.map(h => formatUTCDate(h.date)));
    const attendanceDateSet = new Set();
    attendanceRecords.forEach(record => {
        const recDateStr = formatUTCDate(record.date);
        attendanceDateSet.add(recDateStr);

        // If this day is a holiday, ignore the "Absent" record — it's a paid off-day
        if (holidayDates.has(recDateStr) && record.status === 'Absent') {
            return; // Skip — will be counted as paidOffDay below
        }

        if (record.status === 'Present' || record.status === 'Late') presentDays++;
        else if (record.status === 'Absent') explicitAbsentDays++;
        else if (record.status === 'Half-Day') { presentDays += 0.5; explicitAbsentDays += 0.5; }

        overtimeHours += (record.overtime || 0);
    });

    // 3. Identify Off-days (Sundays + Holidays)
    let paidOffDays = 0;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const countUpTo = endDate < today ? endDate : today; // Don't count future days

    for (let d = new Date(startDate); d <= countUpTo; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const isSunday = d.getDay() === 0;
        const isHoliday = holidayDates.has(dateStr);

        if (isSunday || isHoliday) {
            // Check if user has a WORKING attendance record for this day (e.g. Worked on off-day)
            // But if they have an "Absent" record on a holiday, still count it as off-day
            const hasWorkingAtt = attendanceRecords.some(r => {
                const rStr = formatUTCDate(r.date);
                return rStr === dateStr && (r.status === 'Present' || r.status === 'Late' || r.status === 'Half-Day');
            });
            if (!hasWorkingAtt) {
                paidOffDays++;
            }
        }
    }

    // 4. Process leaves
    // Use sets to track unique leave dates per type
    const paidLeaveDateSet = new Set();
    const unpaidLeaveDateSet = new Set();

    leaves.forEach(leave => {
        const lStart = new Date(Math.max(new Date(leave.startDate), startDate));
        const lEnd = new Date(Math.min(new Date(leave.endDate), endDate));

        for (let ld = new Date(lStart); ld <= lEnd; ld.setDate(ld.getDate() + 1)) {
            const ldStr = formatDate(ld);
            // Skip if already has an attendance record or is an off-day
            if (attendanceDateSet.has(ldStr) || holidayDates.has(ldStr)) continue;
            const ldDate = new Date(ld);
            if (ldDate.getDay() === 0) continue; // Sunday

            if (leave.leaveType === 'Unpaid') {
                unpaidLeaveDateSet.add(ldStr);
            } else {
                paidLeaveDateSet.add(ldStr);
            }
        }
    });

    // If a date is marked both paid and unpaid (overlapping records), unpaid takes precedence
    unpaidLeaveDateSet.forEach(d => paidLeaveDateSet.delete(d));

    const paidLeaves = paidLeaveDateSet.size;
    const unpaidLeaves = unpaidLeaveDateSet.size;

    // 5. Calculate total elapsed working days (exclude future)
    const totalDaysInMonth = endDate.getDate();
    let elapsedCalendarDays = 0;
    for (let d = new Date(startDate); d <= countUpTo; d.setDate(d.getDate() + 1)) {
        elapsedCalendarDays++;
    }

    // Absent = elapsed days - present - off days - leave days - explicit absent days already counted
    const accountedDays = presentDays + paidOffDays + paidLeaves + unpaidLeaves + explicitAbsentDays;
    const absentDays = Math.max(0, elapsedCalendarDays - accountedDays);
    const totalAbsent = explicitAbsentDays + absentDays; // Both explicit and unrecorded

    return {
        presentDays,
        absentDays: totalAbsent,
        paidLeaves,
        unpaidLeaves,
        overtimeHours,
        paidOffDays,
        totalWorkingDays: totalDaysInMonth // Denominator for per-day salary
    };
};
