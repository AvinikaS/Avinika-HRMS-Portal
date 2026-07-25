const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const TdsChallan = require('../models/TdsChallan');
const Form24QReturn = require('../models/Form24QReturn');
const Setting = require('../models/Setting');
const mongoose = require('mongoose');

// Helper to get month numbers for a quarter (Financial Year Apr-Mar)
const getMonthsForQuarter = (quarter) => {
    if (quarter === 1) return [4, 5, 6];     // Apr, May, Jun
    if (quarter === 2) return [7, 8, 9];     // Jul, Aug, Sep
    if (quarter === 3) return [10, 11, 12];  // Oct, Nov, Dec
    if (quarter === 4) return [1, 2, 3];     // Jan, Feb, Mar
    return [];
};

const calculateAnnualTax = (income, regime) => {
    let tax = 0;
    if (regime && regime.includes('Old')) {
        // Old Regime Slab
        if (income <= 250000) return 0;
        if (income <= 500000) tax = (income - 250000) * 0.05;
        else if (income <= 1000000) tax = 12500 + (income - 500000) * 0.20;
        else tax = 112500 + (income - 1000000) * 0.30;
        // Old regime 87A rebate
        if (income <= 500000) tax = 0;
    } else {
        // New Regime Slab (FY 2024-25)
        if (income <= 300000) return 0;
        if (income <= 700000) tax = (income - 300000) * 0.05;
        else if (income <= 1000000) tax = 20000 + (income - 700000) * 0.10;
        else if (income <= 1200000) tax = 50000 + (income - 1000000) * 0.15;
        else if (income <= 1500000) tax = 80000 + (income - 1200000) * 0.20;
        else tax = 140000 + (income - 1500000) * 0.30;
        // New regime 87A rebate
        if (income <= 700000) tax = 0;
    }
    // Add 4% Cess
    return Math.round(tax * 1.04);
};

