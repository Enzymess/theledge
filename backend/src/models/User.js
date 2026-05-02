const { getDB }  = require('../config/db');
const bcrypt     = require('bcryptjs');

function findByEmail(email)  { return getDB().findOne('users', u => u.email === email); }
function findById(id)        { return getDB().findById('users', id); }
function getAll()            { return getDB().all('users').map(({ password_hash, ...u }) => u); }
async function create({ name, email, password, role = 'front_desk' }) {
  const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
  return getDB().insert('users', { name, email, password_hash: hash, role, is_active: true, last_login: null });
}
function updateLastLogin(id) { return getDB().updateById('users', id, { last_login: new Date().toISOString() }); }
function setActive(id, v)    { return getDB().updateById('users', id, { is_active: v }); }
function updateRole(id, role){ return getDB().updateById('users', id, { role }); }
module.exports = { findByEmail, findById, getAll, create, updateLastLogin, setActive, updateRole };
