const { getDB } = require('../config/db');
function findById(id)          { return getDB().findById('bookings', id); }
function findByReference(ref)  { return getDB().findOne('bookings', b => b.reference === ref); }
function checkAvailability(roomId, checkin, checkout, excludeId = null) {
  const conflicts = getDB().find('bookings', b =>
    b.room_id === parseInt(roomId) &&
    b.status !== 'cancelled' &&
    b.id !== excludeId &&
    !(checkout <= b.checkin_date || checkin >= b.checkout_date)
  );
  return conflicts.length === 0;
}
function getUpcomingCheckins(daysAhead = 1) {
  const target = new Date();
  target.setDate(target.getDate() + daysAhead);
  const dateStr = target.toISOString().split('T')[0];
  const db = getDB();
  return db.find('bookings', b => b.checkin_date === dateStr && b.status === 'confirmed').map(b => {
    const guest = db.findById('guests', b.guest_id);
    const room  = db.findById('rooms', b.room_id);
    return { ...b, first_name: guest?.first_name, last_name: guest?.last_name, email: guest?.email, room_name: room?.name };
  });
}
module.exports = { findById, findByReference, checkAvailability, getUpcomingCheckins };
