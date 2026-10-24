const HelpdeskTicket = require('../models/HelpdeskTicket');
const HelpdeskMessage = require('../models/HelpdeskMessage');
const HelpdeskCategory = require('../models/HelpdeskCategory');
const Employee = require('../models/Employee');
const User = require('../models/User');
const notificationHelper = require('../utils/notificationHelper');

// ============================
// VALID STATUS TRANSITIONS
// ============================
const VALID_TRANSITIONS = {
    OPEN: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    ASSIGNED: ['IN_PROGRESS', 'WAITING_FOR_EMPLOYEE', 'RESOLVED', 'CLOSED'],
    IN_PROGRESS: ['WAITING_FOR_EMPLOYEE', 'RESOLVED', 'CLOSED'],
    WAITING_FOR_EMPLOYEE: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
    RESOLVED: ['CLOSED', 'REOPENED'],
    CLOSED: [],
    REOPENED: ['IN_PROGRESS', 'ASSIGNED']
};

// Helper: get user's display name
const getUserName = async (userId) => {
    try {
        const user = await User.findById(userId).select('email');
        const emp = await Employee.findOne({ userId }).select('firstName lastName');
        if (emp) return `${emp.firstName} ${emp.lastName}`;
        return user?.email || 'Unknown';
    } catch {
        return 'Unknown';
    }
};

// Helper: create system event message
const createSystemEvent = async (ticketId, senderId, message) => {
    await HelpdeskMessage.create({
        ticketId,
        senderId,
        senderRole: 'SYSTEM',
        message,
        messageType: 'SYSTEM_EVENT'
    });
};

// Helper: get senderRole string from user object
const getSenderRole = (user) => {
    if (user.role === 'SuperAdmin') return 'SUPER_ADMIN';
    if (user.role === 'HRAdmin') return 'HR_ADMIN';
    return 'EMPLOYEE';
};

// ============================
// EMPLOYEE ROUTES
// ============================

