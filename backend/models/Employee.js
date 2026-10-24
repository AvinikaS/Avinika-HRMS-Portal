const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    employeeCode: { type: String, unique: true, required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true },
    personalEmail: { type: String, trim: true },
    workEmail: { type: String, trim: true },
    aadhaar: { type: String, sparse: true, index: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: String,
    department: { type: String, required: true },
    designation: { type: String, required: true },
    dateOfJoining: { type: Date, required: true },
    dateOfLeaving: Date,
    reportingManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    manager: { type: String }, // Plain string if reportingManager not set
    workLocation: { type: String },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    employmentType: { type: String, enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Probation', 'Full-time', 'Part-time'], default: 'Full-time' },
    status: { type: String, enum: ['Active', 'Resigned / Notice Period', 'Terminated / Ex-Employee'], default: 'Active' },

    // NEW FLATTENED FIELDS FOR WIZARD
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    medicalAllowance: { type: Number, default: 0 },
    otherAllowance: { type: Number, default: 0 },
    gross: { type: Number, default: 0 },

    paymentMode: { type: String, enum: ['Bank Transfer', 'Cash', 'Cheque'], default: 'Bank Transfer' },
    taxRegime: { type: String, enum: ['Old regime', 'New regime (FY 2025-26)', 'Old', 'New'], default: 'New regime (FY 2025-26)' },
    form12BBSubmitted: { type: String, enum: ['Yes', 'No', 'Not applicable'], default: 'Not applicable' },

    inv80c: { type: Number, default: 0 },
    inv80d: { type: Number, default: 0 },
    inv80e: { type: Number, default: 0 },
    homeLoanInterest: { type: Number, default: 0 },
    hraClaimed: { type: Number, default: 0 },
    other80: { type: Number, default: 0 },

    pfCalculationType: { type: String, enum: ['actual_wage', 'pf_ceiling', 'not_applicable'], default: 'actual_wage' },
    pfEmployee: { type: Number, default: 0 },
    pfEmployer: { type: Number, default: 0 },
    esicEmployee: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    otherDeduction: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    salaryEffectiveFrom: Date,

    accountHolderName: String,
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    branchName: String,
    accountType: { type: String, enum: ['Savings', 'Current', 'Salary Account', 'Savings Account', 'Current Account', 'Salary'] },

    pan: String,
    uan: String,
    esicIPNumber: String,

    // ESIC specific tracking
    esicEligible: { type: Boolean, default: false },
    esicCoverageStartMonth: String,
    currentContributionPeriod: String,

    // OLD FIELDS FOR BACKWARD COMPAT (Keeping these embedded structs just in case)
    salary: {
        basic: { type: Number, default: 0 },
        hra: { type: Number, default: 0 },
        allowances: {
            travel: { type: Number, default: 0 },
            food: { type: Number, default: 0 },
            other: { type: Number, default: 0 },
            special: { type: Number, default: 0 }
        },
        bonus: { type: Number, default: 0 },
        pfApplicable: { type: Boolean, default: true },
        pfPercentage: { type: Number, default: 12 },
        employerPfPercentage: { type: Number, default: 12 },
        esiApplicable: { type: Boolean, default: false },
        esiPercentage: { type: Number, default: 0.75 },
        employerEsiPercentage: { type: Number, default: 3.25 },
        taxSlabApplicable: { type: Boolean, default: true },
        taxRegime: { type: String, enum: ['Old', 'New'], default: 'New' }
    },
    leaveBalance: {
        casual: { type: Number, default: 12 },
        sick: { type: Number, default: 12 },
        earned: { type: Number, default: 15 },
        unpaid: { type: Number, default: 0 },
        other: { type: Number, default: 0 }
    },
    complianceDetails: {
        panNumber: String,
        uanNumber: String,
        esicNumber: String,
        pfJoiningDate: Date
    },
    bankDetails: {
        bankName: String,
        accountNumber: String,
        ifscCode: String
    },
    profileImage: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    onboardingComplete: { type: Boolean, default: false }
}, { timestamps: true });

employeeSchema.virtual('fullName').get(function () {
    return `${this.firstName} ${this.lastName}`;
});

employeeSchema.index({ phone: 1 });
employeeSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
