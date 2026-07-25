const Performance = require('../models/Performance');

exports.createReview = async (req, res) => {
    try {
        const review = await Performance.create({ ...req.body });
        res.status(201).json({ success: true, data: review });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getReviews = async (req, res) => {
    try {
        const { employee, year } = req.query;
        const query = {};
        if (employee) query.employee = employee;
        if (year) query.year = parseInt(year);
        const reviews = await Performance.find(query)
            .populate('employee', 'firstName lastName employeeCode department')
            .populate('reviewer', 'firstName lastName')
            .sort({ createdAt: -1 });
        res.json({ success: true, data: reviews });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getReview = async (req, res) => {
    try {
        const review = await Performance.findById(req.params.id)
            .populate('employee', 'firstName lastName employeeCode department designation')
            .populate('reviewer', 'firstName lastName');
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        res.json({ success: true, data: review });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateReview = async (req, res) => {
    try {
        const review = await Performance.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });
        res.json({ success: true, data: review });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getMyReviews = async (req, res) => {
    try {
        const reviews = await Performance.find({ employee: req.user.employeeId })
            .populate('reviewer', 'firstName lastName').sort({ createdAt: -1 });
        res.json({ success: true, data: reviews });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// Employee self-assessment update (limited fields only)
exports.selfUpdateReview = async (req, res) => {
    try {
        const review = await Performance.findById(req.params.id);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

        // Verify this is the employee's own review
        if (review.employee.toString() !== req.user.employeeId?.toString()) {
            return res.status(403).json({ success: false, message: 'You can only update your own reviews' });
        }

        // Only allow updates during 'Self Review' stage
        if (review.status !== 'Self Review') {
            return res.status(400).json({ success: false, message: `Cannot update self-assessment in "${review.status}" stage` });
        }

        // Update only self-assessment fields
        if (req.body.selfComments !== undefined) review.selfComments = req.body.selfComments;
        if (req.body.goals) {
            req.body.goals.forEach((g, i) => {
                if (review.goals[i]) {
                    review.goals[i].selfRating = g.selfRating || review.goals[i].selfRating;
                }
            });
        }

        await review.save();
        res.json({ success: true, data: review });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
