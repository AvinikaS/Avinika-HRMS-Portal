const AttendanceRegularization = require('../models/AttendanceRegularization.model');
const AttendanceAuditLog = require('../models/AttendanceAuditLog.model');
const AttendanceVerificationLog = require('../models/AttendanceVerificationLog.model');
const PayrollAdjustment = require('../models/PayrollAdjustment.model');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const Notification = require('../models/Notification');
const User = require('../models/User');

// Helper to get Employee document from JWT User
const getEmployeeFromUser = async (user) => {
    let employee = null;
    if (user.employeeId) {
        employee = await Employee.findById(user.employeeId);
    }
    if (!employee) {
        employee = await Employee.findOne({ userId: user._id });
    }
    if (!employee && user.email) {
        employee = await Employee.findOne({ email: user.email.toLowerCase() });
    }
    return employee;
};

// Helper: parse time "09:30" into a Date object on target date
const parseDateTime = (targetDate, timeStr) => {
    const d = new Date(targetDate);
    if (!timeStr) return d;
    const [hours, minutes] = timeStr.split(':').map(Number);
    d.setHours(hours || 0, minutes || 0, 0, 0);
    return d;
};

// ==========================================
// EMPLOYEE ENDPOINTS
// ==========================================

// POST /api/attendance/regularization
exports.submitRegularization = async (req, res) => {
    try {
        const employee = await getEmployeeFromUser(req.user);
        if (!employee) {
            return res.status(404).json({ success: false, message: 'Employee profile not found' });
        }
        if (employee.status === 'Terminated / Ex-Employee') {
            return res.status(403).json({ success: false, message: 'Ex-employees / terminated employees cannot submit attendance regularizations.' });
        }

        const {
            attendanceDate,
            attendanceDates,
            requestedCheckIn,
            requestedCheckOut,
            attendanceType,
            reason,
            comment,
            attachments,
            helpdeskTicketId,
            submitImmediately
        } = req.body;

        // Support both multi-dates array and single date
        const datesToProcess = (Array.isArray(attendanceDates) && attendanceDates.length > 0)
            ? attendanceDates
            : (attendanceDate ? [attendanceDate] : []);

        if (datesToProcess.length === 0 || !requestedCheckIn || !requestedCheckOut || !reason) {
            return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const createdRegs = [];
        const skippedDates = [];

        for (const dStr of datesToProcess) {
            const targetDate = new Date(dStr);
            if (isNaN(targetDate.getTime())) {
                skippedDates.push({ date: dStr, reason: 'Invalid date format' });
                continue;
            }
            if (targetDate > today) {
                skippedDates.push({ date: dStr, reason: 'Date cannot be in the future' });
                continue;
            }

            // Duplicate check: check if any regularization with status NOT IN [REJECTED, CANCELLED] exists for same employeeId + attendanceDate
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const existingReq = await AttendanceRegularization.findOne({
                employeeId: employee._id,
                attendanceDate: { $gte: startOfDay, $lte: endOfDay },
                status: { $nin: ['REJECTED', 'CANCELLED'] }
            });

            if (existingReq) {
                skippedDates.push({ date: dStr, reason: 'Regularization request already exists' });
                continue;
            }

            // Find existing attendance record if any
            const existingAtt = await Attendance.findOne({
                employee: employee._id,
                date: { $gte: startOfDay, $lte: endOfDay }
            });

            const initialStatus = submitImmediately ? 'PENDING_HR_REVIEW' : 'DRAFT';

            const reg = new AttendanceRegularization({
                employeeId: employee._id,
                attendanceDate: targetDate,
                existingAttendanceId: existingAtt ? existingAtt._id : null,
                requestedCheckIn,
                requestedCheckOut,
                attendanceType: attendanceType || 'FULL_DAY',
                reason,
                comment,
                attachments: attachments || [],
                status: initialStatus,
                helpdeskTicketId: helpdeskTicketId || null,
                submittedAt: submitImmediately ? new Date() : null
            });

            await reg.save();

            // Create Audit Log
            await AttendanceAuditLog.create({
                attendanceId: existingAtt ? existingAtt._id : null,
                regularizationId: reg._id,
                employeeId: employee._id,
                date: targetDate,
                action: submitImmediately ? 'REGULARIZATION_SUBMITTED' : 'REGULARIZATION_DRAFT_CREATED',
                newValue: { requestedCheckIn, requestedCheckOut, attendanceType, reason, status: initialStatus },
                performedBy: req.user._id,
                performedByRole: req.user.role,
                reason: reason,
                source: 'EMPLOYEE'
            });

            createdRegs.push(reg);
        }

        if (createdRegs.length === 0) {
            const errorMsg = skippedDates.length > 0
                ? (datesToProcess.length === 1
                    ? (skippedDates[0].reason || 'Regularization request already exists for this date.')
                    : `Regularization request already exists or invalid for all selected date(s).`)
                : 'No valid dates provided';
            return res.status(400).json({ success: false, message: errorMsg, skippedDates });
        }

        // Notify HR Admins if submitted immediately
        if (submitImmediately) {
            const hrUsers = await User.find({ role: { $in: ['HRAdmin', 'SuperAdmin'] } });
            const dateSummary = createdRegs.length === 1
                ? new Date(createdRegs[0].attendanceDate).toLocaleDateString('en-IN')
                : `${createdRegs.length} dates`;
            for (const hr of hrUsers) {
                await Notification.create({
                    recipient: hr._id,
                    title: 'New Regularization Request',
                    message: `${employee.firstName} ${employee.lastName} submitted attendance regularization for ${dateSummary}`,
                    type: 'info',
                    link: '/hradmin/attendance/regularization'
                });
            }
        }

        const successMsg = createdRegs.length > 1
            ? `${createdRegs.length} regularization requests ${submitImmediately ? 'submitted successfully' : 'saved as draft'}${skippedDates.length > 0 ? ` (${skippedDates.length} skipped due to duplicates)` : ''}`
            : (submitImmediately ? 'Regularization request submitted successfully' : 'Regularization draft saved');

        res.status(201).json({
            success: true,
            message: successMsg,
            data: createdRegs[0],
            count: createdRegs.length,
            skippedDates
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/attendance/regularization/:id/submit
exports.submitDraftRegularization = async (req, res) => {
    try {
        const employee = await getEmployeeFromUser(req.user);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Regularization request not found' });

        if (reg.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        if (!['DRAFT', 'INFORMATION_REQUIRED'].includes(reg.status)) {
            return res.status(400).json({ success: false, message: `Cannot submit request in status ${reg.status}` });
        }

        reg.status = 'PENDING_HR_REVIEW';
        reg.submittedAt = new Date();
        await reg.save();

        await AttendanceAuditLog.create({
            attendanceId: reg.existingAttendanceId,
            regularizationId: reg._id,
            employeeId: employee._id,
            date: reg.attendanceDate,
            action: 'REGULARIZATION_SUBMITTED',
            newValue: { status: 'PENDING_HR_REVIEW' },
            performedBy: req.user._id,
            performedByRole: req.user.role,
            reason: reg.reason,
            source: 'EMPLOYEE'
        });

        res.json({ success: true, message: 'Regularization submitted for HR review', data: reg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/regularization/my
exports.getMyRegularizations = async (req, res) => {
    try {
        const employee = await getEmployeeFromUser(req.user);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

        const { page = 1, limit = 20, status, scope, dateFrom, dateTo, year, month } = req.query;
        const query = { employeeId: employee._id };

        if (status) {
            query.status = status;
        } else if (scope === 'pending') {
            query.status = { $in: ['DRAFT', 'PENDING_HR_REVIEW', 'INFORMATION_REQUIRED'] };
        } else if (scope === 'history') {
            query.status = { $in: ['APPROVED', 'REJECTED', 'CANCELLED'] };
        }

        if (dateFrom || dateTo) {
            query.attendanceDate = {};
            if (dateFrom) query.attendanceDate.$gte = new Date(dateFrom);
            if (dateTo) query.attendanceDate.$lte = new Date(dateTo);
        }

        let records = await AttendanceRegularization.find(query)
            .sort({ createdAt: -1 })
            .populate('payrollAdjustmentId');

        if (year || month) {
            records = records.filter(r => {
                if (!r.attendanceDate) return false;
                const d = new Date(r.attendanceDate);
                if (year && d.getFullYear().toString() !== year.toString()) return false;
                if (month && (d.getMonth() + 1).toString() !== month.toString()) return false;
                return true;
            });
        }

        const count = records.length;
        const paginated = records.slice((page - 1) * limit, page * limit);

        res.json({
            success: true,
            data: paginated,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit) || 1
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/regularization/:id
exports.getRegularizationById = async (req, res) => {
    try {
        const reg = await AttendanceRegularization.findById(req.params.id)
            .populate({
                path: 'employeeId',
                select: 'firstName lastName employeeCode department designation basic gross profileImage userId',
                populate: { path: 'userId', select: 'profileImage' }
            })
            .populate('hrAdminId', 'firstName lastName email')
            .populate('payrollAdjustmentId');

        if (!reg) return res.status(404).json({ success: false, message: 'Regularization request not found' });

        // Authorization check for non-admin users
        const isHRorAdmin = ['HRAdmin', 'SuperAdmin'].includes(req.user.role);
        if (!isHRorAdmin) {
            const employee = await getEmployeeFromUser(req.user);
            if (!employee || reg.employeeId._id.toString() !== employee._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to view this request' });
            }
        }

        const targetDate = new Date(reg.attendanceDate);
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        let auditLogs = await AttendanceAuditLog.find({
            $or: [
                { regularizationId: reg._id },
                { 'metadata.regularizationId': reg._id },
                {
                    employeeId: reg.employeeId._id,
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            ]
        }).sort({ timestamp: -1 }).populate({
            path: 'performedBy',
            select: 'email role employeeId',
            populate: { path: 'employeeId', select: 'firstName lastName' }
        });

        const timeline = buildRequestTimeline(reg, auditLogs);
        const regObj = reg.toObject();
        regObj.auditLogs = timeline;

        res.json({ success: true, data: regObj, auditLogs: timeline });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/attendance/regularization/:id/respond
exports.respondToInformationRequest = async (req, res) => {
    try {
        const employee = await getEmployeeFromUser(req.user);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Request not found' });

        if (reg.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        if (reg.status !== 'INFORMATION_REQUIRED') {
            return res.status(400).json({ success: false, message: 'Request is not in INFORMATION_REQUIRED state' });
        }

        const { comment, attachments } = req.body;
        if (comment) reg.comment = (reg.comment ? reg.comment + '\n\nEmployee Note: ' : 'Employee Note: ') + comment;
        if (attachments && attachments.length > 0) {
            reg.attachments = [...(reg.attachments || []), ...attachments];
        }

        reg.status = 'PENDING_HR_REVIEW';
        await reg.save();

        await AttendanceAuditLog.create({
            attendanceId: reg.existingAttendanceId,
            regularizationId: reg._id,
            employeeId: employee._id,
            date: reg.attendanceDate,
            action: 'REGULARIZATION_RESUBMITTED',
            newValue: { status: 'PENDING_HR_REVIEW', comment },
            performedBy: req.user._id,
            performedByRole: req.user.role,
            reason: comment || 'Resubmitted with requested information',
            source: 'EMPLOYEE'
        });

        // Notify HR Admins
        try {
            const hrUsers = await User.find({ role: { $in: ['HRAdmin', 'SuperAdmin'] } });
            for (const hr of hrUsers) {
                await Notification.create({
                    recipient: hr._id,
                    title: 'Regularization Info Provided',
                    message: `${employee.firstName} ${employee.lastName} provided requested information for regularization on ${new Date(reg.attendanceDate).toLocaleDateString('en-IN')}`,
                    type: 'info',
                    link: `/hradmin/attendance/regularization/${reg._id}`
                });
            }
        } catch (notifErr) {
            console.error('Failed to create HR notification on info resubmit:', notifErr);
        }

        res.json({ success: true, message: 'Information updated and resubmitted to HR', data: reg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/attendance/regularization/:id/cancel
exports.cancelRegularization = async (req, res) => {
    try {
        const employee = await getEmployeeFromUser(req.user);
        if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Request not found' });

        if (reg.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        if (!['DRAFT', 'PENDING_HR_REVIEW'].includes(reg.status)) {
            return res.status(400).json({ success: false, message: `Cannot cancel request in status ${reg.status}` });
        }

        reg.status = 'CANCELLED';
        await reg.save();

        await AttendanceAuditLog.create({
            attendanceId: reg.existingAttendanceId,
            regularizationId: reg._id,
            employeeId: employee._id,
            date: reg.attendanceDate,
            action: 'REGULARIZATION_CANCELLED',
            newValue: { status: 'CANCELLED' },
            performedBy: req.user._id,
            performedByRole: req.user.role,
            reason: reg.reason,
            source: 'EMPLOYEE'
        });

        res.json({ success: true, message: 'Regularization request cancelled', data: reg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/attendance/audit/:attendanceId
exports.getAttendanceAuditLogs = async (req, res) => {
    try {
        const { attendanceId } = req.params;
        const att = await Attendance.findById(attendanceId);

        if (!att) return res.status(404).json({ success: false, message: 'Attendance record not found' });

        const isHRorAdmin = ['HRAdmin', 'SuperAdmin'].includes(req.user.role);
        if (!isHRorAdmin) {
            const employee = await getEmployeeFromUser(req.user);
            if (!employee || att.employee.toString() !== employee._id.toString()) {
                return res.status(403).json({ success: false, message: 'Forbidden' });
            }
        }

        const logs = await AttendanceAuditLog.find({
            $or: [{ attendanceId: att._id }, { employeeId: att.employee, date: att.date }]
        }).sort({ timestamp: -1 }).populate({
            path: 'performedBy',
            select: 'email role employeeId',
            populate: { path: 'employeeId', select: 'firstName lastName' }
        });

        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// ==========================================
// HR ADMIN ENDPOINTS
// ==========================================

// GET /api/hradmin/regularization/pending
exports.getPendingRegularizations = async (req, res) => {
    try {
        const { page = 1, limit = 20, department, employeeId, dateFrom, dateTo, year, month, status } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        } else {
            query.status = { $in: ['PENDING_HR_REVIEW', 'INFORMATION_REQUIRED'] };
        }

        if (employeeId) query.employeeId = employeeId;
        if (dateFrom || dateTo) {
            query.attendanceDate = {};
            if (dateFrom) query.attendanceDate.$gte = new Date(dateFrom);
            if (dateTo) query.attendanceDate.$lte = new Date(dateTo);
        }

        let records = await AttendanceRegularization.find(query)
            .sort({ createdAt: -1 })
            .populate({
                path: 'employeeId',
                select: 'firstName lastName employeeCode department designation profileImage'
            });

        if (department) {
            records = records.filter(r => r.employeeId && r.employeeId.department === department);
        }

        if (year || month) {
            records = records.filter(r => {
                if (!r.attendanceDate) return false;
                const d = new Date(r.attendanceDate);
                if (year && d.getFullYear().toString() !== year.toString()) return false;
                if (month && (d.getMonth() + 1).toString() !== month.toString()) return false;
                return true;
            });
        }

        const count = records.length;
        const paginated = records.slice((page - 1) * limit, page * limit);

        res.json({
            success: true,
            data: paginated,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit) || 1
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/hradmin/regularization/all
exports.getAllRegularizationsAdmin = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, scope, department, employeeId, dateFrom, dateTo, year, month } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        } else if (scope === 'history') {
            query.status = { $in: ['APPROVED', 'REJECTED', 'CANCELLED'] };
        }
        if (employeeId) query.employeeId = employeeId;
        if (dateFrom || dateTo) {
            query.attendanceDate = {};
            if (dateFrom) query.attendanceDate.$gte = new Date(dateFrom);
            if (dateTo) query.attendanceDate.$lte = new Date(dateTo);
        }

        let records = await AttendanceRegularization.find(query)
            .sort({ createdAt: -1 })
            .populate({
                path: 'employeeId',
                select: 'firstName lastName employeeCode department designation profileImage'
            })
            .populate('payrollAdjustmentId');

        if (department) {
            records = records.filter(r => r.employeeId && r.employeeId.department === department);
        }

        if (year || month) {
            records = records.filter(r => {
                if (!r.attendanceDate) return false;
                const d = new Date(r.attendanceDate);
                if (year && d.getFullYear().toString() !== year.toString()) return false;
                if (month && (d.getMonth() + 1).toString() !== month.toString()) return false;
                return true;
            });
        }

        const count = records.length;
        const paginated = records.slice((page - 1) * limit, page * limit);

        res.json({
            success: true,
            data: paginated,
            total: count,
            page: Number(page),
            pages: Math.ceil(count / limit) || 1
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Shared Helper: Build & Sort Complete Request Activity Timeline (Guarantees identical sequence in detail page & audit modal)
function buildRequestTimeline(reg, rawLogs) {
    const regIdStr = reg._id.toString();
    const targetDateStr = new Date(reg.attendanceDate).toDateString();
    const regTime = new Date(reg.submittedAt || reg.createdAt).getTime();

    // Filter audit logs strictly for THIS regularization request
    let auditLogs = (rawLogs || []).filter(log => {
        if (log.regularizationId) {
            return log.regularizationId.toString() === regIdStr;
        }
        if (log.metadata && log.metadata.regularizationId) {
            return log.metadata.regularizationId.toString() === regIdStr;
        }

        // Legacy fallback only for old logs without regularizationId field
        if (!log.regularizationId && new Date(log.date).toDateString() === targetDateStr) {
            const logTime = new Date(log.timestamp || log.createdAt).getTime();
            const diffMinutes = Math.abs(logTime - regTime) / (1000 * 60);
            return diffMinutes <= 3;
        }
        return false;
    });

    // Sort initial logs chronologically
    auditLogs.sort((a, b) => new Date(a.timestamp || a.createdAt) - new Date(b.timestamp || b.createdAt));

    // Map initial logs: detect draft saves and ensure reason is present on submitted event
    auditLogs = auditLogs.map(log => {
        const logObj = log.toObject ? log.toObject() : log;
        if (
            logObj.action === 'REGULARIZATION_DRAFT_CREATED' ||
            (logObj.action === 'REGULARIZATION_SUBMITTED' && logObj.newValue && logObj.newValue.status === 'DRAFT')
        ) {
            logObj.action = 'REGULARIZATION_DRAFT_CREATED';
            logObj.reason = logObj.reason || reg.reason;
            return logObj;
        }

        if (logObj.action === 'REGULARIZATION_SUBMITTED') {
            logObj.reason = logObj.reason || reg.reason;
        }

        return logObj;
    });

    // Ensure all employee notes stored in reg.comment have a corresponding RESUBMITTED event
    if (reg.comment && reg.comment.includes('Employee Note:')) {
        const rawNotes = reg.comment
            .split(/Employee Note:\s*/i)
            .slice(1)
            .map(n => n.trim())
            .filter(Boolean);

        const existingResubLogs = auditLogs.filter(l => l.action === 'REGULARIZATION_RESUBMITTED');
        const existingReasons = existingResubLogs.map(l => (l.reason || '').trim());

        // Find employee notes that don't have a matching audit log in the database
        const missingNotes = rawNotes.filter(note => !existingReasons.includes(note));

        if (missingNotes.length > 0) {
            const infoReqLogs = auditLogs.filter(l => l.action === 'REGULARIZATION_INFO_REQUIRED')
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            missingNotes.forEach((missingNote, idx) => {
                let noteTime;
                if (infoReqLogs[idx]) {
                    const reqTime = new Date(infoReqLogs[idx].timestamp).getTime();
                    // Find the next event after this info request
                    const nextLog = auditLogs.find(l => new Date(l.timestamp).getTime() > reqTime);
                    const nextTime = nextLog ? new Date(nextLog.timestamp).getTime() : (reqTime + 60000);
                    // Place it halfway between the info request and the next event
                    noteTime = new Date((reqTime + nextTime) / 2);
                } else {
                    noteTime = new Date(reg.updatedAt || Date.now());
                }

                auditLogs.push({
                    action: 'REGULARIZATION_RESUBMITTED',
                    performedByRole: 'Employee',
                    performedBy: reg.employeeId,
                    reason: missingNote,
                    timestamp: noteTime,
                    source: 'EMPLOYEE'
                });
            });
        }
    }

    // Check if an override event already exists in audit logs
    const hasOverrideEvent = auditLogs.some(l =>
        l.action === 'ADMIN_CORRECTION' ||
        (l.reason && typeof l.reason === 'string' && l.reason.startsWith('[SuperAdmin Override]')) ||
        l.source === 'SUPER_ADMIN'
    );

    // Ensure approval, rejection, cancellation, info required, or resubmitted events are present in timeline
    const hasDraftEvent = auditLogs.some(l => l.action === 'REGULARIZATION_DRAFT_CREATED');
    const hasSubmittedEvent = auditLogs.some(l => l.action === 'REGULARIZATION_SUBMITTED');
    const hasApprovedEvent = auditLogs.some(l => l.action === 'REGULARIZATION_APPROVED' || (l.action === 'ADMIN_CORRECTION' && reg.status === 'APPROVED'));
    const hasRejectedEvent = auditLogs.some(l => l.action === 'REGULARIZATION_REJECTED' || (l.action === 'ADMIN_CORRECTION' && reg.status === 'REJECTED'));
    const hasCancelledEvent = auditLogs.some(l => l.action === 'REGULARIZATION_CANCELLED');
    const hasInfoRequiredEvent = auditLogs.some(l => l.action === 'REGULARIZATION_INFO_REQUIRED');
    const hasResubmittedEvent = auditLogs.some(l => l.action === 'REGULARIZATION_RESUBMITTED');

    if (reg.status === 'DRAFT' && !hasDraftEvent) {
        auditLogs.push({
            action: 'REGULARIZATION_DRAFT_CREATED',
            performedByRole: 'Employee',
            performedBy: reg.employeeId,
            reason: reg.reason,
            timestamp: reg.createdAt || new Date(),
            source: 'EMPLOYEE'
        });
    }

    if (!hasSubmittedEvent && reg.status !== 'DRAFT') {
        auditLogs.push({
            action: 'REGULARIZATION_SUBMITTED',
            performedByRole: 'Employee',
            performedBy: reg.employeeId,
            reason: reg.reason,
            timestamp: reg.submittedAt || reg.createdAt || new Date(),
            source: 'EMPLOYEE'
        });
    }

    if (reg.informationRequestNote && !hasInfoRequiredEvent) {
        const resubLog = auditLogs.find(l => l.action === 'REGULARIZATION_RESUBMITTED');
        const infoTime = resubLog ? new Date(new Date(resubLog.timestamp).getTime() - 1000) : (reg.submittedAt || reg.createdAt || new Date());
        auditLogs.push({
            action: 'REGULARIZATION_INFO_REQUIRED',
            performedByRole: 'HRAdmin',
            performedBy: reg.hrAdminId || { firstName: 'HR', lastName: 'Admin' },
            reason: reg.informationRequestNote,
            timestamp: infoTime,
            source: 'HR_ADMIN'
        });
    }

    if (reg.comment && (reg.comment.includes('Employee Note:') || reg.status === 'PENDING_HR_REVIEW') && reg.informationRequestNote && !hasResubmittedEvent) {
        const appLog = auditLogs.find(l => ['REGULARIZATION_APPROVED', 'REGULARIZATION_REJECTED'].includes(l.action));
        const resubTime = appLog ? new Date(new Date(appLog.timestamp).getTime() - 1000) : (reg.updatedAt || new Date());
        auditLogs.push({
            action: 'REGULARIZATION_RESUBMITTED',
            performedByRole: 'Employee',
            performedBy: reg.employeeId,
            reason: reg.comment,
            timestamp: resubTime,
            source: 'EMPLOYEE'
        });
    }

    if (reg.status === 'APPROVED' && !hasApprovedEvent && !hasOverrideEvent) {
        auditLogs.push({
            action: 'REGULARIZATION_APPROVED',
            performedByRole: 'HRAdmin',
            performedBy: reg.hrAdminId || { firstName: 'HR', lastName: 'Admin' },
            reason: reg.hrAdminComment || 'Regularization Approved',
            timestamp: reg.hrAdminReviewedAt || reg.updatedAt || new Date(),
            source: 'HR_ADMIN'
        });
    }

    if (reg.status === 'REJECTED' && !hasRejectedEvent && !hasOverrideEvent) {
        auditLogs.push({
            action: 'REGULARIZATION_REJECTED',
            performedByRole: 'HRAdmin',
            performedBy: reg.hrAdminId || { firstName: 'HR', lastName: 'Admin' },
            reason: reg.rejectionReason || 'Regularization Rejected',
            timestamp: reg.hrAdminReviewedAt || reg.updatedAt || new Date(),
            source: 'HR_ADMIN'
        });
    }

    if (reg.status === 'CANCELLED' && !hasCancelledEvent) {
        auditLogs.push({
            action: 'REGULARIZATION_CANCELLED',
            performedByRole: 'Employee',
            performedBy: reg.employeeId,
            reason: reg.reason,
            timestamp: reg.updatedAt || reg.submittedAt || new Date(),
            source: 'EMPLOYEE'
        });
    }

    // Deduplicate auditLogs:
    // 1. Filter exact same action within 2 seconds
    // 2. Remove redundant REGULARIZATION_REJECTED / REGULARIZATION_APPROVED when ADMIN_CORRECTION (SuperAdmin Override) is already present
    const uniqueLogs = [];
    for (const log of auditLogs) {
        const isDup = uniqueLogs.some(existing => {
            const timeDiff = Math.abs(new Date(existing.timestamp) - new Date(log.timestamp));
            if (existing.action === log.action && timeDiff < 2000) return true;
            if (
                ((existing.action === 'ADMIN_CORRECTION' && ['REGULARIZATION_REJECTED', 'REGULARIZATION_APPROVED'].includes(log.action)) ||
                 (log.action === 'ADMIN_CORRECTION' && ['REGULARIZATION_REJECTED', 'REGULARIZATION_APPROVED'].includes(existing.action))) &&
                timeDiff < 5000
            ) {
                return true;
            }
            return false;
        });
        if (!isDup) {
            uniqueLogs.push(log);
        }
    }

    // Sort chronologically by real timestamp (with lifecycle stage order as tie-breaker for simultaneous events)
    const ACTION_STAGE_ORDER = {
        'REGULARIZATION_DRAFT_CREATED': 0,
        'REGULARIZATION_SUBMITTED': 1,
        'REGULARIZATION_INFO_REQUIRED': 2,
        'REGULARIZATION_RESUBMITTED': 3,
        'REGULARIZATION_APPROVED': 4,
        'REGULARIZATION_REJECTED': 4,
        'REGULARIZATION_CANCELLED': 4,
        'ADMIN_CORRECTION': 5,
        'PAYROLL_SYNC': 6
    };

    return uniqueLogs.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();

        // If events occur at different times (more than 2 seconds apart), sort strictly chronologically
        if (Math.abs(timeA - timeB) > 2000) {
            return timeA - timeB;
        }

        // Tie-breaker for simultaneous events (within 2 seconds): lifecycle stage order
        const stageA = ACTION_STAGE_ORDER[a.action] || 99;
        const stageB = ACTION_STAGE_ORDER[b.action] || 99;
        if (stageA !== stageB) {
            return stageA - stageB;
        }

        return timeA - timeB;
    });
};

// GET /api/hradmin/regularization/:id
exports.getRegularizationDetailAdmin = async (req, res) => {
    try {
        const reg = await AttendanceRegularization.findById(req.params.id)
            .populate({
                path: 'employeeId',
                populate: { path: 'userId', select: 'profileImage' }
            })
            .populate('hrAdminId', 'firstName lastName email')
            .populate('payrollAdjustmentId')
            .populate('helpdeskTicketId');

        if (!reg) return res.status(404).json({ success: false, message: 'Regularization request not found' });

        const targetDate = new Date(reg.attendanceDate);
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        // Fetch existing attendance record
        const attendanceRecord = await Attendance.findOne({
            employee: reg.employeeId._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        // Fetch audit log
        let auditLogs = await AttendanceAuditLog.find({
            $or: [
                { regularizationId: reg._id },
                { 'metadata.regularizationId': reg._id },
                {
                    employeeId: reg.employeeId._id,
                    date: { $gte: startOfDay, $lte: endOfDay }
                }
            ]
        }).sort({ timestamp: -1 }).populate({
            path: 'performedBy',
            select: 'email role employeeId',
            populate: { path: 'employeeId', select: 'firstName lastName' }
        });

        // Build timeline using shared helper
        auditLogs = buildRequestTimeline(reg, auditLogs);

        // Check payroll status for that month
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();

        const payrollRecord = await Payroll.findOne({
            employee: reg.employeeId._id,
            month,
            year
        });

        const isPayrollProcessed = payrollRecord && ['Paid', 'Generated'].includes(payrollRecord.status);

        // Fetch verification attempt logs (GPS & check-in attempts)
        const verificationAttemptLogs = await AttendanceVerificationLog.find({
            employeeId: reg.employeeId._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        }).sort({ attemptTime: -1 });

        // Calculate estimated arrear based on Gross Salary / days in target month
        const emp = reg.employeeId;
        const grossSalary = emp.gross || ((emp.basic || 0) + (emp.hra || 0) + (emp.specialAllowance || 0) + (emp.conveyance || 0) + (emp.medicalAllowance || 0) + (emp.otherAllowance || 0)) || (emp.salary?.basic || 0);
        const daysInMonth = new Date(year, month, 0).getDate() || 30;
        const dailyRate = grossSalary > 0 ? grossSalary / daysInMonth : 0;
        const estimatedAmount = Math.round((reg.attendanceType === 'HALF_DAY' ? dailyRate * 0.5 : dailyRate) * 100) / 100;

        res.json({
            success: true,
            data: reg,
            attendanceEvidence: {
                attendanceRecord,
                auditLogs,
                verificationAttemptLogs,
                payrollProcessed: !!isPayrollProcessed,
                payrollStatusText: isPayrollProcessed ? 'PROCESSED' : 'OPEN',
                payrollMonthStr: `${targetDate.toLocaleString('default', { month: 'long' })} ${year}`,
                estimatedAmount
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/hradmin/regularization/:id/approve
exports.approveRegularization = async (req, res) => {
    try {
        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Request not found' });

        if (reg.status !== 'PENDING_HR_REVIEW') {
            return res.status(400).json({ success: false, message: `Cannot approve request in status ${reg.status}` });
        }

        const { comment } = req.body;
        const targetDate = new Date(reg.attendanceDate);
        const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

        // Step 1: Check payroll status
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();

        const payrollRecord = await Payroll.findOne({
            employee: reg.employeeId,
            month,
            year
        });

        const isPayrollProcessed = payrollRecord && ['Paid', 'Generated'].includes(payrollRecord.status);

        // Step 2: Update or create Attendance record
        let att = await Attendance.findOne({
            employee: reg.employeeId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        const checkInDate = parseDateTime(targetDate, reg.requestedCheckIn);
        const checkOutDate = parseDateTime(targetDate, reg.requestedCheckOut);
        const diffMs = checkOutDate - checkInDate;
        const totalHours = diffMs > 0 ? Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10 : 8;

        // If payroll was already processed, attendance status for closed month remains Absent (paid via Arrear Adjustment in next month's payroll)
        const newStatus = isPayrollProcessed ? (att ? att.status : 'Absent') : (reg.attendanceType === 'HALF_DAY' ? 'Half-Day' : 'Present');
        const prevValue = att ? { status: att.status, checkIn: att.checkIn, checkOut: att.checkOut } : null;

        if (att) {
            att.checkIn = checkInDate;
            att.checkOut = checkOutDate;
            att.status = newStatus;
            att.totalHours = totalHours;
            att.notes = (att.notes ? att.notes + ' | ' : '') + (isPayrollProcessed ? `Regularized via Arrear Adjustment (${reg.reason})` : `Regularized by HR (${reg.reason})`);
            await att.save();
        } else {
            att = new Attendance({
                employee: reg.employeeId,
                date: targetDate,
                checkIn: checkInDate,
                checkOut: checkOutDate,
                status: newStatus,
                totalHours: totalHours,
                notes: isPayrollProcessed ? `Regularized via Arrear Adjustment (${reg.reason})` : `Regularized by HR (${reg.reason})`
            });
            await att.save();
        }

        // Create AttendanceAuditLog
        await AttendanceAuditLog.create({
            attendanceId: att._id,
            regularizationId: reg._id,
            employeeId: reg.employeeId,
            date: targetDate,
            action: req.isSuperAdminOverride ? 'ADMIN_CORRECTION' : 'REGULARIZATION_APPROVED',
            previousValue: prevValue,
            newValue: { status: newStatus, checkIn: checkInDate, checkOut: checkOutDate },
            performedBy: req.user._id,
            performedByRole: req.user.role,
            reason: comment || 'Regularization Approved',
            source: req.user.role === 'SuperAdmin' ? 'SUPER_ADMIN' : 'HR_ADMIN'
        });

        if (!isPayrollProcessed) {
            // Step 3a: Payroll NOT processed yet
            reg.payrollStatus = 'PAYROLL_OPEN';
            await AttendanceAuditLog.create({
                attendanceId: att._id,
                employeeId: reg.employeeId,
                date: targetDate,
                action: 'PAYROLL_SYNC',
                newValue: 'Attendance corrected — payroll not yet processed, recalculation will apply automatically',
                performedBy: req.user._id,
                performedByRole: req.user.role,
                source: 'SYSTEM'
            });
        } else {
            // Step 3b: Payroll IS processed
            reg.payrollStatus = 'PAYROLL_PROCESSED';

            const emp = await Employee.findById(reg.employeeId);
            const grossSalary = emp.gross || ((emp.basic || 0) + (emp.hra || 0) + (emp.specialAllowance || 0) + (emp.conveyance || 0) + (emp.medicalAllowance || 0) + (emp.otherAllowance || 0)) || (emp.salary?.basic || 0);
            const daysInMonth = new Date(year, month, 0).getDate() || 30;
            const dailyRate = grossSalary > 0 ? grossSalary / daysInMonth : 0;
            const multiplier = reg.attendanceType === 'HALF_DAY' ? 0.5 : 1;
            const calculatedAmount = Math.max(0.01, Math.round((dailyRate * multiplier) * 100) / 100);

            // Find first upcoming open payroll month (where payroll is not yet Generated/Paid)
            let targetY = new Date().getFullYear();
            let targetM = new Date().getMonth() + 1;
            for (let i = 0; i < 12; i++) {
                const existingPayroll = await Payroll.findOne({
                    employee: reg.employeeId,
                    month: targetM,
                    year: targetY,
                    status: { $in: ['Paid', 'Generated'] }
                });
                if (!existingPayroll) break;
                targetM++;
                if (targetM > 12) {
                    targetM = 1;
                    targetY++;
                }
            }

            const targetPayrollMonth = `${targetY}-${String(targetM).padStart(2, '0')}`;
            const origYearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const monthNamesFull = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthLabel = monthNamesFull[month - 1] || `Month ${month}`;

            const initialStatus = calculatedAmount > 5000 ? 'PENDING_SUPERADMIN_APPROVAL' : 'APPROVED';

            let adj = reg.payrollAdjustmentId
                ? await PayrollAdjustment.findById(reg.payrollAdjustmentId)
                : await PayrollAdjustment.findOne({ sourceId: reg._id });

            if (!adj) {
                adj = new PayrollAdjustment({
                    employeeId: reg.employeeId,
                    adjustmentType: 'ATTENDANCE_ARREAR',
                    direction: 'CREDIT',
                    amount: calculatedAmount,
                    originalPayrollMonth: origYearMonth,
                    adjustmentPayrollMonth: targetPayrollMonth,
                    sourceType: 'ATTENDANCE_REGULARIZATION',
                    sourceId: reg._id,
                    reason: `Attendance arrear for ${targetDate.toLocaleDateString('en-IN')} (${reg.reason})`,
                    comment: comment,
                    status: initialStatus,
                    createdBy: req.user._id,
                    createdByRole: req.user.role,
                    hrApprovedBy: req.user._id,
                    hrApprovedAt: new Date(),
                    payslipLabel: `Attendance Arrear – ${monthLabel} ${year}`
                });
                await adj.save();
            } else if (['DRAFT', 'PENDING_HR_APPROVAL', 'CANCELLED'].includes(adj.status)) {
                adj.amount = calculatedAmount;
                adj.adjustmentPayrollMonth = targetPayrollMonth;
                adj.status = initialStatus;
                adj.hrApprovedBy = req.user._id;
                adj.hrApprovedAt = new Date();
                adj.payslipLabel = `Attendance Arrear – ${monthLabel} ${year}`;
                await adj.save();
            }

            reg.payrollAdjustmentCreated = true;
            reg.payrollAdjustmentId = adj._id;
        }

        reg.status = 'APPROVED';
        reg.hrAdminId = req.user._id;
        reg.hrAdminReviewedAt = new Date();
        reg.hrAdminComment = comment || 'Approved';
        await reg.save();

        res.json({
            success: true,
            message: reg.payrollAdjustmentCreated
                ? 'Attendance regularized! Payroll for that month was already processed, so a Payroll Adjustment was created.'
                : 'Attendance regularized! Payroll for that month is open and will include this change automatically.',
            data: reg
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/hradmin/regularization/:id/reject
exports.rejectRegularization = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ success: false, message: 'Rejection reason is required' });
        }

        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Request not found' });

        if (reg.status !== 'PENDING_HR_REVIEW') {
            return res.status(400).json({ success: false, message: `Cannot reject request in status ${reg.status}` });
        }

        reg.status = 'REJECTED';
        reg.rejectionReason = reason;
        reg.hrAdminId = req.user._id;
        reg.hrAdminReviewedAt = new Date();
        await reg.save();

        await AttendanceAuditLog.create({
            attendanceId: reg.existingAttendanceId,
            regularizationId: reg._id,
            employeeId: reg.employeeId,
            date: reg.attendanceDate,
            action: 'REGULARIZATION_REJECTED',
            performedBy: req.user._id,
            performedByRole: req.user.role,
            reason: reason,
            source: req.user.role === 'SuperAdmin' ? 'SUPER_ADMIN' : 'HR_ADMIN'
        });

        res.json({ success: true, message: 'Regularization request rejected', data: reg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/hradmin/regularization/:id/request-info
exports.requestInfoRegularization = async (req, res) => {
    try {
        const { note } = req.body;
        if (!note || note.trim() === '') {
            return res.status(400).json({ success: false, message: 'Information request note is required' });
        }

        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Request not found' });

        reg.status = 'INFORMATION_REQUIRED';
        reg.informationRequestNote = note;
        reg.hrAdminId = req.user._id;
        await reg.save();

        await AttendanceAuditLog.create({
            attendanceId: reg.existingAttendanceId,
            regularizationId: reg._id,
            employeeId: reg.employeeId,
            date: reg.attendanceDate,
            action: 'REGULARIZATION_INFO_REQUIRED',
            performedBy: req.user._id,
            performedByRole: req.user.role,
            reason: note,
            source: req.user.role === 'SuperAdmin' ? 'SUPER_ADMIN' : 'HR_ADMIN'
        });

        res.json({ success: true, message: 'Requested additional information from employee', data: reg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/hradmin/attendance/audit/:employeeId
exports.getEmployeeAuditLogsAdmin = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { dateFrom, dateTo, year, month } = req.query;
        const logQuery = {};
        const regQuery = {};

        if (employeeId && employeeId !== 'ALL') {
            logQuery.employeeId = employeeId;
            regQuery.employeeId = employeeId;
        }

        let startDate = null;
        let endDate = null;

        const validYear = year && year !== 'ALL' && year !== '';
        const validMonth = month && month !== 'ALL' && month !== '';

        if (validYear) {
            const y = parseInt(year);
            if (validMonth) {
                const m = parseInt(month) - 1;
                startDate = new Date(y, m, 1, 0, 0, 0, 0);
                endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
            } else {
                startDate = new Date(y, 0, 1, 0, 0, 0, 0);
                endDate = new Date(y, 11, 31, 23, 59, 59, 999);
            }
        } else if (validMonth) {
            const y = new Date().getFullYear();
            const m = parseInt(month) - 1;
            startDate = new Date(y, m, 1, 0, 0, 0, 0);
            endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
        } else {
            if (dateFrom) startDate = new Date(dateFrom);
            if (dateTo) endDate = new Date(dateTo);
        }

        if (startDate || endDate) {
            logQuery.date = {};
            regQuery.attendanceDate = {};
            if (startDate && !isNaN(startDate.getTime())) {
                logQuery.date.$gte = startDate;
                regQuery.attendanceDate.$gte = startDate;
            }
            if (endDate && !isNaN(endDate.getTime())) {
                logQuery.date.$lte = endDate;
                regQuery.attendanceDate.$lte = endDate;
            }
        }

        // Fetch raw audit logs
        const logs = await AttendanceAuditLog.find(logQuery)
            .sort({ timestamp: -1 })
            .populate({
                path: 'performedBy',
                select: 'email role employeeId',
                populate: { path: 'employeeId', select: 'firstName lastName employeeCode department' }
            });

        // Fetch all regularizations for this employee in date range
        const regularizations = await AttendanceRegularization.find(regQuery)
            .sort({ createdAt: -1 })
            .populate('employeeId', 'firstName lastName employeeCode department')
            .populate({
                path: 'hrAdminId',
                select: 'email role employeeId',
                populate: { path: 'employeeId', select: 'firstName lastName' }
            });

        // Track which audit logs have been assigned to a regularization request
        const assignedLogIds = new Set();
        const groupedRequests = [];

        for (const reg of regularizations) {
            const formattedLogs = buildRequestTimeline(reg, logs);
            formattedLogs.forEach(l => {
                if (l._id) assignedLogIds.add(l._id.toString());
            });

            // Latest action info & initial submission timestamp
            const latestLog = formattedLogs[formattedLogs.length - 1] || {};
            const latestTimestamp = latestLog.timestamp || reg.updatedAt || reg.createdAt;
            const submissionLog = formattedLogs.find(l => l.action === 'REGULARIZATION_SUBMITTED') || formattedLogs[0];
            const initialSubmittedAt = submissionLog ? (submissionLog.timestamp || reg.submittedAt || reg.createdAt) : (reg.submittedAt || reg.createdAt);

            groupedRequests.push({
                id: reg._id,
                type: 'REGULARIZATION_REQUEST',
                regularizationNumber: reg.regularizationNumber || `AR-${reg._id.toString().slice(-6)}`,
                attendanceDate: reg.attendanceDate,
                submittedAt: initialSubmittedAt,
                employee: reg.employeeId,
                attendanceType: reg.attendanceType,
                reason: reg.reason,
                comment: reg.comment,
                requestedCheckIn: reg.requestedCheckIn,
                requestedCheckOut: reg.requestedCheckOut,
                attachments: reg.attachments || [],
                currentStatus: reg.status,
                hrAdminComment: reg.hrAdminComment,
                rejectionReason: reg.rejectionReason,
                informationRequestNote: reg.informationRequestNote,
                latestAction: latestLog.action || reg.status,
                latestPerformedBy: latestLog.performedBy || reg.hrAdminId || reg.employeeId,
                latestTimestamp: latestTimestamp,
                history: formattedLogs
            });
        }

        // Add any remaining unassigned standalone audit logs (e.g. direct check-ins/outs)
        const unassignedLogs = logs.filter(l => !assignedLogIds.has(l._id.toString()));
        for (const log of unassignedLogs) {
            groupedRequests.push({
                id: log._id,
                type: 'STANDALONE_LOG',
                regularizationNumber: 'SYSTEM_EVENT',
                attendanceDate: log.date,
                submittedAt: log.timestamp,
                employee: log.employeeId,
                currentStatus: log.action,
                latestAction: log.action,
                latestPerformedBy: log.performedBy,
                latestTimestamp: log.timestamp,
                reason: log.reason || (typeof log.newValue === 'string' ? log.newValue : JSON.stringify(log.newValue || {})),
                history: [log]
            });
        }

        // Sort all entries by latest timestamp descending
        groupedRequests.sort((a, b) => new Date(b.latestTimestamp || b.submittedAt) - new Date(a.latestTimestamp || a.submittedAt));

        res.json({
            success: true,
            data: groupedRequests,
            rawLogs: logs
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};


// ==========================================
// SUPER ADMIN ENDPOINTS
// ==========================================

// POST /api/superadmin/regularization/:id/override
exports.overrideRegularization = async (req, res) => {
    try {
        const { action, reason } = req.body;
        if (!['APPROVE', 'REJECT'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Action must be APPROVE or REJECT' });
        }
        if (!reason || reason.trim() === '') {
            return res.status(400).json({ success: false, message: 'Mandatory override reason is required' });
        }

        const reg = await AttendanceRegularization.findById(req.params.id);
        if (!reg) return res.status(404).json({ success: false, message: 'Request not found' });

        if (!['APPROVED', 'REJECTED'].includes(reg.status)) {
            return res.status(400).json({
                success: false,
                message: `Override is only applicable for Approved or Rejected requests. Current status is ${reg.status}.`
            });
        }

        if (action === 'APPROVE' && reg.status === 'APPROVED') {
            return res.status(400).json({
                success: false,
                message: 'This request is already Approved. You cannot override-approve an already approved request. Please choose REJECT to revoke it.'
            });
        }

        if (action === 'REJECT' && reg.status === 'REJECTED') {
            return res.status(400).json({
                success: false,
                message: 'This request is already Rejected. You cannot override-reject an already rejected request. Please choose APPROVE to force approve it.'
            });
        }

        if (action === 'REJECT') {
            reg.status = 'REJECTED';
            reg.rejectionReason = `[SuperAdmin Override]: ${reason}`;
            reg.hrAdminId = req.user._id;
            reg.hrAdminReviewedAt = new Date();
            await reg.save();

            const targetDate = new Date(reg.attendanceDate);
            const startOfDay = new Date(targetDate); startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate); endOfDay.setHours(23, 59, 59, 999);

            const att = await Attendance.findOne({
                employee: reg.employeeId,
                date: { $gte: startOfDay, $lte: endOfDay }
            });
            if (att) {
                att.status = 'Absent';
                att.checkIn = null;
                att.checkOut = null;
                att.totalHours = 0;
                att.notes = `(SuperAdmin Override Rejection: ${reason})`;
                await att.save();
            }

            if (reg.payrollAdjustmentId) {
                const adj = await PayrollAdjustment.findById(reg.payrollAdjustmentId);
                if (adj && adj.status !== 'PAID_IN_PAYROLL') {
                    adj.status = 'CANCELLED';
                    adj.reason = `SuperAdmin Override Rejection: ${reason}`;
                    await adj.save();
                }
            }

            await AttendanceAuditLog.create({
                attendanceId: reg.existingAttendanceId || (att ? att._id : null),
                regularizationId: reg._id,
                employeeId: reg.employeeId,
                date: reg.attendanceDate,
                action: 'ADMIN_CORRECTION',
                performedBy: req.user._id,
                performedByRole: req.user.role,
                reason: `[SuperAdmin Override]: ${reason}`,
                source: 'SUPER_ADMIN'
            });

            return res.json({ success: true, message: 'Request rejected via SuperAdmin override', data: reg });
        } else {
            // Override APPROVE: execute approval logic even if previously rejected or pending
            reg.status = 'PENDING_HR_REVIEW'; // temporary to reuse approve logic
            await reg.save();
            req.body.comment = `[SuperAdmin Override]: ${reason}`;
            req.isSuperAdminOverride = true;
            return exports.approveRegularization(req, res);
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
