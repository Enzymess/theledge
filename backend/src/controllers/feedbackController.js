/* ============================================================
   THE LEDGE BAGUIO — Feedback Controller (JSON-file DB)
   ============================================================ */

const { getDB } = require('../config/db');
const AuditLog  = require('../models/AuditLog');
const logger    = require('../utils/logger');

// Submit new feedback (public)
exports.submitFeedback = (req, res) => {
  try {
    const { name, email, rating, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email, and message are required' });
    }

    const r = parseInt(rating) || 5;
    if (r < 1 || r > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    const db    = getDB();
    const entry = db.insert('feedback', {
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      rating:  r,
      message: message.trim(),
      status:  'pending',
    });

    res.status(201).json({ success: true, message: 'Feedback submitted successfully. Thank you!', data: { id: entry.id, status: 'pending' } });
  } catch (err) {
    logger.error('submitFeedback error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
};

// Get approved feedback (public)
exports.getApprovedFeedback = (req, res) => {
  try {
    const db       = getDB();
    const feedback = db.find('feedback', f => f.status === 'approved')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, count: feedback.length, data: feedback });
  } catch (err) {
    logger.error('getApprovedFeedback error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to load feedback' });
  }
};

// Get all feedback (admin only)
exports.getAllFeedback = (req, res) => {
  try {
    const { status } = req.query;
    const db = getDB();

    let feedback = db.all('feedback');
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      feedback = feedback.filter(f => f.status === status);
    }

    feedback.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, count: feedback.length, data: feedback });
  } catch (err) {
    logger.error('getAllFeedback error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to load feedback' });
  }
};

// Update feedback status (admin only)
exports.updateFeedbackStatus = (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Must be pending, approved, or rejected' });
    }

    const db       = getDB();
    const feedback = db.findById('feedback', id);
    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    db.updateById('feedback', id, { status, reviewed_by: req.user.id, reviewed_at: new Date().toISOString() });

    AuditLog.log({ userId: req.user.id, action: 'feedback.status_updated', entity: 'feedback', entityId: id, note: `Status → ${status}`, ip: req.ip });

    res.json({ success: true, message: `Feedback ${status}` });
  } catch (err) {
    logger.error('updateFeedbackStatus error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update feedback status' });
  }
};

// Delete feedback (admin only)
exports.deleteFeedback = (req, res) => {
  try {
    const { id } = req.params;
    const db     = getDB();

    const feedback = db.findById('feedback', id);
    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback not found' });
    }

    db.deleteById('feedback', id);
    AuditLog.log({ userId: req.user.id, action: 'feedback.deleted', entity: 'feedback', entityId: id, note: `From ${feedback.name}`, ip: req.ip });

    res.json({ success: true, message: 'Feedback deleted' });
  } catch (err) {
    logger.error('deleteFeedback error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to delete feedback' });
  }
};

// Get feedback stats (admin only)
exports.getFeedbackStats = (req, res) => {
  try {
    const db       = getDB();
    const feedback = db.all('feedback');
    const total    = feedback.length;

    const byStatus = { pending: 0, approved: 0, rejected: 0 };
    let ratingSum  = 0;
    let ratingCount = 0;

    feedback.forEach(f => {
      if (byStatus[f.status] !== undefined) byStatus[f.status]++;
      if (f.status === 'approved') { ratingSum += f.rating || 0; ratingCount++; }
    });

    const averageRating = ratingCount ? (ratingSum / ratingCount).toFixed(1) : 0;

    res.json({ success: true, data: { total, pending: byStatus.pending, byStatus, averageRating } });
  } catch (err) {
    logger.error('getFeedbackStats error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to load feedback stats' });
  }
};
