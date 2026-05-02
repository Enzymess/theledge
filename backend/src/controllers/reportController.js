const { getDB } = require('../config/db');

function getSummary(req, res, next) {
  try {
    const year     = parseInt(req.query.year) || new Date().getFullYear();
    const db       = getDB();
    const bookings = db.find('bookings', b => b.status !== 'cancelled' && new Date(b.checkin_date).getFullYear() === year);

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mb    = bookings.filter(b => new Date(b.checkin_date).getMonth() + 1 === month);
      return { month, bookings: mb.length, revenue: mb.reduce((s, b) => s + (b.total_amount || 0), 0) };
    });

    const all  = db.all('bookings').filter(b => new Date(b.checkin_date).getFullYear() === year);
    const totals = {
      total_bookings:     all.length,
      total_revenue:      bookings.reduce((s, b) => s + (b.total_amount || 0), 0),
      avg_booking_value:  bookings.length ? bookings.reduce((s, b) => s + (b.total_amount || 0), 0) / bookings.length : 0,
      cancellations:      all.filter(b => b.status === 'cancelled').length,
    };

    res.json({ monthly, totals });
  } catch (err) { next(err); }
}

function getOccupancy(req, res, next) {
  try {
    const db    = getDB();
    const rooms = db.all('rooms');
    const bookings = db.find('bookings', b => b.status !== 'cancelled');

    const data = rooms.map(r => {
      const rb = bookings.filter(b => b.room_id === r.id);
      return {
        room_name:    r.name,
        bookings:     rb.length,
        revenue:      rb.reduce((s, b) => s + (b.total_amount || 0), 0),
        booked_nights: rb.reduce((s, b) => s + (b.nights || 0), 0),
      };
    });

    res.json(data);
  } catch (err) { next(err); }
}

function getBookingSources(req, res, next) {
  try {
    const db       = getDB();
    const bookings = db.find('bookings', b => b.status !== 'cancelled');
    const sources  = {};

    bookings.forEach(b => {
      const src = b.source || 'website';
      if (!sources[src]) sources[src] = { source: src, count: 0, revenue: 0 };
      sources[src].count++;
      sources[src].revenue += b.total_amount || 0;
    });

    res.json(Object.values(sources));
  } catch (err) { next(err); }
}

module.exports = { getSummary, getOccupancy, getBookingSources };
