const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const { generatePayslipPDF } = require('../utils/pdfGenerator');
const { processMonthlyPayroll, rollbackPayrollDeductions } = require('../services/payrollService');

// POST /api/payroll/generate
exports.generatePayroll = async (req, res) => {
    try {
        const { month, year, employeeId, regenerate } = req.body;

        const currentM = new Date().getMonth() + 1;
        const currentY = new Date().getFullYear();
        if (year > currentY || (year === currentY && month >= currentM)) {
            return res.status(400).json({ success: false, message: 'Payslips can only be generated after the month is completely over.' });
        }

        // If regenerate flag is set, delete existing payroll records first and rollback deductions
        if (regenerate) {
            const deleteQuery = { month, year };
            if (employeeId) deleteQuery.employee = employeeId;
            await Payroll.deleteMany(deleteQuery);
            await rollbackPayrollDeductions(month, year, employeeId);
        }

        const payrollsResult = await processMonthlyPayroll(month, year, employeeId);

        try {
            const notificationHelper = require('../utils/notificationHelper');
            const monthNames = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const monthStr = monthNames[month] || `Month ${month}`;

            for (const pr of payrollsResult) {
                await notificationHelper.createNotificationForEmployee({
                    employeeId: pr.employee,
                    title: regenerate ? 'Payslip Regenerated' : 'Payslip Generated',
                    message: `Your payslip for ${monthStr} ${year} has been ${regenerate ? 'regenerated' : 'generated'} and is now available for viewing.`,
                    type: 'success',
                    link: '/my-payslips'
                });
            }
        } catch (notifErr) {
            console.error('Notification error on payroll generation:', notifErr);
        }

        res.status(201).json({
            success: true,
            message: `Payroll generated for ${payrollsResult.length} employees`,
            data: payrollsResult
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const Setting = require('../models/Setting');

// GET /api/payroll/:id/download
exports.downloadPayslip = async (req, res) => {
    try {
        const payroll = await Payroll.findById(req.params.id)
            .populate('employee', 'firstName lastName employeeCode department designation dateOfJoining bankName accountNumber ifscCode pan uan aadhaar');

        if (!payroll) {
            return res.status(404).json({ success: false, message: 'Payroll record not found' });
        }

        // Set response headers for PDF download
        const filename = `Payslip_${payroll.employee.employeeCode}_${payroll.month}_${payroll.year}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        // Fetch Settings for Company Info
        const settingsRaw = await Setting.find({});
        const companyInfo = {
            companyName: 'HRMS Portal Technologies Private Limited.',
            companyAddress: 'Plot no. 123, Business Park, Indore Madhya Pradesh, 452010'
        };
        settingsRaw.forEach(s => {
            if (s.key === 'companyName' && s.value) companyInfo.companyName = s.value;
            if (s.key === 'companyAddress' && s.value) companyInfo.companyAddress = s.value;
        });

        generatePayslipPDF(payroll, res, companyInfo);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/payroll
exports.getAllPayroll = async (req, res) => {
    try {
        const { month, year, page = 1, limit = 50 } = req.query;
        const query = {};
        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);

        const payrolls = await Payroll.find(query)
            .populate('employee', 'firstName lastName employeeCode department designation profileImage bankName accountNumber ifscCode bankDetails')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit).limit(parseInt(limit));

        const total = await Payroll.countDocuments(query);
        res.json({ success: true, data: payrolls, total });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/payroll/my
exports.getMyPayslips = async (req, res) => {
    try {
        const { month, year } = req.query;
        // Search for user's employee ID
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) return res.status(404).json({ success: false, message: 'Employee profile not found' });

        const query = { employee: employee._id };
        if (month) query.month = parseInt(month);
        if (year) query.year = parseInt(year);

        const payslips = await Payroll.find(query).sort({ year: -1, month: -1 });
        res.json({ success: true, data: payslips });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/payroll/:id/pay
exports.markAsPaid = async (req, res) => {
    try {
        const payroll = await Payroll.findByIdAndUpdate(req.params.id, { status: 'Paid', paidOn: new Date() }, { new: true });
        if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
        res.json({ success: true, data: payroll });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
