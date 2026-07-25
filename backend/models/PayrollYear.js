const mongoose = require('mongoose');

const payrollYearSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: [true, 'Year is required'],
        unique: true
    }
}, { timestamps: true });

module.exports = mongoose.model('PayrollYear', payrollYearSchema);
