const JobPost = require('../models/JobPost');
const Candidate = require('../models/Candidate');
const Employee = require('../models/Employee');
const User = require('../models/User');
const PlatformConfig = require('../models/PlatformConfig');

// ---- JOB POSTS ----
exports.createJobPost = async (req, res) => {
    try {
        const job = await JobPost.create({ ...req.body, createdBy: req.user.id });
        res.status(201).json({ success: true, data: job });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getJobPosts = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};
        if (status) query.status = status;
        const jobs = await JobPost.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: jobs });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getJobPost = async (req, res) => {
    try {
        const job = await JobPost.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job post not found' });
        const candidates = await Candidate.find({ jobPost: job._id });
        res.json({ success: true, data: { ...job.toObject(), candidates } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateJobPost = async (req, res) => {
    try {
        const job = await JobPost.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!job) return res.status(404).json({ success: false, message: 'Job post not found' });
        res.json({ success: true, data: job });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ---- PUBLISH JOB TO PLATFORMS ----
exports.publishJob = async (req, res) => {
    try {
        const { platforms } = req.body;
        const job = await JobPost.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job post not found' });

        const results = [];
        for (const platform of platforms) {
            const config = await PlatformConfig.findOne({ platform, isConnected: true });

            let publishResult = { platform, status: 'Published', publishedAt: new Date() };

            if (platform === 'Company Career Page') {
                // Always succeeds - just marks as published on career page
                publishResult.externalUrl = `/careers/${job.slug}`;
            } else if (config) {
                // Simulate API call to external platform
                // In production, you would call the real API here:
                // const response = await publishToLinkedIn(config, job);
                publishResult.externalJobId = `${platform.toLowerCase().replace(/\s/g, '')}-${Date.now()}`;
                publishResult.externalUrl = `https://${platform.toLowerCase().replace(/[\s.]/g, '')}.com/jobs/${publishResult.externalJobId}`;

                // Update platform stats
                await PlatformConfig.findByIdAndUpdate(config._id, {
                    $inc: { totalJobsPublished: 1 },
                    lastSyncAt: new Date()
                });
            } else {
                publishResult.status = 'Failed';
                publishResult.error = `${platform} is not connected. Go to Settings to connect.`;
            }

            // Update or add platform entry
            const existingIndex = job.publishedPlatforms.findIndex(p => p.platform === platform);
            if (existingIndex >= 0) {
                job.publishedPlatforms[existingIndex] = publishResult;
            } else {
                job.publishedPlatforms.push(publishResult);
            }
            results.push(publishResult);
        }

        job.status = 'Open';
        job.isPublished = true;
        job.publishedAt = job.publishedAt || new Date();
        await job.save();

        res.json({ success: true, data: job, publishResults: results });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ---- CLOSE JOB ----
exports.closeJob = async (req, res) => {
    try {
        const job = await JobPost.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job post not found' });

        job.status = 'Closed';
        job.closedAt = new Date();

        // Mark all published platforms as 'Removed'
        for (let i = 0; i < job.publishedPlatforms.length; i++) {
            job.publishedPlatforms[i].status = 'Removed';
        }

        await job.save();
        res.json({ success: true, data: job, message: 'Job closed and removed from all platforms' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ---- REOPEN JOB ----
exports.reopenJob = async (req, res) => {
    try {
        const job = await JobPost.findById(req.params.id);
        if (!job) return res.status(404).json({ success: false, message: 'Job post not found' });

        job.status = 'Open';
        job.closedAt = undefined;

        // Restore platform statuses to Published
        for (let i = 0; i < job.publishedPlatforms.length; i++) {
            job.publishedPlatforms[i].status = 'Published';
            job.publishedPlatforms[i].publishedAt = new Date();
        }

        await job.save();
        res.json({ success: true, data: job, message: 'Job reopened and re-published on all platforms' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ---- PLATFORM CONFIGS ----
const PLATFORMS = ['LinkedIn', 'Naukri', 'Indeed', 'Internshala', 'Monster', 'Glassdoor', 'Company Career Page'];

exports.getPlatformConfigs = async (req, res) => {
    try {
        const configs = await PlatformConfig.find().select('-apiKey -apiSecret -accessToken -refreshToken -webhookSecret');
        // Fill in missing platforms with defaults
        const result = PLATFORMS.map(p => {
            const existing = configs.find(c => c.platform === p);
            return existing || { platform: p, isConnected: p === 'Company Career Page', totalJobsPublished: 0, totalCandidatesSynced: 0 };
        });
        res.json({ success: true, data: result });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.savePlatformConfig = async (req, res) => {
    try {
        const { platform, apiKey, apiSecret, accessToken, accountEmail, companyId } = req.body;
        const config = await PlatformConfig.findOneAndUpdate(
            { platform },
            {
                platform,
                isConnected: true,
                apiKey, apiSecret, accessToken, accountEmail, companyId,
                connectedBy: req.user.id,
                connectedAt: new Date()
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, data: { platform: config.platform, isConnected: config.isConnected, accountEmail: config.accountEmail, connectedAt: config.connectedAt } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.disconnectPlatform = async (req, res) => {
    try {
        await PlatformConfig.findOneAndUpdate(
            { platform: req.params.platform },
            { isConnected: false, apiKey: null, apiSecret: null, accessToken: null, refreshToken: null }
        );
        res.json({ success: true, message: `${req.params.platform} disconnected` });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ---- CANDIDATES ----
exports.addCandidate = async (req, res) => {
    try {
        const { email, phone, aadhaar } = req.body;

        // Duplicate detection across candidates
        const orConditions = [{ email }];
        if (phone) orConditions.push({ phone });
        if (aadhaar) orConditions.push({ aadhaar });

        const existingCandidate = await Candidate.findOne({ $or: orConditions, jobPost: req.body.jobPost });
        if (existingCandidate) {
            return res.status(400).json({ success: false, message: 'Candidate already applied for this job', duplicate: true, existingCandidate: existingCandidate._id });
        }

        // Cross-job duplicate detection
        const duplicateCandidate = await Candidate.findOne({ $or: orConditions, _id: { $ne: existingCandidate?._id } });
        let isDuplicate = false;
        let duplicateOf = null;
        if (duplicateCandidate) {
            isDuplicate = true;
            duplicateOf = duplicateCandidate._id;
        }

        // Rehire detection
        const prevEmployee = await Employee.findOne({ $or: orConditions, status: { $in: ['Inactive', 'Resigned', 'Terminated'] } });
        let isPreviousEmployee = false;
        let previousEmploymentHistory = [];
        if (prevEmployee) {
            isPreviousEmployee = true;
            previousEmploymentHistory = [{
                employeeCode: prevEmployee.employeeCode,
                department: prevEmployee.department,
                designation: prevEmployee.designation,
                dateOfJoining: prevEmployee.dateOfJoining,
                dateOfLeaving: prevEmployee.dateOfLeaving,
                reason: prevEmployee.status
            }];
        }

        const candidate = await Candidate.create({ ...req.body, isPreviousEmployee, previousEmploymentHistory, isDuplicate, duplicateOf });
        if (req.body.jobPost) {
            await JobPost.findByIdAndUpdate(req.body.jobPost, { $inc: { applicationsCount: 1 } });
        }
        res.status(201).json({ success: true, data: candidate, isPreviousEmployee, isDuplicate });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getCandidates = async (req, res) => {
    try {
        const { stage, jobPost, search, source } = req.query;
        const query = {};
        if (stage) query.stage = stage;
        if (jobPost) query.jobPost = jobPost;
        if (source) query.source = source;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        const candidates = await Candidate.find(query).populate('jobPost', 'title department').sort({ createdAt: -1 });
        res.json({ success: true, data: candidates });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id).populate('jobPost');
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
        res.json({ success: true, data: candidate });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateCandidateStage = async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndUpdate(req.params.id, { stage: req.body.stage, ...req.body }, { new: true });
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
        res.json({ success: true, data: candidate });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const { sendInterviewEmail } = require('../utils/emailService');

exports.scheduleInterview = async (req, res) => {
    try {
        const { date, time, duration, interviewType, meetingLink, interviewerName } = req.body;
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        // Update candidate stage to Interview (or stay in Interview if already there)
        candidate.stage = 'Interview';
        // Optional: you can save interview details in the candidate document if you add fields for it
        await candidate.save();

        if (candidate.email) {
            await sendInterviewEmail(candidate.email, candidate.name, {
                date, time, duration, interviewType, meetingLink, interviewerName
            });
        }

        res.json({ success: true, message: 'Interview scheduled & email sent!', data: candidate });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Candidate to Employee conversion
exports.hireCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

        const count = await Employee.countDocuments();
        const employeeCode = `EMP${String(count + 1).padStart(4, '0')}`;
        const nameParts = candidate.name.split(' ');

        const employee = await Employee.create({
            employeeCode,
            firstName: nameParts[0] || candidate.name,
            lastName: nameParts.slice(1).join(' ') || '',
            email: candidate.email,
            phone: candidate.phone,
            aadhaar: candidate.aadhaar || '',
            department: req.body.department || 'General',
            designation: req.body.designation || 'Associate',
            dateOfJoining: req.body.dateOfJoining || new Date(),
            salary: req.body.salary || {}
        });

        const user = await User.create({
            email: candidate.email,
            password: 'Welcome@123',
            role: 'Employee',
            employeeId: employee._id
        });
        employee.userId = user._id;
        await employee.save();

        candidate.stage = 'Hired';
        candidate.convertedToEmployee = employee._id;
        await candidate.save();

        res.status(201).json({ success: true, data: { employee, candidate } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteCandidate = async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);
        if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
        res.json({ success: true, message: 'Candidate deleted' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
