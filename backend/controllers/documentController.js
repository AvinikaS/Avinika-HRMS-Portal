const Document = require('../models/Document');
const User = require('../models/User');
const { deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');

// POST /api/documents
exports.uploadDocument = async (req, res) => {
    try {
        const { fileUrl, fileSize, name, type, employeeId } = req.body;
        if (!fileUrl) return res.status(400).json({ success: false, message: 'No file uploaded' });
        // Resolve employee ID: from body, from user's linked employee, or user itself
        let empId = employeeId;
        if (!empId) {
            const user = await User.findById(req.user.id);
            empId = user?.employeeId || req.user.id;
        }

        const EmployeeModel = require('../models/Employee');
        const employee = await EmployeeModel.findById(empId);
        if (employee && employee.status === 'Terminated / Ex-Employee') {
            return res.status(403).json({ success: false, message: 'Ex-employees are not permitted to upload documents.' });
        }

        const doc = await Document.create({
            employee: empId,
            name: name || 'Untitled',
            type: type || 'Other',
            fileUrl,
            fileSize: fileSize || 0,
            uploadedBy: req.user.id
        });

        try {
            const EmployeeModel = require('../models/Employee');
            const employee = await EmployeeModel.findById(empId);
            const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : 'An employee';

            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotification({
                roles: ['SuperAdmin', 'HRAdmin'],
                title: 'New Document Uploaded',
                message: `${employeeName} has uploaded a new document: "${doc.name}" (${doc.type}).`,
                type: 'info',
                link: '/document-approvals'
            });
        } catch (notifErr) {
            console.error('Notification error on document upload:', notifErr);
        }

        res.status(201).json({ success: true, data: doc });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/documents/my - get logged-in user's documents
exports.getMyDocuments = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const empId = user?.employeeId || req.user.id;
        const docs = await Document.find({ employee: empId }).sort({ createdAt: -1 });
        res.json({ success: true, data: docs });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/documents/:employeeId
exports.getDocuments = async (req, res) => {
    try {
        const docs = await Document.find({ employee: req.params.employeeId }).sort({ createdAt: -1 });
        res.json({ success: true, data: docs });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/documents (Admin - All docs)
exports.getAllDocuments = async (req, res) => {
    try {
        const docs = await Document.find({}).populate('employee', 'firstName lastName employeeCode profileImage department designation').sort({ createdAt: -1 });
        res.json({ success: true, data: docs });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/documents/:id/status
exports.updateStatus = async (req, res) => {
    try {
        const { status, rejectionReason } = req.body;
        const doc = await Document.findByIdAndUpdate(req.params.id, {
            status,
            rejectionReason: status === 'Rejected' ? rejectionReason : null
        }, { new: true });
        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        try {
            const notificationHelper = require('../utils/notificationHelper');
            if (status === 'Approved') {
                await notificationHelper.createNotificationForEmployee({
                    employeeId: doc.employee,
                    title: 'Document Approved',
                    message: `Your document "${doc.name}" has been approved.`,
                    type: 'success',
                    link: '/my-documents'
                });
            } else if (status === 'Rejected') {
                await notificationHelper.createNotificationForEmployee({
                    employeeId: doc.employee,
                    title: 'Document Rejected',
                    message: `Your document "${doc.name}" has been rejected. To know the reason, please go to the "My Documents" section in your portal.`,
                    type: 'error',
                    link: '/my-documents'
                });
            }
        } catch (notifErr) {
            console.error('Notification error on document status update:', notifErr);
        }

        res.json({ success: true, data: doc });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT /api/documents/:id
exports.updateDocument = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        // Block edit if already approved (unless admin)
        if (doc.status === 'Approved' && !['SuperAdmin', 'HRAdmin', 'Admin'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Approved documents cannot be edited' });
        }

        const EmployeeModel = require('../models/Employee');
        const employee = await EmployeeModel.findById(doc.employee);
        if (employee && employee.status === 'Terminated / Ex-Employee' && !['SuperAdmin', 'HRAdmin', 'Admin'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Ex-employees are not permitted to edit documents.' });
        }

        if (req.body.name) doc.name = req.body.name;
        if (req.body.type) doc.type = req.body.type;

        // If a new file URL is provided (Employee correcting a rejected document)
        if (req.body.fileUrl) {
            // Delete old file from Cloudinary 
            if (doc.fileUrl) {
                const publicId = getPublicIdFromUrl(doc.fileUrl);
                await deleteFromCloudinary(publicId);
            }
            doc.fileUrl = req.body.fileUrl;
            doc.fileSize = req.body.fileSize || 0;
            // IMPORTANT: Reset status to Pending so admin can review again
            doc.status = 'Pending';
            doc.rejectionReason = null;
        }

        await doc.save();
        res.json({ success: true, data: doc });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/documents/:id
exports.deleteDocument = async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });

        // Block delete if already approved (unless admin)
        if (doc.status === 'Approved' && !['SuperAdmin', 'HRAdmin', 'Admin'].includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Approved documents cannot be deleted' });
        }

        await Document.findByIdAndDelete(req.params.id);
        // Delete file from Cloudinary
        if (doc.fileUrl) {
            const publicId = getPublicIdFromUrl(doc.fileUrl);
            await deleteFromCloudinary(publicId);
        }
        res.json({ success: true, message: 'Document deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
