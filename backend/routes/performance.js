const router = require('express').Router();
const { createReview, getReviews, getReview, updateReview, getMyReviews, selfUpdateReview } = require('../controllers/performanceController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.route('/')
    .get(authorize('SuperAdmin', 'HRAdmin', 'Manager'), getReviews)
    .post(authorize('SuperAdmin', 'HRAdmin', 'Manager'), createReview);
router.get('/my', getMyReviews);
router.put('/my/:id', selfUpdateReview);
router.route('/:id')
    .get(getReview)
    .put(authorize('SuperAdmin', 'HRAdmin', 'Manager'), updateReview);

module.exports = router;
