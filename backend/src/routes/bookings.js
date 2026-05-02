const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const roleGuard = require('../middleware/roleGuard');
const { apiLimiter } = require('../middleware/rateLimiter');
const { getDB }  = require('../config/db');
const {
  getBookings, getBooking, createBooking, updateStatus, deleteBooking,
  checkAvailability, previewPrice,
  submitCancelRequest, getCancelRequests, approveCancelRequest, rejectCancelRequest,
  rebookBooking,
} = require('../controllers/bookingController');

// ── Public ────────────────────────────────────────
router.post('/',                    apiLimiter, createBooking);
router.get('/availability',         apiLimiter, checkAvailability);
router.post('/preview',             apiLimiter, previewPrice);
router.post('/cancel-request',      apiLimiter, submitCancelRequest);

// ── Guest: view own bookings ──────────────────────
router.get('/my', auth, roleGuard('guest','admin','manager','front_desk'), (req, res) => {
  try {
    const db    = getDB();
    const guest = db.findOne('guests', g => g.email === req.user.email);
    if (!guest) return res.json([]);
    const bookings = db.find('bookings', b => b.guest_id === guest.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(b => {
        const room = db.findById('rooms', b.room_id);
        return { ...b, room_name: room?.name, room_image: room?.images?.[0] || null };
      });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: 'Failed to load bookings' }); }
});

// ── Admin/staff ───────────────────────────────────
router.get('/',                                   auth, getBookings);
router.get('/cancel-requests',                    auth, roleGuard('admin','manager'), getCancelRequests);
router.get('/:id',                                auth, getBooking);
router.patch('/:id/status',                       auth, roleGuard('admin','manager','front_desk'), updateStatus);
router.patch('/:id/rebook',                       auth, roleGuard('admin','manager'), rebookBooking);
router.delete('/:id',                             auth, roleGuard('admin','manager'), deleteBooking);
router.patch('/cancel-requests/:id/approve',      auth, roleGuard('admin','manager'), approveCancelRequest);
router.patch('/cancel-requests/:id/reject',       auth, roleGuard('admin','manager'), rejectCancelRequest);

module.exports = router;
