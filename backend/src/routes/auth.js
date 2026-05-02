const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { loginLimiter } = require('../middleware/rateLimiter');
const {
  googleLogin, googleCallback,
  googlePublicLogin, googlePublicCallback,
  login, changePassword, getMe,
  getAdminEmailsList, updateAdminEmails
} = require('../controllers/authController');

router.get('/status', (req, res) => {
  const { isGoogleEnabled } = require('../config/env');
  res.json({ google_enabled: isGoogleEnabled(), password_login: true });
});

router.get('/google',                    googleLogin);
router.get('/google/callback',           googleCallback);
router.get('/google/public',             googlePublicLogin);
router.get('/google/public/callback',    googlePublicCallback);
router.post('/login',                    loginLimiter, login);
router.get('/me',                        auth, getMe);
router.put('/change-password',           auth, changePassword);
router.get('/admin-emails',              auth, roleGuard('admin'), getAdminEmailsList);
router.put('/admin-emails',              auth, roleGuard('admin'), updateAdminEmails);

module.exports = router;
