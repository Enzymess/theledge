const { getDB } = require('../config/db');
function log({ userId, action, entity, entityId, note, ip }) {
  try { getDB().insert('audit_log', { user_id: userId || null, action, entity: entity || null, entity_id: entityId || null, note: note || null, ip_address: ip || null }); }
  catch (_) {}
}
function getRecent(limit = 50) {
  const db = getDB();
  return db.all('audit_log').sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit)
    .map(l => ({ ...l, user_name: db.findById('users', l.user_id)?.name || 'System' }));
}
module.exports = { log, getRecent };
