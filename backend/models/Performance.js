const mongoose = require('mongoose');

const performanceSchema = new mongoose.Schema({
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    reviewPeriod: { type: String, required: true },
    year: { type: Number, required: true },
    goals: [{
        title: String,
        description: String,
        weightage: Number,
        selfRating: { type: Number, min: 0, max: 5, default: 0 },
        managerRating: { type: Number, min: 0, max: 5, default: 0 },
        status: { type: String, enum: ['Not Started', 'In Progress', 'Completed'], default: 'Not Started' }
    }],
    overallRating: { type: Number, min: 0, max: 5, default: 0 },
    selfComments: String,
    reviewerComments: String,
    status: { type: String, enum: ['Draft', 'Self Review', 'Manager Review', 'Completed'], default: 'Draft' }
}, { timestamps: true });

module.exports = mongoose.model('Performance', performanceSchema);
