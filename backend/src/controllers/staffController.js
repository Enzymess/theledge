const bcrypt   = require('bcryptjs');
const { getDB }          = require('../config/db');
const logger             = require('../utils/logger');
const { sanitizeObject } = require('../utils/sanitize');

function getStaff(req, res, next) {
  try {
    const db    = getDB();
    const staff = db.all('users').map(({ password_hash, ...u }) => u);
    res.json(staff);
  } catch (err) { next(err); }
}

function getStaffMember(req, res, next) {
  try {
    const db   = getDB();
    const user = db.findById('users', req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...safe } = user;
    res.json(safe);
  } catch (err) { next(err); }
}

async function createStaff(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { name, email, password, role } = clean;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const validRoles = ['admin', 'manager', 'front_desk', 'store_staff'];
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const db = getDB();
    if (db.findOne('users', u => u.email === email.toLowerCase()))
      return res.status(409).json({ error: 'Email already exists' });

    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    const user = db.insert('users', { name, email: email.toLowerCase(), password_hash: hash, role: role || 'front_desk', is_active: true, last_login: null });

    db.insert('audit_log', { user_id: req.user.id, action: 'staff.created', entity: 'user', entity_id: user.id, note: `Created ${email}`, ip: req.ip });
    logger.info('Staff created', { id: user.id, email, by: req.user.id });
    res.status(201).json({ id: user.id, message: 'Staff account created' });
  } catch (err) { next(err); }
}

function updateStaff(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const id    = parseInt(req.params.id);
    if (id === req.user.id && clean.role && clean.role !== req.user.role)
      return res.status(403).json({ error: 'Cannot change your own role' });

    const db = getDB();
    const changes = {};
    if (clean.name !== undefined) changes.name = clean.name;
    if (clean.role !== undefined) changes.role = clean.role;
    db.updateById('users', id, changes);

    db.insert('audit_log', { user_id: req.user.id, action: 'staff.updated', entity: 'user', entity_id: id, ip: req.ip });
    res.json({ message: 'Staff updated' });
  } catch (err) { next(err); }
}

function toggleStaff(req, res, next) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user.id) return res.status(403).json({ error: 'Cannot deactivate your own account' });

    const db   = getDB();
    const user = db.findById('users', id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    db.updateById('users', id, { is_active: !user.is_active });
    db.insert('audit_log', { user_id: req.user.id, action: user.is_active ? 'staff.deactivated' : 'staff.activated', entity: 'user', entity_id: id, ip: req.ip });

    logger.info(`Staff ${user.is_active ? 'deactivated' : 'activated'}`, { targetId: id, by: req.user.id });
    res.json({ message: `Account ${user.is_active ? 'deactivated' : 'activated'}` });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    // FIX: declare db so audit_log insert doesn't throw ReferenceError
    const db   = getDB();
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
    db.updateById('users', req.params.id, { password_hash: hash });

    db.insert('audit_log', { user_id: req.user.id, action: 'staff.password_reset', entity: 'user', entity_id: req.params.id, ip: req.ip });
    logger.info('Password reset by admin', { targetId: req.params.id, by: req.user.id });
    res.json({ message: 'Password reset successfully' });
  } catch (err) { next(err); }
}

function getAuditLog(req, res, next) {
  try {
    const db   = getDB();
    const logs = db.all('audit_log')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, parseInt(req.query.limit) || 50)
      .map(log => {
        const user = db.findById('users', log.user_id);
        return { ...log, user_name: user?.name || 'System' };
      });
    res.json(logs);
  } catch (err) { next(err); }
}

module.exports = { getStaff, getStaffMember, createStaff, updateStaff, toggleStaff, resetPassword, getAuditLog };
