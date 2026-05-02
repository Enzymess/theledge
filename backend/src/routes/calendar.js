const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { apiLimiter } = require('../middleware/rateLimiter');
const { getDB }      = require('../config/db');
const { sanitizeObject } = require('../utils/sanitize');
const logger         = require('../utils/logger');

// ── GET /api/calendar/month?year=2026&month=4
// Public — returns day-by-day occupancy for all rooms
router.get('/month', apiLimiter, (req, res) => {
  try {
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const db    = getDB();
    const rooms = db.find('rooms', r => r.is_active);
    const totalRooms = rooms.length;
    if (!totalRooms) return res.json({ year, month, days: [] });

    const daysInMonth = new Date(year, month, 0).getDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

      // Count how many rooms are occupied on this date
      const occupiedRoomIds = new Set();

      // Active bookings
      db.find('bookings', b =>
        ['confirmed','checked_in','pending'].includes(b.status) &&
        b.checkin_date <= dateStr &&
        b.checkout_date > dateStr
      ).forEach(b => occupiedRoomIds.add(b.room_id));

      // Blocked dates
      const isBlocked = db.find('blocked_dates', b =>
        (!b.room_id) && // whole-property block
        b.date_from <= dateStr && b.date_to >= dateStr
      ).length > 0;

      // Per-room blocks
      db.find('blocked_dates', b =>
        b.room_id &&
        b.date_from <= dateStr && b.date_to >= dateStr
      ).forEach(b => occupiedRoomIds.add(b.room_id));

      const occupied = occupiedRoomIds.size;
      const available = isBlocked ? 0 : Math.max(0, totalRooms - occupied);
      const status = isBlocked ? 'blocked'
        : available === 0 ? 'full'
        : available < totalRooms ? 'partial'
        : 'available';

      // Detailed per-room info for admin
      const roomDetails = rooms.map(r => {
        const booking = db.find('bookings', b =>
          b.room_id === r.id &&
          ['confirmed','checked_in','pending'].includes(b.status) &&
          b.checkin_date <= dateStr &&
          b.checkout_date > dateStr
        )[0];
        const blockedEntry = db.find('blocked_dates', b =>
          (b.room_id === r.id || !b.room_id) &&
          b.date_from <= dateStr && b.date_to >= dateStr
        )[0];
        return {
          room_id:   r.id,
          room_name: r.name,
          status:    blockedEntry ? 'blocked' : booking ? booking.status : 'available',
          booking_id:  booking?.id || null,
          reference:   booking?.reference || null,
          guest_name:  booking ? null : null, // resolved client-side if needed
          blocked_reason: blockedEntry?.reason || null,
        };
      });

      days.push({ date: dateStr, day: d, status, available, occupied, total: totalRooms, rooms: roomDetails });
    }

    res.json({ year, month, total_rooms: totalRooms, days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/calendar/blocked — list all blocked dates (admin)
router.get('/blocked', auth, (req, res) => {
  try {
    res.json(getDB().all('blocked_dates').sort((a,b) => a.date_from.localeCompare(b.date_from)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/calendar/blocked — block dates (admin)
router.post('/blocked', auth, roleGuard('admin','manager'), (req, res) => {
  try {
    const clean = sanitizeObject(req.body);
    const { date_from, date_to, room_id, reason } = clean;
    if (!date_from || !date_to) return res.status(400).json({ error: 'date_from and date_to required' });
    if (date_from > date_to) return res.status(400).json({ error: 'date_from must be before date_to' });

    const db     = getDB();
    const entry  = db.insert('blocked_dates', {
      date_from,
      date_to,
      room_id:    room_id ? parseInt(room_id) : null,
      reason:     reason || null,
      created_by: req.user.id,
    });
    logger.info('Dates blocked', { date_from, date_to, room_id, by: req.user.id });
    res.status(201).json({ message: 'Dates blocked', id: entry.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/calendar/blocked/:id — unblock (admin)
router.delete('/blocked/:id', auth, roleGuard('admin','manager'), (req, res) => {
  try {
    getDB().deleteById('blocked_dates', req.params.id);
    logger.info('Block removed', { id: req.params.id, by: req.user.id });
    res.json({ message: 'Block removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
