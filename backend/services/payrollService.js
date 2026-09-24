const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const { getAttendanceStats } = require('../utils/attendanceUtils');
const { calculateMonthlyTDS } = require('../utils/taxUtils');

const Loan = require('../models/Loan');
const AdvanceSalary = require('../models/AdvanceSalary');
const { ExpenseClaim } = require('../models/ExpenseClaim.model');

exports.rollbackPayrollDeductions = async (month, year, employeeId = null) => {
    // 1. Rollback Loans
    const loanQuery = { 'recoveryHistory': { $elemMatch: { month, year } } };
    if (employeeId) loanQuery.employee = employeeId;

    const loansToRollback = await Loan.find(loanQuery);
    for (const loan of loansToRollback) {
        const historyItemIndex = loan.recoveryHistory.findIndex(h => h.month === month && h.year === year);
        if (historyItemIndex !== -1) {
            const deductedAmount = loan.recoveryHistory[historyItemIndex].amountDeducted;
            loan.outstandingAmount += deductedAmount;
            loan.recoveryHistory.splice(historyItemIndex, 1);
            if (loan.status === 'Closed') {
                loan.status = 'In Progress';
                // Remove the 'Closed' history event
                const closeHistoryIndex = loan.history.findIndex(h => h.status === 'Closed' && h.remark && h.remark.includes(`${month}/${year}`));
                if (closeHistoryIndex !== -1) loan.history.splice(closeHistoryIndex, 1);
            }
            await loan.save();
        }
    }

    // 2. Rollback Advance Salaries
    const advanceQuery = { 'recoveryHistory': { $elemMatch: { month, year } } };
    if (employeeId) advanceQuery.employee = employeeId;

    const advancesToRollback = await AdvanceSalary.find(advanceQuery);
    for (const adv of advancesToRollback) {
        const historyItemIndex = adv.recoveryHistory.findIndex(h => h.month === month && h.year === year);
        if (historyItemIndex !== -1) {
            const deductedAmount = adv.recoveryHistory[historyItemIndex].amountDeducted;
            adv.outstandingAmount += deductedAmount;
            adv.recoveryHistory.splice(historyItemIndex, 1);
            if (adv.status === 'Recovered') {
                adv.status = 'Recovering';
                const closeHistoryIndex = adv.history.findIndex(h => h.status === 'Recovered' && h.remark && h.remark.includes(`${month}/${year}`));
                if (closeHistoryIndex !== -1) adv.history.splice(closeHistoryIndex, 1);
            }
            await adv.save();
        }
    }
};

/**
 * Core logic to generate payroll for a given month and year.
 * Can be called by the API controller or a scheduled Cron job.
 * 
 * @param {number} month 
 * @param {number} year 
 * @param {string} employeeId (Optional)
 * @returns {Promise<Array>} List of generated payroll records
 */
