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

        // Auto-correct stale calculated totals for Pending loans
        for (let l of loans) {
            if (l.status === 'Pending' && (!l.recoveryHistory || l.recoveryHistory.length === 0)) {
                const P = l.amount;
                const n = l.repaymentTerms || 1;
                let expectedTotal = P;
                let expectedEmi;

                if (l.interestType === 'Reducing Balance' && l.interestRate > 0) {
                    const r = l.interestRate / 12 / 100;
                    expectedEmi = Math.ceil(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
                    expectedTotal = expectedEmi * n;
                } else if (l.interestType === 'Flat Interest' && l.interestRate > 0) {
                    expectedTotal = P + (P * (l.interestRate / 100));
                    expectedEmi = Math.ceil(expectedTotal / n);
                } else {
                    expectedEmi = Math.ceil(P / n);
                }

                if (l.totalRepayment !== expectedTotal || l.outstandingAmount !== expectedTotal || l.emiAmount !== expectedEmi) {
                    l.totalRepayment = expectedTotal;
                    l.outstandingAmount = expectedTotal;
                    l.emiAmount = expectedEmi;
                    await l.save();
                }
            }
        }

        res.json({ success: true, data: loans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Apply for Loan (Employee applies as 'Pending' | Admin adds loan as 'Offered')
exports.applyLoan = async (req, res) => {
    try {
        const { amount, interestType, interestRate, repaymentTerms, preferredPaymentMethod, disbursalMode } = req.body;
        const P = Number(amount);
        const n = Number(repaymentTerms);
        let totalRepayment = P;
        let emiAmount;

        if (interestType === 'Reducing Balance' && Number(interestRate) > 0) {
            const r = Number(interestRate) / 12 / 100;
            emiAmount = Math.ceil(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
            totalRepayment = emiAmount * n;
        } else if (interestType === 'Flat Interest' && Number(interestRate) > 0) {
            totalRepayment = P + (P * (Number(interestRate) / 100));
            emiAmount = Math.ceil(totalRepayment / n);
        } else {
            emiAmount = Math.ceil(P / n);
        }

        const isEmployee = req.user.role === 'Employee';
        if (isEmployee) {
            const EmployeeModel = require('../models/Employee');
            const emp = await EmployeeModel.findById(req.user.employeeId);
            if (emp?.status === 'Terminated / Ex-Employee') {
                return res.status(403).json({ success: false, message: 'Ex-employees / terminated employees cannot apply for loans.' });
            }
        }
        const initialStatus = isEmployee ? 'Pending' : 'Offered';
        const activeDisbursalMode = disbursalMode || preferredPaymentMethod || 'Payroll System';

        const loan = new Loan({
            ...req.body,
            preferredPaymentMethod: preferredPaymentMethod || 'Payroll System',
            disbursalMode: activeDisbursalMode,
            employee: isEmployee ? req.user.employeeId : req.body.employee,
            totalRepayment,
            emiAmount,
            outstandingAmount: totalRepayment,
            status: initialStatus,
            history: [{
                status: initialStatus,
                updatedBy: req.user._id,
                remark: isEmployee ? 'Loan successfully applied' : 'Loan offer created by Admin and sent to employee'
            }]
        });

        await loan.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            if (isEmployee) {
                const EmployeeModel = require('../models/Employee');
                const emp = await EmployeeModel.findById(loan.employee);
                const employeeName = emp ? `${emp.firstName} ${emp.lastName}` : 'An employee';
                await notificationHelper.createNotification({
                    roles: ['SuperAdmin', 'HRAdmin'],
                    title: 'New Loan Application',
                    message: `${employeeName} requested a loan of ₹${loan.amount} for a term of ${loan.repaymentTerms} months.`,
                    type: 'info',
                    link: '/payroll/loans'
                });
            } else {
                await notificationHelper.createNotificationForEmployee({
                    employeeId: loan.employee,
                    title: 'New Loan Offer Received',
                    message: `Admin has created a loan offer of ₹${loan.amount} for ${loan.repaymentTerms} months for you. Please review and accept/reject.`,
                    type: 'info',
                    link: '/my-loans'
                });
            }
        } catch (notifErr) {
            console.error('Notification error on loan application:', notifErr);
        }

        res.status(201).json({ success: true, data: loan, message: isEmployee ? 'Loan request submitted successfully' : 'Loan offer created and sent to employee' });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

// Update Loan Status (Admin: Offer/Approve/Reject | Employee: Accept/Reject Offer)
exports.updateLoanStatus = async (req, res) => {
    try {
        const { status, remark, disbursalMode, interestType, interestRate, rejectionReason, amount, repaymentTerms, disbursalPayrollMonth, disbursalPayrollYear, emiStartMonth, emiStartYear } = req.body;
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        // --- EMPLOYEE ROLE LOGIC ---
        if (req.user.role === 'Employee') {
            if (req.user.employeeId && loan.employee.toString() !== req.user.employeeId.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to update this loan' });
            }

            // Employee Accept Offer
            if (status === 'Approved' || status === 'In Progress') {
                if (loan.status !== 'Offered') {
                    return res.status(400).json({ success: false, message: 'No pending offer to accept' });
                }
                loan.status = 'In Progress';
                loan.history.push({ status: 'In Progress', updatedBy: req.user._id, remark: 'Employee accepted the loan offer. Loan activated.' });
                await loan.save();

                try {
                    const notificationHelper = require('../utils/notificationHelper');
                    await notificationHelper.createNotification({
                        roles: ['SuperAdmin', 'HRAdmin'],
                        title: 'Loan Offer Accepted & Activated',
                        message: `Employee accepted loan offer of ₹${loan.amount} (${loan.disbursalMode || 'Payroll'}). Loan is now active.`,
                        type: 'success',
                        link: '/payroll/loans'
                    });
                } catch (e) { }

                return res.json({ success: true, data: loan, message: 'Loan offer accepted and activated successfully' });
            }

            // Employee Reject Offer / Cancel Request
            if (status === 'Cancelled' || status === 'Rejected by Employee') {
                if (!['Offered', 'Pending'].includes(loan.status)) {
                    return res.status(400).json({ success: false, message: 'Cannot cancel this loan request' });
                }
                loan.status = 'Rejected by Employee';
                loan.history.push({ status: 'Rejected by Employee', updatedBy: req.user._id, remark: remark || 'Employee rejected the loan offer' });
                await loan.save();
                return res.json({ success: true, data: loan, message: 'Loan offer rejected' });
            }

            return res.status(403).json({ success: false, message: 'Employees can only accept or reject loan offers' });
        }

        // --- ADMIN ROLE LOGIC ---
        // Review Loan Request (Direct Approve if terms unchanged, or Send Offer if terms modified)
        if (status === 'Offered' || status === 'Approved' || status === 'In Progress') {
            const P = Number(amount) > 0 ? Number(amount) : loan.amount;
            const n = Number(repaymentTerms) > 0 ? Number(repaymentTerms) : loan.repaymentTerms;
            const finalDisbursalMode = disbursalMode || loan.preferredPaymentMethod || 'Payroll System';
            const finalInterestType = interestType || 'No Interest';
            const finalInterestRate = Number(interestRate) || 0;
            const finalDisbursalMonth = disbursalPayrollMonth ? Number(disbursalPayrollMonth) : loan.expectedMonth;
            const finalDisbursalYear = disbursalPayrollYear ? Number(disbursalPayrollYear) : loan.expectedYear;
            const finalEmiMonth = emiStartMonth ? Number(emiStartMonth) : loan.emiStartMonth;
            const finalEmiYear = emiStartYear ? Number(emiStartYear) : loan.emiStartYear;

            // Check if Admin modified any of the employee's requested terms
            const amountChanged = P !== loan.amount;
            const tenureChanged = n !== loan.repaymentTerms;
            const paymentModeChanged = finalDisbursalMode !== (loan.preferredPaymentMethod || 'Payroll System');
            const interestAdded = finalInterestType !== 'No Interest' || finalInterestRate > 0;
            const disbursalDateChanged = finalDisbursalMonth !== loan.expectedMonth || finalDisbursalYear !== loan.expectedYear;
            const emiDateChanged = finalEmiMonth !== loan.emiStartMonth || finalEmiYear !== loan.emiStartYear;

            const hasTermsChanged = amountChanged || tenureChanged || paymentModeChanged || interestAdded || disbursalDateChanged || emiDateChanged;

            const targetStatus = (status === 'Approved' && !hasTermsChanged) ? 'In Progress' : 'Offered';

            let totalRepayment = P;
            let emiAmount;

            if (finalInterestType === 'Reducing Balance' && finalInterestRate > 0) {
                const r = finalInterestRate / 12 / 100;
                emiAmount = Math.ceil(P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
                totalRepayment = emiAmount * n;
            } else if (finalInterestType === 'Flat Interest' && finalInterestRate > 0) {
                totalRepayment = P + (P * (finalInterestRate / 100));
                emiAmount = Math.ceil(totalRepayment / n);
            } else {
                emiAmount = Math.ceil(P / n);
            }

            loan.amount = P;
            loan.repaymentTerms = n;
            loan.disbursalMode = finalDisbursalMode;
            loan.disbursalPayrollMonth = finalDisbursalMonth;
            loan.expectedMonth = finalDisbursalMonth;
            loan.disbursalPayrollYear = finalDisbursalYear;
            loan.expectedYear = finalDisbursalYear;
            loan.emiStartMonth = finalEmiMonth;
            loan.emiStartYear = finalEmiYear;

            loan.interestType = finalInterestType;
            loan.interestRate = finalInterestRate;
            loan.totalRepayment = totalRepayment;
            loan.emiAmount = emiAmount;
            loan.outstandingAmount = totalRepayment;
            loan.status = targetStatus;

            const remarkMsg = targetStatus === 'Offered'
                ? (remark || `Loan terms modified by Admin (₹${P}, ${n} mos). Offer sent to employee for acceptance`)
                : (remark || `Loan request of ₹${P} approved as requested by Admin`);

            loan.history.push({ status: targetStatus, updatedBy: req.user._id, remark: remarkMsg });
            await loan.save();

            try {
                const notificationHelper = require('../utils/notificationHelper');
                if (targetStatus === 'Offered') {
                    await notificationHelper.createNotificationForEmployee({
                        employeeId: loan.employee,
                        title: 'Loan Offer Received',
                        message: `Admin sent a loan offer of ₹${P} for ${n} months. Please review and accept/reject.`,
                        type: 'info',
                        link: '/my-loans'
                    });
                } else {
                    await notificationHelper.createNotificationForEmployee({
                        employeeId: loan.employee,
                        title: 'Loan Request Approved',
                        message: `Your loan request of ₹${P} has been approved! Admin will proceed with disbursal.`,
                        type: 'success',
                        link: '/my-loans'
                    });
                }
            } catch (e) { }

            return res.json({
                success: true,
                data: loan,
                message: targetStatus === 'Offered' ? 'Loan offer sent to employee for acceptance' : 'Loan request approved'
            });
        }

        // Reject with reason
        if (status === 'Rejected' || status === 'Rejected by Admin') {
            if (!rejectionReason) return res.status(400).json({ success: false, message: 'Rejection reason is required' });
            loan.status = 'Rejected by Admin';
            loan.rejectionReason = rejectionReason;
            loan.history.push({ status: 'Rejected by Admin', updatedBy: req.user._id, remark: rejectionReason });
            await loan.save();

            try {
                const notificationHelper = require('../utils/notificationHelper');
                await notificationHelper.createNotificationForEmployee({
                    employeeId: loan.employee,
                    title: 'Loan Request Rejected',
                    message: `Your loan request of ₹${loan.amount} has been rejected. Reason: ${rejectionReason}`,
                    type: 'error',
                    link: '/my-loans'
                });
            } catch (e) { }

            return res.json({ success: true, data: loan, message: 'Loan request rejected' });
        }

        // General status change (Admin: Disburse, Cancel, etc.)
        loan.status = status;
        if (disbursalMode) loan.disbursalMode = disbursalMode;
        loan.history.push({ status, updatedBy: req.user._id, remark: remark || `Status changed to ${status}` });
        await loan.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: loan.employee,
                title: 'Loan Status Updated',
                message: `Your loan of ₹${loan.amount} status is now ${status}. ${remark ? `Details: ${remark}` : ''}`,
                type: status === 'Approved' || status === 'Disbursed' || status === 'In Progress' ? 'success' : 'info',
                link: '/my-loans'
            });
        } catch (notifErr) { }

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

// Full / Partial Settle & Close Loan (Early Payment / Recalculate EMI / Cancel)
exports.settleLoan = async (req, res) => {
    try {
        const { settlementAmount, paymentMode, transactionRef, remark, actionType, newTenure } = req.body;
        const loan = await Loan.findById(req.params.id);
        if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

        if (actionType === 'VoidWithoutPayment') {
            loan.status = 'Cancelled by Admin';
            loan.rejectionReason = remark || 'Loan voided/cancelled by Admin';
            loan.history.push({
                status: 'Cancelled by Admin',
                updatedBy: req.user._id,
                remark: remark || 'Loan voided/cancelled by Admin without payment'
            });
            await loan.save();

            try {
                const notificationHelper = require('../utils/notificationHelper');
                await notificationHelper.createNotificationForEmployee({
                    employeeId: loan.employee,
                    title: 'Loan Cancelled',
                    message: `Your loan of ₹${loan.amount} has been cancelled by Admin. Reason: ${remark || 'N/A'}`,
                    type: 'info',
                    link: '/my-loans'
                });
            } catch (e) { }

            return res.json({ success: true, data: loan, message: 'Loan cancelled successfully' });
        }

        const now = new Date();
        const curMonth = now.getMonth() + 1;
        const curYear = now.getFullYear();
        const mode = paymentMode || 'Cash';
        const paidAmount = Number(settlementAmount) || 0;

        // Partial Settlement & Recalculate EMI
        if (actionType === 'PartialSettlement') {
            if (paidAmount <= 0 || paidAmount >= loan.outstandingAmount) {
                return res.status(400).json({ success: false, message: `Partial payment must be between ₹1 and ₹${loan.outstandingAmount - 1}` });
            }

            const remainingBalance = loan.outstandingAmount - paidAmount;
            loan.outstandingAmount = remainingBalance;

            const n = Number(newTenure) > 0 ? Number(newTenure) : Math.max(1, loan.repaymentTerms - (loan.recoveryHistory?.length || 0));
            loan.repaymentTerms = (loan.recoveryHistory?.length || 0) + n;

            if (loan.interestType === 'Reducing Balance' && loan.interestRate > 0) {
                const r = loan.interestRate / 12 / 100;
                loan.emiAmount = Math.ceil(remainingBalance * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
            } else if (loan.interestType === 'Flat Interest' && loan.interestRate > 0) {
                const totalRepayment = remainingBalance + (remainingBalance * (loan.interestRate / 100));
                loan.emiAmount = Math.ceil(totalRepayment / n);
            } else {
                loan.emiAmount = Math.ceil(remainingBalance / n);
            }

            const settlementRemark = `Partial Payment Received: Paid ₹${paidAmount.toLocaleString('en-IN')} via ${mode}${transactionRef ? ` (Ref: ${transactionRef})` : ''}. Remaining ₹${remainingBalance.toLocaleString('en-IN')} converted to ${n} monthly EMIs of ₹${loan.emiAmount.toLocaleString('en-IN')}/mo. ${remark ? `Notes: ${remark}` : ''}`;

            loan.recoveryHistory.push({
                month: curMonth,
                year: curYear,
                amountDeducted: paidAmount,
                overrideType: 'PartialSettlement',
                paymentMode: mode,
                transactionRef: transactionRef || '',
                settlementDate: now
            });

            loan.history.push({
                status: 'In Progress',
                updatedBy: req.user._id,
                remark: settlementRemark
            });

            await loan.save();

            try {
                const notificationHelper = require('../utils/notificationHelper');
                await notificationHelper.createNotificationForEmployee({
                    employeeId: loan.employee,
                    title: 'Partial Loan Payment Recorded',
                    message: `Partial payment of ₹${paidAmount} received via ${mode}. Remaining ₹${remainingBalance} rescheduled for ${n} months at ₹${loan.emiAmount}/mo.`,
                    type: 'success',
                    link: '/my-loans'
                });
            } catch (e) { }

            return res.json({
                success: true,
                data: loan,
                message: `Partial payment of ₹${paidAmount.toLocaleString('en-IN')} recorded. Remaining ₹${remainingBalance.toLocaleString('en-IN')} rescheduled into ${n} EMIs!`
            });
        }

        // Full One-Time Settlement
        const fullAmount = paidAmount > 0 ? paidAmount : loan.outstandingAmount;
        loan.outstandingAmount = Math.max(0, loan.outstandingAmount - fullAmount);
        loan.status = 'Closed';

        const settlementRemark = `Full One-Time Settlement: Paid ₹${fullAmount.toLocaleString('en-IN')} via ${mode}${transactionRef ? ` (Ref: ${transactionRef})` : ''}. ${remark ? `Notes: ${remark}` : ''}`;

        loan.recoveryHistory.push({
            month: curMonth,
            year: curYear,
            amountDeducted: fullAmount,
            overrideType: 'FullSettlement',
            paymentMode: mode,
            transactionRef: transactionRef || '',
            settlementDate: now
        });

        loan.history.push({
            status: 'Closed',
            updatedBy: req.user._id,
            remark: settlementRemark
        });

        await loan.save();

        try {
            const notificationHelper = require('../utils/notificationHelper');
            await notificationHelper.createNotificationForEmployee({
                employeeId: loan.employee,
                title: 'Loan Fully Settled & Closed',
                message: `Full settlement of ₹${fullAmount} received via ${mode}. Your loan is now fully closed.`,
                type: 'success',
                link: '/my-loans'
            });
        } catch (e) { }

        return res.json({
            success: true,
            data: loan,
            message: 'Loan fully settled and closed successfully!'
        });
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

        const amount = req.body.amount !== undefined ? Number(req.body.amount) : loan.amount;
        const repaymentTerms = req.body.repaymentTerms !== undefined ? Number(req.body.repaymentTerms) : loan.repaymentTerms;
        const interestType = req.body.interestType || loan.interestType || 'No Interest';
        const interestRate = req.body.interestRate !== undefined ? Number(req.body.interestRate) : (loan.interestRate || 0);

        let totalRepayment = amount;
        let emiAmount;

        if (interestType === 'Reducing Balance' && interestRate > 0) {
            const r = interestRate / 12 / 100;
            emiAmount = Math.ceil(amount * r * Math.pow(1 + r, repaymentTerms) / (Math.pow(1 + r, repaymentTerms) - 1));
            totalRepayment = emiAmount * repaymentTerms;
        } else if (interestType === 'Flat Interest' && interestRate > 0) {
            totalRepayment = amount + (amount * (interestRate / 100));
            emiAmount = Math.ceil(totalRepayment / repaymentTerms);
        } else {
            emiAmount = Math.ceil(amount / repaymentTerms);
        }

        Object.assign(loan, req.body);
        loan.amount = amount;
        loan.repaymentTerms = repaymentTerms;
        loan.totalRepayment = totalRepayment;
        loan.emiAmount = emiAmount;
        loan.outstandingAmount = totalRepayment;

        if (req.body.preferredPaymentMethod) {
            loan.preferredPaymentMethod = req.body.preferredPaymentMethod;
            loan.disbursalMode = req.body.preferredPaymentMethod;
        }

        loan.history.push({
            status: loan.status,
            updatedBy: req.user._id,
            remark: 'Loan request updated'
        });

        await loan.save();
        res.json({ success: true, data: loan, message: 'Loan request updated successfully' });
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
