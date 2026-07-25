const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const Form16 = require('../models/Form16');
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const Setting = require('../models/Setting');
const TdsChallan = require('../models/TdsChallan');
const Form24QReturn = require('../models/Form24QReturn');

const PDFDocument = require('pdfkit-table');
const { deleteFromCloudinary } = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2;

// Helper to get quarter details
const getQuarterDetails = (q) => {
    const qMap = {
        1: { name: 'Q1', period: 'Apr-Jun', months: [4, 5, 6] },
        2: { name: 'Q2', period: 'Jul-Sep', months: [7, 8, 9] },
        3: { name: 'Q3', period: 'Oct-Dec', months: [10, 11, 12] },
        4: { name: 'Q4', period: 'Jan-Mar', months: [1, 2, 3] }
    };
    return qMap[q];
};

const numberToWords = (num) => {
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
        if (n < 20) return a[n];
        if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
        if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
        if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
        if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
        return '';
    };

    if (num === 0) return 'Zero';
    return inWords(num) + ' Rupees Only';
};

// GET /api/payroll/form16
exports.getForm16List = async (req, res) => {
    try {
        const { fy, department } = req.query; // fy format: "2025-26"
        if (!fy) return res.status(400).json({ success: false, message: 'Financial year is required' });

        const [sYear, syPart] = fy.split('-');
        const startYear = Number(sYear);
        const endYear = Number(`20${syPart}`);

        const rawSettings = await Setting.find({});
        const settings = {};
        rawSettings.forEach(s => settings[s.key] = s.value);
        if (!settings?.tan || !settings?.companyPan) {
            return res.status(400).json({ success: false, message: 'TAN / Employer PAN not configured. Please complete Settings → General before generating Form 16.', isBlocker: true });
        }

        const matchQuery = { status: 'Active' };
        if (department && department !== 'all') matchQuery.department = department;

        const employees = await Employee.find(matchQuery).lean();

        const results = [];

        for (const emp of employees) {
            // Get Payroll data for all 12 months in FY
            // FY 2025-26 -> April 2025 to March 2026
            const payrolls = await Payroll.find({
                employee: emp._id,
                $or: [
                    { year: startYear, month: { $gte: 4 } },
                    { year: endYear, month: { $lte: 3 } }
                ]
            }).lean();

            let grossAnnual = 0;
            let totalTdsDeducted = 0;
            let totalTdsDeposited = 0;

            payrolls.forEach(p => {
                grossAnnual += (p.grossSalary || 0);
                totalTdsDeducted += (p.deductions?.tax || 0);
            });

            // Get Form24Q deposited data per quarter
            const qData = [];
            for (let q = 1; q <= 4; q++) {
                const qinfo = getQuarterDetails(q);
                let qDeducted = 0;
                let qDeposited = 0;

                // Deducted in this quarter from payroll
                payrolls.forEach(p => {
                    if (qinfo.months.includes(p.month)) {
                        qDeducted += (p.deductions?.tax || 0);
                    }
                });

                // Deposited in this quarter from TdsChallan
                const challans = await TdsChallan.find({
                    financialYear: fy,
                    month: { $in: qinfo.months }
                }).lean();

                challans.forEach(ch => {
                    const mapped = ch.mappedEmployees.find(me => me.employeeId.toString() === emp._id.toString());
                    if (mapped) {
                        qDeposited += mapped.amount;
                    }
                });

                totalTdsDeposited += qDeposited;

                const qReturn = await Form24QReturn.findOne({ financialYear: fy, quarter: q });
                qData.push({
                    quarter: qinfo.name,
                    period: qinfo.period,
                    deducted: qDeducted,
                    deposited: qDeposited,
                    receiptNumber: qReturn?.receiptNumber || 'Pending'
                });
            }

            // Look for existing Form16
            const existingForm16 = await Form16.findOne({ employeeId: emp._id, financialYear: fy });

            // Allow variance of +/- Rs 10 due to rounding
            const mismatch = Math.abs(totalTdsDeducted - totalTdsDeposited) > 10;

            const employeePan = emp.pan || (emp.complianceDetails?.panNumber) || '-';

            results.push({
                employeeId: emp._id,
                employeeName: `${emp.firstName} ${emp.lastName}`,
                employeeCode: emp.employeeCode,
                pan: employeePan,
                taxRegime: emp.taxRegime || 'New',
                grossSalary: grossAnnual,
                taxableIncome: existingForm16 ? existingForm16.taxableIncome : 0, // We could pre-compute
                totalTdsDeducted,
                totalTdsDeposited,
                mismatch,
                mismatchAmount: totalTdsDeducted - totalTdsDeposited,
                status: existingForm16 ? existingForm16.status : 'not_generated',
                form16Id: existingForm16 ? existingForm16._id : null
            });
        }

        res.json({ success: true, data: results });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error fetching Form 16 list' });
    }
};

