const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const JobPost = require('../models/JobPost');
const Candidate = require('../models/Candidate');
const Payroll = require('../models/Payroll');

exports.getDashboardStats = async (req, res) => {
    try {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
        const [
            totalEmployees, activeEmployees, todayPresent, pendingLeaves,
            openPositions, totalCandidates, departmentStats
        ] = await Promise.all([
            Employee.countDocuments(),
            Employee.countDocuments({ status: 'Active' }),
            Attendance.countDocuments({ date: { $gte: today, $lt: tomorrow }, status: 'Present' }),
            Leave.countDocuments({ status: 'Pending' }),
            JobPost.countDocuments({ status: 'Open' }),
            Candidate.countDocuments(),
            Employee.aggregate([
                { $match: { status: 'Active' } },
                { $group: { _id: '$department', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ])
        ]);

        // Recent activity - last 5 employees joined
        const recentJoining = await Employee.find({ status: 'Active' })
            .sort({ dateOfJoining: -1 }).limit(5).select('firstName lastName department dateOfJoining');

        // Monthly attendance trend (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const attendanceTrend = await Attendance.aggregate([
            { $match: { date: { $gte: sixMonthsAgo }, status: 'Present' } },
            { $group: { _id: { month: { $month: '$date' }, year: { $year: '$date' } }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        // Birthdays today
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        const activeEmpsWithDob = await Employee.find({ status: 'Active', dateOfBirth: { $exists: true, $ne: null } })
            .select('firstName lastName department profileImage dateOfBirth');

        const birthdaysToday = activeEmpsWithDob.filter(emp => {
            const dob = new Date(emp.dateOfBirth);
            return (dob.getMonth() + 1 === currentMonth) && (dob.getDate() === currentDay);
        });

        res.json({
            success: true,
            data: {
                totalEmployees, activeEmployees, todayPresent, pendingLeaves,
                openPositions, totalCandidates, departmentStats, recentJoining, attendanceTrend, birthdaysToday
            }
        });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
