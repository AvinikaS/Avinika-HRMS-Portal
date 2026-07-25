const mongoose = require('mongoose');

const pfChallanSchema = new mongoose.Schema({
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    establishmentCode: { type: String },

    totalEmployeesIncluded: { type: Number, default: 0 },
    actualWageCount: { type: Number, default: 0 },
    ceilingCount: { type: Number, default: 0 },
    excludedCount: { type: Number, default: 0 },

    totalPFWages: { type: Number, default: 0 },
    totalEmployeeEPF: { type: Number, default: 0 },
    totalEmployerEPF: { type: Number, default: 0 },
    totalEmployerEPS: { type: Number, default: 0 },
    totalEDLI: { type: Number, default: 0 },
    adminCharges: { type: Number, default: 500 },
    grandTotal: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['not_generated', 'ecr_generated', 'payment_pending', 'paid', 'completed'],
        default: 'not_generated'
    },

    trrn: { type: String },
    paymentDate: { type: Date },
    transactionId: { type: String },

    ecrGeneratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    ecrGeneratedOn: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('PfChallan', pfChallanSchema);