// POST /api/helpdesk/tickets
exports.createTicket = async (req, res) => {
    try {
        const { subject, categoryId, description, priority, attachments } = req.body;

        // Get employee from JWT user
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) {
            return res.status(400).json({ success: false, message: 'Employee profile not linked to your account.' });
        }
        if (employee.status === 'Terminated / Ex-Employee') {
            return res.status(403).json({ success: false, message: 'Ex-employees / terminated employees cannot raise support tickets.' });
        }

        if (!subject || !description) {
            return res.status(400).json({ success: false, message: 'Subject and description are required.' });
        }

        const ticket = await HelpdeskTicket.create({
            employeeId: employee._id,
            subject: subject.trim(),
            categoryId: categoryId || null,
            description: description.trim(),
            priority: priority || 'MEDIUM',
            attachments: attachments || []
        });

        // Create system event
        await createSystemEvent(ticket._id, req.user._id, 'Ticket created.');

        // Notify HR/Admin users
        await notificationHelper.createNotification({
            roles: ['SuperAdmin', 'HRAdmin'],
            title: 'New Helpdesk Ticket',
            message: `[${ticket.ticketNumber}] ${ticket.subject} — raised by ${employee.firstName} ${employee.lastName}`,
            type: 'info',
            link: `/admin/helpdesk/tickets/${ticket._id}`
        });

        res.status(201).json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/tickets/my
exports.getMyTickets = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee not found.' });

        const { page = 1, limit = 10, status, priority, categoryId, search } = req.query;
        const query = { employeeId: employee._id };

        if (status) {
            if (status.includes(',')) query.status = { $in: status.split(',') };
            else query.status = status;
        }
        if (priority) query.priority = priority;
        if (categoryId) query.categoryId = categoryId;
        if (search) {
            query.$or = [
                { ticketNumber: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } }
            ];
        }

        const total = await HelpdeskTicket.countDocuments(query);
        const tickets = await HelpdeskTicket.find(query)
            .populate('categoryId', 'name')
            .populate('assignedTo', 'email')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Enrich assignedTo with employee name
        const enriched = await Promise.all(tickets.map(async (t) => {
            let assignedToName = null;
            if (t.assignedTo) {
                const emp = await Employee.findOne({ userId: t.assignedTo._id }).select('firstName lastName');
                assignedToName = emp ? `${emp.firstName} ${emp.lastName}` : t.assignedTo.email;
            }
            return { ...t.toObject(), assignedToName };
        }));

        res.json({ success: true, data: enriched, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/tickets/my/summary
exports.getMyTicketSummary = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(400).json({ success: false, message: 'Employee not found.' });

        const base = { employeeId: employee._id };
        const [total, open, inProgress, waitingForMe, resolved, closed] = await Promise.all([
            HelpdeskTicket.countDocuments(base),
            HelpdeskTicket.countDocuments({ ...base, status: 'OPEN' }),
            HelpdeskTicket.countDocuments({ ...base, status: { $in: ['IN_PROGRESS', 'ASSIGNED'] } }),
            HelpdeskTicket.countDocuments({ ...base, status: 'WAITING_FOR_EMPLOYEE' }),
            HelpdeskTicket.countDocuments({ ...base, status: 'RESOLVED' }),
            HelpdeskTicket.countDocuments({ ...base, status: 'CLOSED' })
        ]);

        res.json({ success: true, data: { total, open, inProgress, waitingForMe, resolved, closed } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/tickets/:id  (employee view)
exports.getMyTicketDetail = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id)
            .populate('categoryId', 'name')
            .populate('assignedTo', 'email');

        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        // Ownership check
        if (ticket.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to view this ticket.' });
        }

        // Enrich assignedTo name
        let assignedToName = null;
        if (ticket.assignedTo) {
            const emp = await Employee.findOne({ userId: ticket.assignedTo._id }).select('firstName lastName');
            assignedToName = emp ? `${emp.firstName} ${emp.lastName}` : ticket.assignedTo.email;
        }

        // Messages: PUBLIC_REPLY + SYSTEM_EVENT only (NOT INTERNAL_NOTE)
        const messages = await HelpdeskMessage.find({
            ticketId: ticket._id,
            messageType: { $in: ['PUBLIC_REPLY', 'SYSTEM_EVENT'] }
        }).sort({ createdAt: 1 });

        res.json({ success: true, data: { ...ticket.toObject(), assignedToName }, messages });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/helpdesk/tickets/:id (employee edit ticket)
exports.updateMyTicket = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (ticket.employeeId.toString() !== employee._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
        
        if (ticket.status !== 'OPEN' || ticket.assignedTo) {
            return res.status(400).json({ success: false, message: 'You can only edit unassigned OPEN tickets.' });
        }

        const { subject, categoryId, description, priority, attachments } = req.body;
        if (subject) ticket.subject = subject.trim();
        if (categoryId) ticket.categoryId = categoryId;
        if (description) ticket.description = description.trim();
        if (priority) ticket.priority = priority;
        if (attachments) ticket.attachments = attachments;

        await ticket.save();
        res.json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// DELETE /api/helpdesk/tickets/:id (employee delete ticket)
exports.deleteMyTicket = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (ticket.employeeId.toString() !== employee._id.toString()) return res.status(403).json({ success: false, message: 'Not authorized.' });
        
        if (ticket.status !== 'OPEN' || ticket.assignedTo) {
            return res.status(400).json({ success: false, message: 'You can only delete unassigned OPEN tickets.' });
        }

        await HelpdeskMessage.deleteMany({ ticketId: ticket._id });
        await HelpdeskTicket.findByIdAndDelete(ticket._id);
        
        res.json({ success: true, message: 'Ticket deleted successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/tickets/:id/reply  (employee reply)
exports.employeeReply = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (ticket.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (ticket.status === 'CLOSED') {
            return res.status(400).json({ success: false, message: 'Cannot reply to a closed ticket.' });
        }

        const { message, attachments } = req.body;

        const msg = await HelpdeskMessage.create({
            ticketId: ticket._id,
            senderId: req.user._id,
            senderRole: 'EMPLOYEE',
            message,
            messageType: 'PUBLIC_REPLY',
            attachments: attachments || []
        });

        // Auto-change WAITING_FOR_EMPLOYEE → IN_PROGRESS
        if (ticket.status === 'WAITING_FOR_EMPLOYEE') {
            const oldStatus = ticket.status;
            ticket.status = 'IN_PROGRESS';
            await ticket.save();
            await createSystemEvent(ticket._id, req.user._id, `Status changed from ${oldStatus} to IN_PROGRESS (employee replied).`);
        } else {
            await HelpdeskTicket.findByIdAndUpdate(ticket._id, { updatedAt: new Date() });
        }

        // Notify HR
        await notificationHelper.createNotification({
            roles: ['SuperAdmin', 'HRAdmin'],
            title: 'Ticket Reply',
            message: `Employee replied on [${ticket.ticketNumber}] ${ticket.subject}`,
            type: 'info',
            link: `/admin/helpdesk/tickets/${ticket._id}`
        });

        res.json({ success: true, data: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/tickets/:id/close  (employee confirms resolution)
exports.employeeCloseTicket = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (ticket.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (ticket.status !== 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Ticket can only be closed when status is RESOLVED.' });
        }

        ticket.status = 'CLOSED';
        ticket.closedAt = new Date();
        await ticket.save();

        await createSystemEvent(ticket._id, req.user._id, 'Employee confirmed resolution — ticket closed.');

        res.json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/tickets/:id/reopen
exports.employeeReopenTicket = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (ticket.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (ticket.status !== 'RESOLVED') {
            return res.status(400).json({ success: false, message: 'Only RESOLVED tickets can be reopened.' });
        }

        const { reason } = req.body;
        ticket.status = 'REOPENED';
        ticket.reopenedAt = new Date();
        await ticket.save();

        await createSystemEvent(ticket._id, req.user._id, `Employee reopened ticket — Reason: ${reason || 'Not specified'}`);

        // Notify HR
        await notificationHelper.createNotification({
            roles: ['SuperAdmin', 'HRAdmin'],
            title: 'Ticket Reopened',
            message: `[${ticket.ticketNumber}] was reopened by employee. Reason: ${reason || 'Not specified'}`,
            type: 'warning',
            link: `/admin/helpdesk/tickets/${ticket._id}`
        });

        res.json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/tickets/:id/feedback
exports.submitFeedback = async (req, res) => {
    try {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(403).json({ success: false, message: 'Not authorized.' });

        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        if (ticket.employeeId.toString() !== employee._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized.' });
        }
        if (!['RESOLVED', 'CLOSED'].includes(ticket.status)) {
            return res.status(400).json({ success: false, message: 'Feedback can only be submitted for RESOLVED or CLOSED tickets.' });
        }
        if (ticket.feedback && ticket.feedback.rating) {
            return res.status(400).json({ success: false, message: 'Feedback has already been submitted for this ticket.' });
        }

        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
        }

        ticket.feedback = { rating: Number(rating), comment: comment || '', submittedAt: new Date() };
        await ticket.save();

        res.json({ success: true, data: ticket.feedback });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/categories (public for employees to use in create form)
exports.getCategories = async (req, res) => {
    try {
        const categories = await HelpdeskCategory.find({ isActive: true }).sort({ name: 1 });
        // Move "Other" to the end
        const otherIndex = categories.findIndex(c => c.name === 'Other');
        if (otherIndex > -1) {
            const [otherCat] = categories.splice(otherIndex, 1);
            categories.push(otherCat);
        }
        res.json({ success: true, data: categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// ============================
// HR/ADMIN ROUTES
// ============================

// GET /api/helpdesk/admin/dashboard
exports.adminDashboard = async (req, res) => {
    try {
        const [total, open, assigned, inProgress, waitingForEmployee, resolved, closed, reopened, urgent] = await Promise.all([
            HelpdeskTicket.countDocuments(),
            HelpdeskTicket.countDocuments({ status: 'OPEN' }),
            HelpdeskTicket.countDocuments({ status: 'ASSIGNED' }),
            HelpdeskTicket.countDocuments({ status: 'IN_PROGRESS' }),
            HelpdeskTicket.countDocuments({ status: 'WAITING_FOR_EMPLOYEE' }),
            HelpdeskTicket.countDocuments({ status: 'RESOLVED' }),
            HelpdeskTicket.countDocuments({ status: 'CLOSED' }),
            HelpdeskTicket.countDocuments({ status: 'REOPENED' }),
            HelpdeskTicket.countDocuments({ priority: 'URGENT', status: { $nin: ['CLOSED', 'RESOLVED'] } })
        ]);

        const byCategory = await HelpdeskTicket.aggregate([
            { $group: { _id: '$categoryId', count: { $sum: 1 } } },
            { $lookup: { from: 'helpdeskcategories', localField: '_id', foreignField: '_id', as: 'category' } },
            { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
            { $project: { _id: 0, category: { $ifNull: ['$category.name', 'Uncategorized'] }, count: 1 } },
            { $sort: { count: -1 } }
        ]);

        const byPriority = await HelpdeskTicket.aggregate([
            { $group: { _id: '$priority', count: { $sum: 1 } } },
            { $project: { _id: 0, priority: '$_id', count: 1 } }
        ]);

        const byAssignee = await HelpdeskTicket.aggregate([
            { $match: { assignedTo: { $ne: null } } },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
        ]);

        const byAssigneeEnriched = await Promise.all(byAssignee.map(async (a) => {
            const name = await getUserName(a._id);
            return { assignee: name, count: a.count };
        }));

        const recentTickets = await HelpdeskTicket.find()
            .populate('categoryId', 'name')
            .populate('employeeId', 'firstName lastName employeeCode')
            .sort({ createdAt: -1 })
            .limit(5);

        const urgentOpenTickets = await HelpdeskTicket.find({
            priority: 'URGENT',
            status: { $nin: ['CLOSED', 'RESOLVED'] }
        })
            .populate('categoryId', 'name')
            .populate('employeeId', 'firstName lastName employeeCode')
            .sort({ createdAt: -1 })
            .limit(10);

        res.json({
            success: true,
            data: {
                total, open, assigned, inProgress, waitingForEmployee,
                resolved, closed, reopened, urgent,
                byCategory, byPriority, byAssignee: byAssigneeEnriched,
                recentTickets, urgentOpenTickets
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/admin/tickets
exports.adminGetAllTickets = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, priority, categoryId, assignedTo, search, dateFrom, dateTo } = req.query;
        const query = {};

        if (status) {
            if (status.includes(',')) query.status = { $in: status.split(',') };
            else query.status = status;
        }
        if (priority) query.priority = priority;
        if (categoryId) query.categoryId = categoryId;
        if (assignedTo) query.assignedTo = assignedTo;
        if (dateFrom || dateTo) {
            query.createdAt = {};
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
            if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        // Search by ticketNumber, subject, or employee name
        if (search) {
            // Find employees matching search name
            const emps = await Employee.find({
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const empIds = emps.map(e => e._id);

            query.$or = [
                { ticketNumber: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { employeeId: { $in: empIds } }
            ];
        }

        const total = await HelpdeskTicket.countDocuments(query);
        const tickets = await HelpdeskTicket.find(query)
            .populate('employeeId', 'firstName lastName employeeCode')
            .populate('categoryId', 'name')
            .populate('assignedTo', 'email')
            .sort({ updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        // Enrich assignedTo names
        const enriched = await Promise.all(tickets.map(async (t) => {
            let assignedToName = null;
            if (t.assignedTo) {
                const emp = await Employee.findOne({ userId: t.assignedTo._id }).select('firstName lastName');
                assignedToName = emp ? `${emp.firstName} ${emp.lastName}` : t.assignedTo.email;
            }
            return { ...t.toObject(), assignedToName };
        }));

        res.json({ success: true, data: enriched, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/admin/tickets/:id
exports.adminGetTicketDetail = async (req, res) => {
    try {
        const ticket = await HelpdeskTicket.findById(req.params.id)
            .populate('employeeId', 'firstName lastName employeeCode department designation')
            .populate('categoryId', 'name')
            .populate('assignedTo', 'email')
            .populate('assignedBy', 'email');

        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        let assignedToName = null;
        let assignedByName = null;
        if (ticket.assignedTo) {
            const emp = await Employee.findOne({ userId: ticket.assignedTo._id }).select('firstName lastName');
            assignedToName = emp ? `${emp.firstName} ${emp.lastName}` : ticket.assignedTo.email;
        }
        if (ticket.assignedBy) {
            const emp = await Employee.findOne({ userId: ticket.assignedBy._id }).select('firstName lastName');
            assignedByName = emp ? `${emp.firstName} ${emp.lastName}` : ticket.assignedBy.email;
        }

        // ALL messages for admin (including INTERNAL_NOTE)
        const messages = await HelpdeskMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1 });

        // Enrich message sender names
        const enrichedMessages = await Promise.all(messages.map(async (m) => {
            let senderName = 'System';
            if (m.senderRole !== 'SYSTEM') {
                senderName = await getUserName(m.senderId);
            }
            return { ...m.toObject(), senderName };
        }));

        res.json({
            success: true,
            data: { ...ticket.toObject(), assignedToName, assignedByName },
            messages: enrichedMessages
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/helpdesk/admin/tickets/:id/status
exports.adminUpdateStatus = async (req, res) => {
    try {
        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        const { status, reason } = req.body;
        const allowed = VALID_TRANSITIONS[ticket.status] || [];

        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status transition: ${ticket.status} → ${status}. Allowed: ${allowed.join(', ') || 'none'}`
            });
        }

        const oldStatus = ticket.status;
        ticket.status = status;
        if (status === 'RESOLVED') ticket.resolvedAt = new Date();
        if (status === 'CLOSED') ticket.closedAt = new Date();
        
        let autoAssigned = false;
        // Auto-assign to the admin performing the action if it's not assigned yet
        if (!ticket.assignedTo && status !== 'OPEN') {
            ticket.assignedTo = req.user._id;
            ticket.assignedBy = req.user._id;
            ticket.assignedAt = new Date();
            autoAssigned = true;
        }

        await ticket.save();

        const adminName = await getUserName(req.user._id);
        const reasonNote = reason ? ` — Reason: ${reason}` : '';
        let eventMsg = `Status changed from ${oldStatus} to ${status} by ${adminName}.${reasonNote}`;
        if (autoAssigned) {
            eventMsg += ` Ticket auto-assigned to ${adminName}.`;
        }
        await createSystemEvent(ticket._id, req.user._id, eventMsg);

        // Notify employee
        await notificationHelper.createNotificationForEmployee({
            employeeId: ticket.employeeId,
            title: 'Ticket Status Updated',
            message: `Your ticket [${ticket.ticketNumber}] status changed to ${status}`,
            type: status === 'RESOLVED' ? 'success' : 'info',
            link: `/helpdesk/tickets/${ticket._id}`
        });

        res.json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/helpdesk/admin/tickets/:id/priority
exports.adminUpdatePriority = async (req, res) => {
    try {
        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        const { priority } = req.body;
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        if (!validPriorities.includes(priority)) {
            return res.status(400).json({ success: false, message: 'Invalid priority value.' });
        }

        const oldPriority = ticket.priority;
        ticket.priority = priority;
        await ticket.save();

        const adminName = await getUserName(req.user._id);
        await createSystemEvent(ticket._id, req.user._id, `Priority changed from ${oldPriority} to ${priority} by ${adminName}.`);

        res.json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/helpdesk/admin/tickets/:id/assign
exports.adminAssignTicket = async (req, res) => {
    try {
        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        const { assignedTo } = req.body;
        const assignee = await User.findById(assignedTo);
        if (!assignee || !['SuperAdmin', 'HRAdmin'].includes(assignee.role)) {
            return res.status(400).json({ success: false, message: 'Can only assign to SuperAdmin or HRAdmin users.' });
        }

        ticket.assignedTo = assignedTo;
        ticket.assignedBy = req.user._id;
        ticket.assignedAt = new Date();

        // Auto-change OPEN → ASSIGNED
        if (ticket.status === 'OPEN') {
            ticket.status = 'ASSIGNED';
        }
        await ticket.save();

        const adminName = await getUserName(req.user._id);
        const assigneeName = await getUserName(assignedTo);
        await createSystemEvent(ticket._id, req.user._id, `Ticket assigned to ${assigneeName} by ${adminName}.`);

        res.json({ success: true, data: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/admin/tickets/:id/reply
exports.adminReply = async (req, res) => {
    try {
        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        const { message, attachments } = req.body;

        const msg = await HelpdeskMessage.create({
            ticketId: ticket._id,
            senderId: req.user._id,
            senderRole: getSenderRole(req.user),
            message,
            messageType: 'PUBLIC_REPLY',
            attachments: attachments || []
        });

        await HelpdeskTicket.findByIdAndUpdate(ticket._id, { updatedAt: new Date() });

        // Notify employee
        await notificationHelper.createNotificationForEmployee({
            employeeId: ticket.employeeId,
            title: 'HR replied to your ticket',
            message: `HR Support replied on [${ticket.ticketNumber}] ${ticket.subject}`,
            type: 'info',
            link: `/helpdesk/tickets/${ticket._id}`
        });

        res.json({ success: true, data: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/admin/tickets/:id/internal-note
exports.adminInternalNote = async (req, res) => {
    try {
        const ticket = await HelpdeskTicket.findById(req.params.id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

        const { message, attachments } = req.body;

        const msg = await HelpdeskMessage.create({
            ticketId: ticket._id,
            senderId: req.user._id,
            senderRole: getSenderRole(req.user),
            message,
            messageType: 'INTERNAL_NOTE',
            attachments: attachments || []
        });

        res.json({ success: true, data: msg });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/admin/hr-users
exports.getHRUsers = async (req, res) => {
    try {
        const users = await User.find({ role: { $in: ['SuperAdmin', 'HRAdmin'] }, isActive: true }).select('_id role email');
        const enriched = await Promise.all(users.map(async (u) => {
            const emp = await Employee.findOne({ userId: u._id }).select('firstName lastName');
            return {
                _id: u._id,
                name: emp ? `${emp.firstName} ${emp.lastName}` : u.email,
                role: u.role
            };
        }));
        res.json({ success: true, data: enriched });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/helpdesk/admin/categories
exports.adminGetCategories = async (req, res) => {
    try {
        const categories = await HelpdeskCategory.find().sort({ name: 1 });
        // Move "Other" to the end
        const otherIndex = categories.findIndex(c => c.name === 'Other');
        if (otherIndex > -1) {
            const [otherCat] = categories.splice(otherIndex, 1);
            categories.push(otherCat);
        }
        res.json({ success: true, data: categories });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/helpdesk/admin/categories
exports.adminCreateCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Category name is required.' });

        const cat = await HelpdeskCategory.create({
            name: name.trim(),
            description: description || '',
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, data: cat });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Category name already exists.' });
        res.status(500).json({ success: false, message: err.message });
    }
};

// PATCH /api/helpdesk/admin/categories/:id
exports.adminUpdateCategory = async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const cat = await HelpdeskCategory.findByIdAndUpdate(
            req.params.id,
            { name, description, isActive },
            { new: true, runValidators: true }
        );
        if (!cat) return res.status(404).json({ success: false, message: 'Category not found.' });
        res.json({ success: true, data: cat });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Category name already exists.' });
        res.status(500).json({ success: false, message: err.message });
    }
};
