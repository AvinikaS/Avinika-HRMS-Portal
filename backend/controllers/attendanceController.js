const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { haversineDistance } = require('../utils/geoUtils');
const { compareFaces } = require('../utils/faceMatch');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { cloudinary } = require('../config/cloudinary');

const OFFICE_LAT = parseFloat(process.env.OFFICE_LAT) || 12.9716;
// POST /api/attendance/checkin
exports.checkIn = async (req, res) => {
    try {
        // Read configuration dynamically
        const officeLat = parseFloat(process.env.OFFICE_LAT) || 12.9716;
        const officeLon = parseFloat(process.env.OFFICE_LON) || 77.5946;
        const allowedRadius = parseInt(process.env.ALLOWED_RADIUS) || 500;

        const { latitude, longitude, selfie, livenessStatus } = req.body || {};
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;


        // 1. Basic Validation
        if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
            return res.status(400).json({ success: false, message: 'Location data is required' });
        }
        if (!selfie) return res.status(400).json({ success: false, message: 'Selfie is required for verification' });

        // 2. GPS Verification
        const distance = haversineDistance(latitude, longitude, officeLat, officeLon);
        console.log(`Distance: ${distance.toFixed(2)}m (Max: ${allowedRadius}m)`);

        if (distance > allowedRadius) {
            return res.status(403).json({ success: false, message: 'You are outside office location', distance: Math.round(distance) });
        }

        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        // 3. Duplicate Check
        let att = await Attendance.findOne({ employee: req.user.employeeId, date: { $gte: today, $lt: tomorrow } });
        if (att && att.checkIn) return res.status(400).json({ success: false, message: 'Already checked in today' });

        // 4. Face Match & Liveness
        const employee = await Employee.findById(req.user.employeeId);
        if (!employee || !employee.profileImage) {
            return res.status(400).json({ success: false, message: 'Profile image not found. Please update your profile first.' });
        }

        // Ensure temp directory for face comparison
        const tmpDir = os.tmpdir();

        // Save binary selfie to temp for face comparison
        const base64Data = selfie.replace(/^data:image\/\w+;base64,/, "");
        const dateStr = today.toISOString().split('T')[0];
        const fileName = `att_${req.user.employeeId}_${dateStr}.jpg`;
        const tempFilePath = path.join(tmpDir, fileName);

        fs.writeFileSync(tempFilePath, Buffer.from(base64Data, 'base64'));

        // Compare faces
        // Profile image is a Cloudinary URL — canvas.loadImage() supports URLs
        const profileImageUrl = employee.profileImage;

        const matchScore = await compareFaces(tempFilePath, profileImageUrl);

        if (matchScore < 80) {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            return res.status(400).json({ success: false, message: 'Face verification failed', matchScore });
        }

        // Upload selfie to Cloudinary
        const dataUri = `data:image/jpeg;base64,${base64Data}`;
        const cloudResult = await cloudinary.uploader.upload(dataUri, {
            folder: 'hrms/attendance',
            public_id: `att_${req.user.employeeId}_${dateStr}`,
            overwrite: true,
            access_mode: 'public'
        });

        // Clean up temp file
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

        const selfieUrl = cloudResult.secure_url;

        // 5. Mark Attendance
        if (!att) {
            att = await Attendance.create({
                employee: req.user.employeeId,
                date: today,
                checkIn: new Date(),
                status: 'Present',
                latitude,
                longitude,
                faceMatchScore: matchScore,
                livenessStatus: livenessStatus || 'Passed',
                attendanceSelfiePath: selfieUrl,
                ipAddress
            });
        } else {
            att.checkIn = new Date();
            att.status = 'Present';
            att.latitude = latitude;
            att.longitude = longitude;
            att.faceMatchScore = matchScore;
            att.livenessStatus = livenessStatus || 'Passed';
            att.attendanceSelfiePath = selfieUrl;
            att.ipAddress = ipAddress;
            await att.save();
        }

        res.json({ success: true, data: att, message: 'Checked in successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/attendance/verify-location
exports.verifyLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const officeLat = parseFloat(process.env.OFFICE_LAT) || 12.9716;
        const officeLon = parseFloat(process.env.OFFICE_LON) || 77.5946;
        const allowedRadius = parseInt(process.env.ALLOWED_RADIUS) || 500;

        if (latitude === undefined || longitude === undefined) {
            return res.status(400).json({ success: false, message: 'Coordinates are required' });
        }

        const distance = haversineDistance(latitude, longitude, officeLat, officeLon);
        if (distance > allowedRadius) {
            return res.status(403).json({
                success: false,
                message: 'You are outside office location',
                distance: Math.round(distance),
                allowed: allowedRadius
            });
        }

        res.json({ success: true, message: 'Location verified' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/attendance/checkout
exports.checkOut = async (req, res) => {
    try {
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const att = await Attendance.findOne({ employee: req.user.employeeId, date: { $gte: today, $lt: tomorrow } });
        if (!att || !att.checkIn) return res.status(400).json({ success: false, message: 'You have not checked in today' });
        if (att.checkOut) return res.status(400).json({ success: false, message: 'Already checked out today' });
        att.checkOut = new Date();
        att.totalHours = ((att.checkOut - att.checkIn) / (1000 * 60 * 60)).toFixed(2);
        if (att.totalHours < 4) att.status = 'Half-Day';
        await att.save();
        res.json({ success: true, data: att });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/my
exports.getMyAttendance = async (req, res) => {
    try {
        const { month, year } = req.query;
        const query = { employee: req.user.employeeId };

        // Define date range
        let start, end;
        if (month && year) {
            start = new Date(year, month - 1, 1);
            end = new Date(year, month, 0, 23, 59, 59);
            query.date = { $gte: start, $lte: end };
        }

        // 1. Fetch actual attendance records
        let records = await Attendance.find(query).sort({ date: -1 });
        records = records.map(r => r.toObject()); // Convert to plain objects

        // 2. Fetch approved leaves if month/year provided
        if (month && year) {
            const Leave = require('../models/Leave');
            const approvedLeaves = await Leave.find({
                employee: req.user.employeeId,
                status: 'Approved',
                startDate: { $lte: end },
                endDate: { $gte: start }
            });

            const attendanceDates = new Set(records.map(r => new Date(r.date).toDateString()));

            approvedLeaves.forEach(leave => {
                let curr = new Date(leave.startDate);
                const leaveEnd = new Date(leave.endDate);

                while (curr <= leaveEnd) {
                    if (curr >= start && curr <= end && curr.getDay() !== 0) { // Skip Sunday
                        const dateString = curr.toDateString();
                        if (!attendanceDates.has(dateString)) {
                            records.push({
                                _id: `leave_${leave._id}_${curr.getTime()}`,
                                employee: req.user.employeeId,
                                date: new Date(curr),
                                status: 'On Leave',
                                isLeaveRecord: true,
                                leaveType: leave.leaveType
                            });
                            attendanceDates.add(dateString);
                        }
                    }
                    curr.setDate(curr.getDate() + 1);
                }
            });
        }

        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/employee/:id
exports.getEmployeeAttendance = async (req, res) => {
    try {
        const { month, year } = req.query;
        const employeeId = req.params.id;
        const query = { employee: employeeId };

        let start, end;
        if (month && year) {
            start = new Date(year, month - 1, 1);
            end = new Date(year, month, 0, 23, 59, 59);
        } else if (year) {
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31, 23, 59, 59); // Fixed 11 for Dec
        }

        if (start && end) {
            query.date = { $gte: start, $lte: end };
        }

        let records = await Attendance.find(query).sort({ date: -1 });
        records = records.map(r => r.toObject());

        const Leave = require('../models/Leave');
        const approvedLeaves = await Leave.find({
            employee: employeeId,
            status: 'Approved',
            ...(start && end ? { startDate: { $lte: end }, endDate: { $gte: start } } : {})
        });

        const attendanceDates = new Set(records.map(r => new Date(r.date).toDateString()));

        approvedLeaves.forEach(leave => {
            let curr = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);

            while (curr <= leaveEnd) {
                if ((!start || curr >= start) && (!end || curr <= end) && curr.getDay() !== 0) {
                    const dateString = curr.toDateString();
                    if (!attendanceDates.has(dateString)) {
                        records.push({
                            _id: `leave_${leave._id}_${curr.getTime()}`,
                            employee: employeeId,
                            date: new Date(curr),
                            status: 'On Leave',
                            isLeaveRecord: true,
                            leaveType: leave.leaveType
                        });
                        attendanceDates.add(dateString);
                    }
                }
                curr.setDate(curr.getDate() + 1);
            }
        });

        if (start && end) {
            const Employee = require('../models/Employee');
            const Holiday = require('../models/Holiday');

            const emp = await Employee.findById(employeeId);
            const joining = emp && emp.dateOfJoining ? new Date(emp.dateOfJoining) : new Date(2000, 0, 1);

            const holidays = await Holiday.find({
                date: { $gte: start, $lte: end }
            });
            const holidayMap = {};
            holidays.forEach(h => {
                holidayMap[new Date(h.date).toDateString()] = h.name;
            });

            const today = new Date();
            const endFill = today < end ? today : end;
            let d = new Date(start);
            while (d <= endFill) {
                const dateStr = d.toDateString();
                if (d.getDay() !== 0 && !attendanceDates.has(dateStr) && d >= joining) {
                    if (holidayMap[dateStr]) {
                        records.push({
                            _id: `holiday_${d.getTime()}`,
                            employee: employeeId,
                            date: new Date(d),
                            status: 'Holiday',
                            isVirtual: true,
                            details: holidayMap[dateStr]
                        });
                    } else {
                        records.push({
                            _id: `absent_${d.getTime()}`,
                            employee: employeeId,
                            date: new Date(d),
                            status: 'Absent',
                            isVirtual: true
                        });
                    }
                }
                d.setDate(d.getDate() + 1);
            }
        }

        records.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, data: records });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/today
exports.getTodayStatus = async (req, res) => {
    try {
        const today = new Date(); today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const att = await Attendance.findOne({ employee: req.user.employeeId, date: { $gte: today, $lt: tomorrow } });
        res.json({ success: true, data: att });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/all  (Admin)
exports.getAllAttendance = async (req, res) => {
    try {
        const { date, department, page = 1, limit = 50 } = req.query;
        const query = {};
        if (date) {
            const d = new Date(date); d.setUTCHours(0, 0, 0, 0);
            const d2 = new Date(d); d2.setUTCDate(d2.getUTCDate() + 1);
            query.date = { $gte: d, $lt: d2 };
        }

        // Use let because we might append virtual records
        let records = await Attendance.find(query)
            .populate('employee', 'firstName lastName employeeCode department designation profileImage')
            .sort({ date: -1 });

        // If it's for a specific date, also check for leaves
        if (date) {
            const currentDay = new Date(date);
            currentDay.setUTCHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setUTCHours(23, 59, 59, 999);

            const Leave = require('../models/Leave');
            const Holiday = require('../models/Holiday');

            const [approvedLeaves, holidays] = await Promise.all([
                Leave.find({
                    status: 'Approved',
                    startDate: { $lte: endOfDay },
                    endDate: { $gte: currentDay }
                }).populate('employee', 'firstName lastName employeeCode department designation profileImage'),
                Holiday.find({
                    date: { $gte: currentDay, $lte: endOfDay }
                })
            ]);

            const isSunday = currentDay.getDay() === 0;
            const currentHoliday = holidays.length > 0 ? holidays[0] : null;

            const attendanceEmpIds = new Set(records.map(r => r.employee?._id.toString()));

            // Also check for leaves to identify who is "On Leave" vs "Absent"
            if (!isSunday) { // Skip leave marking on Sundays, let the Weekly Off logic handle it
                approvedLeaves.forEach(leave => {
                    if (leave.employee && !attendanceEmpIds.has(leave.employee._id.toString())) {
                        records.push({
                            _id: `leave_${leave._id}`,
                            employee: leave.employee,
                            date: currentDay,
                            status: 'On Leave',
                            isLeaveRecord: true,
                            leaveDetails: {
                                leaveType: leave.leaveType,
                                startDate: leave.startDate,
                                endDate: leave.endDate,
                                totalDays: leave.totalDays
                            }
                        });
                        attendanceEmpIds.add(leave.employee._id.toString());
                    }
                });
            }

            // 3. For any other Active employee who has NO record yet, mark as "Absent" virtually
            // (Only if it's today or a past date)
            const today = new Date(); today.setUTCHours(0, 0, 0, 0);
            if (currentDay <= today) {
                const Employee = require('../models/Employee');
                const allActiveEmployees = await Employee.find({
                    status: 'Active',
                    dateOfJoining: { $lte: endOfDay } // Only if they had joined by then
                }).select('firstName lastName employeeCode department designation profileImage');

                allActiveEmployees.forEach(emp => {
                    if (!attendanceEmpIds.has(emp._id.toString())) {
                        let status = 'Absent';
                        let details = null;

                        if (currentHoliday) {
                            status = 'Holiday';
                            details = currentHoliday.name;
                        } else if (isSunday) {
                            status = 'Weekly Off';
                        }

                        records.push({
                            _id: `virtual_${status.toLowerCase().replace(' ', '_')}_${emp._id}_${currentDay.getTime()}`,
                            employee: emp,
                            date: currentDay,
                            status: status,
                            isVirtual: true,
                            details: details
                        });
                    }
                });
            }
        }

        // Sorting: Present first, then others
        records.sort((a, b) => {
            const statusOrder = { 'Present': 1, 'Late': 2, 'Half-Day': 3, 'On Leave': 4, 'Holiday': 5, 'Weekly Off': 6, 'Absent': 7 };
            return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
        });

        const total = records.length;
        const paginatedRecords = records.slice((page - 1) * limit, page * limit);

        res.json({ success: true, data: paginatedRecords, total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
