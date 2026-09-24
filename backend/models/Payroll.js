const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },

    // Attendance data
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    paidLeaves: { type: Number, default: 0 },
    unpaidLeaves: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },

    earnings: {
        basic: { type: Number, default: 0 },
        hra: { type: Number, default: 0 },
        allowances: { type: Number, default: 0 }, // Combined fallback
        specialAllowance: { type: Number, default: 0 },
        conveyance: { type: Number, default: 0 },
        medicalAllowance: { type: Number, default: 0 },
        otherAllowance: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 },
        incentive: { type: Number, default: 0 },
        overtime: { type: Number, default: 0 },
        loanDisbursal: { type: Number, default: 0 },
        advanceDisbursal: { type: Number, default: 0 },
        expenseReimbursement: { type: Number, default: 0 }
    },

    deductions: {
        pf: { type: Number, default: 0 },
        esic: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        leaveDeduction: { type: Number, default: 0 },
        loanEmi: { type: Number, default: 0 },
        advanceRecovery: { type: Number, default: 0 }
    },

    grossSalary: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },

    esicDetails: {
        eligible: { type: Boolean, default: false },
        wages: { type: Number, default: 0 },
        contributionPeriod: { type: String, default: '' },
        employeeContribution: { type: Number, default: 0 },
        employerContribution: { type: Number, default: 0 },
        totalContribution: { type: Number, default: 0 }
    },

    pfDetails: {
        calculationType: { type: String, default: 'actual_wage' },
        pfWage: { type: Number, default: 0 },
        employeePf: { type: Number, default: 0 },
        employerEpf: { type: Number, default: 0 },
        employerEps: { type: Number, default: 0 },
        edli: { type: Number, default: 0 },
        adminCharges: { type: Number, default: 0 }
    },

    status: {
        type: String,
        enum: ['Draft', 'Generated', 'Paid', 'Hold'],
        default: 'Draft'
    },
    paidOn: Date,
    paymentMode: { type: String, enum: ['Bank Transfer', 'Cheque', 'Cash'], default: 'Bank Transfer' },
    generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

payrollSchema.index({ employee: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Payroll', payrollSchema);