// POST /api/payroll/form16/generate
exports.generateForm16 = async (req, res) => {
    try {
        const { employeeIds, financialYear: fy } = req.body;
        if (!fy || !employeeIds || !employeeIds.length) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        const rawSettings = await Setting.find({});
        const settings = {};
        rawSettings.forEach(s => settings[s.key] = s.value);
        if (!settings?.tan || !settings?.companyPan) {
            return res.status(400).json({ success: false, message: 'Missing TAN / PAN in settings.' });
        }

        const [sYear, syPart] = fy.split('-');
        const startYear = Number(sYear);
        const endYear = Number(`20${syPart}`);
        const ay = `${syPart}-${parseInt(syPart) + 1}`; // Assessment Year e.g. 26-27

        let generatedCount = 0;

        for (const empId of employeeIds) {
            const emp = await Employee.findById(empId);
            if (!emp) continue;

            const payrolls = await Payroll.find({
                employee: emp._id,
                $or: [
                    { year: startYear, month: { $gte: 4 } },
                    { year: endYear, month: { $lte: 3 } }
                ]
            }).lean();

            // CRITICAL FIX: Use Current Master Salary as the primary source for current FY generation
            // This ensures if historical payroll is missing/old, we use the "Current" standard provided by the user.
            const annualBasic = (emp.basic || 0) * 12;
            const annualHRA = (emp.hra || 0) * 12;
            const annualSpecial = (emp.specialAllowance || 0) * 12;
            const annualMedical = (emp.medicalAllowance || 0) * 12;
            const annualConveyance = (emp.conveyance || 0) * 12;
            const annualOther = (emp.otherAllowance || 0) * 12;
            const annualOvertime = payrolls.reduce((sum, p) => sum + (p.earnings?.overtime || 0), 0); // Keep historical for OT/Incentives
            const annualBonus = payrolls.reduce((sum, p) => sum + (p.earnings?.bonus || 0), 0);
            const annualIncentive = payrolls.reduce((sum, p) => sum + (p.earnings?.incentive || 0), 0);

            let totalTdsDeducted = 0;
            let totalTdsDeposited = 0;

            // TDS is always historical (what was actually deducted)
            payrolls.forEach(p => {
                totalTdsDeducted += (p.deductions?.tax || 0);
            });

            // If no payroll deduction exists but Master has TDS, project it
            if (totalTdsDeducted === 0 && emp.tds > 0) {
                totalTdsDeducted = emp.tds * 12;
            }

            const grossAnnual = annualBasic + annualHRA + annualSpecial + annualMedical + annualConveyance + annualOther + annualOvertime + annualBonus + annualIncentive;
            const quarterlyTDS = [];
            for (let q = 1; q <= 4; q++) {
                const qinfo = getQuarterDetails(q);
                let qDeducted = 0;
                let qDeposited = 0;

                payrolls.forEach(p => {
                    if (qinfo.months.includes(p.month)) qDeducted += (p.deductions?.tax || 0);
                });

                const challans = await TdsChallan.find({ financialYear: fy, month: { $in: qinfo.months } }).lean();
                challans.forEach(ch => {
                    if (!ch.mappedEmployees) return;
                    const mapped = ch.mappedEmployees.find(me => me.employeeId?.toString() === emp._id.toString());
                    if (mapped) qDeposited += mapped.amount;
                });
                totalTdsDeposited += qDeposited;

                const qReturn = await Form24QReturn.findOne({ financialYear: fy, quarter: q });
                quarterlyTDS.push({
                    quarter: qinfo.name,
                    period: qinfo.period,
                    deducted: qDeducted,
                    deposited: qDeposited,
                    receiptNumber: qReturn?.receiptNumber || 'Pending'
                });
            }

            if (Math.abs(totalTdsDeducted - totalTdsDeposited) > 10) {
                // Mismatch, skip generation
                continue;
            }

            // Calculations
            let regime = 'New';
            if (emp.taxRegime && emp.taxRegime.toLowerCase().includes('old')) regime = 'Old';

            let standardDeduction = regime === 'Old' ? 50000 : 75000;

            // Limit standard deduction to gross salary
            if (grossAnnual < standardDeduction) standardDeduction = grossAnnual;

            let deduction80C = 0, deduction80D = 0, deduction80E = 0, homeLoanInterest = 0, hraExemption = 0, otherDeductions = 0, totalChapterVIA = 0;

            if (regime === 'Old') {
                deduction80C = Math.min(emp.inv80c || 0, 150000);
                deduction80D = Math.min(emp.inv80d || 0, 250000);
                deduction80E = emp.inv80e || 0;
                homeLoanInterest = Math.min(emp.homeLoanInterest || 0, 200000);
                hraExemption = Math.min(emp.hraClaimed || 0, annualBasic * 0.40);
                otherDeductions = emp.other80 || 0;

                totalChapterVIA = deduction80C + deduction80D + deduction80E + homeLoanInterest + hraExemption + otherDeductions;
            }

            let taxableIncome = grossAnnual - standardDeduction - totalChapterVIA;
            if (taxableIncome < 0) taxableIncome = 0;

            // PDF Generation
            const pdfDoc = new PDFDocument({ margin: 40, size: 'A4' });
            const chunks = [];
            pdfDoc.on('data', (chunk) => chunks.push(chunk));

            const authorizerName = settings.companyAuthorizer || '_________________';
            const authorizerDesignation = settings.companyAuthorizerDesignation || 'Authorised Signatory';
            const city = settings.companyCity || '';
            const today = new Date().toLocaleDateString('en-IN');

            // --- PAGE 1: PART A ---
            // Header
            pdfDoc.font('Helvetica-Bold').fontSize(16).text('FORM NO. 16', { align: 'center' });
            pdfDoc.font('Helvetica').fontSize(10).text('[See rule 31(1)(a)]', { align: 'center' }).moveDown(0.3);
            pdfDoc.font('Helvetica-Bold').fontSize(11).text('Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary', { align: 'center' }).moveDown(1.5);

            // Employer + Employee Details grid
            const employeePan = emp.pan || emp.panNumber || (emp.complianceDetails?.panNumber) || 'N/A';
            const detailsTable = {
                headers: [
                    { label: 'Employer Details', width: 250 },
                    { label: 'Employee Details', width: 250 }
                ],
                rows: [[
                    `Name: ${settings.companyName || 'N/A'}\nAddress: ${settings.companyAddress || 'N/A'}\n\nTAN: ${settings.tan || 'N/A'}\nPAN: ${settings.companyPan || 'N/A'}`,
                    `Name: ${emp.firstName} ${emp.lastName}\nPAN: ${employeePan}\n\nAssessment Year: AY ${ay}\nFinancial Year: FY ${fy}\nTax Regime: ${regime}\nDesignation: ${emp.designation || 'N/A'}`
                ]]
            };
            await pdfDoc.table(detailsTable, {
                width: 500,
                prepareHeader: () => pdfDoc.fontSize(10).font('Helvetica-Bold'),
                prepareRow: () => pdfDoc.fontSize(9.5).font('Helvetica').lineGap(2.5)
            });
            pdfDoc.moveDown(1.5);

            // Part A Table
            pdfDoc.font('Helvetica-Bold').fontSize(11).text('PART A - Summary of tax deducted and deposited', { underline: true }).moveDown(1);
            const partATable = {
                headers: ['Quarter', 'Period', 'Deducted (Rs)', 'Deposited (Rs)', 'Receipt / Ack No.'],
                rows: [
                    ...quarterlyTDS.map(q => [q.quarter, q.period, q.deducted.toLocaleString('en-IN'), q.deposited.toLocaleString('en-IN'), q.receiptNumber]),
                    ['Total', '', totalTdsDeducted.toLocaleString('en-IN'), totalTdsDeposited.toLocaleString('en-IN'), '—']
                ]
            };
            await pdfDoc.table(partATable, {
                width: 500,
                prepareHeader: () => pdfDoc.fontSize(9.5).font('Helvetica-Bold'),
                prepareRow: (row, i) => {
                    pdfDoc.fontSize(9.5);
                    if (i === partATable.rows.length - 1) pdfDoc.font('Helvetica-Bold');
                    else pdfDoc.font('Helvetica');
                }
            });
            pdfDoc.fontSize(8.5).fillColor('#444').text('* Acknowledgement numbers populated from Form 24Q module.', { italic: true }).moveDown(2.5);
            pdfDoc.fillColor('black');

            // Verification Block (Dynamic anchoring with spacing)
            const margin = 40;
            const pageHeight = pdfDoc.page.height;
            const minSigY = pageHeight - 220; // Move it lower as requested

            // If we have too much gap, push it down mid-way for balance
            if (pdfDoc.y < minSigY - 80) {
                pdfDoc.moveDown(6);
            } else if (pdfDoc.y < minSigY) {
                pdfDoc.y = minSigY;
            }

            pdfDoc.font('Helvetica').fontSize(10.5).text(`I, ${authorizerName}, working as ${authorizerDesignation} do hereby certify that a sum of Rs ${totalTdsDeducted.toLocaleString('en-IN')} (${numberToWords(totalTdsDeducted)}) has been deducted and deposited to the credit of the Central Government. I further certify that the information given above is true, correct and complete.`, { align: 'justify', lineGap: 4 }).moveDown(2);

            pdfDoc.fontSize(10.5);
            pdfDoc.text(`Date: ${today}`, 40, pdfDoc.y, { continued: true }).text(`Signature: _________________`, { align: 'right' });
            pdfDoc.moveDown(0.7);
            pdfDoc.text(`Place: ${city}`, 40, pdfDoc.y, { continued: true }).text(`Full Name: ${authorizerName}`, { align: 'right' });
            pdfDoc.moveDown(0.7);
            pdfDoc.text('', 40, pdfDoc.y, { continued: true }).text(`Designation: ${authorizerDesignation}`, { align: 'right' });

            // Footer Page 1 (Forced to stay on Page 1)
            pdfDoc.page.margins.bottom = 0;
            pdfDoc.fontSize(8).fillColor('gray').text(`${settings.companyName} | TAN: ${settings.tan} | Page 1 of 2 | Generated: ${today}`, margin, pageHeight - 32, { align: 'center', width: 500 });
            pdfDoc.fillColor('black');

            // --- PAGE 2: PART B ---
            pdfDoc.addPage();

            // Header Page 2 (Compact)
            pdfDoc.font('Helvetica-Bold').fontSize(14).text('FORM NO. 16', { align: 'center' });
            pdfDoc.font('Helvetica').fontSize(10).text(`${emp.firstName} ${emp.lastName} | PAN: ${employeePan} | FY: ${fy} | AY: ${ay} | Regime: ${regime}`, { align: 'center' }).moveDown(2);

            pdfDoc.font('Helvetica-Bold').fontSize(11).text('PART B — Annexure (Salary Details)', { underline: true }).moveDown(1.5);

            // Tables with better row height feel
            const tableOptions = {
                width: 500,
                prepareHeader: () => pdfDoc.fontSize(10).font('Helvetica-Bold'),
                prepareRow: (row, i) => {
                    pdfDoc.fontSize(9.5);
                    const isTotal = row[0].toLowerCase().includes('total') || row[0].toLowerCase().includes('net');
                    if (isTotal) pdfDoc.font('Helvetica-Bold');
                    else pdfDoc.font('Helvetica');
                }
            };

            // 1. Gross Salary
            pdfDoc.font('Helvetica-Bold').fontSize(10.5).text('1. Gross Salary');
            await pdfDoc.table({
                headers: ['Particulars', 'Amount (Rs)'],
                rows: [
                    ['(a) Salary as per provisions of section 17(1)', (annualBasic + annualHRA + annualSpecial + annualMedical + annualConveyance + annualOther + annualOvertime).toLocaleString('en-IN')],
                    ['(b) Value of perquisites u/s 17(2)', '0.00'],
                    ['(c) Profits in lieu of salary u/s 17(3)', (annualBonus + annualIncentive).toLocaleString('en-IN')],
                    ['TOTAL GROSS SALARY', grossAnnual.toLocaleString('en-IN')]
                ]
            }, tableOptions);
            pdfDoc.moveDown(1);

            // 2. Section 16
            pdfDoc.font('Helvetica-Bold').fontSize(10.5).text('2. Less: Deductions under Section 16');
            await pdfDoc.table({
                headers: ['Particulars', 'Amount (Rs)'],
                rows: [
                    ['(a) Standard Deduction u/s 16(ia)', standardDeduction.toLocaleString('en-IN')],
                    ['(b) Entertainment allowance u/s 16(ii)', '0.00'],
                    ['(c) Professional tax u/s 16(iii)', '0.00'],
                    ['Net Income from Salaries', (grossAnnual - standardDeduction).toLocaleString('en-IN')]
                ]
            }, tableOptions);
            pdfDoc.moveDown(1);

            // 3. Chapter VI-A (Normalize regime and submission status)
            const isOldRegime = regime.toLowerCase().includes('old');
            const is12BBSubmitted = emp.form12BBSubmitted === 'Yes' || emp.form12BBStatus === 'Submitted';
            const isNoteNeeded = !isOldRegime || !is12BBSubmitted;

            pdfDoc.font('Helvetica-Bold').fontSize(10.5).text('3. Deductions under Chapter VI-A');
            await pdfDoc.table({
                headers: ['Particulars', 'Amount (Rs)'],
                rows: [
                    ['80C — LIC / PPF / ELSS / EPF etc.', deduction80C.toLocaleString('en-IN')],
                    ['80D — Medical Insurance Premium', deduction80D.toLocaleString('en-IN')],
                    ['10(13A) — HRA Exemption', hraExemption.toLocaleString('en-IN')],
                    ['Sec 24(b) — Home Loan Interest', homeLoanInterest.toLocaleString('en-IN')],
                    ['80G / 80TTA / Others', otherDeductions.toLocaleString('en-IN')],
                    ['TOTAL Chapter VI-A Deductions', totalChapterVIA.toLocaleString('en-IN')]
                ]
            }, tableOptions);
            if (isNoteNeeded) {
                pdfDoc.fontSize(8.5).fillColor('#c0392b').text(`* Chapter VI-A not applicable — ${!isOldRegime ? 'New Regime' : 'Form 12BB missing'}`, { italic: true }).moveDown(1);
                pdfDoc.fillColor('black');
            }

            // 4. Tax Computation
            pdfDoc.font('Helvetica-Bold').fontSize(10.5).text('4. Tax Computation');
            const taxDeducted = totalTdsDeducted || 0;
            const sec4Table = {
                headers: ['Particulars', 'Amount (Rs)'],
                rows: [
                    ['4a. Total Gross Salary', grossAnnual.toLocaleString('en-IN')],
                    ['4b. Less: Section 16 Deductions', `(${standardDeduction.toLocaleString('en-IN')})`],
                    ['4c. Less: Total Chapter VI-A Deductions', `(${totalChapterVIA.toLocaleString('en-IN')})`],
                    ['4d. TOTAL TAXABLE INCOME', taxableIncome.toLocaleString('en-IN')],
                    ['4e. Income Tax on Total Income', taxDeducted.toLocaleString('en-IN')],
                    ['4f. Add: Health & Education Cess @ 4%', '0.00'],
                    ['4g. TOTAL TAX LIABILITY', taxDeducted.toLocaleString('en-IN')],
                    ['4h. Less: Rebate u/s 87A', '0.00'],
                    ['4i. NET TAX PAYABLE', taxDeducted.toLocaleString('en-IN')],
                    ['4j. Less: Total TDS Deducted (Annual)', `(${taxDeducted.toLocaleString('en-IN')})`],
                    ['4k. BALANCE TAX PAYABLE / (REFUND)', '₹0 — Nil']
                ]
            };
            await pdfDoc.table(sec4Table, tableOptions);

            const boxY = pdfDoc.y + 10;
            pdfDoc.rect(40, boxY, 500, 20).stroke();
            pdfDoc.fontSize(9).text(`Regime: ${regime} | Std Deduction: ₹${standardDeduction.toLocaleString('en-IN')} | Form 12BB: ${is12BBSubmitted ? 'Yes' : 'No'}`, 50, boxY + 6);

            // Signature Page 2
            if (pdfDoc.y < minSigY) pdfDoc.y = minSigY;
            pdfDoc.font('Helvetica').fontSize(10.5).text(`I, ${authorizerName}, working as ${authorizerDesignation} do hereby certify that the information given above is true, correct and complete.`, { align: 'justify', lineGap: 4 }).moveDown(2);
            pdfDoc.text(`Date: ${today}`, 40, pdfDoc.y, { continued: true }).text(`Signature: _________________`, { align: 'right' });
            pdfDoc.moveDown(0.7);
            pdfDoc.text(`Place: ${city}`, 40, pdfDoc.y, { continued: true }).text(`Full Name: ${authorizerName}`, { align: 'right' });
            pdfDoc.moveDown(0.7);
            pdfDoc.text('', 40, pdfDoc.y, { continued: true }).text(`Designation: ${authorizerDesignation}`, { align: 'right' });

            // Footer Page 2 (FORCED to stay on Page 2)
            pdfDoc.page.margins.bottom = 0;
            pdfDoc.fontSize(8.5).fillColor('gray');
            const footerText = `${settings.companyName} | TAN: ${settings.tan} | Page 2 of 2 | Generated: ${today}`;
            const disclaimerText = 'This Form 16 is system-generated for reference purposes only.';
            pdfDoc.text(`${footerText}\n${disclaimerText}`, margin, pageHeight - 32, { align: 'center', width: 500 });

            // Save to DB
            const form16Data = {
                companyId: settings.companyId,
                employeeId: emp._id,
                financialYear: fy,
                assessmentYear: ay,
                pan: employeePan,
                taxRegime: emp.taxRegime || 'new',
                form12BBSubmitted: emp.form12BBStatus === 'Submitted',
                employerTAN: settings.tan,
                employerPAN: settings.companyPan,
                quarterlyTDS,
                totalTDSDeducted: totalTdsDeducted,
                totalTDSDeposited: totalTdsDeposited,
                annualBasic, annualHRA, annualSpecialAllowance: annualSpecial,
                annualConveyance, annualMedical, annualOtherAllowance: annualOther,
                annualBonus, annualIncentive, grossSalary: grossAnnual,
                standardDeduction,
                deduction80C, deduction80D, deduction80E, homeLoanInterest, hraExemption, otherDeductions, totalChapterVIA,
                taxableIncome,
                status: 'generated',
                generatedOn: new Date(),
                generatedBy: req.user._id
            };

            // Aggressive Cleanup: Handle replacement of old Cloudinary file variations (with folder prefix)
            const existingForm16 = await Form16.findOne({ employeeId: emp._id, financialYear: fy });
            const baseId = `hrms/form16/form16_${emp.employeeCode}_${fy.replace('-', '_')}`;

            // Try deleting current saved ID (Full public_id from DB already has folder)
            if (existingForm16 && existingForm16.cloudinaryPublicId) {
                await deleteFromCloudinary(existingForm16.cloudinaryPublicId);
            }

            // Try deleting potential legacy naming variations in the correct folder
            await deleteFromCloudinary(baseId); // without .pdf
            await deleteFromCloudinary(`${baseId}.pdf`); // with .pdf

            // Try as raw specifically just in case
            await deleteFromCloudinary(baseId, 'raw');
            await deleteFromCloudinary(`${baseId}.pdf`, 'raw');

            // Finalize PDF and collect Buffer
            const pdfBuffer = await new Promise((resolve, reject) => {
                pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                pdfDoc.on('error', (err) => reject(err));
                pdfDoc.end();
            });

            // Convert to Base64 for most reliable upload
            const base64Data = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;

            // Upload to Cloudinary
            const cloudResult = await cloudinary.uploader.upload(base64Data, {
                folder: 'hrms/form16',
                resource_type: 'auto',
                public_id: `form16_${emp.employeeCode}_${fy.replace('-', '_')}`,
                overwrite: true
            });

            // Update data with cloud info
            form16Data.pdfPath = cloudResult.secure_url;
            form16Data.cloudinaryPublicId = cloudResult.public_id;

            await Form16.findOneAndUpdate({ employeeId: emp._id, financialYear: fy }, form16Data, { upsert: true, new: true });

            generatedCount++;
        }

        res.json({ success: true, message: `Successfully generated Form 16 for ${generatedCount} employees.` });

    } catch (err) {
        console.error('Form 16 Generation Error:', err);
        res.status(500).json({ success: false, message: 'Generation failed: ' + err.message });
    }
};

exports.downloadForm16 = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const fy = req.query.fy;
        const form16 = await Form16.findOne({ employeeId, financialYear: fy });

        if (!form16 || !form16.pdfPath) {
            return res.status(404).json({ success: false, message: 'Form 16 not found or not yet generated' });
        }

        // Redirect to Cloudinary URL for download
        res.redirect(form16.pdfPath);
    } catch (err) {
        res.status(500).json({ success: false, message: 'Download failed' });
    }
};

exports.sendToEmployee = async (req, res) => {
    try {
        const { employeeIds, financialYear: fy } = req.body;
        await Form16.updateMany(
            { employeeId: { $in: employeeIds }, financialYear: fy, status: 'generated' },
            { $set: { status: 'sent_to_employee', sentOn: new Date() } }
        );
        res.json({ success: true, message: 'Form 16 marked as sent to selected employees.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to send' });
    }
};

// Employee Portal Endpoint
exports.getMyForm16s = async (req, res) => {
    try {
        const list = await Form16.find({ employeeId: req.user.employeeId, status: 'sent_to_employee' }).sort({ financialYear: -1 });
        res.json({ success: true, data: list });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Fetch failed' });
    }
};