exports.processMonthlyPayroll = async (month, year, employeeId = null) => {
    let candidateEmployees;
    if (employeeId) {
        candidateEmployees = [await Employee.findById(employeeId)];
    } else {
        candidateEmployees = await Employee.find({
            dateOfJoining: { $lte: new Date(year, month, 0, 23, 59, 59) }
        });
    }

    const employees = [];
    const payrollStart = new Date(year, month - 1, 1);
    const ExitRequest = require('../models/ExitRequest');

    for (const emp of candidateEmployees) {
        if (!emp) continue;

        if (employeeId) {
            employees.push(emp);
            continue;
        }

        // Active statuses are always eligible
        if (['Active', 'On Notice', 'Exit In Progress'].includes(emp.status)) {
            employees.push(emp);
            continue;
        }

        // Inactive / Resigned / Terminated checks:
        // 1. Check if dateOfLeaving is in the payroll month or future
        if (emp.dateOfLeaving && new Date(emp.dateOfLeaving) >= payrollStart) {
            employees.push(emp);
            continue;
        }

        // 2. Check if there is an approved or completed exit request
        const exitReq = await ExitRequest.findOne({
            employeeId: emp._id,
            approvalStatus: { $ne: 'rejected' }
        }).sort({ createdAt: -1 });

        if (exitReq) {
            // If exit process is fully completed, DO NOT include in regular monthly payroll (as F&F settlement handles their final payout)
            if (exitReq.approvalStatus === 'completed' || emp.status === 'Inactive') {
                continue;
            }
            if (exitReq.lastWorkingDay && new Date(exitReq.lastWorkingDay) >= payrollStart) {
                employees.push(emp);
                continue;
            }
        }
    }

    const Setting = require('../models/Setting');
    const settingsRaw = await Setting.find({});
    const sysSettings = {};
    settingsRaw.forEach(s => sysSettings[s.key] = s.value);

    const esicWageComponents = sysSettings.esicWageComponents || ['Basic', 'HRA', 'Allowance', 'Incentive', 'Bonus'];
    const esicWageCeiling = sysSettings.esicWageCeiling || 21000;
    const esicEmployeeRate = sysSettings.esicEmployeeRate || 0.75;
    const esicEmployerRate = sysSettings.esicEmployerRate || 3.25;

    // Determine the ESIC period for this month
    let esicPeriod = '';
    const m = parseInt(month);
    const y = parseInt(year);
    if (m >= 4 && m <= 9) esicPeriod = `Apr-Sep ${y}`;
    else if (m >= 10 && m <= 12) esicPeriod = `Oct-Mar ${y}-${(y + 1).toString().slice(2)}`;
    else esicPeriod = `Oct-Mar ${y - 1}-${y.toString().slice(2)}`;

    const isPeriodStartMonth = (m === 4 || m === 10);

    const results = [];

    for (const emp of employees) {
        if (!emp) continue;

        // Skip if payroll already exists
        const exists = await Payroll.findOne({ employee: emp._id, month, year });
        if (exists) continue;

        // 1. Fetch Attendance Stats
        const stats = await getAttendanceStats(emp._id, month, year);
        const { presentDays, absentDays, paidLeaves, unpaidLeaves, overtimeHours, totalWorkingDays } = stats;

        // Dynamically fetch approved Bonus & Incentives for this month
        const mongoose = require('mongoose');
        const Bonus = require('../models/Bonus');
        const Incentive = require('../models/Incentive');

        const monthlyBonuses = await Bonus.find({ employee: emp._id, month, financialYear: { $regex: year.toString() }, status: 'Approved' });
        const monthlyIncentives = await Incentive.find({ employee: emp._id, month, year, status: 'Approved' });

        const dynamicBonus = monthlyBonuses.reduce((sum, b) => sum + b.amount, 0);
        const dynamicIncentive = monthlyIncentives.reduce((sum, i) => sum + i.amount, 0);

        // 2. Earnings Calculation
        const basic = emp.basic || emp.salary?.basic || 0;
        const hra = emp.hra || emp.salary?.hra || 0;
        const specialAllowance = emp.specialAllowance || emp.salary?.allowances?.special || 0;
        const conveyance = emp.conveyance || emp.salary?.allowances?.travel || 0;
        const medicalAllowance = emp.medicalAllowance || emp.salary?.allowances?.food || 0;
        const otherAllowance = emp.otherAllowance || emp.salary?.allowances?.other || 0;

        const allowances = specialAllowance + conveyance + medicalAllowance + otherAllowance;

        // Use static fixed bonus from employee profile + dynamic bonuses awarded this month
        const totalBonus = dynamicBonus;

        const monthlyGross = emp.gross || (basic + hra + allowances);
        const perDaySalary = totalWorkingDays > 0 ? (monthlyGross / totalWorkingDays) : 0;

        const overtimePay = Math.round((perDaySalary / 8) * overtimeHours);

        // 3. Deductions Calculation
        let pfCalcType = emp.pfCalculationType || 'actual_wage';

        let pfWage = 0;
        if (pfCalcType === 'actual_wage') pfWage = basic;
        else if (pfCalcType === 'pf_ceiling') pfWage = Math.min(basic, 15000);

        let employeePf = 0;
        let employerEpf = 0;
        let employerEps = 0;
        let edli = 0;
        let adminCharges = 0;

        if (pfCalcType !== 'not_applicable') {
            // Apply 12% calculation or manual override
            employeePf = emp.pfEmployee !== undefined ? emp.pfEmployee : (emp.salary?.pfApplicable !== false ? Math.round(pfWage * 0.12) : 0);

            // Employer matching (EPS is strictly capped at max 15000 wage calculation)
            const epsWage = Math.min(pfWage, 15000);
            employerEps = Math.round(epsWage * 0.0833);

            const totalEmployer12 = Math.round(pfWage * 0.12);
            employerEpf = Math.max(0, totalEmployer12 - employerEps);

            edli = Math.round(epsWage * 0.005);
            adminCharges = Math.round(epsWage * 0.005);
        }

        const pf = employeePf;

        // ESIC CALCULATION (PERIOD LOCKED)
        let esicWagesForCalculation = 0;
        if (esicWageComponents.includes('Basic')) esicWagesForCalculation += basic;
        if (esicWageComponents.includes('HRA')) esicWagesForCalculation += hra;
        if (esicWageComponents.includes('Allowance')) esicWagesForCalculation += allowances;
        if (esicWageComponents.includes('Incentive')) esicWagesForCalculation += dynamicIncentive;
        if (esicWageComponents.includes('Bonus')) esicWagesForCalculation += totalBonus;
        if (esicWageComponents.includes('Overtime')) esicWagesForCalculation += overtimePay;

        let esicEligible = emp.esicEligible;

        if (isPeriodStartMonth || !emp.currentContributionPeriod || emp.currentContributionPeriod !== esicPeriod) {
            // Re-evaluate eligibility at the start of a new period
            esicEligible = esicWagesForCalculation <= esicWageCeiling;

            // Save eligibility to Employee model
            emp.esicEligible = esicEligible;
            emp.currentContributionPeriod = esicPeriod;
            if (esicEligible) emp.esicCoverageStartMonth = `${m}/${y}`;
            await emp.save();
        }

        let esic = 0;
        let esicEmployerContribution = 0;
        if (esicEligible) {
            esic = Math.ceil(esicWagesForCalculation * (esicEmployeeRate / 100)); // ESIC rounds up
            esicEmployerContribution = Math.ceil(esicWagesForCalculation * (esicEmployerRate / 100));
        }
        // Advanced Income Tax module / Flat TDS override
        let tax = 0;

        // If employee has new flat fields (e.g. gross is greater than 0), trust emp.tds even if it is 0. 
        // This avoids legacy fallbacks overriding a legitimate 0 tax calculated by the wizard.
        if (emp.gross !== undefined && emp.gross > 0) {
            tax = emp.tds || 0;
        } else {
            // Legacy handling
            tax = emp.tds || 0;
            if (!tax && emp.salary?.taxSlabApplicable) {
                const IncomeTaxProfile = require('../models/IncomeTaxProfile');
                const taxProfile = await IncomeTaxProfile.findOne({ employee: emp._id, financialYear: new Date().getFullYear().toString() });

                if (taxProfile && taxProfile.monthlyTDS > 0) {
                    tax = taxProfile.monthlyTDS;
                } else {
                    // Fallback to static old calculation if no profile exists
                    const annualProjected = (monthlyGross + totalBonus + dynamicIncentive) * 12;
                    const { calculateMonthlyTDS } = require('../utils/taxUtils');
                    tax = calculateMonthlyTDS(annualProjected);
                }
            }
        }

        const leaveDeduction = Math.round((unpaidLeaves + absentDays) * perDaySalary);

        // Loan EMI & Advance Recovery
        const Loan = require('../models/Loan');
        let loanEmi = 0;

        // Fetch 'In Progress' loans for this employee where EMI start month/year <= current
        const activeLoans = await Loan.find({
            employee: emp._id,
            status: 'In Progress',
            $expr: {
                $lte: [
                    { $add: [{ $multiply: ["$emiStartYear", 12] }, "$emiStartMonth"] },
                    { $add: [{ $multiply: [year, 12] }, month] }
                ]
            }
        });

        // Iterate and calculate deduction for this month
        for (const loan of activeLoans) {
            let deductionForThisLoan = 0;
            let overrideType = 'None';

            if (loan.currentOverride && loan.currentOverride.month === month && loan.currentOverride.year === year) {
                if (loan.currentOverride.overrideType === 'Skip') {
                    deductionForThisLoan = 0;
                    overrideType = 'Skip';
                } else if (loan.currentOverride.overrideType === 'Prepay') {
                    deductionForThisLoan = loan.outstandingAmount;
                    overrideType = 'Prepay';
                }
            } else {
                // Normal EMI (bounded by max outstanding)
                deductionForThisLoan = Math.min(loan.emiAmount, loan.outstandingAmount);
            }

            loanEmi += deductionForThisLoan;

            // Apply updates to the loan document (assuming payroll generation is final)
            if (deductionForThisLoan > 0 || overrideType === 'Skip') {
                loan.outstandingAmount -= deductionForThisLoan;
                loan.recoveryHistory.push({
                    month, year, amountDeducted: deductionForThisLoan, overrideType
                });

                if (loan.outstandingAmount <= 0) {
                    loan.outstandingAmount = 0;
                    loan.status = 'Closed';
                    loan.history.push({ status: 'Closed', updatedBy: null, remark: `Loan closed automatically via payroll deduction for ${month}/${year}` });
                }

                // Clear override
                if (loan.currentOverride && loan.currentOverride.month === month) loan.currentOverride = null;

                await loan.save();
            }
        }

        // Advance Recovery
        const AdvanceSalary = require('../models/AdvanceSalary');
        let advanceRecovery = 0;

        const activeAdvances = await AdvanceSalary.find({
            employee: emp._id,
            status: { $in: ['Approved', 'Recovering'] },
            $expr: {
                $lte: [
                    { $add: [{ $multiply: ["$recoveryStartYear", 12] }, "$recoveryStartMonth"] },
                    { $add: [{ $multiply: [year, 12] }, month] }
                ]
            }
        });

        for (const advance of activeAdvances) {
            let recoveryThisMonth = Math.min(advance.installmentAmount, advance.outstandingAmount);
            advanceRecovery += recoveryThisMonth;

            if (recoveryThisMonth > 0) {
                advance.outstandingAmount -= recoveryThisMonth;
                advance.status = advance.outstandingAmount <= 0 ? 'Recovered' : 'Recovering';

                advance.recoveryHistory.push({
                    month, year, amountDeducted: recoveryThisMonth
                });

                if (advance.outstandingAmount <= 0) {
                    advance.history.push({ status: 'Recovered', updatedBy: null, remark: `Advance recovered via payroll for ${month}/${year}` });
                }

                await advance.save();
            }
        }

        // Add Disbursals through Payroll System
        const disbursedLoans = await Loan.find({
            employee: emp._id,
            expectedMonth: month,
            expectedYear: year,
            disbursalMode: { $in: ['Payroll System', null] },
            status: { $in: ['Approved', 'In Progress', 'Disbursed', 'Closed'] }
        });
        const disbursedAdvances = await AdvanceSalary.find({
            employee: emp._id,
            requestMonth: month,
            requestYear: year,
            disbursalMode: { $in: ['Payroll System', null] },
            status: { $in: ['Approved', 'Recovering', 'Disbursed', 'Recovered'] }
        });

        const loanDisbursal = disbursedLoans.reduce((sum, l) => sum + l.amount, 0);
        const advanceDisbursal = disbursedAdvances.reduce((sum, a) => sum + a.amount, 0);

        // Fetch Expense Reimbursements
        const expenseMonthStr = `${year}-${month.toString().padStart(2, '0')}`;
        const reimbursableExpenses = await ExpenseClaim.find({
            employeeId: emp._id,
            'payment.method': 'PAYROLL',
            'payment.payrollMonth': expenseMonthStr,
            status: { $in: ['PAYMENT_PENDING', 'PAID'] }
        });
        const expenseReimbursement = reimbursableExpenses.reduce((sum, e) => sum + (e.amountApproved || 0), 0);

        // 4. Final Totals
        const totalEarnings = basic + hra + allowances + totalBonus + dynamicIncentive + overtimePay + loanDisbursal + advanceDisbursal + expenseReimbursement;
        const totalDeductions = pf + esic + tax + leaveDeduction + loanEmi + advanceRecovery;
        const netSalary = totalEarnings - totalDeductions;

        const payroll = await Payroll.create({
            employee: emp._id,
            month,
            year,
            presentDays,
            absentDays,
            paidLeaves,
            unpaidLeaves,
            overtimeHours,
            earnings: {
                basic,
                hra,
                allowances,
                specialAllowance,
                conveyance,
                medicalAllowance,
                otherAllowance,
                bonus: totalBonus,
                incentive: dynamicIncentive,
                overtime: overtimePay,
                loanDisbursal,
                advanceDisbursal,
                expenseReimbursement
            },
            deductions: {
                pf,
                esic,
                tax,
                leaveDeduction,
                loanEmi,
                advanceRecovery
            },
            esicDetails: {
                eligible: esicEligible,
                wages: esicWagesForCalculation,
                contributionPeriod: esicPeriod,
                employeeContribution: esic,
                employerContribution: esicEmployerContribution,
                totalContribution: esic + esicEmployerContribution
            },
            pfDetails: {
                calculationType: pfCalcType,
                pfWage,
                employeePf,
                employerEpf,
                employerEps,
                edli,
                adminCharges
            },
            grossSalary: totalEarnings,
            totalDeductions,
            netSalary,
            status: 'Generated'
        });

        results.push(payroll);
    }

    return results;
};
