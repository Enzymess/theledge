const { getDB } = require('../config/db');
function findAll(activeOnly = true) { return activeOnly ? getDB().find('rooms', r => r.is_active) : getDB().all('rooms'); }
function findById(id)               { return getDB().findById('rooms', id); }
function isAvailable(roomId, checkin, checkout) {
  const conflicts = getDB().find('bookings', b =>
    b.room_id === parseInt(roomId) && b.status !== 'cancelled' &&
    !(checkout <= b.checkin_date || checkin >= b.checkout_date)
  );
  if (conflicts.length > 0) return false;
  const blocked = getDB().find('blocked_dates', b =>
    (!b.room_id || b.room_id === parseInt(roomId)) &&
    !(checkout < b.date_from || checkin > b.date_to)
  );
  return blocked.length === 0;
}
module.exports = { findAll, findById, isAvailable };
