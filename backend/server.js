const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();
const { initCronJobs } = require('./utils/cronJobs');

const app = express();

// Socket.IO only works in non-serverless (local dev) environments
const IS_VERCEL = process.env.VERCEL === '1';
let server;
if (!IS_VERCEL) {
    const http = require('http');
    server = http.createServer(app);
    const { initSocket } = require('./config/socket');
    initSocket(server);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));
// Keep static serving for old files uploaded before Cloudinary migration
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection (cached for serverless cold starts)
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const opts = {
            serverSelectionTimeoutMS: 5000
        };
        cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
            console.log('MongoDB connected successfully');
            return mongoose;
        }).catch(err => {
            cached.promise = null;
            console.error('MongoDB connection error:', err.message);
            throw err;
        });
    }

    try {
        cached.conn = await cached.promise;
        return cached.conn;
    } catch (e) {
        cached.promise = null;
        throw e;
    }
};

// Ensure DB connects BEFORE any route handler runs
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        next(err);
    }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/leaves', require('./routes/leaves'));
app.use('/api/payroll', require('./routes/payroll'));
app.use('/api/recruitment', require('./routes/recruitment'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/performance', require('./routes/performance'));
app.use('/api/shifts', require('./routes/shifts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/careers', require('./routes/careers'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/payroll-years', require('./routes/payrollYears'));
app.use('/api/performance-years', require('./routes/performanceYears'));
app.use('/api/document-types', require('./routes/documentTypes'));
app.use('/api/holidays', require('./routes/holiday'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/bonus', require('./routes/bonus'));
app.use('/api/incentives', require('./routes/incentives'));
app.use('/api/loans', require('./routes/loan'));
app.use('/api/advances', require('./routes/advance'));
app.use('/api/tax', require('./routes/tax'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/exit', require('./routes/exit'));
app.use('/api/helpdesk', require('./routes/helpdesk'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/cron', require('./routes/cron'));
app.use("/api/expenses", require("./routes/expense.routes"));
app.use('/api', require('./routes/attendanceRegularization.routes'));
app.use('/api', require('./routes/payrollAdjustment.routes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal Server Error'
    });
});




if (!IS_VERCEL) {
    // Local development: connect and start HTTP server
    const PORT = process.env.PORT || 5000;
    connectDB().then(async () => {
        initCronJobs();
        // Seed default expense categories
        const { seedDefaultCategories } = require('./models/ExpenseCategory.model');
        await seedDefaultCategories();
        server.listen(PORT, () => {
            console.log(`HRMS Server running on port ${PORT}`);
        });
    }).catch(err => {
        process.exit(1);
    });
}

// Export for Vercel serverless
module.exports = app;
