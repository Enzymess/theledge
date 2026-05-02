const bcrypt             = require('bcryptjs');
const jwt                = require('jsonwebtoken');
const { getDB }          = require('../config/db');
const { getAdminEmails, isGoogleEnabled } = require('../config/env');
const logger             = require('../utils/logger');
const { sanitizeString } = require('../utils/sanitize');

// Only require google-auth-library if Google is configured
let OAuth2Client;
try { OAuth2Client = require('google-auth-library').OAuth2Client; } catch(_) {}

function getOAuthClient(redirectUri) {
  if (!OAuth2Client) throw new Error('google-auth-library not installed');
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_REDIRECT_URI
  );
}

function issueJWT(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

// ── GET /api/auth/google ──────────────────────────
function googleLogin(req, res) {
  if (!isGoogleEnabled()) return res.redirect('/login?error=google_not_configured');
  const url = getOAuthClient().generateAuthUrl({
    access_type: 'offline', prompt: 'select_account',
    scope: ['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile','openid'],
  });
  res.redirect(url);
}

// ── GET /api/auth/google/callback ─────────────────
async function googleCallback(req, res, next) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/login?error=cancelled');
  if (!isGoogleEnabled()) return res.redirect('/login?error=google_not_configured');
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const ticket  = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const googleEmail   = payload.email.toLowerCase();
    const googleName    = payload.name || googleEmail.split('@')[0];
    const googleId      = payload.sub;
    if (!payload.email_verified) return res.redirect('/login?error=unverified');
    const allowedEmails = getAdminEmails();
    if (!allowedEmails.includes(googleEmail)) return res.redirect('/login?error=unauthorized');
    const db = getDB();
    let user = db.findOne('users', u => u.email === googleEmail);
    if (!user) {
      user = db.insert('users', { name:googleName, email:googleEmail, google_id:googleId, password_hash:null, role:'admin', is_active:true, last_login:new Date().toISOString(), auth_method:'google' });
    } else {
      db.updateById('users', user.id, { last_login:new Date().toISOString(), google_id:googleId, name:googleName });
      user = db.findById('users', user.id);
    }
    if (!user.is_active) return res.redirect('/login?error=deactivated');
    const token = issueJWT(user);
    logger.info('Google admin login', { email: googleEmail });
    res.redirect(`/login?token=${encodeURIComponent(token)}&name=${encodeURIComponent(googleName)}&email=${encodeURIComponent(googleEmail)}&role=${user.role}`);
  } catch(err) {
    logger.error('Google OAuth error', { error: err.message });
    res.redirect('/login?error=failed');
  }
}

// ── GET /api/auth/google/public ───────────────────
function googlePublicLogin(req, res) {
  if (!isGoogleEnabled()) return res.redirect('/?error=google_not_configured');
  const publicRedirect = process.env.GOOGLE_PUBLIC_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
  const client = getOAuthClient(publicRedirect);
  const url = client.generateAuthUrl({
    access_type: 'online', prompt: 'select_account',
    scope: ['https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile','openid'],
  });
  res.redirect(url);
}

// ── GET /api/auth/google/public/callback ──────────
async function googlePublicCallback(req, res, next) {
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/?error=cancelled');
  if (!isGoogleEnabled()) return res.redirect('/?error=google_not_configured');
  try {
    const publicRedirect = process.env.GOOGLE_PUBLIC_REDIRECT_URI || process.env.GOOGLE_REDIRECT_URI;
    const client = getOAuthClient(publicRedirect);
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const ticket  = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const googleEmail = payload.email.toLowerCase();
    const googleName  = payload.name || googleEmail.split('@')[0];
    const googleId    = payload.sub;
    if (!payload.email_verified) return res.redirect('/?error=unverified');
    const allowedEmails = getAdminEmails();
    const isAdmin       = allowedEmails.includes(googleEmail);
    const db = getDB();
    let user = db.findOne('users', u => u.email === googleEmail);
    if (!user) {
      user = db.insert('users', { name:googleName, email:googleEmail, google_id:googleId, password_hash:null, role:isAdmin?'admin':'guest', is_active:true, last_login:new Date().toISOString(), auth_method:'google' });
    } else {
      db.updateById('users', user.id, { last_login:new Date().toISOString(), google_id:googleId, name:googleName });
      user = db.findById('users', user.id);
    }
    if (!user.is_active) return res.redirect('/?error=deactivated');
    const finalRole = isAdmin ? 'admin' : 'guest';
    const token = issueJWT({ ...user, role: finalRole });
    logger.info(`Google public login (${finalRole})`, { email: googleEmail });
    if (isAdmin) {
      res.redirect(`/login?token=${encodeURIComponent(token)}&name=${encodeURIComponent(googleName)}&email=${encodeURIComponent(googleEmail)}&role=admin`);
    } else {
      res.redirect(`/?gtoken=${encodeURIComponent(token)}&gname=${encodeURIComponent(googleName)}&gemail=${encodeURIComponent(googleEmail)}`);
    }
  } catch(err) {
    logger.error('Google public callback error', { error: err.message });
    res.redirect('/?error=failed');
  }
}

