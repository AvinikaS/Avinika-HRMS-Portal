const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const EsicChallan = require('../models/EsicChallan');
const Setting = require('../models/Setting');

// GET /api/payroll/esic-challan?month=2026-06
exports.getSummary = async (req, res) => {
    try {
        const queryYm = req.query.month; // e.g. "2026-06"
        if (!queryYm) return res.status(400).json({ success: false, message: 'Month required' });
        const [year, month] = queryYm.split('-');

        const mStr = month;
        const y = parseInt(year, 10);

        if (mStr === 'All') {
            const payrolls = await Payroll.find({ year: y }).populate('employee', 'firstName lastName employeeCode esicIPNumber esicEligible');

            let employeeMap = {};
            let totalEmployeeContribution = 0;
            let totalEmployerContribution = 0;
            let eligibleEmployeesCount = 0;

            payrolls.forEach(p => {
                const esic = p.esicDetails || {};
                const empEsi = esic.employeeContribution || 0;
                const employerEsi = esic.employerContribution || 0;
                const totalEsi = esic.totalContribution || 0;

                if (!employeeMap[p.employee._id]) {
                    employeeMap[p.employee._id] = {
                        employeeId: p.employee._id,
                        employeeCode: p.employee.employeeCode,
                        employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                        ipNumber: p.employee.esicIPNumber || '',
                        grossWages: 0,
                        esicWages: 0,
                        esicEligible: false,
                        employeeESIC: 0,
                        employerESIC: 0,
                        totalESIC: 0,
                        contributionPeriod: 'Annual Aggregated'
                    };
                }

                employeeMap[p.employee._id].grossWages += p.grossSalary;

                if (esic.eligible) {
                    if (!employeeMap[p.employee._id].esicEligible) {
                        employeeMap[p.employee._id].esicEligible = true;
                        eligibleEmployeesCount++;
                    }
                    totalEmployeeContribution += empEsi;
                    totalEmployerContribution += employerEsi;

                    employeeMap[p.employee._id].esicWages += (esic.wages || 0);
                    employeeMap[p.employee._id].employeeESIC += empEsi;
                    employeeMap[p.employee._id].employerESIC += employerEsi;
                    employeeMap[p.employee._id].totalESIC += totalEsi;
                }
            });

            const summary = {
                month: 'All',
                year: y,
                contributionPeriod: `Financial Year ${y}`,
                eligibleEmployees: eligibleEmployeesCount,
                totalEmployeeContribution,
                totalEmployerContribution,
                totalESIC: totalEmployeeContribution + totalEmployerContribution,
                status: 'Annual Overview (Read Only)'
            };

            // Calculate exact total per month based on current payrolls to sync outdated draft challans
            let monthTotals = {};
            payrolls.forEach(p => {
                if (p.esicDetails && p.esicDetails.eligible) {
                    if (!monthTotals[p.month]) {
                        monthTotals[p.month] = {
                            totalESIC: 0,
                            employeeESIC: 0,
                            employerESIC: 0,
                            employees: new Set()
                        };
                    }
                    monthTotals[p.month].totalESIC += (p.esicDetails.totalContribution || 0);
                    monthTotals[p.month].employeeESIC += (p.esicDetails.employeeContribution || 0);
                    monthTotals[p.month].employerESIC += (p.esicDetails.employerContribution || 0);
                    monthTotals[p.month].employees.add(p.employee._id.toString());
                }
            });

            const allChallans = await EsicChallan.find({ year: y }).sort({ month: -1 });

            // Auto sync draft challans to current payroll
            for (let c of allChallans) {
                if (c.status !== 'Paid' && c.status !== 'Completed') {
                    let actual = monthTotals[c.month] ? monthTotals[c.month].totalESIC : 0;
                    if (c.amount !== actual) {
                        c.amount = actual;
                        await c.save();
                    }
                }
            }

            let monthlyBreakdown = Object.keys(monthTotals).map(k => {
                const monthNum = parseInt(k);
                return {
                    month: monthNum,
                    period: (monthNum >= 4 && monthNum <= 9) ? `Apr-Sep ${y}` : `Oct-Mar ${monthNum >= 10 ? y + '-' + (y + 1).toString().slice(2) : (y - 1) + '-' + y.toString().slice(2)}`,
                    eligibleEmployees: monthTotals[k].employees.size,
                    employeeESIC: monthTotals[k].employeeESIC,
                    employerESIC: monthTotals[k].employerESIC,
                    totalESIC: monthTotals[k].totalESIC
                };
            }).sort((a, b) => b.month - a.month);

            return res.json({ success: true, summary, employeeDetails: Object.values(employeeMap), allChallans, monthlyBreakdown });
        }

        const m = parseInt(month, 10);
        const payrolls = await Payroll.find({ month: m, year: y }).populate('employee', 'firstName lastName employeeCode esicIPNumber esicEligible');

        // Check if there is already a challan
        let challan = await EsicChallan.findOne({ month: m, year: y });

        let employeeDetails = [];
        let totalEmployeeContribution = 0;
        let totalEmployerContribution = 0;
        let eligibleEmployees = 0;
        let isAnyIpMissing = false;

        payrolls.forEach(p => {
            const esic = p.esicDetails || {};
            const empEsi = esic.employeeContribution || 0;
            const employerEsi = esic.employerContribution || 0;
            const totalEsi = esic.totalContribution || 0;

            if (esic.eligible) {
                eligibleEmployees++;
                totalEmployeeContribution += empEsi;
                totalEmployerContribution += employerEsi;
                if (!p.employee.esicIPNumber) {
                    isAnyIpMissing = true;
                }
            }

            employeeDetails.push({
                employeeId: p.employee._id,
                employeeCode: p.employee.employeeCode,
                employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                ipNumber: p.employee.esicIPNumber || '',
                grossWages: p.grossSalary,
                esicWages: esic.wages || 0,
                esicEligible: esic.eligible || false,
                employeeESIC: empEsi,
                employerESIC: employerEsi,
                totalESIC: totalEsi,
                contributionPeriod: esic.contributionPeriod || 'N/A'
            });
        });

        // Determine contribution period
        let esicPeriod = '';
        if (m >= 4 && m <= 9) esicPeriod = `Apr-Sep ${y}`;
        else if (m >= 10 && m <= 12) esicPeriod = `Oct-Mar ${y}-${(y + 1).toString().slice(2)}`;
        else esicPeriod = `Oct-Mar ${y - 1}-${y.toString().slice(2)}`;

        const summary = {
            month: m,
            year: y,
            contributionPeriod: esicPeriod,
            eligibleEmployees,
            totalEmployeeContribution,
            totalEmployerContribution,
            totalESIC: totalEmployeeContribution + totalEmployerContribution,
            status: challan ? challan.status : (payrolls.length > 0 ? 'Generated' : 'Not Generated'),
            isAnyIpMissing
        };

        if (summary.status === 'Generated' && challan === null && payrolls.length > 0) {
            // Auto generate drafting challan
            challan = await EsicChallan.create({
                month: m,
                year: y,
                contributionPeriod: esicPeriod,
                amount: summary.totalESIC,
                status: 'Generated'
            });
        }

        if (challan) {
            // Auto-sync amount if draft
            if (challan.status !== 'Paid' && challan.status !== 'Completed' && challan.amount !== summary.totalESIC) {
                challan.amount = summary.totalESIC;
                await challan.save();
            }

            summary.challanNumber = challan.challanNumber;
            summary.paymentDate = challan.paymentDate;
            summary.transactionId = challan.transactionId;
            summary.amount = challan.amount;
        }

        res.json({ success: true, summary, employeeDetails });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// POST /api/payroll/esic-challan/payment-details
exports.updatePaymentDetails = async (req, res) => {
    try {
        const { month, challanNumber, paymentDate, transactionId, status } = req.body;
        const [y, m] = month.split('-');

        let challan = await EsicChallan.findOne({ month: parseInt(m), year: parseInt(y) });
        if (!challan) return res.status(404).json({ success: false, message: 'Challan not found' });

        if (challanNumber !== undefined) challan.challanNumber = challanNumber;
        if (paymentDate !== undefined) challan.paymentDate = paymentDate;
        if (transactionId !== undefined) challan.transactionId = transactionId;

        if (status) {
            challan.status = status;
        } else if (challan.status !== 'Paid' && challan.status !== 'Completed') {
            challan.status = 'Payment Pending';
        }

        await challan.save();
        res.json({ success: true, message: 'Payment details updated successfully', data: challan });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const getPeriodSummaryData = async (year) => {
    // P1: Apr to Sep
    let p1Payrolls = await Payroll.find({
        year: year, month: { $gte: 4, $lte: 9 }
    }).populate('employee', 'firstName lastName employeeCode esicIPNumber esicEligible');

    // P2: Oct to Mar
    let p2Payrolls = await Payroll.find({
        $or: [
            { year: year, month: { $gte: 10, $lte: 12 } },
            { year: year + 1, month: { $gte: 1, $lte: 3 } }
        ]
    }).populate('employee', 'firstName lastName employeeCode esicIPNumber esicEligible');

    const aggregatePeriod = (payrolls, periodName) => {
        let employees = new Set();
        let totalWages = 0;
        let employeeEsic = 0;
        let employerEsic = 0;
        let monthWise = {};
        let employeeWise = {};

        payrolls.forEach(p => {
            const esic = p.esicDetails || {};
            if (esic.eligible) {
                employees.add(p.employee._id.toString());
                totalWages += (esic.wages || 0);
                employeeEsic += (esic.employeeContribution || 0);
                employerEsic += (esic.employerContribution || 0);

                if (!monthWise[p.month]) monthWise[p.month] = { employees: new Set(), employeeEsic: 0, employerEsic: 0, total: 0 };
                monthWise[p.month].employees.add(p.employee._id.toString());
                monthWise[p.month].employeeEsic += (esic.employeeContribution || 0);
                monthWise[p.month].employerEsic += (esic.employerContribution || 0);
                monthWise[p.month].total += (esic.totalContribution || 0);

                if (!employeeWise[p.employee._id]) {
                    employeeWise[p.employee._id] = {
                        employeeCode: p.employee.employeeCode,
                        employeeName: `${p.employee.firstName} ${p.employee.lastName}`,
                        ipNumber: p.employee.esicIPNumber || '',
                        eligibleMonths: 0,
                        totalWages: 0,
                        employeeEsic: 0,
                        employerEsic: 0
                    };
                }
                employeeWise[p.employee._id].eligibleMonths++;
                employeeWise[p.employee._id].totalWages += (esic.wages || 0);
                employeeWise[p.employee._id].employeeEsic += (esic.employeeContribution || 0);
                employeeWise[p.employee._id].employerEsic += (esic.employerContribution || 0);
            }
        });

        let mwArray = Object.keys(monthWise).map(m => ({
            month: parseInt(m),
            coveredEmployees: monthWise[m].employees.size,
            employeeEsic: monthWise[m].employeeEsic,
            employerEsic: monthWise[m].employerEsic,
            total: monthWise[m].total
        })).sort((a, b) => {
            let am = a.month < 4 ? a.month + 12 : a.month;
            let bm = b.month < 4 ? b.month + 12 : b.month;
            return am - bm;
        });

        let ewArray = Object.values(employeeWise).map(e => ({
            ...e,
            avgWages: Math.round(e.totalWages / e.eligibleMonths)
        }));

        let maxM = 0;
        let latestAvailableMonth = null;
        payrolls.forEach(p => {
            let cur = p.month < 4 ? p.month + 12 : p.month;
            if (cur > maxM) { maxM = cur; latestAvailableMonth = p.month; }
        });
        let expectedMax = periodName.startsWith('Apr') ? 9 : 15;
        let inProgress = maxM > 0 && maxM < expectedMax;

        return {
            period: periodName,
            coveredEmployees: employees.size,
            totalWages,
            employeeContribution: employeeEsic,
            employerContribution: employerEsic,
            totalESIC: employeeEsic + employerEsic,
            monthWiseBreakup: mwArray,
            employeeWiseBreakup: ewArray,
            inProgress,
            latestAvailableMonth
        };
    };

    return [
        aggregatePeriod(p1Payrolls, `Apr-Sep ${year}`),
        aggregatePeriod(p2Payrolls, `Oct-Mar ${year}-${(year + 1).toString().slice(2)}`)
    ];
};

exports.getPeriodSummary = async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10);
        if (!year) return res.status(400).json({ success: false, message: 'Year is required' });

        const periods = await getPeriodSummaryData(year);
        res.json({ success: true, periods });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

const PDFDocument = require('pdfkit-table');

exports.exportPeriodSummaryPdf = async (req, res) => {
    try {
        const year = parseInt(req.query.year, 10);
        const periodStr = req.query.period;
        if (!year || !periodStr) return res.status(400).json({ success: false, message: 'Year and period required' });

        const periods = await getPeriodSummaryData(year);
        const period = periods.find(p => p.period === periodStr);

        if (!period) return res.status(404).json({ success: false, message: 'Period not found' });

        // Generate PDF
        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=ESIC_Period_Summary_${periodStr.replace(/\s+/g, '_')}.pdf`);

        doc.pipe(res);

        // Header
        const settingsRaw = await Setting.find({});
        const settings = {};
        settingsRaw.forEach(s => settings[s.key] = s.value);

        const companyName = settings.companyName || 'Avinika Solution Pvt. Ltd.';
        const companyAddress = settings.companyAddress || 'A B Road, Indore, Madhya Pradesh';
        const esicRegNo = settings.esicCode || 'Not Configured';

        doc.fontSize(20).font('Helvetica-Bold').fillColor('#1f2937').text(companyName, { align: 'center' });
        doc.fontSize(10).font('Helvetica').fillColor('#6b7280').text(companyAddress, { align: 'center' });
        doc.moveDown(1);

        doc.fontSize(14).font('Helvetica-Bold').fillColor('#111827').text('ESIC Half-Year Summary Report', { align: 'center', underline: true });
        doc.moveDown(1);

        // Horizontal Line Divider
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e5e7eb').lineWidth(2).stroke();
        doc.moveDown(1);

        // Grid for Period Info
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#4b5563');
        const infoY = doc.y;
        doc.text(`ESIC Registration Number:`, 50, infoY);
        doc.font('Helvetica').fillColor('#111827').text(esicRegNo, 200, infoY);

        doc.font('Helvetica-Bold').fillColor('#4b5563').text(`Report Period:`, 50, infoY + 15);
        doc.font('Helvetica').fillColor('#111827').text(period.period, 200, infoY + 15);

        doc.font('Helvetica-Bold').fillColor('#4b5563').text(`Generated On:`, 50, infoY + 30);
        doc.font('Helvetica').fillColor('#111827').text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), 200, infoY + 30);

        doc.y = infoY + 60;

        // Section 1: Totals
        const totalsTable = {
            title: "Period Totals",
            headers: ["Metric", "Value"],
            rows: [
                ["Total Employees Covered", period.coveredEmployees.toString()],
                ["Total ESIC Wages", `Rs. ${period.totalWages}`],
                ["Total Employee Contribution", `Rs. ${period.employeeContribution}`],
                ["Total Employer Contribution", `Rs. ${period.employerContribution}`],
                ["Total ESIC Payable", `Rs. ${period.totalESIC}`]
            ]
        };
        await doc.table(totalsTable, {
            width: 510,
            x: 42,
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#1f2937'),
            prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('#374151')
        });
        doc.moveDown(2);

        // Section 2: Month-wise
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthTable = {
            title: "Month-wise Breakup Detail",
            headers: ["Month", "Covered Employees", "Employee ESIC", "Employer ESIC", "Total"],
            rows: period.monthWiseBreakup.map(m => [
                months[m.month - 1],
                m.coveredEmployees.toString(),
                `Rs. ${m.employeeEsic}`,
                `Rs. ${m.employerEsic}`,
                `Rs. ${m.total}`
            ])
        };
        await doc.table(monthTable, {
            width: 510,
            x: 42,
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#1f2937'),
            prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('#374151')
        });
        doc.moveDown(2);

        // Section 3: Employee-wise
        const empTable = {
            title: "Employee-wise Breakup Detail",
            headers: ["Code", "Name", "IP Number", "Months", "Total Wages", "Emp Cont.", "Employer Cont."],
            rows: period.employeeWiseBreakup.map(e => [
                e.employeeCode,
                e.employeeName,
                e.ipNumber || '-',
                e.eligibleMonths.toString(),
                `Rs. ${e.totalWages}`,
                `Rs. ${e.employeeEsic}`,
                `Rs. ${e.employerEsic}`
            ])
        };
        await doc.table(empTable, {
            width: 510,
            x: 42,
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8).fillColor('#1f2937'),
            prepareRow: () => doc.font("Helvetica").fontSize(8).fillColor('#374151')
        });

        doc.moveDown(2);
        doc.fontSize(8).fillColor('gray').text(
            "This is an internal half-yearly rollup for audit and management reference. ESIC does not require a separate half-yearly return — monthly wage data upload, challan generation, and payment on the ESIC government portal is the complete compliance requirement.",
            { align: 'center', width: 500 }
        );

        doc.end();

    } catch (err) {
        if (!res.headersSent) res.status(500).json({ success: false, message: err.message });
    }
};
