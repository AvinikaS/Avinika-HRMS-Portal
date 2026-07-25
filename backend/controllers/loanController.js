const Loan = require('../models/Loan');
const mongoose = require('mongoose');

// Get all loans (Filtered by HR/Admin vs Employee)
exports.getLoans = async (req, res) => {
    try {
        const query = req.user.role === 'Employee' ? { employee: req.user.employeeId } : {};
        if (req.query.status) query.status = req.query.status;

        const loans = await Loan.find(query)
            .populate('employee', 'firstName lastName employeeCode department profileImage')
            .sort({ createdAt: -1 });

        res.json({ success: true, data: loans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Apply for Loan
exports.applyLoan = async (req, res) => {
    try {
        const { amount, interestType, interestRate, repaymentTerms } = req.body;

        let totalRepayment = Number(amount);
        if (interestType === 'Flat Interest') {
            totalRepayment += (amount * (interestRate / 100)); // basic flat calculation
        }

        const emiAmount = Math.ceil(totalRepayment / repaymentTerms);

        const loan = new Loan({
            ...req.body,
            employee: req.user.role === 'Employee' ? req.user.employeeId : req.body.employee,
            totalRepayment,
            emiAmount,
            outstandingAmount: totalRepayment,
            history: [{ status: 'Pending', updatedBy: req.user._id, remark: 'Loan successfully applied' }]
        });

        await loan.save();

        try {
            const EmployeeModel = require('../models/Employee');
            const emp = await EmployeeModel.findById(loan.employee);
            const employeeName = emp ? `${emp.firstName} ${emp.lastName}` : 'An employee';
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotification({
                roles: ['SuperAdmin', 'HRAdmin'],
                title: 'New Loan Application',
                message: `${employeeName} requested a loan of ₹${loan.amount} for a term of ${loan.repaymentTerms} months.`,
                type: 'info',
                link: '/payroll/loans'
            });
        } catch (notifErr) {
            console.error('Notification error on loan application:', notifErr);
        }

        res.status(201).json({ success: true, data: loan, message: 'Loan request submitted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Update Loan Status (Approve/Reject/Disburse/Cancel)
exports.updateLoanStatus = async (req, res) => {
    try {
        const { status, remark, disbursalMode } = req.body;
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        loan.status = status;
        if (disbursalMode) loan.disbursalMode = disbursalMode;

        loan.history.push({
            status,
            updatedBy: req.user._id,
            remark: remark || `Status manually changed to ${status}`
        });

        await loan.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: loan.employee,
                title: 'Loan Status Updated',
                message: `Your requested loan of ₹${loan.amount} status is now ${status}. ${remark ? `Details: ${remark}` : ''}`,
                type: status === 'Approved' || status === 'Disbursed' ? 'success' : 'info',
                link: '/my-loans'
            });
        } catch (notifErr) {
            console.error('Notification error on loan status:', notifErr);
        }

        res.json({ success: true, data: loan, message: `Loan marked as ${status}` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Restructure / Change Repayment Term
exports.changeRepaymentTerm = async (req, res) => {
    try {
        const { newTerms } = req.body;
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        if (loan.outstandingAmount <= 0) return res.status(400).json({ success: false, message: 'Loan already cleared' });

        loan.repaymentTerms = loan.recoveryHistory.length + Number(newTerms); // Update total term
        loan.emiAmount = Math.ceil(loan.outstandingAmount / Number(newTerms));

        loan.history.push({
            status: 'Restructured',
            updatedBy: req.user._id,
            remark: `Repayment terms restructured to ${newTerms} months remaining.`
        });

        await loan.save();
        res.json({ success: true, data: loan, message: 'Repayment terms successfully restructured' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Override specific month EMI (Skip or Prepay)
exports.overrideEMI = async (req, res) => {
    try {
        const { month, year, overrideType } = req.body; // 'Skip' or 'Prepay'
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        loan.currentOverride = { month, year, overrideType };

        if (overrideType === 'Skip') {
            loan.repaymentTerms += 1; // Extending by 1 month
        }

        loan.history.push({
            status: 'Override Set',
            updatedBy: req.user._id,
            remark: `${overrideType} override set for ${month}/${year}`
        });

        await loan.save();
        res.json({ success: true, data: loan, message: `EMI behavior overridden with ${overrideType} for ${month}/${year}` });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Update Loan Request (Only allowable when Pending)
exports.updateLoan = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        // Ensure only pending loans can be updated by employee
        if (loan.status !== 'Pending' && req.user.role === 'Employee') {
            return res.status(403).json({ success: false, message: 'Cannot edit loan after it has been processed' });
        }

        const updatedLoan = await Loan.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ success: true, data: updatedLoan, message: 'Loan request updated successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Delete Loan Request (Only allowable when Pending)
exports.deleteLoan = async (req, res) => {
    try {
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        if (loan.status !== 'Pending' && req.user.role === 'Employee') {
            return res.status(403).json({ success: false, message: 'Cannot delete loan after it has been processed' });
        }

        await Loan.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Loan request deleted successfully' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};
