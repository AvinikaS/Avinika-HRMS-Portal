const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Format a long string into a funnel/inverted pyramid of 3 lines
 */
const formatAddressFunnel = (text) => {
    if (!text) return [];
    const words = text.split(' ').filter(w => w.trim().length > 0);
    if (words.length <= 3) return [text];

    // Distribute words to form an inverted pyramid shape (e.g. 5 > 3 > 2)
    const l1Count = Math.ceil(words.length * 0.45);
    const l2Count = Math.ceil((words.length - l1Count) * 0.6);

    const lines = [];
    lines.push(words.slice(0, l1Count).join(' '));
    if (l2Count > 0) lines.push(words.slice(l1Count, l1Count + l2Count).join(' '));
    const remainder = words.slice(l1Count + l2Count).join(' ');
    if (remainder.length > 0) lines.push(remainder);

    return lines;
};

/**
 * Generate a professional Payslip PDF and stream it to the response.
 * 
 * @param {object} payroll Detailed payroll record with populated employee data
 * @param {object} res Node.js response object
 * @param {object} companyInfo Contains companyName and companyAddress
 */
exports.generatePayslipPDF = (payroll, res, companyInfo = {}) => {
    const doc = new PDFDocument({ margin: 50 });

    // Stream the PDF to the response
    doc.pipe(res);

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = months[payroll.month - 1];

    // Top Left: Title
    doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold').text(`Payslip  ${monthName} ${payroll.year}`, 40, 45, { align: 'left' });

    // Top Left: Company Address
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica-Bold').text(companyInfo.companyName || 'Avinika Solution Pvt. Ltd.', 40, doc.y, { width: 300 });

    doc.font('Helvetica').fillColor('#4b5563');
    const addressText = companyInfo.companyAddress || 'A B Road, Indore, Madhya Pradesh';
    const addressLines = formatAddressFunnel(addressText);

    addressLines.forEach(line => {
        doc.text(line, 40, doc.y, { lineGap: 1 });
    });

    // Top Right: Logo Wrapper (Dark background to protect white logos)
    let logoPath = path.join(__dirname, '..', 'assets', 'logo.png');
    if (!fs.existsSync(logoPath)) {
        logoPath = path.join(__dirname, '..', 'assets', 'avinikalogo.png');
    }
    if (fs.existsSync(logoPath)) {
        // Render logo natively. (For PDF, recommend using a logo designed for light backgrounds)
        doc.image(logoPath, doc.page.width - 155, 35, { width: 110, height: 40, fit: [110, 40], align: 'right', valign: 'center' });
    }

    // Dynamic spacing: Ensure we are safely below both the address block and the logo
    doc.y = Math.max(doc.y, 90) + 25;

    // Employee Name (Large) & Generated Date
    const nameY = doc.y;
    doc.fillColor('#111827').fontSize(14).font('Helvetica-Bold').text(`${payroll.employee.firstName} ${payroll.employee.lastName}`, 40, nameY);

    const generatedDateStr = new Date(payroll.generatedAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    doc.fontSize(9).font('Helvetica').fillColor('#6b7280').text(`Generated on ${generatedDateStr}`, doc.page.width - 200, nameY + 4, { align: 'right', width: 160 });

    doc.moveDown(1);

    // Line Separator
    let infoY = doc.y;
    doc.moveTo(40, infoY).lineTo(doc.page.width - 40, infoY).strokeColor('#e5e7eb').lineWidth(1).stroke();

    infoY += 15;
    const colStep = 130;
    const col1 = 40;
    const col2 = col1 + colStep;
    const col3 = col2 + colStep;
    const col4 = col3 + colStep;

    // Helper to draw a label-value pair
    const drawGridItem = (label, value, x, y) => {
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#6b7280').text(label.toUpperCase(), x, y);
        doc.font('Helvetica').fontSize(9).fillColor('#111827').text(value || '-', x, y + 12, { width: 120 });
    };

    // ROW 1
    drawGridItem('EMP NO', payroll.employee.employeeCode, col1, infoY);
    drawGridItem('DATE OF JOINING', payroll.employee.dateOfJoining ? new Date(payroll.employee.dateOfJoining).toLocaleDateString('en-GB') : '-', col2, infoY);
    drawGridItem('DEPARTMENT', payroll.employee.department, col3, infoY);
    drawGridItem('DESIGNATION', payroll.employee.designation, col4, infoY);

    infoY += 45;

    // ROW 2
    drawGridItem('PAYMENT MODE', payroll.paymentMode || 'Bank Transfer', col1, infoY);
    drawGridItem('BANK NAME', payroll.employee.bankName, col2, infoY);
    drawGridItem('BANK IFSC CODE', payroll.employee.ifscCode, col3, infoY);
    drawGridItem('BANK ACCOUNT', payroll.employee.accountNumber, col4, infoY);

    infoY += 45;

    // ROW 3
    drawGridItem('PAN', payroll.employee.pan, col1, infoY);
    drawGridItem('UAN', payroll.employee.uan, col2, infoY);
    drawGridItem('AADHAAR', payroll.employee.aadhaar, col3, infoY);

    // Pay Cycle Date logic (Assuming 1st to last day of month)
    const lastDay = new Date(payroll.year, payroll.month, 0).getDate();
    const payCycleStr = `01 ${monthName.substring(0, 3)} - ${lastDay} ${monthName.substring(0, 3)}`;
    drawGridItem('PAY CYCLE DATE', payCycleStr, col4, infoY);

    infoY += 40;
    // Line Separator
    doc.moveTo(40, infoY).lineTo(doc.page.width - 40, infoY).strokeColor('#e5e7eb').lineWidth(1).stroke();

    const tableTop = infoY + 25;

    // Draw Table Headers
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000').text('Earnings', col1, tableTop);
    doc.text('Amount (Rs.)', col2 - 30, tableTop, { align: 'right', width: 80 });
    doc.text('Deductions', col3 - 20, tableTop);
    doc.text('Amount (Rs.)', col4 + 10, tableTop, { align: 'right', width: 80 });

    doc.moveTo(40, tableTop + 15).lineTo(doc.page.width - 40, tableTop + 15).strokeColor('#000').lineWidth(1).stroke();
    doc.font('Helvetica').fontSize(10);

    let currentY = tableTop + 25;

    // Build row rendering function to align earnings/deductions properly
    const earnItems = [
        { label: 'Basic Salary', val: payroll.earnings.basic },
        { label: 'HRA', val: payroll.earnings.hra },
        { label: 'Special Allowance', val: payroll.earnings.specialAllowance || 0 },
        { label: 'Conveyance', val: payroll.earnings.conveyance || 0 },
        { label: 'Medical Allowance', val: payroll.earnings.medicalAllowance || 0 },
        { label: 'Other Allowance', val: payroll.earnings.otherAllowance || 0 },
        ...(payroll.earnings.allowances > 0 && !(payroll.earnings.specialAllowance || payroll.earnings.conveyance || payroll.earnings.medicalAllowance || payroll.earnings.otherAllowance)
            ? [{ label: 'Allowances (Combined)', val: payroll.earnings.allowances }] : []),
        { label: 'Overtime', val: payroll.earnings.overtime },
        { label: 'Bonus', val: payroll.earnings.bonus },
        { label: 'Incentive', val: payroll.earnings.incentive || 0 },
        { label: 'Loan Disbursal', val: payroll.earnings.loanDisbursal || 0 },
        { label: 'Advance Salary Disbursal', val: payroll.earnings.advanceDisbursal || 0 },
        { label: 'Expense Reimbursement', val: payroll.earnings.expenseReimbursement || 0 }
    ].filter(i => i.val > 0 || i.label === 'Basic Salary' || i.label === 'HRA' || i.label.includes('Allowance'));

    if (payroll.adjustments && payroll.adjustments.length > 0) {
        payroll.adjustments.filter(a => a.direction === 'CREDIT').forEach(adj => {
            earnItems.push({ label: adj.label || 'Attendance Arrear', val: adj.amount });
        });
    } else if (payroll.earnings?.arrears > 0) {
        earnItems.push({ label: 'Attendance Arrear', val: payroll.earnings.arrears });
    }

    const dedItems = [
        { label: payroll.pfDetails?.calculationType === 'pf_ceiling' ? 'Provident Fund (PF Ceiling 15K)' : 'Provident Fund (PF)', val: payroll.deductions.pf },
        { label: 'INCOME TAX (TDS)', val: payroll.deductions.tax },
        { label: 'ESIC Employee Contribution', val: payroll.deductions.esic || 0 },
        { label: 'Leave/LWP Deduction', val: payroll.deductions.leaveDeduction },
        { label: 'Loan EMI Recovery', val: payroll.deductions.loanEmi || 0 },
        { label: 'Advance Recovery', val: payroll.deductions.advanceRecovery || 0 }
    ].filter(i => i.val > 0);

    if (payroll.adjustments && payroll.adjustments.length > 0) {
        payroll.adjustments.filter(a => a.direction === 'DEBIT').forEach(adj => {
            dedItems.push({ label: adj.label || 'Payroll Deduction Adjustment', val: adj.amount });
        });
    }

    const maxRows = Math.max(earnItems.length, dedItems.length);

    for (let i = 0; i < maxRows; i++) {
        if (earnItems[i]) {
            doc.text(earnItems[i].label, col1, currentY);
            doc.text(earnItems[i].val.toLocaleString('en-IN'), col2 - 30, currentY, { align: 'right', width: 80 });
        }
        if (dedItems[i]) {
            doc.text(dedItems[i].label, col3 - 20, currentY);
            doc.text(dedItems[i].val.toLocaleString('en-IN'), col4 + 10, currentY, { align: 'right', width: 80 });
        }
        currentY += 20;
    }

    doc.moveTo(40, currentY).lineTo(doc.page.width - 40, currentY).strokeColor('#e2e8f0').lineWidth(1).stroke();
    currentY += 10;

    // Totals
    doc.fillColor('#000000').font('Helvetica-Bold');
    doc.text('Total Earnings', col1, currentY);
    doc.text(`Rs. ${payroll.grossSalary.toLocaleString('en-IN')}`, col2 - 30, currentY, { align: 'right', width: 80 });

    doc.text('Total Deductions', col3 - 20, currentY);
    doc.text(`Rs. ${payroll.totalDeductions.toLocaleString('en-IN')}`, col4 + 10, currentY, { align: 'right', width: 80 });

    currentY += 20;
    const boxHeight = 50;
    const boxWidth = doc.page.width - 80;
    const boxX = col1;
    const amountBoxWidth = 120;

    // Outer Box with light gray border
    doc.save();
    doc.roundedRect(boxX, currentY, boxWidth, boxHeight, 8).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Right side green highlights background for the amount
    doc.roundedRect(boxX + (boxWidth - amountBoxWidth), currentY, amountBoxWidth, boxHeight, 8)
        .fillColor('#f0fdf4')
        .fill();

    // Redraw the border over the fill to keep it clean (or just draw left side part)
    doc.roundedRect(boxX, currentY, boxWidth, boxHeight, 8).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // Labels
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(11).text('TOTAL NET PAYABLE', boxX + 15, currentY + 12);
    doc.fillColor('#64748b').font('Helvetica').fontSize(9).text('Gross Earnings - Total Deductions', boxX + 15, currentY + 28);

    // Amount
    doc.fillColor('#000000').font('Helvetica-Bold').fontSize(14).text(`Rs. ${payroll.netSalary.toLocaleString('en-IN')}`, boxX + (boxWidth - amountBoxWidth), currentY + 18, { width: amountBoxWidth, align: 'center' });
    doc.restore();

    currentY += boxHeight + 15;
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(`Amount In Words : `, 250, currentY, { continued: true });
    doc.font('Helvetica-Bold').text(`Indian Rupee ${numberToWords(payroll.netSalary)} Only`);

    // Footer Disclaimer with line
    doc.moveTo(50, doc.page.height - 80)
        .lineTo(550, doc.page.height - 80)
        .strokeColor('#dddddd')
        .lineWidth(0.5)
        .stroke();

    doc.fontSize(8)
        .fillColor('#777777')
        .text('-- This document has been automatically generated by Avinika Payroll System; therefore, a signature is not required. --', 50, doc.page.height - 70, { align: 'center', width: 500 });

    doc.end();
};

function numberToWords(number) {
    // Simple implementation for number to words
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

    if (number === 0) return 'Zero';

    function convert(n) {
        let word = '';
        if (n >= 10000000) {
            word += convert(Math.floor(n / 10000000)) + ' Crore ';
            n %= 10000000;
        }
        if (n >= 100000) {
            word += convert(Math.floor(n / 100000)) + ' Lakh ';
            n %= 100000;
        }
        if (n >= 1000) {
            word += convert(Math.floor(n / 1000)) + ' Thousand ';
            n %= 1000;
        }
        if (n >= 100) {
            word += convert(Math.floor(n / 100)) + ' Hundred ';
            n %= 100;
        }
        if (n >= 20) {
            word += tens[Math.floor(n / 10)] + ' ';
            n %= 10;
        } else if (n >= 10) {
            word += teens[n - 10] + ' ';
            n = 0;
        }
        if (n > 0) {
            word += ones[n] + ' ';
        }
        return word;
    }

    return convert(number).trim();
}
