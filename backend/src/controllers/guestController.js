const { getDB }          = require('../config/db');
const { sanitizeObject } = require('../utils/sanitize');

function getGuests(req, res, next) {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const db       = getDB();
    let guests     = db.all('guests');
    const bookings = db.all('bookings');

    // Enrich guests with booking stats
    guests = guests.map(g => {
      const gBookings = bookings.filter(b => b.guest_id === g.id && b.status !== 'cancelled');
      return {
        ...g,
        total_stays:  gBookings.length,
        total_spent:  gBookings.reduce((s, b) => s + (b.total_amount || 0), 0),
        last_stay:    gBookings.sort((a, b) => new Date(b.checkin_date) - new Date(a.checkin_date))[0]?.checkin_date || null,
      };
    });

    if (search) {
      const s = search.toLowerCase();
      guests = guests.filter(g =>
        g.first_name?.toLowerCase().includes(s) ||
        g.last_name?.toLowerCase().includes(s) ||
        g.email?.toLowerCase().includes(s)
      );
    }

    guests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const offset = (parseInt(page) - 1) * parseInt(limit);
    res.json(guests.slice(offset, offset + parseInt(limit)));
  } catch (err) { next(err); }
}

function getGuest(req, res, next) {
  try {
    const db    = getDB();
    const guest = db.findById('guests', req.params.id);
    if (!guest) return res.status(404).json({ error: 'Guest not found' });

    const bookings = db.find('bookings', b => b.guest_id === guest.id).map(b => {
      const room = db.findById('rooms', b.room_id);
      return { ...b, room_name: room?.name };
    }).sort((a, b) => new Date(b.checkin_date) - new Date(a.checkin_date));

    res.json({ ...guest, bookings });
  } catch (err) { next(err); }
}

function updateGuest(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const db    = getDB();
    const changes = {};
    if (clean.first_name !== undefined) changes.first_name = clean.first_name;
    if (clean.last_name  !== undefined) changes.last_name  = clean.last_name;
    if (clean.phone      !== undefined) changes.phone      = clean.phone;
    if (clean.notes      !== undefined) changes.notes      = clean.notes;
    db.updateById('guests', req.params.id, changes);
    res.json({ message: 'Guest updated' });
  } catch (err) { next(err); }
}

module.exports = { getGuests, getGuest, updateGuest };
