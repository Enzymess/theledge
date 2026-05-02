/* ============================================================
   THE LEDGE BAGUIO — Feedback Routes
   ============================================================ */

const express            = require('express');
const router             = express.Router();
const feedbackController = require('../controllers/feedbackController');
const auth               = require('../middleware/auth');
const roleGuard          = require('../middleware/roleGuard');

// Public routes
router.post('/',          feedbackController.submitFeedback);
router.get('/approved',   feedbackController.getApprovedFeedback);

// Admin routes
router.get('/',           auth, roleGuard('admin', 'manager'), feedbackController.getAllFeedback);
router.get('/stats',      auth, roleGuard('admin', 'manager'), feedbackController.getFeedbackStats);
router.patch('/:id',      auth, roleGuard('admin', 'manager'), feedbackController.updateFeedbackStatus);
router.delete('/:id',     auth, roleGuard('admin'),            feedbackController.deleteFeedback);

module.exports = router;
