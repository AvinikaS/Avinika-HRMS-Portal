const mongoose = require('mongoose');

const performanceYearSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: [true, 'Year is required'],
        unique: true
    }
}, { timestamps: true });

module.exports = mongoose.model('PerformanceYear', performanceYearSchema);
