const Payroll = require('../models/Payroll');
const PfChallan = require('../models/PfChallan');
const Setting = require('../models/Setting');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');

// Helper to get setting
const getSetting = async (key, defaultVal) => {
    const s = await Setting.findOne({ key });
    return s ? s.value : defaultVal;
};

// GET /api/payroll/pf-challan?year=2026&month=06
exports.getChallanSummary = async (req, res) => {
    try {
        const { year, month } = req.query;
        let query = {};
        if (year) query.year = parseInt(year);
        if (month && parseInt(month) > 0) query.month = parseInt(month);

        const isAllMonths = month === 'All';

        let pfChallan;
        let yearChallans = [];
        if (!isAllMonths && query.year && query.month) {
            pfChallan = await PfChallan.findOne({ year: query.year, month: query.month });
        } else if (isAllMonths && query.year) {
            yearChallans = await PfChallan.find({ year: query.year });
        }

        const payrolls = await Payroll.find(query).populate('employee', 'firstName lastName employeeCode uan status currentContributionPeriod email profileImage');

        let actualWageCount = 0;
        let ceilingCount = 0;
        let excludedCount = 0;
        let totalPFWages = 0;
        let totalEmployeeEPF = 0;
        let totalEmployerEPF = 0;
        let totalEmployerEPS = 0;
        let totalEDLI = 0;
        let totalEDLIWages = 0;

        const employeeDetails = [];
        const empMap = {};
        const monthlyBreakdown = {};

        payrolls.forEach(p => {
            const pfType = p.pfDetails?.calculationType || 'actual_wage';
            const pfWage = p.pfDetails?.pfWage || 0;
            const empEpf = p.pfDetails?.employeePf || 0;
            const emprEpf = p.pfDetails?.employerEpf || 0;
            const emprEps = p.pfDetails?.employerEps || 0;
            const edli = p.pfDetails?.edli || 0;
            const total = empEpf + emprEpf + emprEps + edli;

            if (pfType === 'not_applicable') excludedCount++;
            else if (pfType === 'actual_wage') actualWageCount++;
            else ceilingCount++;

            if (pfType !== 'not_applicable') {
                totalPFWages += pfWage;
                totalEmployeeEPF += empEpf;
                totalEmployerEPF += emprEpf;
                totalEmployerEPS += emprEps;
                totalEDLI += edli;
                totalEDLIWages += Math.min(pfWage, 15000);

                if (isAllMonths && p.month) {
                    if (!monthlyBreakdown[p.month]) {
                        monthlyBreakdown[p.month] = {
                            month: p.month,
                            totalPFWages: 0,
                            totalEmployeeEPF: 0,
                            totalEmployerEPF: 0,
                            totalEmployerEPS: 0,
                            totalEDLI: 0,
                            totalEDLIWages: 0,
                            actualWageCount: new Set(),
                            ceilingCount: new Set()
                        };
                    }
                    monthlyBreakdown[p.month].totalPFWages += pfWage;
                    monthlyBreakdown[p.month].totalEmployeeEPF += empEpf;
                    monthlyBreakdown[p.month].totalEmployerEPF += emprEpf;
                    monthlyBreakdown[p.month].totalEmployerEPS += emprEps;
                    monthlyBreakdown[p.month].totalEDLI += edli;
                    monthlyBreakdown[p.month].totalEDLIWages += Math.min(pfWage, 15000);

                    if (pfType === 'actual_wage') monthlyBreakdown[p.month].actualWageCount.add(p.employee?._id?.toString());
                    else if (pfType === 'pf_ceiling') monthlyBreakdown[p.month].ceilingCount.add(p.employee?._id?.toString());
                }
            }

            const empId = p.employee?._id?.toString() || 'unknown';
            if (isAllMonths) {
                if (!empMap[empId]) {
                    empMap[empId] = {
                        employeeCode: p.employee?.employeeCode,
                        employeeName: `${p.employee?.firstName} ${p.employee?.lastName}`,
                        uan: p.employee?.uan || '',
                        basicSalary: 0,
                        pfCalculationType: pfType,
                        pfWage: 0,
                        employeeEPF: 0,
                        employerEPF: 0,
                        employerEPS: 0,
                        edli: 0,
                        total: 0
                    };
                }
                empMap[empId].basicSalary += p.earnings?.basic || 0;
                empMap[empId].pfWage += pfWage;
                empMap[empId].employeeEPF += empEpf;
                empMap[empId].employerEPF += emprEpf;
                empMap[empId].employerEPS += emprEps;
                empMap[empId].edli += edli;
                empMap[empId].total += total;
            } else {
                employeeDetails.push({
                    employeeCode: p.employee?.employeeCode,
                    employeeName: `${p.employee?.firstName} ${p.employee?.lastName}`,
                    uan: p.employee?.uan || '',
                    basicSalary: p.earnings?.basic || 0,
                    pfCalculationType: pfType,
                    pfWage,
                    employeeEPF: empEpf,
                    employerEPF: emprEpf,
                    employerEPS: emprEps,
                    edli,
                    total
                });
            }
        });

        if (isAllMonths) {
            Object.values(empMap).forEach(e => employeeDetails.push(e));
        }

        // Current actual admin charges based on settings
        const adminRateConfig = await getSetting('pfAdminRate', 0.5);
        let adminCharges = Math.max(Math.round(totalEDLIWages * (adminRateConfig / 100)), 500);
        if (totalPFWages === 0) adminCharges = 0; // if no one is in PF

        // If a generated ECR is found, prefer its stored values for the summary cards
        const summary = {
            totalEmployeesIncluded: actualWageCount + ceilingCount,
            actualWageCount,
            ceilingCount,
            excludedCount,
            totalPFWages,
            totalEmployeeEPF,
            totalEmployerEPF,
            totalEmployerEPS,
            totalEDLI,
            adminCharges,
            grandTotal: totalEmployeeEPF + totalEmployerEPF + totalEmployerEPS + totalEDLI + adminCharges,
            status: pfChallan ? pfChallan.status : 'not_generated'
        };

        const mbArray = [];
        if (isAllMonths) {
            for (let m in monthlyBreakdown) {
                const mb = monthlyBreakdown[m];
                const adminC = Math.max(Math.round(mb.totalEDLIWages * (adminRateConfig / 100)), 500);
                const monthChallan = yearChallans.find(c => c.month === mb.month);
                mbArray.push({
                    month: mb.month,
                    totalEmployeesIncluded: mb.actualWageCount.size + mb.ceilingCount.size,
                    totalEmployeeEPF: mb.totalEmployeeEPF,
                    totalEmployerEPF: mb.totalEmployerEPF,
                    totalEmployerEPS: mb.totalEmployerEPS,
                    adminCharges: mb.totalPFWages > 0 ? adminC : 0,
                    totalEDLI: mb.totalEDLI,
                    grandTotal: mb.totalEmployeeEPF + mb.totalEmployerEPF + mb.totalEmployerEPS + mb.totalEDLI + (mb.totalPFWages > 0 ? adminC : 0),
                    status: monthChallan ? monthChallan.status : 'not_generated'
                });
            }
            mbArray.sort((a, b) => a.month - b.month);
        }

        res.json({ success: true, summary, monthlyBreakdown: mbArray, employeeDetails, challanFlow: pfChallan || null });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/payroll/pf-challan/generate
exports.generateEcr = async (req, res) => {
    try {
        const { year, month } = req.body;
        if (!year || !month) return res.status(400).json({ success: false, message: 'Month and year required' });

        const pfCode = await getSetting('pfCode', '');
        if (!pfCode) return res.status(400).json({ success: false, message: 'PF Establishment Code not configured in Settings.' });

        // Ensure payroll exists
        const payrolls = await Payroll.find({ month, year }).populate('employee');
        if (payrolls.length === 0) return res.status(400).json({ success: false, message: 'Payroll for this month is not processed yet.' });

        let actualWageCount = 0;
        let ceilingCount = 0;
        let excludedCount = 0;
        let totalPFWages = 0;
        let totalEmployeeEPF = 0;
        let totalEmployerEPF = 0;
        let totalEmployerEPS = 0;
        let totalEDLI = 0;
        let totalEDLIWages = 0;

        payrolls.forEach(p => {
            const pfType = p.pfDetails?.calculationType || 'actual_wage';
            if (pfType === 'actual_wage') actualWageCount++;
            else if (pfType === 'pf_ceiling') ceilingCount++;
            else { excludedCount++; return; }

            const empUan = p.employee?.uan;
            if (empUan) { // We technically rely on frontend warning, but let's just aggregate those who have it
                totalPFWages += p.pfDetails.pfWage || 0;
                totalEmployeeEPF += p.pfDetails.employeePf || 0;
                totalEmployerEPF += p.pfDetails.employerEpf || 0;
                totalEmployerEPS += p.pfDetails.employerEps || 0;
                totalEDLI += p.pfDetails.edli || 0;
                totalEDLIWages += Math.min(p.pfDetails.pfWage || 0, 15000);
            }
        });

        const adminRateConfig = await getSetting('pfAdminRate', 0.5);
        let adminCharges = Math.max(Math.round(totalEDLIWages * (adminRateConfig / 100)), 500);
        if (totalPFWages === 0) adminCharges = 0;

        const grandTotal = totalEmployeeEPF + totalEmployerEPF + totalEmployerEPS + totalEDLI + adminCharges;

        let pfChallan = await PfChallan.findOne({ month, year });
        if (pfChallan) {
            pfChallan.establishmentCode = pfCode;
            pfChallan.totalEmployeesIncluded = actualWageCount + ceilingCount;
            pfChallan.actualWageCount = actualWageCount;
            pfChallan.ceilingCount = ceilingCount;
            pfChallan.excludedCount = excludedCount;
            pfChallan.totalPFWages = totalPFWages;
            pfChallan.totalEmployeeEPF = totalEmployeeEPF;
            pfChallan.totalEmployerEPF = totalEmployerEPF;
            pfChallan.totalEmployerEPS = totalEmployerEPS;
            pfChallan.totalEDLI = totalEDLI;
            pfChallan.adminCharges = adminCharges;
            pfChallan.grandTotal = grandTotal;
            pfChallan.status = pfChallan.status === 'not_generated' ? 'ecr_generated' : pfChallan.status;
            if (pfChallan.status === 'ecr_generated') {
                pfChallan.ecrGeneratedBy = req.user ? req.user.id : null;
                pfChallan.ecrGeneratedOn = new Date();
            }
            await pfChallan.save();
        } else {
            pfChallan = await PfChallan.create({
                month, year,
                establishmentCode: pfCode,
                totalEmployeesIncluded: actualWageCount + ceilingCount,
                actualWageCount, ceilingCount, excludedCount,
                totalPFWages, totalEmployeeEPF, totalEmployerEPF, totalEmployerEPS, totalEDLI, adminCharges, grandTotal,
                status: 'ecr_generated',
                ecrGeneratedBy: req.user ? req.user.id : null,
                ecrGeneratedOn: new Date()
            });
        }

        res.json({ success: true, message: 'ECR Generated successfully', data: pfChallan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/payroll/pf-challan/ecr-file?month=06&year=2026
exports.downloadEcrFile = async (req, res) => {
    try {
        const { year, month } = req.query;
        const pfCode = await getSetting('pfCode', '');
        const companyName = await getSetting('companyName', 'COMPANY');

        const payrolls = await Payroll.find({ month, year }).populate('employee');

        // Include only PF eligible with UAN
        const eligiblePayrolls = payrolls.filter(p => p.employee && p.employee.uan && (p.pfDetails?.calculationType === 'actual_wage' || p.pfDetails?.calculationType === 'pf_ceiling'));

        let fileContent = `#~#${pfCode}#~#${companyName}#~#${String(month).padStart(2, '0')}/${year}#~#INR#~#${eligiblePayrolls.length}\r\n`;

        eligiblePayrolls.forEach(p => {
            const emp = p.employee;
            const gross = p.grossSalary || 0;
            const pfWage = p.pfDetails.pfWage || 0;
            const epsWage = Math.min(pfWage, 15000);
            const edliWage = Math.min(pfWage, 15000);
            const eEpf = p.pfDetails.employeePf || 0;
            const emprEps = p.pfDetails.employerEps || 0;
            const totalRepm = eEpf + emprEps;

            // NCP Days logic (from attendance)
            const ncpDays = p.unpaidLeaves + p.absentDays;

            fileContent += `${emp.uan}#~#${emp.firstName} ${emp.lastName}#~#${gross}#~#${pfWage}#~#${epsWage}#~#${edliWage}#~#${eEpf}#~#${emprEps}#~#${totalRepm}#~#${ncpDays}#~#0\r\n`;
        });

        res.setHeader('Content-disposition', `attachment; filename=ECR_${pfCode}_${month}_${year}.txt`);
        res.setHeader('Content-type', 'text/plain');
        res.send(fileContent);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/payroll/pf-challan/payment-details
exports.updatePaymentDetails = async (req, res) => {
    try {
        const { year, month, trrn, paymentDate, transactionId, status } = req.body;
        const challan = await PfChallan.findOne({ month, year });
        if (!challan) return res.status(404).json({ success: false, message: 'Challan not found' });

        if (trrn !== undefined) challan.trrn = trrn;
        if (paymentDate !== undefined) challan.paymentDate = paymentDate;
        if (transactionId !== undefined) challan.transactionId = transactionId;
        if (status) challan.status = status;
        await challan.save();

        res.json({ success: true, message: 'Payment details updated', data: challan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getChallansList = async (req, res) => {
    try {
        const challans = await PfChallan.find().sort({ year: -1, month: -1 });
        res.json({ success: true, data: challans });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// GET /api/payroll/pf-challan/export?month=06&year=2026&format=pdf
exports.exportPdf = async (req, res) => {
    try {
        const { year, month } = req.query;
        let challan;

        if (month === 'All') {
            const allChallans = await PfChallan.find({ year });
            if (!allChallans.length) return res.status(404).send('Challans not found for this year');
            challan = allChallans.reduce((acc, c) => {
                acc.totalEmployeesIncluded += c.totalEmployeesIncluded || 0;
                acc.actualWageCount += c.actualWageCount || 0;
                acc.ceilingCount += c.ceilingCount || 0;
                acc.totalPFWages += c.totalPFWages || 0;
                acc.totalEmployeeEPF += c.totalEmployeeEPF || 0;
                acc.totalEmployerEPF += c.totalEmployerEPF || 0;
                acc.totalEmployerEPS += c.totalEmployerEPS || 0;
                acc.totalEDLI += c.totalEDLI || 0;
                acc.adminCharges += c.adminCharges || 0;
                acc.grandTotal += c.grandTotal || 0;
                return acc;
            }, {
                totalEmployeesIncluded: 0, actualWageCount: 0, ceilingCount: 0,
                totalPFWages: 0, totalEmployeeEPF: 0, totalEmployerEPF: 0,
                totalEmployerEPS: 0, totalEDLI: 0, adminCharges: 0, grandTotal: 0
            });
        } else {
            challan = await PfChallan.findOne({ month, year });
            if (!challan) return res.status(404).send('Challan not found');
        }

        const companyName = await getSetting('companyName', 'COMPANY');
        const companyAddress = await getSetting('companyAddress', 'ADDRESS');
        const pfCode = await getSetting('pfCode', 'Not Configured');

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-disposition', `attachment; filename=PF_Challan_${month}_${year}.pdf`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#1f2937').text(companyName, { align: 'center' });
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(companyAddress, { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text(`PF Challan Internal Summary - ${month === 'All' ? 'All Months' : month}/${year}`, { align: 'center', underline: true });
        doc.moveDown(1);

        // Horizontal Line Divider
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').lineWidth(2).stroke();
        doc.moveDown(1);

        // Grid for Period Info
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#4b5563');
        const infoY = doc.y;
        doc.text(`Establishment Code:`, 50, infoY);
        doc.font('Helvetica').fillColor('#111827').text(pfCode, 200, infoY);

        doc.font('Helvetica-Bold').fillColor('#4b5563').text(`Total Employees:`, 50, infoY + 15);
        doc.font('Helvetica').fillColor('#111827').text(`${challan.totalEmployeesIncluded} (Actual: ${challan.actualWageCount}, Ceiling: ${challan.ceilingCount})`, 200, infoY + 15);

        doc.font('Helvetica-Bold').fillColor('#4b5563').text(`Generated On:`, 50, infoY + 30);
        doc.font('Helvetica').fillColor('#111827').text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 200, infoY + 30);

        doc.y = infoY + 60;

        const table = {
            title: "PF Component Breakup",
            headers: ["Component", "Amount (Rs.)"],
            rows: [
                ["Total PF Wages", challan.totalPFWages.toString()],
                ["Employee EPF (12%)", challan.totalEmployeeEPF.toString()],
                ["Employer EPF (3.67%)", challan.totalEmployerEPF.toString()],
                ["Employer EPS (8.33%)", challan.totalEmployerEPS.toString()],
                ["EDLI (0.5%)", challan.totalEDLI.toString()],
                ["Admin Charges", challan.adminCharges.toString()],
                ["Grand Total", challan.grandTotal.toString()]
            ]
        };

        await doc.table(table, {
            width: 510,
            x: 42,
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10).fillColor('#1f2937'),
            prepareRow: (row, i) => {
                doc.font(i === 6 ? "Helvetica-Bold" : "Helvetica").fontSize(10).fillColor('#374151');
            }
        });

        doc.moveDown(3);
        doc.fontSize(9).fillColor('gray').text('This is an internal record. The ECR text file (generated separately) is the actual government submission document.', { align: 'center' });

        doc.end();
    } catch (err) {
        res.status(500).send(err.message);
    }
};
