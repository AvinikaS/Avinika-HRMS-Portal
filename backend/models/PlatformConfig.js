const mongoose = require('mongoose');

const platformConfigSchema = new mongoose.Schema({
    platform: {
        type: String,
        required: true,
        unique: true,
        enum: ['LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Monster', 'Glassdoor', 'Company Career Page', 'Other']
    },
    isConnected: { type: Boolean, default: false },
    apiKey: String,
    apiSecret: String,
    accessToken: String,
    refreshToken: String,
    accountEmail: String,
    companyId: String,
    webhookSecret: String,
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    connectedAt: Date,
    lastSyncAt: Date,
    totalJobsPublished: { type: Number, default: 0 },
    totalCandidatesSynced: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('PlatformConfig', platformConfigSchema);
