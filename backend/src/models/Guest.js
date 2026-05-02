const { getDB } = require('../config/db');
function findByEmail(email) { return getDB().findOne('guests', g => g.email === email); }
function findById(id)       { return getDB().findById('guests', id); }
function upsert({ first_name, last_name, email, phone }) {
  const db = getDB();
  const existing = findByEmail(email);
  if (existing) { db.updateById('guests', existing.id, { first_name, last_name, phone: phone || existing.phone }); return existing.id; }
  return db.insert('guests', { first_name, last_name, email, phone: phone || null }).id;
}
module.exports = { findByEmail, findById, upsert };
