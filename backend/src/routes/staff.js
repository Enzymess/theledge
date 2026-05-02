const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const {
  getStaff, getStaffMember, createStaff,
  updateStaff, toggleStaff, resetPassword, getAuditLog
} = require('../controllers/staffController');

// All staff routes require admin role
router.get('/',                   auth, roleGuard('admin'), getStaff);
router.get('/audit-log',          auth, roleGuard('admin'), getAuditLog);
router.get('/:id',                auth, roleGuard('admin'), getStaffMember);
router.post('/',                  auth, roleGuard('admin'), createStaff);
router.put('/:id',                auth, roleGuard('admin'), updateStaff);
router.patch('/:id/toggle',       auth, roleGuard('admin'), toggleStaff);
router.post('/:id/reset-password',auth, roleGuard('admin'), resetPassword);

module.exports = router;
