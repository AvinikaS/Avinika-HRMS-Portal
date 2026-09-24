const mongoose = require('mongoose');
const ExitRequest = require('../models/ExitRequest');
const GratuityCalculation = require('../models/GratuityCalculation');
const FFSettlement = require('../models/FFSettlement');
const Employee = require('../models/Employee');
const Loan = require('../models/Loan');
const AdvanceSalary = require('../models/AdvanceSalary');
const Setting = require('../models/Setting');
const Attendance = require('../models/Attendance');

const PDFDocument = require('pdfkit');

// Helper to get system settings
const getSystemSettings = async () => {
    const settings = await Setting.find({});
    const settingsMap = {};
    settings.forEach(s => settingsMap[s.key] = s.value);
    return {
        workWeekType: settingsMap['workWeekType'] || '5-Day Week',
        applyFiftyPercentRule: settingsMap['applyFiftyPercentRule'] === true || settingsMap['applyFiftyPercentRule'] === 'true',
        gratuityTimeline: Number(settingsMap['gratuityTimeline'] || 30),
        noticePeriodDays: Number(settingsMap['noticePeriodDays'] || 30),
        companyName: settingsMap['companyName'] || 'Company Ltd.',
        companyAddress: settingsMap['companyAddress'] || 'Company Street Address',
        logoUrl: settingsMap['logoUrl'] || ''
    };
};