// ── POST /api/auth/login — password login ─────────
async function login(req, res, next) {
  try {
    const email    = sanitizeString(req.body.email || '').toLowerCase();
    const password = req.body.password || '';
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const db   = getDB();
    const user = db.findOne('users', u => u.email === email);

    const dummy = '$2a$12$invaliddummyhashfortimingprotection00000000000000000';
    const hash  = (user && user.password_hash) ? user.password_hash : dummy;
    const match = await bcrypt.compare(password, hash);

    if (!user || !match || !user.is_active) {
      logger.warn('Failed password login', { email, ip: req.ip });
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const allowedEmails = getAdminEmails();
    if (!allowedEmails.includes(email)) {
      return res.status(403).json({ error: 'This email does not have admin access' });
    }

    db.updateById('users', user.id, { last_login: new Date().toISOString() });
    const token = issueJWT(user);
    logger.info('Password login success', { email });
    res.json({ token, user: { id:user.id, name:user.name, email:user.email, role:user.role } });
  } catch(err) { next(err); }
}

// ── PUT /api/auth/change-password ─────────────────
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const db   = getDB();
    const user = db.findById('users', req.user.id);
    if (!user.password_hash) return res.status(400).json({ error: 'This account uses Google sign-in — no password set' });
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS)||12);
    db.updateById('users', req.user.id, { password_hash: hash });
    res.json({ message: 'Password updated' });
  } catch(err) { next(err); }
}

// ── GET /api/auth/me ──────────────────────────────
async function getMe(req, res, next) {
  try {
    const user = getDB().findById('users', req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch(err) { next(err); }
}

// ── GET /api/auth/admin-emails ────────────────────
function getAdminEmailsList(req, res) {
  res.json({ emails: getAdminEmails() });
}

// ── PUT /api/auth/admin-emails ────────────────────
function updateAdminEmails(req, res) {
  const { emails } = req.body;
  if (!Array.isArray(emails) || !emails.length) return res.status(400).json({ error: 'Provide at least one email' });
  const cleaned = emails.map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
  if (!cleaned.length) return res.status(400).json({ error: 'No valid emails provided' });
  const fs   = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '../../../.env');
  try {
    let content = fs.readFileSync(envPath, 'utf8');
    const line  = `ADMIN_EMAILS=${cleaned.join(',')}`;
    content = content.includes('ADMIN_EMAILS=') ? content.replace(/ADMIN_EMAILS=.*/g, line) : content + `\n${line}\n`;
    fs.writeFileSync(envPath, content, 'utf8');
    process.env.ADMIN_EMAILS = cleaned.join(',');
    logger.info('Admin emails updated', { emails: cleaned, by: req.user.email });
    res.json({ message: 'Access list updated', emails: cleaned });
  } catch(err) {
    process.env.ADMIN_EMAILS = cleaned.join(',');
    res.json({ message: 'Updated for this session', emails: cleaned });
  }
}

module.exports = { googleLogin, googleCallback, googlePublicLogin, googlePublicCallback, login, changePassword, getMe, getAdminEmailsList, updateAdminEmails };
