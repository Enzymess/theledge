const { getDB } = require('../config/db');
function findValid(code) {
  const today = new Date().toISOString().split('T')[0];
  return getDB().findOne('promos', p =>
    p.code === code.toUpperCase().trim() && p.is_active &&
    (!p.valid_until || p.valid_until >= today) &&
    (!p.max_uses || p.uses_count < p.max_uses)
  );
}
function incrementUsage(id) {
  const p = getDB().findById('promos', id);
  if (p) getDB().updateById('promos', id, { uses_count: (p.uses_count || 0) + 1 });
}
module.exports = { findValid, incrementUsage };
