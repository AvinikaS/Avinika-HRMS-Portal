const mongoose = require('mongoose');

async function fixHolidayIndexes() {
    try {
        const conn = await mongoose.connect('mongodb://127.0.0.1:27017/hrms_portal');
        console.log('Connected to DB to fix indexes...');

        const collection = conn.connection.db.collection('holidays');

        // 1. Purane indexes check karo
        const indexes = await collection.indexes();
        console.log('Current indexes:', indexes.map(i => i.name));

        // 2. Agar "date_1" (purely unique on date) exist karta hai, to usey drop karo
        if (indexes.find(i => i.name === 'date_1' && i.unique)) {
            console.log('Dropping strict unique date index...');
            await collection.dropIndex('date_1');
        }

        // 3. Naya compound index ensure karo (Unique for Date + Name)
        console.log('Applying new compound unique index (date + name)...');
        await collection.createIndex({ date: 1, name: 1 }, { unique: true });

        console.log('Indexes fixed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error fixing indexes:', err.message);
        process.exit(1);
    }
}

fixHolidayIndexes();
