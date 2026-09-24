const mongoose = require('mongoose');

const expenseCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, uppercase: true, unique: true, trim: true },
    description: { type: String },
    receiptRequired: { type: Boolean, default: true },
    maxAmount: { type: Number, default: null }, // null = no limit
    monthlyLimit: { type: Number, default: null }, // null = no limit
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const ExpenseCategory = mongoose.model('ExpenseCategory', expenseCategorySchema);

// Seed default categories if collection is empty
const seedDefaultCategories = async () => {
    try {
        const count = await ExpenseCategory.countDocuments();
        if (count === 0) {
            const defaults = [
                { name: 'Travel', code: 'TRAVEL', description: 'Flight, train, bus, cab fares', receiptRequired: true },
                { name: 'Local Conveyance', code: 'CONVEYANCE', description: 'Local travel by auto, cab, etc.', receiptRequired: false },
                { name: 'Food & Meals', code: 'FOOD', description: 'Meals during work or client meetings', receiptRequired: true },
                { name: 'Accommodation', code: 'ACCOMMODATION', description: 'Hotel / guesthouse stay', receiptRequired: true },
                { name: 'Office Supplies', code: 'OFFICE_SUPPLIES', description: 'Stationery, printing, etc.', receiptRequired: true },
                { name: 'Communication', code: 'COMMUNICATION', description: 'Phone, courier, postal charges', receiptRequired: false },
                { name: 'Internet / Mobile', code: 'INTERNET', description: 'Internet bill, mobile recharge', receiptRequired: true },
                { name: 'Client Meeting', code: 'CLIENT_MEETING', description: 'Client entertainment or gifts', receiptRequired: true },
                { name: 'Training & Development', code: 'TRAINING', description: 'Course fees, books, certifications', receiptRequired: true },
                { name: 'Medical / Wellness', code: 'MEDICAL', description: 'Medical expenses related to work', receiptRequired: true },
                { name: 'Relocation', code: 'RELOCATION', description: 'Relocation / shifting expenses', receiptRequired: true },
                { name: 'Miscellaneous', code: 'MISC', description: 'Any other work-related expense', receiptRequired: false },
                { name: 'Other', code: 'OTHER', description: 'Custom expense category', receiptRequired: true }
            ];

            await ExpenseCategory.insertMany(defaults);
            console.log('✅ Default expense categories seeded');
        } else {
            // Check if 'Other' exists, insert if missing
            const otherExists = await ExpenseCategory.findOne({ name: 'Other' });
            if (!otherExists) {
                await ExpenseCategory.create({ name: 'Other', code: 'OTHER', description: 'Custom expense category', receiptRequired: true });
                console.log('✅ Added Other expense category');
            }
        }
    } catch (err) {
        console.error('Failed to seed expense categories:', err.message);
    }
};

module.exports = { ExpenseCategory, seedDefaultCategories };
