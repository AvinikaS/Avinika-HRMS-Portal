const router = require('express').Router();
const JobPost = require('../models/JobPost');
const Candidate = require('../models/Candidate');
const Employee = require('../models/Employee');
const PlatformConfig = require('../models/PlatformConfig');

// ========== PUBLIC ENDPOINTS (No Auth) ==========

// GET /api/careers — List all open jobs
router.get('/', async (req, res) => {
    try {
        const { search, department, type } = req.query;
        const query = { status: 'Open' };
        if (department) query.department = department;
        if (type) query.employmentType = type;
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } },
                { skills: { $elemMatch: { $regex: search, $options: 'i' } } }
            ];
        }
        const jobs = await JobPost.find(query)
            .select('title department location employmentType experienceMin experienceMax salaryMin salaryMax currency skills openings slug createdAt')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: jobs });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/careers/:slug — Get job detail by slug
router.get('/:slug', async (req, res) => {
    try {
        const job = await JobPost.findOne({ slug: req.params.slug, status: 'Open' })
            .select('-createdBy -publishedPlatforms');
        if (!job) return res.status(404).json({ success: false, message: 'Job not found or closed' });
        res.json({ success: true, data: job });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/careers/:jobId/apply — Apply to a job (with resume upload)
router.post('/:jobId/apply', async (req, res) => {
    try {
        const job = await JobPost.findById(req.params.jobId);
        if (!job || job.status !== 'Open') {
            return res.status(404).json({ success: false, message: 'Job not found or closed' });
        }

        const { name, email, phone, skills, experience, currentCompany, currentDesignation, expectedSalary, noticePeriod, coverLetter, aadhaar } = req.body;

        // Duplicate check — same job
        const existingForJob = await Candidate.findOne({ email: email.toLowerCase(), jobPost: job._id });
        if (existingForJob) {
            return res.status(400).json({ success: false, message: 'You have already applied for this position' });
        }

        // Rehire detection
        const orConditions = [{ email: email.toLowerCase() }];
        if (phone) orConditions.push({ phone });
        if (aadhaar) orConditions.push({ aadhaar });

        const prevEmployee = await Employee.findOne({ $or: orConditions, status: { $in: ['Terminated / Ex-Employee'] } });
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

        // Cross-job duplicate detection
        const existingCandidate = await Candidate.findOne({ $or: orConditions });
        let isDuplicate = false;
        let duplicateOf = null;
        if (existingCandidate) {
            isDuplicate = true;
            duplicateOf = existingCandidate._id;
        }

        const candidate = await Candidate.create({
            name, email: email.toLowerCase(), phone,
            aadhaar, coverLetter, experience: experience || 0,
            currentCompany, currentDesignation, expectedSalary, noticePeriod,
            skills: skills ? (typeof skills === 'string' ? skills.split(',').map(s => s.trim()) : skills) : [],
            resumeUrl: req.body.resumeUrl || null, // Cloudinary URL from direct upload
            source: 'Company Career Page',
            jobPost: job._id,
            isPreviousEmployee, previousEmploymentHistory,
            isDuplicate, duplicateOf,
            appliedAt: new Date()
        });

        await JobPost.findByIdAndUpdate(job._id, { $inc: { applicationsCount: 1 } });

        // Update platform sync count
        await PlatformConfig.findOneAndUpdate(
            { platform: 'Company Career Page' },
            { $inc: { totalCandidatesSynced: 1 }, lastSyncAt: new Date() },
            { upsert: true }
        );

        res.status(201).json({ success: true, message: 'Application submitted successfully!', data: { id: candidate._id } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST /api/careers/webhook/:platform — Webhook for external platforms
router.post('/webhook/:platform', async (req, res) => {
    try {
        const { platform } = req.params;
        const config = await PlatformConfig.findOne({ platform });

        // Optional: Verify webhook secret
        // if (config?.webhookSecret && req.headers['x-webhook-secret'] !== config.webhookSecret) {
        //     return res.status(403).json({ success: false, message: 'Invalid webhook secret' });
        // }

        const { candidateName, candidateEmail, candidatePhone, resumeUrl, jobExternalId, skills, experience, aadhaar } = req.body;

        if (!candidateEmail) {
            return res.status(400).json({ success: false, message: 'candidateEmail is required' });
        }

        // Find matching job
        let jobPost = null;
        if (jobExternalId) {
            const job = await JobPost.findOne({ 'publishedPlatforms.externalJobId': jobExternalId });
            if (job) jobPost = job._id;
        }

        // Duplicate / rehire detection
        const orConditions = [{ email: candidateEmail.toLowerCase() }];
        if (candidatePhone) orConditions.push({ phone: candidatePhone });
        if (aadhaar) orConditions.push({ aadhaar });

        const prevEmployee = await Employee.findOne({ $or: orConditions, status: { $in: ['Terminated / Ex-Employee'] } });
        const existingCandidate = await Candidate.findOne({ $or: orConditions });

        const candidate = await Candidate.create({
            name: candidateName || 'Unknown',
            email: candidateEmail.toLowerCase(),
            phone: candidatePhone || '',
            resumeUrl: resumeUrl || null,
            skills: skills || [],
            experience: experience || 0,
            source: platform,
            jobPost,
            isPreviousEmployee: !!prevEmployee,
            isDuplicate: !!existingCandidate,
            duplicateOf: existingCandidate?._id,
            previousEmploymentHistory: prevEmployee ? [{
                employeeCode: prevEmployee.employeeCode,
                department: prevEmployee.department,
                designation: prevEmployee.designation,
                dateOfJoining: prevEmployee.dateOfJoining,
                dateOfLeaving: prevEmployee.dateOfLeaving,
                reason: prevEmployee.status
            }] : [],
            appliedAt: new Date()
        });

        if (jobPost) {
            await JobPost.findByIdAndUpdate(jobPost, { $inc: { applicationsCount: 1 } });
        }
        await PlatformConfig.findOneAndUpdate(
            { platform },
            { $inc: { totalCandidatesSynced: 1 }, lastSyncAt: new Date() },
            { upsert: true }
        );

        res.status(201).json({ success: true, message: 'Candidate synced', data: { id: candidate._id } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