// POST /api/exit/resignation
exports.submitResignation = async (req, res) => {
    try {
        const {
            employeeId,
            exitReason,
            resignationDate,
            lastWorkingDay,
            lwd,
            noticePeriodRequired,
            noticePeriodServed,
            remarks,
            resignationLetter,
            earlyReleaseRequest,
            nomineeName,
            nomineeRelationship,
            nomineeBankAccount,
            nomineeIFSC,
            deathCertificateNumber,
            eventDate,
            isDraft
        } = req.body;

        const targetEmployeeId = employeeId || req.user.employeeId || req.user._id;

        // Check if employee exists
        const emp = await Employee.findById(targetEmployeeId);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

        const settings = await getSystemSettings();
        const finalNoticeRequired = noticePeriodRequired !== undefined ? Number(noticePeriodRequired) : (settings.noticePeriodDays || 30);
        const finalNoticeServed = noticePeriodServed !== undefined ? Number(noticePeriodServed) : finalNoticeRequired;

        const finalLwd = lwd || lastWorkingDay;
        const finalExitReason = exitReason || 'resignation';

        // Check if there is already an active exit request
        const activeRequest = await ExitRequest.findOne({
            employeeId: targetEmployeeId,
            approvalStatus: { $in: ['pending', 'hr_approved', 'exit_initiated'] }
        });
        if (activeRequest) {
            return res.status(400).json({ success: false, message: 'You already have an active exit request in progress.' });
        }

        // Check if there is already a draft exit request
        let exitRequest = await ExitRequest.findOne({
            employeeId: targetEmployeeId,
            approvalStatus: 'draft'
        });

        // Validations: (only if it is not a draft)
        if (!isDraft) {
            if (!finalExitReason) {
                return res.status(400).json({ success: false, message: 'Exit reason category is required' });
            }

            if (!['death', 'permanent_disablement'].includes(finalExitReason)) {
                if (!resignationDate) {
                    return res.status(400).json({ success: false, message: 'Resignation Date is required' });
                }
                const resDateObj = new Date(resignationDate);
                const targetLwdDate = new Date(finalLwd);

                if (!finalLwd || isNaN(targetLwdDate.getTime())) {
                    return res.status(400).json({ success: false, message: 'Expected Last Working Day (LWD) selection is required' });
                }
                if (targetLwdDate < resDateObj) {
                    return res.status(400).json({ success: false, message: 'Last Working Day cannot be before Resignation Date' });
                }

                // Verify LWD is within 90 days from today
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const maxLwd = new Date();
                maxLwd.setDate(today.getDate() + 90);
                maxLwd.setHours(23, 59, 59, 999);

                if (targetLwdDate > maxLwd) {
                    return res.status(400).json({ success: false, message: `LWD cannot be more than 90 days in the future. Latest allowed: ${maxLwd.toLocaleDateString('en-IN')}` });
                }
            }

            if (!resignationLetter || resignationLetter.trim().length < 20) {
                return res.status(400).json({ success: false, message: 'Resignation statement / letter details must be at least 20 characters long' });
            }
        }

        let approvalStatus = isDraft ? 'draft' : 'pending';
        // Special handling for Death / Permanent Disablement
        if (!isDraft && (finalExitReason === 'death' || finalExitReason === 'permanent_disablement')) {
            approvalStatus = 'exit_initiated';
        }

        if (exitRequest) {
            // Update existing draft request
            exitRequest.exitReason = finalExitReason;
            exitRequest.resignationDate = resignationDate || exitRequest.resignationDate || new Date();
            exitRequest.lastWorkingDay = finalLwd || exitRequest.lastWorkingDay;
            exitRequest.noticePeriodRequired = finalNoticeRequired;
            exitRequest.noticePeriodServed = finalNoticeServed;
            exitRequest.remarks = remarks || resignationLetter || exitRequest.remarks;
            exitRequest.resignationLetter = resignationLetter || exitRequest.resignationLetter;
            exitRequest.earlyReleaseRequest = earlyReleaseRequest || exitRequest.earlyReleaseRequest;
            exitRequest.nomineeName = nomineeName || exitRequest.nomineeName;
            exitRequest.nomineeRelationship = nomineeRelationship || exitRequest.nomineeRelationship;
            exitRequest.nomineeBankAccount = nomineeBankAccount || exitRequest.nomineeBankAccount;
            exitRequest.nomineeIFSC = nomineeIFSC || exitRequest.nomineeIFSC;
            exitRequest.deathCertificateNumber = deathCertificateNumber || exitRequest.deathCertificateNumber;
            exitRequest.eventDate = eventDate || exitRequest.eventDate;
            exitRequest.approvalStatus = approvalStatus;
            await exitRequest.save();
        } else {
            // Create a new request (draft or pending)
            exitRequest = new ExitRequest({
                employeeId: targetEmployeeId,
                exitReason: finalExitReason,
                resignationDate: resignationDate || new Date(),
                lastWorkingDay: finalLwd,
                noticePeriodRequired: finalNoticeRequired,
                noticePeriodServed: finalNoticeServed,
                remarks: remarks || resignationLetter || '',
                resignationLetter: resignationLetter || '',
                earlyReleaseRequest: earlyReleaseRequest || '',
                nomineeName,
                nomineeRelationship,
                nomineeBankAccount,
                nomineeIFSC,
                deathCertificateNumber,
                eventDate,
                approvalStatus,
                initiatedBy: req.user.role === 'Employee' ? 'employee' : 'admin'
            });
            await exitRequest.save();
        }

        // Update employee status to 'Exit In Progress' if initiated directly (e.g. death/disablement case)
        if (approvalStatus === 'exit_initiated') {
            await Employee.findByIdAndUpdate(targetEmployeeId, { status: 'Exit In Progress' });
        }

        // Triggers notification only if not draft
        if (!isDraft) {
            try {
                const employeeName = `${emp.firstName} ${emp.lastName}`;
                const notificationHelper = require('../utils/notificationHelper');
                await notificationHelper.createNotification({
                    roles: ['SuperAdmin', 'HRAdmin'],
                    title: 'Resignation Submitted',
                    message: `${employeeName} has submitted an exit request (${finalExitReason}). Expected LWD: ${new Date(finalLwd).toLocaleDateString('en-IN')}`,
                    type: 'warning',
                    link: '/exit-management'
                });
            } catch (notifErr) {
                console.error('Notification dispatch failed:', notifErr);
            }
        }

        res.status(201).json({
            success: true,
            message: isDraft ? 'Draft saved successfully' : 'Exit request submitted successfully',
            data: exitRequest,
            exitRequestId: exitRequest._id
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/exit
exports.getAllExits = async (req, res) => {
    try {
        const exits = await ExitRequest.find({ approvalStatus: { $ne: 'draft' } }).populate('employeeId', 'firstName lastName employeeCode dateOfJoining basic gross leaveBalance status');

        // Auto-heal/sync database for draft/pending requests where employee might have been set to On Notice prematurely
        for (const ex of exits) {
            if (ex.approvalStatus === 'pending' && ex.employeeId && ex.employeeId.status === 'On Notice') {
                await Employee.findByIdAndUpdate(ex.employeeId._id, { status: 'Active' });
                ex.employeeId.status = 'Active'; // update in populated memory object
            }
        }

        // Map fields to have backward compatibility with old frontend expected format
        const mapped = exits.map(ex => {
            const legacyStatus = ex.approvalStatus === 'pending' ? 'Pending'
                : ex.approvalStatus === 'hr_approved' ? 'Checklist Pending'
                    : ex.approvalStatus === 'management_approved' ? 'Checklist Pending'
                        : ex.approvalStatus === 'exit_initiated' ? 'F&F Pending'
                            : ex.approvalStatus === 'completed' ? 'Completed'
                                : ex.approvalStatus === 'rejected' ? 'Rejected'
                                    : 'Pending';

            return {
                _id: ex._id,
                employee: ex.employeeId,
                resignationDate: ex.resignationDate,
                reason: ex.exitReason,
                expectedLastWorkingDay: ex.lastWorkingDay,
                approvedLastWorkingDay: ex.lastWorkingDay,
                status: legacyStatus,
                clearanceChecklist: {
                    itAssetsReturned: ex.clearanceChecklist?.assetsReturned || false,
                    idCardReturned: ex.clearanceChecklist?.idCardReturned || false,
                    financeCleared: ex.clearanceChecklist?.financeClearance || false,
                    knowledgeTransfer: ex.clearanceChecklist?.ktCompleted || false,
                    accessCardReturned: ex.clearanceChecklist?.accessCardReturned || false,
                    emailHandoverDone: ex.clearanceChecklist?.emailHandoverDone || false,
                    leavesSettled: ex.clearanceChecklist?.leavesSettled || false,
                    itAdminClearance: ex.clearanceChecklist?.itAdminClearance || false
                },
                exitRequestDetails: ex
            };
        });

        res.json({ success: true, data: mapped });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/exit/:id/status (legacy compat)
exports.updateExitStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body; // 'Checklist Pending', 'F&F Pending', 'Completed', 'Rejected'

        let updateStatus = 'pending';
        if (status === 'Checklist Pending' || status === 'Approved') updateStatus = 'hr_approved';
        if (status === 'F&F Pending') updateStatus = 'exit_initiated';
        if (status === 'Rejected') updateStatus = 'rejected';

        const exitRequest = await ExitRequest.findById(id);
        if (!exitRequest) return res.status(404).json({ success: false, message: 'Exit request not found' });

        exitRequest.approvalStatus = updateStatus;
        if (status === 'Rejected') {
            exitRequest.rejectionReason = rejectionReason || 'No details provided';
        }
        await exitRequest.save();

        // Update employee status based on approval/rejection
        if (updateStatus === 'hr_approved') {
            await Employee.findByIdAndUpdate(exitRequest.employeeId, { status: 'On Notice' });
        } else if (status === 'Rejected') {
            await Employee.findByIdAndUpdate(exitRequest.employeeId, { status: 'Active' });
        }

        res.json({ success: true, message: `Status updated successfully` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/exit/:id/checklist
exports.updateChecklist = async (req, res) => {
    try {
        const { id } = req.params;
        const bodyChecklist = req.body;

        const exit = await ExitRequest.findById(id);
        if (!exit) return res.status(404).json({ success: false, message: 'Exit request not found' });

        exit.clearanceChecklist = {
            assetsReturned: bodyChecklist.itAssetsReturned || false,
            idCardReturned: bodyChecklist.idCardReturned || false,
            financeClearance: bodyChecklist.financeCleared || false,
            ktCompleted: bodyChecklist.knowledgeTransfer || false,
            accessCardReturned: bodyChecklist.accessCardReturned || false,
            emailHandoverDone: bodyChecklist.emailHandoverDone || false,
            leavesSettled: bodyChecklist.leavesSettled || false,
            itAdminClearance: bodyChecklist.itAdminClearance || false
        };

        // Compute overall checklist clearance status
        const list = exit.clearanceChecklist;
        const allCleared = list.assetsReturned &&
            list.idCardReturned &&
            list.accessCardReturned &&
            list.ktCompleted &&
            list.emailHandoverDone &&
            list.leavesSettled &&
            list.financeClearance &&
            list.itAdminClearance;
        exit.clearanceStatus = allCleared ? 'Cleared' : 'In Progress';

        await exit.save();
        res.json({ success: true, data: exit });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/exit/gratuity-check/:employeeId
exports.gratuityCheck = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

        const exitRequest = await ExitRequest.findOne({ employeeId }).sort({ createdAt: -1 });
        if (!exitRequest) return res.status(400).json({ success: false, message: 'No exit request found for this employee.' });

        const doj = new Date(emp.dateOfJoining);
        const lwd = new Date(exitRequest.lastWorkingDay);

        // Calculate service tenure
        let years = lwd.getFullYear() - doj.getFullYear();
        let months = lwd.getMonth() - doj.getMonth();
        let days = lwd.getDate() - doj.getDate();

        if (days < 0) {
            months -= 1;
            const prevMonth = new Date(lwd.getFullYear(), lwd.getMonth(), 0);
            days += prevMonth.getDate();
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }

        const settings = await getSystemSettings();
        const workWeek = settings.workWeekType === '6-Day Week' ? '6day' : '5day';

        let eligibilityStatus = 'eligible';
        let eligibilityReason = '';
        let fifthYearDaysCount = 0;
        let showOverride = false;

        // Reason checks
        if (exitRequest.exitReason === 'termination_misconduct') {
            eligibilityStatus = 'not_eligible';
            eligibilityReason = 'Gratuity not payable — terminated for misconduct as per Payment of Gratuity Act.';
        } else if (exitRequest.exitReason === 'death' || exitRequest.exitReason === 'permanent_disablement') {
            eligibilityStatus = 'waived_death_disablement';
            eligibilityReason = 'Gratuity payable — death/disablement case. Minimum service requirement waived.';
        } else if (exitRequest.exitReason === 'fixed_term_end') {
            if (years < 1) {
                eligibilityStatus = 'not_eligible';
                eligibilityReason = 'Fixed term contract ended with less than 1 year of service. Gratuity not applicable.';
            } else {
                eligibilityReason = 'Eligible for fixed term contract exit with >= 1 year tenure.';
            }
        } else {
            // General 5-year check
            if (years >= 5) {
                eligibilityReason = `Eligible - completed ${years} full calendar years.`;
            } else if (years < 4) {
                eligibilityStatus = 'not_eligible';
                eligibilityReason = `Minimum 4 years service not completed. Actual service: ${years} Years ${months} Months. Gratuity not applicable.`;
            } else {
                // In their 5th year (years === 4)
                // Pull actual work days in 5th year count
                const fifthYearStart = new Date(doj);
                fifthYearStart.setFullYear(fifthYearStart.getFullYear() + 4);

                const fifthYearEnd = new Date(doj);
                fifthYearEnd.setFullYear(fifthYearEnd.getFullYear() + 5);
                const actualEnd = lwd < fifthYearEnd ? lwd : fifthYearEnd;

                const attendanceRecords = await Attendance.find({
                    employee: employeeId,
                    date: { $gte: fifthYearStart, $lte: actualEnd }
                });

                if (attendanceRecords && attendanceRecords.length > 0) {
                    // Count non-absent days
                    fifthYearDaysCount = attendanceRecords.filter(r => r.status !== 'Absent').length;
                } else {
                    showOverride = true;
                }

                const targetDays = settings.workWeekType === '6-Day Week' ? 240 : 190;
                if (fifthYearDaysCount >= targetDays) {
                    eligibilityStatus = 'eligible';
                    eligibilityReason = `5th year days counted: ${fifthYearDaysCount} / ${targetDays} required — Eligible`;
                } else {
                    if (showOverride) {
                        eligibilityStatus = 'not_eligible';
                        eligibilityReason = 'Attendance data incomplete for 5th year. Manual override required.';
                    } else {
                        eligibilityStatus = 'not_eligible';
                        eligibilityReason = `5th year days counted: ${fifthYearDaysCount} / ${targetDays} required — Not Eligible`;
                    }
                }
            }
        }

        res.json({
            success: true,
            data: {
                employeeName: `${emp.firstName} ${emp.lastName}`,
                doj,
                lwd,
                servicePeriod: `${years} Years ${months} Months ${days} Days`,
                years,
                months,
                days,
                fifthYearDaysCount,
                workWeekType: settings.workWeekType,
                eligibilityStatus,
                eligibilityReason,
                showOverride,
                applyFiftyPercentRule: settings.applyFiftyPercentRule
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/exit/ff-calculation/:employeeId
exports.getFFCalculation = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

        const exitRequest = await ExitRequest.findOne({ employeeId }).sort({ createdAt: -1 });
        if (!exitRequest) return res.status(400).json({ success: false, message: 'No exit request found.' });

        const settings = await getSystemSettings();

        // 1. Pending salary days calculation
        const lwd = new Date(exitRequest.lastWorkingDay);
        const workingDaysInMonth = new Date(lwd.getFullYear(), lwd.getMonth() + 1, 0).getDate();
        const daysWorked = lwd.getDate();

        const basic = emp.basic || emp.salary?.basic || 0;
        const gross = emp.gross || (basic * 2);

        const pendingSalary = Math.round((basic / workingDaysInMonth) * daysWorked);

        // 2. Leave Encashment
        const earnedLeaves = emp.leaveBalance?.earned || 0;
        const leaveEncashment = Math.round(earnedLeaves * (basic / 26));

        // 3. Notice Period shortfalls
        const noticePeriodRequired = exitRequest.noticePeriodRequired || settings.noticePeriodDays || 30;
        const noticePeriodServed = exitRequest.noticePeriodServed || 0;

        let noticePeriodRecovery = 0;
        if (noticePeriodServed < noticePeriodRequired) {
            const shortfall = noticePeriodRequired - noticePeriodServed;
            const rawRecovery = (basic / 30) * shortfall;
            // Cap at 2 months basic salary
            noticePeriodRecovery = Math.round(Math.min(rawRecovery, basic * 2));
        }

        // 4. Loan & Advance Recoveries
        const loans = await Loan.find({ employee: employeeId, status: { $in: ['Approved', 'Disbursed', 'In Progress'] } });
        const loanRecovery = loans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0);

        const advances = await AdvanceSalary.find({ employee: employeeId, status: { $in: ['Approved', 'Recovering'] } });
        const advanceRecovery = advances.reduce((sum, a) => sum + (a.outstandingAmount || 0), 0);

        // 5. Gratuity Calculation (Simulated)
        let gratuityAmount = 0;
        let eligibilityStatus = 'not_eligible';

        const doj = new Date(emp.dateOfJoining);
        let years = lwd.getFullYear() - doj.getFullYear();
        let months = lwd.getMonth() - doj.getMonth();
        let days = lwd.getDate() - doj.getDate();
        if (days < 0) {
            months -= 1;
            const prevMonth = new Date(lwd.getFullYear(), lwd.getMonth(), 0);
            days += prevMonth.getDate();
        }
        if (months < 0) {
            years -= 1;
            months += 12;
        }

        let completedYearsRounded = years;
        if (months >= 6) completedYearsRounded += 1;

        // Waived check
        if (exitRequest.exitReason === 'death' || exitRequest.exitReason === 'permanent_disablement') {
            eligibilityStatus = 'eligible';
            if (completedYearsRounded < 1) completedYearsRounded = 1;
        } else if (exitRequest.exitReason === 'termination_misconduct') {
            eligibilityStatus = 'not_eligible';
        } else if (exitRequest.exitReason === 'fixed_term_end') {
            if (years >= 1) eligibilityStatus = 'eligible';
        } else {
            if (years >= 5) eligibilityStatus = 'eligible';
        }

        // If eligible, apply 50% rule
        let effectiveBasic = basic;
        let showWageWarning = false;
        if (eligibilityStatus === 'eligible' || eligibilityStatus === 'waived_death_disablement') {
            if (settings.applyFiftyPercentRule && basic < (gross * 0.5)) {
                effectiveBasic = gross * 0.5;
                showWageWarning = true;
            }
            gratuityAmount = Math.round((effectiveBasic * 15 * completedYearsRounded) / 26);
        }

        const existingSettlement = await FFSettlement.findOne({ exitRequestId: exitRequest._id });

        if (existingSettlement) {
            res.json({
                success: true,
                data: {
                    employeeId,
                    exitRequestId: exitRequest._id,
                    basic,
                    gross,
                    showWageWarning,
                    effectiveBasic,
                    completedYearsRounded,
                    gratuityEligibility: eligibilityStatus,
                    earnedLeaves,
                    isLocked: true,
                    pendingSalary: existingSettlement.pendingSalary,
                    leaveEncashment: existingSettlement.leaveEncashment,
                    gratuityAmount: existingSettlement.gratuityAmount,
                    otherEarnings: existingSettlement.otherEarnings,
                    loanRecovery: existingSettlement.loanRecovery,
                    advanceRecovery: existingSettlement.advanceRecovery,
                    noticePeriodRecovery: existingSettlement.noticePeriodRecovery,
                    otherDeductions: existingSettlement.otherDeductions,
                    netFFPayable: existingSettlement.netFFPayable,
                    paymentMode: existingSettlement.paymentMode,
                    transactionReference: existingSettlement.transactionReference,
                    paymentStatus: existingSettlement.paymentStatus
                }
            });
        } else {
            res.json({
                success: true,
                data: {
                    employeeId,
                    exitRequestId: exitRequest._id,
                    basic,
                    gross,
                    pendingSalary,
                    leaveEncashment,
                    gratuityAmount,
                    loanRecovery,
                    advanceRecovery,
                    noticePeriodRecovery,
                    showWageWarning,
                    effectiveBasic,
                    completedYearsRounded,
                    gratuityEligibility: eligibilityStatus,
                    earnedLeaves,
                    isLocked: false
                }
            });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/exit/ff-approve
exports.approveFF = async (req, res) => {
    try {
        const { exitRequestId, approvedAmounts } = req.body;

        const exit = await ExitRequest.findById(exitRequestId);
        if (!exit) return res.status(404).json({ success: false, message: 'Exit request not found' });

        const existingSettlement = await FFSettlement.findOne({ exitRequestId });
        if (existingSettlement) {
            return res.status(400).json({ success: false, message: 'F&F settlement is already approved and locked for this exit request.' });
        }

        // Mandate nominee bank details for death cases
        if (exit.exitReason === 'death') {
            if (!approvedAmounts.nomineeBankAccount || !approvedAmounts.nomineeIFSC) {
                return res.status(400).json({ success: false, message: 'Nominee bank account details are mandatory for death cases.' });
            }
            // Update nominee details
            exit.nomineeBankAccount = approvedAmounts.nomineeBankAccount;
            exit.nomineeIFSC = approvedAmounts.nomineeIFSC;
            exit.nomineeName = approvedAmounts.nomineeName;
            exit.nomineeRelationship = approvedAmounts.nomineeRelationship;
        }

        // Gratuity calculation details
        const emp = await Employee.findById(exit.employeeId);
        const settings = await getSystemSettings();

        // Validation check: Gratuity cannot be below formula calculation unless misconduct
        if (exit.exitReason === 'termination_misconduct' && Number(approvedAmounts.gratuityAmount) > 0) {
            return res.status(400).json({ success: false, message: 'Misconduct termination: Gratuity must be ₹0.' });
        }

        const basic = emp.basic || emp.salary?.basic || 0;
        const gross = emp.gross || (basic * 2);
        const doj = new Date(emp.dateOfJoining);
        const lwd = new Date(exit.lastWorkingDay);

        let years = lwd.getFullYear() - doj.getFullYear();
        let months = lwd.getMonth() - doj.getMonth();
        let rounded = years + (months >= 6 ? 1 : 0);
        if ((exit.exitReason === 'death' || exit.exitReason === 'permanent_disablement') && rounded < 1) {
            rounded = 1;
        }

        let minGratuity = 0;
        const isEligible = ['death', 'permanent_disablement'].includes(exit.exitReason) ||
            (exit.exitReason === 'fixed_term_end' && years >= 1) ||
            (exit.exitReason !== 'termination_misconduct' && years >= 5);

        if (isEligible) {
            let effBasic = basic;
            if (settings.applyFiftyPercentRule && basic < (gross * 0.5)) {
                effBasic = gross * 0.5;
            }
            minGratuity = Math.round((effBasic * 15 * rounded) / 26);
        }

        if (exit.exitReason !== 'termination_misconduct' && Number(approvedAmounts.gratuityAmount) < minGratuity) {
            return res.status(400).json({
                success: false,
                message: `Gratuity amount cannot be less than the statutory formula value of ₹${minGratuity}.`
            });
        }

        // Save FFSettlement
        const settlement = new FFSettlement({
            employeeId: exit.employeeId,
            exitRequestId: exit._id,
            pendingSalary: approvedAmounts.pendingSalary || 0,
            leaveEncashment: approvedAmounts.leaveEncashment || 0,
            gratuityAmount: approvedAmounts.gratuityAmount || 0,
            otherEarnings: approvedAmounts.otherEarnings || 0,
            noticePeriodRecovery: approvedAmounts.noticePeriodRecovery || 0,
            loanRecovery: approvedAmounts.loanRecovery || 0,
            advanceRecovery: approvedAmounts.advanceRecovery || 0,
            otherDeductions: approvedAmounts.otherDeductions || 0,
            netFFPayable: approvedAmounts.netFFPayable || 0,
            approvedBy: req.user._id,
            approvedOn: new Date(),
            paymentStatus: 'pending'
        });

        await settlement.save();

        exit.approvalStatus = 'exit_initiated'; // keep in exit_initiated F&F stage
        await exit.save();

        res.json({ success: true, message: 'F&F calculation approved and locked successfully', data: settlement });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/exit/mark-paid
exports.markPaid = async (req, res) => {
    try {
        const { exitRequestId, paymentDate, paymentMode, transactionReference } = req.body;

        const settlement = await FFSettlement.findOne({ exitRequestId });
        if (!settlement) return res.status(404).json({ success: false, message: 'F&F settlement record not found.' });

        settlement.paymentStatus = 'paid';
        settlement.paymentDate = paymentDate || new Date();
        settlement.paymentMode = paymentMode || 'Bank Transfer';
        settlement.transactionReference = transactionReference || 'TXN-DIRECT';
        await settlement.save();

        res.json({ success: true, message: 'Payment status updated to Paid', data: settlement });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/exit/complete
exports.completeExit = async (req, res) => {
    try {
        const { exitRequestId } = req.body;

        const exit = await ExitRequest.findById(exitRequestId);
        if (!exit) return res.status(404).json({ success: false, message: 'Exit request not found.' });

        exit.approvalStatus = 'completed'; // fully complete status
        await exit.save();

        // Deactivate employee & save leaving date
        await Employee.findByIdAndUpdate(exit.employeeId, { status: 'Inactive', dateOfLeaving: exit.lastWorkingDay });

        res.json({ success: true, message: 'Exit workflow completed. Employee marked Inactive.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/exit/documents/:exitRequestId
exports.generateDocument = async (req, res) => {
    try {
        const { exitRequestId } = req.params;
        const { type } = req.query; // ff_letter, experience_letter, relieving_letter

        let exit = null;
        if (exitRequestId && mongoose.Types.ObjectId.isValid(exitRequestId)) {
            exit = await ExitRequest.findById(exitRequestId).populate('employeeId');
            if (!exit) {
                exit = await ExitRequest.findOne({ employeeId: exitRequestId }).populate('employeeId');
            }
        }
        if (!exit) {
            // Fallback: find any non-draft exit request
            exit = await ExitRequest.findOne({ approvalStatus: { $ne: 'draft' } }).sort({ updatedAt: -1 }).populate('employeeId');
        }
        if (!exit) return res.status(404).send('Exit request not found');

        const emp = exit.employeeId;
        const settings = await getSystemSettings();
        let settlement = await FFSettlement.findOne({ exitRequestId: exit._id });
        if (!settlement) {
            settlement = await FFSettlement.findOne({ employeeId: emp?._id || emp }).sort({ createdAt: -1 });
        }
        settlement = settlement || {};

        const doc = new PDFDocument({ margin: 50 });

        // Set headers for file download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${type}_${emp.employeeCode}.pdf"`);

        doc.pipe(res);

        // Header (Company Details)
        doc.fontSize(20).text(settings.companyName, { align: 'center' });
        doc.fontSize(10).text(settings.companyAddress, { align: 'center' });
        doc.moveDown(2);

        const formattedDate = new Date().toLocaleDateString('en-IN');

        if (type === 'ff_letter') {
            doc.fontSize(14).text('Full & Final Settlement Statement', { align: 'center', underline: true });
            doc.moveDown(1.5);
            doc.fontSize(11).text(`Date: ${formattedDate}`);
            doc.text(`Employee Code: ${emp.employeeCode}`);
            doc.text(`Employee Name: ${emp.firstName} ${emp.lastName}`);
            doc.text(`Department: ${emp.department}`);
            doc.text(`Date of Joining: ${new Date(emp.dateOfJoining).toLocaleDateString('en-IN')}`);
            doc.text(`Last Working Day: ${new Date(exit.lastWorkingDay).toLocaleDateString('en-IN')}`);
            doc.moveDown(1.5);

            doc.fontSize(12).text('Earnings Summary:', { underline: true });
            doc.fontSize(11);
            doc.text(`  Pending Salary: Rs. ${settlement.pendingSalary || 0}`);
            doc.text(`  Leave Encashment: Rs. ${settlement.leaveEncashment || 0}`);
            doc.text(`  Gratuity Amount: Rs. ${settlement.gratuityAmount || 0}`);
            doc.text(`  Other Earnings: Rs. ${settlement.otherEarnings || 0}`);
            doc.moveDown(1);

            doc.fontSize(12).text('Deductions Summary:', { underline: true });
            doc.fontSize(11);
            doc.text(`  Notice Period Recovery: Rs. ${settlement.noticePeriodRecovery || 0}`);
            doc.text(`  Loan Recovery: Rs. ${settlement.loanRecovery || 0}`);
            doc.text(`  Advance Recovery: Rs. ${settlement.advanceRecovery || 0}`);
            doc.text(`  Other Deductions: Rs. ${settlement.otherDeductions || 0}`);
            doc.moveDown(1.5);

            doc.fontSize(12).text(`NET PAYABLE AMOUNT: Rs. ${settlement.netFFPayable || 0}`, { bold: true });
            doc.text(`Payment Status: ${(settlement.paymentStatus || 'Pending').toUpperCase()}`);
            if (settlement.paymentMode) {
                doc.text(`Payment Mode: ${settlement.paymentMode}`);
                if (settlement.transactionReference) {
                    doc.text(`Transaction ID / Ref: ${settlement.transactionReference}`);
                }
            }

        } else if (type === 'experience_letter') {
            doc.fontSize(14).text('EXPERIENCE CERTIFICATE', { align: 'center', underline: true });
            doc.moveDown(2);
            doc.fontSize(11);
            doc.text(`Date: ${formattedDate}`);
            doc.moveDown(1.5);
            doc.text(`This is to certify that Mr./Ms. ${emp.firstName} ${emp.lastName} (Employee Code: ${emp.employeeCode}) was employed with ${settings.companyName} as a ${emp.designation} in the ${emp.department} department from ${new Date(emp.dateOfJoining).toLocaleDateString('en-IN')} to ${new Date(exit.lastWorkingDay).toLocaleDateString('en-IN')}.`);
            doc.moveDown(1);
            doc.text(`During their tenure with us, we found them to be diligent, hardworking, and extremely professional. Their conduct and behavior were exemplary.`);
            doc.moveDown(1);
            doc.text(`We wish them the very best in all their future professional endeavors.`);

        } else if (type === 'relieving_letter') {
            doc.fontSize(14).text('RELIEVING LETTER', { align: 'center', underline: true });
            doc.moveDown(2);
            doc.fontSize(11);
            doc.text(`Date: ${formattedDate}`);
            doc.moveDown(1.5);
            doc.text(`To,`);
            doc.text(`${emp.firstName} ${emp.lastName}`);
            doc.text(`Employee Code: ${emp.employeeCode}`);
            doc.moveDown(1.5);
            doc.text(`Subject: Relieving Letter`);
            doc.moveDown(1);
            doc.text(`Dear ${emp.firstName},`);
            doc.moveDown(1);
            doc.text(`This is with reference to your resignation letter from the services of the company. We wish to inform you that your resignation has been accepted and you are relieved from the services of the company with effect from the close of business hours on ${new Date(exit.lastWorkingDay).toLocaleDateString('en-IN')}.`);
            doc.moveDown(1);
            doc.text(`We also confirm that you have returned all assets belonging to the company, and your Full & Final Settlement has been cleared.`);
            doc.moveDown(1.5);
            doc.text(`For ${settings.companyName},`);
            doc.moveDown(2);
            doc.text('Authorized Signatory');
        } else if (type === 'gratuity_sheet' || type === 'gratuity-sheet') {
            doc.fontSize(14).text('GRATUITY CALCULATION SHEET', { align: 'center', underline: true });
            doc.moveDown(2);
            doc.fontSize(11);
            doc.text(`Date: ${formattedDate}`);
            doc.moveDown(1);
            doc.text(`Employee Code: ${emp.employeeCode}`);
            doc.text(`Employee Name: ${emp.firstName} ${emp.lastName}`);
            doc.text(`Department: ${emp.department || 'N/A'}`);
            doc.text(`Designation: ${emp.designation || 'N/A'}`);
            doc.text(`Date of Joining (DOJ): ${new Date(emp.dateOfJoining).toLocaleDateString('en-IN')}`);
            doc.text(`Last Working Day (LWD): ${new Date(exit.lastWorkingDay).toLocaleDateString('en-IN')}`);
            doc.moveDown(1.5);

            // Gratuity calculation parameters
            const dojDate = new Date(emp.dateOfJoining);
            const lwdDate = new Date(exit.lastWorkingDay);
            let years = lwdDate.getFullYear() - dojDate.getFullYear();
            let months = lwdDate.getMonth() - dojDate.getMonth();
            let days = lwdDate.getDate() - dojDate.getDate();
            if (days < 0) {
                months -= 1;
                const prevMonth = new Date(lwdDate.getFullYear(), lwdDate.getMonth(), 0);
                days += prevMonth.getDate();
            }
            if (months < 0) {
                years -= 1;
                months += 12;
            }
            let rounded = years;
            if (months >= 6) rounded += 1;

            const basic = emp.basic || emp.salary?.basic || 0;
            const gross = emp.gross || (basic * 2);

            let effectiveBasic = basic;
            if (settings.applyFiftyPercentRule && basic < (gross * 0.5)) {
                effectiveBasic = gross * 0.5;
            }

            let gratuityEligible = false;
            if (exit.exitReason === 'death' || exit.exitReason === 'permanent_disablement') {
                gratuityEligible = true;
                if (rounded < 1) rounded = 1;
            } else if (exit.exitReason === 'fixed_term_end') {
                if (years >= 1) gratuityEligible = true;
            } else {
                if (years >= 5) gratuityEligible = true;
            }

            const calculatedAmount = gratuityEligible ? Math.round((effectiveBasic * 15 * rounded) / 26) : 0;

            doc.fontSize(12).text('Gratuity Calculation Parameter & Breakdown:', { underline: true });
            doc.fontSize(11);
            doc.text(`  1. Total Service Tenure: ${years} Years ${months} Months ${days} Days`);
            doc.text(`  2. Completed Service Years (Rounded): ${rounded} Years`);
            doc.text(`  3. Last Drawn Basic Salary: Rs. ${basic}`);
            if (settings.applyFiftyPercentRule && basic < (gross * 0.5)) {
                doc.text(`  4. Wage Restructuring Rule Applied: Yes (Basic capped at 50% of gross: Rs. ${effectiveBasic})`);
            } else {
                doc.text(`  4. Wage Restructuring Rule Applied: No`);
            }
            doc.text(`  5. Statutory Formula: (Basic × 15 × Years) ÷ 26`);
            doc.text(`  6. Calculated Gratuity Amount: Rs. ${calculatedAmount}`);
            doc.text(`  7. Tax Exemption Limit Check: Under Sec 10(10) - (Exempt up to Rs. 20,00,000)`);
            doc.moveDown(1.5);
            doc.text(`Status of Gratuity: ${gratuityEligible ? 'PAYABLE (Exempt from Income Tax)' : 'NOT PAYABLE (Service period threshold not met / misconduct termination)'}`);
            doc.moveDown(2);
            doc.text(`For ${settings.companyName},`, { align: 'right' });
            doc.moveDown(2);
            doc.text('Authorized Signatory', { align: 'right' });
        } else {
            return res.status(400).send('Invalid document type requested');
        }

        doc.end();
    } catch (err) {
        res.status(500).send(err.message);
    }
};

// PUT /api/exit/:id/fnf (legacy wrapper)
exports.calculateFnFLegacy = async (req, res) => {
    try {
        const { id } = req.params;
        const exit = await ExitRequest.findById(id);
        if (!exit) return res.status(404).json({ success: false, message: 'Exit request not found.' });

        // Transition to next status
        exit.approvalStatus = 'exit_initiated';
        await exit.save();

        // Also save simple settlement
        const settlement = new FFSettlement({
            employeeId: exit.employeeId,
            exitRequestId: exit._id,
            pendingSalary: req.body.otherEarnings || 0,
            leaveEncashment: 0,
            gratuityAmount: 0,
            netFFPayable: (req.body.otherEarnings || 0) - (req.body.otherDeductions || 0),
            paymentStatus: 'pending'
        });
        await settlement.save();

        res.json({ success: true, data: exit });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// PUT /api/exit/:id
exports.updateExitRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            exitReason,
            resignationDate,
            lastWorkingDay,
            noticePeriodServed,
            remarks,
            nomineeName,
            nomineeRelationship,
            nomineeBankAccount,
            nomineeIFSC,
            deathCertificateNumber,
            eventDate
        } = req.body;

        const exitRequest = await ExitRequest.findById(id);
        if (!exitRequest) {
            return res.status(404).json({ success: false, message: 'Exit request not found' });
        }

        // Limit edits to pending cases only!
        if (exitRequest.approvalStatus !== 'pending') {
            return res.status(400).json({ success: false, message: 'Cannot edit: Request has already been approved / processed.' });
        }

        const isEmployeeInitiated = exitRequest.initiatedBy === 'employee' || !exitRequest.initiatedBy;
        let changesDetail = [];
        const formatDateStr = (dStr) => {
            if (!dStr) return 'N/A';
            const d = new Date(dStr);
            return isNaN(d.getTime()) ? dStr : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        };

        if (isEmployeeInitiated) {
            // Only Expected Last Working Day can be edited for employee-initiated resignations
            if (lastWorkingDay && new Date(lastWorkingDay).toDateString() !== new Date(exitRequest.lastWorkingDay).toDateString()) {
                changesDetail.push(`Expected Last Working Day updated from ${formatDateStr(exitRequest.lastWorkingDay)} to ${formatDateStr(lastWorkingDay)}`);
                exitRequest.lastWorkingDay = lastWorkingDay;
            }
            if (noticePeriodServed !== undefined) {
                const newVal = noticePeriodServed === '' ? 0 : Number(noticePeriodServed);
                if (newVal !== exitRequest.noticePeriodServed) {
                    changesDetail.push(`Notice Period Served updated from ${exitRequest.noticePeriodServed} Days to ${newVal} Days`);
                    exitRequest.noticePeriodServed = newVal;
                }
            }

            if (changesDetail.length > 0) {
                exitRequest.adminEdited = true;
                const separator = exitRequest.adminEditDetails ? '; ' : '';
                exitRequest.adminEditDetails = (exitRequest.adminEditDetails || '') + separator + changesDetail.join(', ');
            }
        } else {
            // Update fields normally (all fields can be edited for admin manually created exit requests)
            exitRequest.exitReason = exitReason || exitRequest.exitReason;
            if (resignationDate) exitRequest.resignationDate = resignationDate;
            if (lastWorkingDay) exitRequest.lastWorkingDay = lastWorkingDay;
            exitRequest.noticePeriodServed = (noticePeriodServed !== undefined) ? (noticePeriodServed === '' ? 0 : Number(noticePeriodServed)) : exitRequest.noticePeriodServed;
            exitRequest.remarks = (remarks !== undefined) ? remarks : exitRequest.remarks;

            // Nominee fields
            if (['death', 'permanent_disablement'].includes(exitReason || exitRequest.exitReason)) {
                exitRequest.nomineeName = nomineeName || exitRequest.nomineeName;
                exitRequest.nomineeRelationship = nomineeRelationship || exitRequest.nomineeRelationship;
                exitRequest.nomineeBankAccount = nomineeBankAccount || exitRequest.nomineeBankAccount;
                exitRequest.nomineeIFSC = nomineeIFSC || exitRequest.nomineeIFSC;
                exitRequest.deathCertificateNumber = deathCertificateNumber || exitRequest.deathCertificateNumber;
                exitRequest.eventDate = eventDate || exitRequest.eventDate;
            }
        }

        await exitRequest.save();
        res.json({ success: true, message: 'Exit request details updated successfully', data: exitRequest });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/exit/resignation-status
exports.getResignationStatus = async (req, res) => {
    try {
        const employeeId = req.user.employeeId;
        if (!employeeId) {
            return res.json({ hasResignation: false, isDraft: false });
        }

        const employee = await Employee.findById(employeeId).populate('reportingManager');
        if (!employee) {
            return res.json({ success: true, hasResignation: false, isDraft: false });
        }

        // 1. Check outstanding loan/advance
        const loans = await Loan.find({ employee: employeeId, status: { $in: ['Approved', 'Disbursed', 'In Progress'] } });
        const advances = await AdvanceSalary.find({ employee: employeeId, status: { $in: ['Approved', 'Recovering'] } });
        const totalLoanOutstanding = loans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0);
        const totalAdvanceOutstanding = advances.reduce((sum, a) => sum + (a.outstandingAmount || 0), 0);
        const totalOutstanding = totalLoanOutstanding + totalAdvanceOutstanding;

        let reportingManagerName = 'N/A';
        if (employee.reportingManager && employee.reportingManager.firstName) {
            reportingManagerName = `${employee.reportingManager.firstName} ${employee.reportingManager.lastName || ''}`.trim();
        } else if (employee.manager) {
            reportingManagerName = employee.manager;
        }

        const exitRequest = await ExitRequest.findOne({ employeeId }).sort({ createdAt: -1 });
        if (!exitRequest) {
            return res.json({ success: true, hasResignation: false, isDraft: false, totalOutstanding, reportingManagerName });
        }

        const isDraft = exitRequest.approvalStatus === 'draft';
        if (isDraft) {
            return res.json({
                success: true,
                hasResignation: false,
                isDraft: true,
                exitRequestId: exitRequest._id,
                resignationDate: exitRequest.resignationDate,
                exitReason: exitRequest.exitReason,
                lwd: exitRequest.lastWorkingDay,
                remarks: exitRequest.remarks,
                resignationLetter: exitRequest.resignationLetter,
                earlyReleaseRequest: exitRequest.earlyReleaseRequest,
                initiatedBy: exitRequest.initiatedBy || 'employee',
                totalOutstanding,
                reportingManagerName
            });
        }

        // 2. Checklist progress
        const checklist = exitRequest.clearanceChecklist || {};
        const checklistItems = [
            { key: 'assetsReturned', name: 'Assets Returned' },
            { key: 'idCardReturned', name: 'ID Card Returned' },
            { key: 'accessCardReturned', name: 'Access Card Returned' },
            { key: 'ktCompleted', name: 'Knowledge Transfer Completed' },
            { key: 'emailHandoverDone', name: 'Email Handover Done' },
            { key: 'leavesSettled', name: 'Leaves Settled' },
            { key: 'financeClearance', name: 'Finance Clearance' },
            { key: 'itAdminClearance', name: 'IT Admin Clearance' }
        ];

        let cleared = 0;
        const items = checklistItems.map(item => {
            const isCleared = !!checklist[item.key];
            if (isCleared) cleared++;
            return { name: item.name, cleared: isCleared };
        });
        const total = 8;
        const checklistProgress = { cleared, total, items };

        // 3. F&F details
        const settlement = await FFSettlement.findOne({ exitRequestId: exitRequest._id });
        let ffDetails = null;
        let ffStatus = 'pending';
        let gratuityDetails = null;

        const settings = await getSystemSettings();
        const doj = employee.dateOfJoining;
        const lwd = exitRequest.lastWorkingDay;

        let years = 0, months = 0, days = 0;
        let completedYearsRounded = 0;
        let gratuityEligibility = 'not_eligible';
        let lastDrawnBasic = employee.basic || employee.salary?.basic || 0;

        if (doj && lwd) {
            const dojDate = new Date(doj);
            const lwdDate = new Date(lwd);
            years = lwdDate.getFullYear() - dojDate.getFullYear();
            months = lwdDate.getMonth() - dojDate.getMonth();
            days = lwdDate.getDate() - dojDate.getDate();
            if (days < 0) {
                months -= 1;
                const prevMonth = new Date(lwdDate.getFullYear(), lwdDate.getMonth(), 0);
                days += prevMonth.getDate();
            }
            if (months < 0) {
                years -= 1;
                months += 12;
            }
            completedYearsRounded = years;
            if (months >= 6) completedYearsRounded += 1;

            if (exitRequest.exitReason === 'death' || exitRequest.exitReason === 'permanent_disablement') {
                gratuityEligibility = 'eligible';
                if (completedYearsRounded < 1) completedYearsRounded = 1;
            } else if (exitRequest.exitReason === 'fixed_term_end') {
                if (years >= 1) gratuityEligibility = 'eligible';
            } else if (exitRequest.exitReason === 'termination_misconduct') {
                gratuityEligibility = 'not_eligible';
            } else {
                if (years >= 5) gratuityEligibility = 'eligible';
            }
        }

        let calculatedGratuity = 0;
        if (gratuityEligibility === 'eligible') {
            let effectiveBasic = lastDrawnBasic;
            if (settings.applyFiftyPercentRule && lastDrawnBasic < (employee.gross * 0.5)) {
                effectiveBasic = employee.gross * 0.5;
            }
            calculatedGratuity = Math.round((effectiveBasic * 15 * completedYearsRounded) / 26);
        }

        gratuityDetails = {
            doj,
            lwd,
            totalService: `${years} Years ${months} Months ${days} Days`,
            eligibilityStatus: gratuityEligibility,
            lastDrawnBasic,
            completedYearsRounded,
            gratuityAmount: calculatedGratuity,
            taxExempt: calculatedGratuity < 2000000
        };

        if (settlement) {
            ffStatus = settlement.paymentStatus === 'paid' ? 'paid' : 'approved';
            ffDetails = {
                pendingSalary: settlement.pendingSalary,
                leaveEncashment: settlement.leaveEncashment,
                gratuityAmount: settlement.gratuityAmount,
                noticePeriodRecovery: settlement.noticePeriodRecovery,
                loanRecovery: settlement.loanRecovery + settlement.advanceRecovery,
                netPayable: settlement.netFFPayable,
                paymentStatus: settlement.paymentStatus,
                paymentDate: settlement.paymentDate
            };
        } else {
            // Simulated preview
            const lwdDate = lwd ? new Date(lwd) : new Date();
            const workingDaysInMonth = new Date(lwdDate.getFullYear(), lwdDate.getMonth() + 1, 0).getDate();
            const daysWorked = lwdDate.getDate();
            const pendingSalary = Math.round((lastDrawnBasic / workingDaysInMonth) * daysWorked);
            const earnedLeaves = employee.leaveBalance?.earned || 0;
            const leaveEncashment = Math.round(earnedLeaves * (lastDrawnBasic / 26));

            const noticePeriodRequired = exitRequest.noticePeriodRequired || settings.noticePeriodDays || 30;
            const noticePeriodServed = exitRequest.noticePeriodServed || 0;
            let noticePeriodRecovery = 0;
            if (noticePeriodServed < noticePeriodRequired) {
                const shortfall = noticePeriodRequired - noticePeriodServed;
                noticePeriodRecovery = Math.round((lastDrawnBasic / 30) * shortfall);
            }

            const netPayable = pendingSalary + leaveEncashment + (exitRequest.exitReason === 'termination_misconduct' ? 0 : calculatedGratuity) - noticePeriodRecovery - totalOutstanding;

            ffDetails = {
                pendingSalary,
                leaveEncashment,
                gratuityAmount: exitRequest.exitReason === 'termination_misconduct' ? 0 : calculatedGratuity,
                noticePeriodRecovery,
                loanRecovery: totalOutstanding,
                netPayable,
                paymentStatus: 'pending',
                paymentDate: null
            };
        }

        // Documents are only ready when exit is fully completed (meaning employee status is Inactive)
        const exitCompleted = employee.status === 'Inactive';
        const documentsReady = exitCompleted;

        res.json({
            success: true,
            hasResignation: true,
            exitRequestId: exitRequest._id,
            resignationDate: exitRequest.resignationDate,
            exitReason: exitRequest.exitReason,
            lwd: exitRequest.lastWorkingDay,
            approvalStatus: exitRequest.approvalStatus,
            approvedOn: exitRequest.updatedAt,
            initiatedBy: exitRequest.initiatedBy || 'employee',
            remarks: exitRequest.remarks,
            adminEdited: exitRequest.adminEdited || false,
            adminEditDetails: exitRequest.adminEditDetails || '',
            rejectionReason: exitRequest.rejectionReason || '',
            checklistProgress,
            ffStatus,
            ffDetails,
            documentsReady,
            gratuityDetails,
            totalOutstanding,
            designation: employee.designation,
            reportingManagerName
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/exit/documents-download/:type
exports.downloadSelfDocument = async (req, res, next) => {
    try {
        const type = req.params.typeOrId || req.params.type;
        const employeeId = req.user.employeeId;
        if (!employeeId) return res.status(400).send('Employee ID not linked to your user account.');

        const exit = await ExitRequest.findOne({ employeeId }).sort({ createdAt: -1 });
        if (!exit) return res.status(404).send('Exit request not found');

        const emp = await Employee.findById(employeeId);
        if (!emp) return res.status(404).send('Employee not found');
        if (emp.status !== 'Inactive') {
            return res.status(403).send('Exit process not completed yet. Documents will be downloadable after complete offboarding.');
        }

        req.params.exitRequestId = exit._id;
        req.query.type = type.replace(/-/g, '_');
        return exports.generateDocument(req, res);
    } catch (err) {
        res.status(500).send(err.message);
    }
};