exports.getSummary = async (req, res) => {
    try {
        const { fy, quarter } = req.query;
        if (!fy || !quarter) return res.status(400).json({ success: false, message: 'FY and quarter required' });

        const qNumber = parseInt(quarter.replace('Q', ''));
        const monthIndexes = getMonthsForQuarter(qNumber);

        let startYear = parseInt(fy.split('-')[0]);
        let endYear = parseInt('20' + fy.split('-')[1]);
        if (fy.split('-')[1].length === 4) endYear = parseInt(fy.split('-')[1]);

        // Fetch payroll for these months
        const payrolls = await Payroll.find({
            $or: monthIndexes.map(m => ({
                month: m,
                year: m <= 3 ? endYear : startYear
            }))
        }).populate('employee');

        // Fetch challans
        const challans = await TdsChallan.find({ financialYear: fy, month: { $in: monthIndexes } });

        // Month-wise summary
        const monthWise = monthIndexes.map(m => {
            const mYear = m <= 3 ? endYear : startYear;
            const mPayrolls = payrolls.filter(p => p.month === m && p.year === mYear);
            const mChallans = challans.filter(c => c.month === m && c.year === mYear);

            const taxDeducted = mPayrolls.reduce((sum, p) => sum + (p.deductions?.tax || 0), 0);

            // Reconcile mappings
            let mappedEmployeeIds = new Set();
            mChallans.forEach(c => {
                c.mappedEmployees.forEach(me => mappedEmployeeIds.add(me.employeeId.toString()));
            });

            // Employees with >0 TDS
            const totalEmpsWithTds = mPayrolls.filter(p => (p.deductions?.tax || 0) > 0).length;
            const mappedCount = Array.from(mappedEmployeeIds).filter(id => mPayrolls.some(p => p.employee._id.toString() === id && (p.deductions?.tax || 0) > 0)).length;

            const totalMappedAmount = mChallans.reduce((sum, c) => {
                return sum + c.mappedEmployees.reduce((s, me) => s + me.amount, 0);
            }, 0);

            let balanceDue = taxDeducted - totalMappedAmount;
            if (balanceDue < 0) balanceDue = 0; // Oversaturated

            return {
                month: m,
                year: mYear,
                taxDeducted,
                challans: mChallans,
                employeesMapped: mappedCount,
                totalEmployees: totalEmpsWithTds,
                balanceDue
            };
        });

        // Employee-wise detail
        let employeeDetails = [];
        payrolls.forEach(p => {
            const empTds = p.deductions?.tax || 0;
            if (!p.employee || empTds <= 0) return;
            // Find challan this employee is mapped to for this month
            let matchedChallan = null;
            for (let c of challans) {
                if (c.month === p.month && c.year === p.year && c.mappedEmployees.some(me => me.employeeId.toString() === p.employee._id.toString())) {
                    matchedChallan = c;
                    break;
                }
            }

            employeeDetails.push({
                employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                pan: p.employee.pan,
                employeeRefNo: p.employee.employeeCode,
                dateOfPayment: p.createdAt,
                amountPaid: p.grossSalary || 0,
                tdsDeducted: empTds,
                surcharge: 0,
                educationCess: empTds ? Math.round(empTds * 0.04) : 0,
                totalTaxDeposited: empTds, // simplifies mvp
                challanBsrCode: matchedChallan ? matchedChallan.bsrCode : '-',
                dateOfDeposit: matchedChallan ? matchedChallan.depositDate : '-',
                challanSerial: matchedChallan ? matchedChallan.challanSerial : '-',
                month: p.month,
                year: p.year
            });
        });

        // Get status
        let returnRec = await Form24QReturn.findOne({ financialYear: fy, quarter: qNumber });
        let status = 'Not processed';
        if (returnRec) {
            status = returnRec.status;
        } else {
            if (payrolls.length > 0) {
                let monthsWithChallans = monthWise.filter(mw => mw.challans.length > 0).length;
                let anyBalanceDue = monthWise.some(mw => mw.taxDeducted > 0 && mw.balanceDue > 0);

                // Requirement: All three months MUST have at least one challan mapped, and no balances.
                if (monthsWithChallans < 3 || anyBalanceDue) {
                    status = 'Pending';
                } else {
                    status = 'Ready to file';
                }
            }
        }

        res.json({
            success: true,
            status,
            monthWise,
            employeeDetails,
            returnRecord: returnRec
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.saveChallan = async (req, res) => {
    try {
        const { fy, month, year, bsrCode, challanSerial, depositDate, amount, mappedEmployees } = req.body;

        let challan = new TdsChallan({
            financialYear: fy, month, year, bsrCode, challanSerial, depositDate, amount,
            mappedEmployees: mappedEmployees || []
        });
        await challan.save();

        res.json({ success: true, challan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateChallan = async (req, res) => {
    try {
        const { id } = req.params;
        const { bsrCode, challanSerial, depositDate, amount, mappedEmployees } = req.body;

        let challan = await TdsChallan.findById(id);
        if (!challan) return res.status(404).json({ success: false, message: 'Challan not found' });

        challan.bsrCode = bsrCode;
        challan.challanSerial = challanSerial;
        challan.depositDate = depositDate;
        challan.amount = amount;
        if (mappedEmployees) challan.mappedEmployees = mappedEmployees;

        await challan.save();

        res.json({ success: true, challan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAnnexure2 = async (req, res) => {
    // Only for Q4. Summarize all months.
    try {
        const { fy } = req.query;
        let startYear = parseInt(fy.split('-')[0]);
        let endYear = parseInt('20' + fy.split('-')[1]);
        if (fy.split('-')[1].length === 4) endYear = parseInt(fy.split('-')[1]);

        // Get all payrolls for FY
        const payrolls = await Payroll.find({
            $or: [
                { year: startYear, month: { $gte: 4 } },
                { year: endYear, month: { $lte: 3 } }
            ]
        }).populate('employee');

        let employeeMap = {};
        payrolls.forEach(p => {
            const emp = p.employee;
            if (!emp) return;
            const eId = emp._id.toString();
            if (!employeeMap[eId]) {
                employeeMap[eId] = {
                    employeeName: `${emp.firstName} ${emp.lastName}`,
                    pan: emp.pan,
                    grossSalary: 0,
                    deduction80C: emp.inv80c || 0,
                    deduction80D: emp.inv80d || 0,
                    deduction80E: emp.inv80e || 0,
                    homeLoanInterest: emp.homeLoanInterest || 0,
                    hraExemption: emp.hraClaimed || 0,
                    deduction80G: emp.other80 || 0, // Mocked to other80
                    deduction80TTA: 0,
                    otherDeductions: 0,
                    totalTdsDeducted: 0,
                    regime: emp.taxRegime || 'New'
                };
            }
            employeeMap[eId].grossSalary += p.grossSalary || 0;
            employeeMap[eId].totalTdsDeducted += p.deductions?.tax || 0;
        });

        // Compute taxable
        let annexure2 = Object.values(employeeMap).map(e => {
            // New Regime standard deduction is ₹75,000 (as per latest FY), Old is ₹50,000
            let deduction16 = (e.regime === 'New' || e.regime === 'New regime (FY 2025-26)') ? 75000 : 50000;

            let totalTaxDeductions = 0;
            if (e.regime.includes('Old')) {
                totalTaxDeductions = e.deduction80C + e.deduction80D + e.deduction80E +
                    e.homeLoanInterest + e.hraExemption + e.deduction80G +
                    e.deduction80TTA + e.otherDeductions;
            }

            let incChargeable = e.grossSalary - deduction16;

            let totalTaxable = incChargeable - totalTaxDeductions;
            if (totalTaxable < 0) totalTaxable = 0;

            let taxPayable = e.totalTdsDeducted; // Set default tax logic to mirror total TDS deducted

            return {
                ...e,
                deduction16,
                totalTaxDeductions,
                totalTaxableIncome: totalTaxable,
                taxPayable: taxPayable
            };
        });

        res.json({ success: true, data: annexure2 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.generateReturn = async (req, res) => {
    try {
        const { quarter, fy, format } = req.body;

        let qNumber = typeof quarter === 'string' ? parseInt(quarter.replace('Q', '')) : quarter;

        // Find Settings TAN
        const settings = await Setting.find({});
        let tanMap = {};
        settings.forEach(s => tanMap[s.key] = s.value);
        if (!tanMap['tan']) {
            return res.status(400).json({ success: false, message: 'Company TAN not set. Please configure it in Settings.' });
        }

        // Just mark as Completed
        if (format === 'rpu-csv') {
            let returnRec = await Form24QReturn.findOne({ financialYear: fy, quarter: qNumber });
            if (!returnRec) {
                returnRec = new Form24QReturn({ financialYear: fy, quarter: qNumber });
            }
            returnRec.status = 'Completed';
            returnRec.generatedBy = req.user ? req.user._id : null;
            returnRec.generatedOn = new Date();
            returnRec.fileName = `24Q_${fy}_Q${qNumber}_${tanMap['tan']}.csv`;
            await returnRec.save();
        }

        res.json({ success: true, message: 'Return Generated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAvailablePayrollsForMonth = async (req, res) => {
    try {
        const { month, year } = req.query;
        const payrolls = await Payroll.find({ month, year }).populate('employee');
        const employees = payrolls.filter(p => (p.deductions?.tax || 0) > 0).map(p => ({
            payrollId: p._id,
            employeeId: p.employee._id,
            employeeCode: p.employee.employeeCode,
            name: `${p.employee.firstName} ${p.employee.lastName}`,
            tdsDeducted: p.deductions?.tax || 0
        }));
        res.json({ success: true, employees });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.saveFilingDetails = async (req, res) => {
    try {
        const { fy, quarter, receiptNumber, dateOfFiling } = req.body;
        const qNumber = parseInt(quarter.replace('Q', ''));

        let returnRec = await Form24QReturn.findOne({ financialYear: fy, quarter: qNumber });
        if (!returnRec) {
            returnRec = new Form24QReturn({ financialYear: fy, quarter: qNumber });
        }

        returnRec.receiptNumber = receiptNumber;
        if (dateOfFiling) returnRec.dateOfFiling = dateOfFiling;
        returnRec.status = 'Filed';

        await returnRec.save();
        res.json({ success: true, message: 'Filing details updated successfully', data: returnRec });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
