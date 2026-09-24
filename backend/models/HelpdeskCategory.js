const mongoose = require('mongoose');

const helpdeskCategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

const HelpdeskCategory = mongoose.model('HelpdeskCategory', helpdeskCategorySchema);

// Seed default categories if collection is empty
const DEFAULT_CATEGORIES = [
    'Leave & Attendance',
    'Payroll & Salary',
    'Employee Benefits',
    'Documents & Certificates',
    'Joining / Onboarding',
    'Employee Profile',
    'Performance',
    'Policy & HR Queries',
    'Reimbursement',
    'Exit / Full & Final',
    'General HR Query',
    'Other'
];

async function seedCategories() {
    try {
        const count = await HelpdeskCategory.countDocuments();
        if (count === 0) {
            await HelpdeskCategory.insertMany(DEFAULT_CATEGORIES.map(name => ({ name })));
            console.log('[Helpdesk] Default categories seeded.');
        } else {
            // Ensure "Other" exists
            const hasOther = await HelpdeskCategory.findOne({ name: 'Other' });
            if (!hasOther) {
                await HelpdeskCategory.create({ name: 'Other' });
                console.log('[Helpdesk] "Other" category added to existing DB.');
            }
        }
    } catch (err) {
        console.error('[Helpdesk] Category seeding error:', err.message);
    }
}

// Auto-seed on first require (after DB is connected)
setTimeout(seedCategories, 3000);

module.exports = HelpdeskCategory;
