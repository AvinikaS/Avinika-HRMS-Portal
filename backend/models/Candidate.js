const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true },
    phone: { type: String, required: true },
    aadhaar: String,
    resumeUrl: String,
    coverLetter: String,
    skills: [String],
    experience: { type: Number, default: 0 },
    currentCompany: String,
    currentDesignation: String,
    expectedSalary: Number,
    noticePeriod: String,
    source: { type: String, enum: ['Company Career Page', 'LinkedIn', 'Indeed', 'Naukri', 'Internshala', 'Monster', 'Glassdoor', 'Referral', 'Other'], default: 'Other' },
    sourcePlatformCandidateId: String,
    jobPost: { type: mongoose.Schema.Types.ObjectId, ref: 'JobPost' },
    stage: {
        type: String,
        enum: ['Applied', 'Screening', 'Interview', 'Technical', 'HR Round', 'Offered', 'Hired', 'Rejected', 'Withdrawn'],
        default: 'Applied'
    },
    isPreviousEmployee: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    previousEmploymentHistory: [{
        employeeCode: String,
        department: String,
        designation: String,
        dateOfJoining: Date,
        dateOfLeaving: Date,
        reason: String
    }],
    interviewNotes: [{
        round: String,
        interviewer: String,
        rating: Number,
        comments: String,
        date: Date
    }],
    convertedToEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    rejectionReason: String,
    appliedAt: { type: Date, default: Date.now }
}, { timestamps: true });

candidateSchema.index({ email: 1 });
candidateSchema.index({ phone: 1 });
candidateSchema.index({ aadhaar: 1 });
candidateSchema.index({ source: 1 });
candidateSchema.index({ jobPost: 1, email: 1 });

module.exports = mongoose.model('Candidate', candidateSchema);
