const mongoose = require('mongoose');

const jobPostSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    department: { type: String, required: true },
    location: String,
    employmentType: { type: String, enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern'], default: 'Full-Time' },
    experienceMin: { type: Number, default: 0 },
    experienceMax: Number,
    salaryMin: Number,
    salaryMax: Number,
    currency: { type: String, default: 'INR' },
    skills: [String],
    qualifications: [String],
    responsibilities: [String],
    status: { type: String, enum: ['Draft', 'Open', 'Closed', 'On Hold'], default: 'Draft' },
    openings: { type: Number, default: 1 },
    applicationsCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closedAt: Date,
    // Distribution fields
    slug: { type: String, unique: true, sparse: true },
    publishedPlatforms: [{
        platform: { type: String, enum: ['LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Monster', 'Glassdoor', 'Company Career Page', 'Other'] },
        status: { type: String, enum: ['Pending', 'Published', 'Failed', 'Removed'], default: 'Pending' },
        publishedAt: Date,
        externalJobId: String,
        externalUrl: String
    }],
    isPublished: { type: Boolean, default: false },
    publishedAt: Date
}, { timestamps: true });

// Auto-generate slug from title
jobPostSchema.pre('save', function (next) {
    if (!this.slug && this.title) {
        this.slug = this.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
    }
    next();
});

module.exports = mongoose.model('JobPost', jobPostSchema);
