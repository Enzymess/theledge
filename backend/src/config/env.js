require('dotenv').config();

function loadEnv() {
  // Only JWT_SECRET and ADMIN_EMAILS are truly required to run
  if (!process.env.JWT_SECRET) {
    console.error('\n[ENV ERROR] JWT_SECRET is missing.');
    console.error('Copy .env.example to .env and fill in JWT_SECRET.\n');
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.error('[ENV ERROR] JWT_SECRET must be at least 32 characters.');
    process.exit(1);
  }
  if (!process.env.ADMIN_EMAILS) {
    console.error('[ENV ERROR] ADMIN_EMAILS is missing. Set it to your email address.');
    process.exit(1);
  }

  // Google OAuth is optional — warn but don't crash
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id') {
    console.warn('[WARN] Google OAuth not configured — only password login will work.');
    console.warn('[WARN] See deploy/GOOGLE_OAUTH_SETUP.md to enable Google Sign-In.');
  }

  // SMTP is optional — warn but don't crash
  if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_email@gmail.com') {
    console.warn('[WARN] SMTP not configured — confirmation emails will not be sent.');
  }
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function isGoogleEnabled() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id' &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}

module.exports = { loadEnv, getAdminEmails, isGoogleEnabled };
