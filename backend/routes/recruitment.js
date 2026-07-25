const router = require('express').Router();
const {
    createJobPost, getJobPosts, getJobPost, updateJobPost,
    publishJob, closeJob, reopenJob,
    getPlatformConfigs, savePlatformConfig, disconnectPlatform,
    addCandidate, getCandidates, getCandidate, updateCandidateStage,
    scheduleInterview, hireCandidate, deleteCandidate
} = require('../controllers/recruitmentController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Job Posts
router.post('/jobs', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), createJobPost);
router.get('/jobs', getJobPosts);
router.get('/jobs/:id', getJobPost);
router.put('/jobs/:id', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), updateJobPost);

// Publish / Distribution
router.post('/jobs/:id/publish', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), publishJob);
router.put('/jobs/:id/close', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), closeJob);
router.put('/jobs/:id/reopen', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), reopenJob);

// Platform Configs
router.get('/platforms', getPlatformConfigs);
router.post('/platforms', authorize('SuperAdmin', 'HRAdmin'), savePlatformConfig);
router.delete('/platforms/:platform', authorize('SuperAdmin', 'HRAdmin'), disconnectPlatform);

// Candidates
router.post('/candidates', addCandidate);
router.get('/candidates', getCandidates);
router.get('/candidates/:id', getCandidate);
router.put('/candidates/:id', updateCandidateStage);
router.post('/candidates/:id/schedule-interview', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), scheduleInterview);
router.post('/candidates/:id/hire', authorize('SuperAdmin', 'HRAdmin'), hireCandidate);
router.delete('/candidates/:id', authorize('SuperAdmin', 'HRAdmin', 'Recruiter'), deleteCandidate);

// Resume upload for candidate
router.post('/candidates/:id/resume', async (req, res) => {
    try {
        const Candidate = require('../models/Candidate');
        const candidate = await Candidate.findByIdAndUpdate(req.params.id, { resumeUrl: req.body.resumeUrl }, { new: true });
        res.json({ success: true, data: candidate });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
