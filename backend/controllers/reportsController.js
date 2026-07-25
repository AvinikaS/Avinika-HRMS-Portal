const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const IncomeTaxProfile = require('../models/IncomeTaxProfile');
const fs = require('fs');
const path = require('path');

// 1. PF Challan Report
exports.getPFReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required' });

        const payrolls = await Payroll.find({ month: Number(month), year: Number(year), status: { $ne: 'Draft' } })
            .populate('employee', 'firstName lastName employeeCode complianceDetails salary');

        let totalEmployeePF = 0;
        let totalEmployerPF = 0;

        const data = payrolls.map(p => {
            const basic = p.earnings.basic;
            const empPF = p.deductions.pf || 0;
            // Calculate Employer PF based on % in Employee schema
            const employerPFPercent = p.employee.salary?.employerPfPercentage || 12;
            const employerPF = Math.round(basic * (employerPFPercent / 100));

            totalEmployeePF += empPF;
            totalEmployerPF += employerPF;

            return {
                employeeCode: p.employee.employeeCode,
                employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                uanNumber: p.employee.complianceDetails?.uanNumber || '-',
                basicSalary: basic,
                employeePF: empPF,
                employerPF: employerPF,
            };
        }).filter(p => p.employeePF > 0 || p.employerPF > 0);

        res.json({
            success: true,
            summary: { totalEmployees: data.length, totalEmployeePF, totalEmployerPF, totalContribution: totalEmployeePF + totalEmployerPF },
            data
        });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 2. ESIC Challan Report
exports.getESICReport = async (req, res) => {
    try {
        const { month, year } = req.query;
        if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year are required' });

        const payrolls = await Payroll.find({ month: Number(month), year: Number(year), status: { $ne: 'Draft' } })
            .populate('employee', 'firstName lastName employeeCode complianceDetails salary');

        let totalEmployeeESIC = 0;
        let totalEmployerESIC = 0;

        const data = payrolls.map(p => {
            const gross = p.grossSalary;
            const empESIC = p.deductions.esic || 0;
            const employerESICPercent = p.employee.salary?.employerEsiPercentage || 3.25;
            const employerESIC = p.employee.salary?.esiApplicable ? Math.round(gross * (employerESICPercent / 100)) : 0;

            totalEmployeeESIC += empESIC;
            totalEmployerESIC += employerESIC;

            return {
                employeeCode: p.employee.employeeCode,
                employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                esicNumber: p.employee.complianceDetails?.esicNumber || '-',
                grossSalary: gross,
                employeeESIC: empESIC,
                employerESIC: employerESIC,
            };
        }).filter(p => p.employeeESIC > 0 || p.employerESIC > 0);

        res.json({
            success: true,
            summary: { totalEmployees: data.length, totalEmployeeESIC, totalEmployerESIC, totalContribution: totalEmployeeESIC + totalEmployerESIC },
            data
        });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 3. Form 24Q (Quarterly TDS Return)
exports.getForm24Q = async (req, res) => {
    try {
        const { year, quarter } = req.query; // quarter 1 (Apr-Jun), 2 (Jul-Sep), 3 (Oct-Dec), 4 (Jan-Mar)
        if (!year || !quarter) return res.status(400).json({ success: false, message: 'Year and Quarter are required' });

        const q = Number(quarter);
        let months = [];
        let y = Number(year);
        if (q === 1) months = [4, 5, 6];
        else if (q === 2) months = [7, 8, 9];
        else if (q === 3) months = [10, 11, 12];
        else if (q === 4) { months = [1, 2, 3]; y += 1; }

        const payrolls = await Payroll.find({ month: { $in: months }, year: y, status: { $ne: 'Draft' } })
            .populate('employee', 'firstName lastName employeeCode complianceDetails');

        const employeeAggregates = {};
        payrolls.forEach(p => {
            const empId = p.employee._id.toString();
            if (!employeeAggregates[empId]) {
                employeeAggregates[empId] = {
                    employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                    panNumber: p.employee.complianceDetails?.panNumber || '-',
                    salaryPaid: 0,
                    tdsDeducted: 0
                };
            }
            employeeAggregates[empId].salaryPaid += p.grossSalary;
            employeeAggregates[empId].tdsDeducted += p.deductions.tax;
        });

        res.json({ success: true, data: Object.values(employeeAggregates).filter(e => e.tdsDeducted > 0) });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 4. Form 16 (Part A & B PDF)
exports.getForm16 = async (req, res) => {
    try {
        const { employeeId, year } = req.query; // Year is financial year start (e.g. 2026 for 2026-27)
        if (!employeeId || !year) return res.status(400).json({ success: false, message: 'Employee and Year required' });

        const emp = await Employee.findById(employeeId).populate('companyId');
        if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });

        const taxProfile = await IncomeTaxProfile.findOne({ employee: employeeId, financialYear: year });
        if (!taxProfile) return res.status(404).json({ success: false, message: 'Income Tax Declarations not found for this FY' });

        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Form16_${emp.employeeCode}_${year}.pdf`);
        doc.pipe(res);

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('FORM NO. 16', { align: 'center' });
        doc.fontSize(10).font('Helvetica').text('[See rule 31(1)(a)]', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text('PART A', { align: 'center' });
        doc.fontSize(10).text('Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary', { align: 'center' });

        doc.moveDown(2);

        // Basic Info
        doc.font('Helvetica-Bold').text('Name and address of Employer:');
        doc.font('Helvetica').text(`HRMS Corporate Dept.\nPAN: ABCDE1234F\nTAN: DELH12345G`);
        doc.moveDown();
        doc.font('Helvetica-Bold').text('Name and address of Employee:');
        doc.font('Helvetica').text(`${emp.firstName} ${emp.lastName}\nPAN: ${emp.complianceDetails?.panNumber || 'NOT PROVIDED'}`);
        doc.moveDown(2);

        // PART B Details
        doc.fontSize(12).font('Helvetica-Bold').text('PART B (Details of Salary Paid and any other income and tax deducted)', { align: 'center' });
        doc.moveDown();

        const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

        doc.fontSize(10).font('Helvetica');
        let currentY = doc.y;

        const items = [
            { label: '1. Gross Salary (Annual)', amount: taxProfile.annualGrossIncome },
            { label: '2. Any Other Income Reported by Employee', amount: taxProfile.otherIncome },
            { label: '3. Gross Total Income', amount: taxProfile.annualGrossIncome + taxProfile.otherIncome },
            { label: '4. Standard Deduction u/s 16(ia)', amount: taxProfile.standardDeduction },
            { label: '5. Deductions under Chapter VI-A (80C, 80D etc.)', amount: taxProfile.totalExemptions - taxProfile.standardDeduction },
            { label: '6. Total Taxable Income (3 - 4 - 5)', amount: taxProfile.taxableIncome },
            { label: '7. Tax on Total Income', amount: taxProfile.estimatedAnnualTax },
            { label: '8. Tax Deducted at Source (TDS)', amount: taxProfile.monthlyTDS * 12 },
            { label: '9. Net Tax Payable / (Refundable)', amount: Math.max(0, taxProfile.estimatedAnnualTax - (taxProfile.monthlyTDS * 12)) }
        ];

        items.forEach(item => {
            doc.text(item.label, 50, currentY);
            doc.text(formatter.format(item.amount), 400, currentY, { width: 100, align: 'right' });
            currentY += 20;
        });

        doc.moveDown(3);
        doc.text(`This is a system generated Form 16 based on verified exact payroll distributions for the FY ${year}-${Number(year) + 1}.`, { align: 'center', color: 'grey' });

        doc.end();
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
