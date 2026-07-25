const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        date: { type: Date, required: true },
        type: {
            type: String,
            enum: ['Public', 'Company', 'Government'],
            default: 'Public',
        },
        description: { type: String, default: '' },
        source: { type: String, enum: ['auto', 'manual'], default: 'manual' },
        year: { type: Number, required: true },
        month: { type: Number, required: true }, // 1–12
        isActive: { type: Boolean, default: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    { timestamps: true }
);

// Same name + same date → duplicate nahi banana
holidaySchema.index({ date: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
