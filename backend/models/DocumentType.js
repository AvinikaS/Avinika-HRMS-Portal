const mongoose = require('mongoose');

const documentTypeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Document type name is required'],
        unique: true,
        trim: true
    },
    icon: {
        type: String,
        default: '📎'
    }
}, { timestamps: true });

module.exports = mongoose.model('DocumentType', documentTypeSchema);
