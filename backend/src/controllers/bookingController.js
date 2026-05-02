const { getDB }          = require('../config/db');
const { v4: uuidv4 }     = require('uuid');
const logger             = require('../utils/logger');
const { sanitizeObject, formatDate } = require('../utils/sanitize');
const emailService       = require('../services/emailService');
const pricingService     = require('../services/pricingService');

function getAll(req, res, next) {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const db = getDB();

    let bookings = db.all('bookings');

    // Join room and guest data
    bookings = bookings.map(b => {
      const room  = db.findById('rooms', b.room_id);
      const guest = db.findById('guests', b.guest_id);
      return { ...b, room_name: room?.name, first_name: guest?.first_name, last_name: guest?.last_name, email: guest?.email, phone: guest?.phone };
    });

    if (status) bookings = bookings.filter(b => b.status === status);
    if (search) {
      const s = search.toLowerCase();
      bookings = bookings.filter(b =>
        b.first_name?.toLowerCase().includes(s) ||
        b.last_name?.toLowerCase().includes(s) ||
        b.email?.toLowerCase().includes(s)
      );
    }

    bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total  = bookings.length;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paged  = bookings.slice(offset, offset + parseInt(limit));

    res.json({ data: paged, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

function getOne(req, res, next) {
  try {
    const db      = getDB();
    const booking = db.findById('bookings', req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    const room  = db.findById('rooms', booking.room_id);
    const guest = db.findById('guests', booking.guest_id);
    res.json({ ...booking, room_name: room?.name, first_name: guest?.first_name, last_name: guest?.last_name, email: guest?.email, phone: guest?.phone });
  } catch (err) { next(err); }
}

async function createBooking(req, res, next) {
  try {
    const clean = sanitizeObject(req.body);
    const { first_name, last_name, email, phone, room_id, checkin_date, checkout_date, guests_count, special_requests, promo_code } = clean;

    if (!first_name || !last_name || !email || !room_id || !checkin_date || !checkout_date)
      return res.status(400).json({ error: 'Missing required fields' });

    const checkin  = formatDate(checkin_date);
    const checkout = formatDate(checkout_date);
    if (!checkin || !checkout || checkin >= checkout)
      return res.status(400).json({ error: 'Invalid check-in or check-out dates' });

    const db = getDB();

    // Check room exists and is active
    const room = db.findById('rooms', room_id);
    if (!room || !room.is_active) return res.status(404).json({ error: 'Room not found or unavailable' });

    // Check availability
    const conflict = db.find('bookings', b =>
      b.room_id === parseInt(room_id) &&
      b.status !== 'cancelled' &&
      !(checkout <= b.checkin_date || checkin >= b.checkout_date)
    );
    if (conflict.length > 0) return res.status(409).json({ error: 'Room is not available for the selected dates' });

    // Check blocked dates
    const blocked = db.find('blocked_dates', b =>
      (!b.room_id || b.room_id === parseInt(room_id)) &&
      !(checkout <= b.date_from || checkin >= b.date_to)
    );
    if (blocked.length > 0) return res.status(409).json({ error: 'Selected dates are blocked' });

    // Calculate price
    const { total, nights, breakdown, discount } = await pricingService.calculate({ roomId: parseInt(room_id), checkin, checkout, promoCode: promo_code, db });

    // Upsert guest
    let guest = db.findOne('guests', g => g.email === email);
    if (guest) {
      db.updateById('guests', guest.id, { first_name, last_name, phone: phone || guest.phone });
    } else {
      guest = db.insert('guests', { first_name, last_name, email, phone: phone || null });
    }

    // Create booking
    const reference = 'LDG-' + Date.now().toString(36).toUpperCase();
    const booking   = db.insert('bookings', {
      reference,
      guest_id:        guest.id,
      room_id:         parseInt(room_id),
      checkin_date:    checkin,
      checkout_date:   checkout,
      guests_count:    parseInt(guests_count) || 1,
      nights,
      total_amount:    total,
      discount_amount: discount,
      promo_code:      promo_code || null,
      special_requests: special_requests || null,
      source:          'website',
      status:          'pending',
    });

    emailService.sendBookingConfirmation({ to: email, name: first_name, reference, room: room.name, checkin, checkout, total, breakdown })
      .catch(err => logger.error('Email failed', { err: err.message }));

    logger.info('Booking created', { reference, total });
    res.status(201).json({ message: 'Booking submitted successfully', reference, total });
  } catch (err) { next(err); }
}

function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const db    = getDB();
    const count = db.updateById('bookings', req.params.id, { status });
    if (!count) return res.status(404).json({ error: 'Booking not found' });

    logger.info('Booking status updated', { id: req.params.id, status, by: req.user?.id });
    res.json({ message: 'Status updated' });
  } catch (err) { next(err); }
}

function deleteBooking(req, res, next) {
  try {
    const db = getDB();
    db.updateById('bookings', req.params.id, { status: 'cancelled' });
    logger.info('Booking cancelled', { id: req.params.id, by: req.user?.id });
    res.json({ message: 'Booking cancelled' });
  } catch (err) { next(err); }
}

module.exports = { getBookings: getAll, getBooking: getOne, createBooking, updateStatus, deleteBooking };

// GET /api/bookings/availability?room_id=1&checkin=2025-04-12&checkout=2025-04-14
function checkAvailability(req, res, next) {
  try {
    const { room_id, checkin, checkout } = req.query;
    if (!room_id || !checkin || !checkout) return res.status(400).json({ error: 'room_id, checkin, checkout required' });
    if (checkin >= checkout) return res.status(400).json({ error: 'Checkout must be after checkin' });

    const db = getDB();
    const room = db.findById('rooms', room_id);
    if (!room || !room.is_active) return res.status(404).json({ available: false, error: 'Room not found' });

    const conflict = db.find('bookings', b =>
      b.room_id === parseInt(room_id) &&
      b.status !== 'cancelled' &&
      !(checkout <= b.checkin_date || checkin >= b.checkout_date)
    );
    const blocked = db.find('blocked_dates', b =>
      (!b.room_id || b.room_id === parseInt(room_id)) &&
      !(checkout < b.date_from || checkin > b.date_to)
    );

    res.json({ available: conflict.length === 0 && blocked.length === 0 });
  } catch (err) { next(err); }
}

module.exports.checkAvailability = checkAvailability;

// POST /api/bookings/preview — calculate price before submitting
async function previewPrice(req, res, next) {
  try {
    const { room_id, checkin_date, checkout_date, promo_code } = req.body;
    if (!room_id || !checkin_date || !checkout_date) return res.status(400).json({ error: 'room_id, checkin_date, checkout_date required' });

    const checkin  = formatDate(checkin_date);
    const checkout = formatDate(checkout_date);
    if (!checkin || !checkout || checkin >= checkout) return res.status(400).json({ error: 'Invalid dates' });

    const db = getDB();
    const room = db.findById('rooms', room_id);
    if (!room || !room.is_active) return res.status(404).json({ error: 'Room not found' });

    const { total, nights, subtotal, discount, breakdown } = await pricingService.calculate({
      roomId: parseInt(room_id), checkin, checkout, promoCode: promo_code, db, dryRun: true
    });

    res.json({ room_name: room.name, nights, subtotal, discount, total, breakdown });
  } catch (err) { next(err); }
}

module.exports.previewPrice = previewPrice;

/* ============================================================
   CANCELLATION REQUESTS
   ============================================================ */

async function submitCancelRequest(req, res, next) {
  try {
    const { sanitizeString } = require('../utils/sanitize');
    const { reference, booking_name, booking_date, payment_details, reason } = req.body;
    if (!reference || !booking_name || !payment_details)
      return res.status(400).json({ error: 'Reference, booking name, and payment details are required' });

    const db      = getDB();
    const booking = db.findOne('bookings', b => b.reference === reference.trim().toUpperCase());
    if (!booking)  return res.status(404).json({ error: 'Booking not found. Please check your reference number.' });
    if (booking.status === 'cancelled')   return res.status(400).json({ error: 'This booking is already cancelled.' });
    if (booking.status === 'checked_out') return res.status(400).json({ error: 'This booking has already been completed.' });

    const existing = db.findOne('cancel_requests', r => r.booking_id === booking.id && r.status === 'pending');
    if (existing)  return res.status(400).json({ error: 'A cancellation request for this booking is already pending review.' });

    const request = db.insert('cancel_requests', {
      booking_id:      booking.id,
      reference:       booking.reference,
      booking_name:    sanitizeString(booking_name),
      booking_date:    sanitizeString(booking_date || ''),
      payment_details: sanitizeString(payment_details),
      reason:          sanitizeString(reason || ''),
      status:          'pending',
      refund_amount:   null,
      refund_method:   null,
      admin_note:      null,
    });

    logger.info('Cancel request submitted', { reference: booking.reference, id: request.id });
    res.status(201).json({ id: request.id, message: 'Cancellation request submitted. We will review it and get back to you shortly.' });
  } catch (err) { next(err); }
}

function getCancelRequests(req, res, next) {
  try {
    const { status } = req.query;
    const db = getDB();
    let requests = db.all('cancel_requests');
    if (status) requests = requests.filter(r => r.status === status);

    requests = requests.map(r => {
      const booking = db.findById('bookings', r.booking_id);
      const guest   = booking ? db.findById('guests', booking.guest_id) : null;
      return {
        ...r,
        guest_name:     guest ? `${guest.first_name} ${guest.last_name}` : r.booking_name,
        guest_email:    guest?.email || null,
        guest_phone:    guest?.phone || null,
        checkin_date:   booking?.checkin_date  || null,
        checkout_date:  booking?.checkout_date || null,
        room_id:        booking?.room_id       || null,
        total_amount:   booking?.total_amount  || 0,
        booking_status: booking?.status        || null,
      };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(requests);
  } catch (err) { next(err); }
}

async function approveCancelRequest(req, res, next) {
  try {
    const { refund_amount, refund_method, admin_note } = req.body;
    const db      = getDB();
    const request = db.findById('cancel_requests', req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    const booking = db.findById('bookings', request.booking_id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    db.updateById('bookings', booking.id, { status: 'cancelled' });
    db.updateById('cancel_requests', req.params.id, {
      status:        'approved',
      refund_amount: parseFloat(refund_amount) || 0,
      refund_method: refund_method || null,
      admin_note:    admin_note    || null,
      reviewed_by:   req.user.id,
      reviewed_at:   new Date().toISOString(),
    });

    db.insert('audit_log', {
      user_id: req.user.id, action: 'booking.cancelled_with_refund',
      entity: 'booking', entity_id: booking.id,
      note: `Refund PHP ${refund_amount} via ${refund_method}`, ip: req.ip,
    });

    const guest = db.findById('guests', booking.guest_id);
    if (guest) {
      const room = db.findById('rooms', booking.room_id);
      const emailService = require('../services/emailService');
      emailService.sendCancellationConfirmation({
        to: guest.email, name: guest.first_name,
        reference: booking.reference, room: room?.name || '—',
        checkin: booking.checkin_date, checkout: booking.checkout_date,
        refundAmount: parseFloat(refund_amount) || 0, refundMethod: refund_method || null,
      }).catch(e => logger.error('Cancel email failed', { error: e.message }));
    }

    logger.info('Cancellation approved', { requestId: req.params.id, by: req.user.id });
    res.json({ message: 'Cancellation approved. Booking slot is now open.' });
  } catch (err) { next(err); }
}

function rejectCancelRequest(req, res, next) {
  try {
    const { admin_note } = req.body;
    const db      = getDB();
    const request = db.findById('cancel_requests', req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ error: 'Request already processed' });

    db.updateById('cancel_requests', req.params.id, {
      status: 'rejected', admin_note: admin_note || null,
      reviewed_by: req.user.id, reviewed_at: new Date().toISOString(),
    });

    logger.info('Cancellation rejected', { requestId: req.params.id, by: req.user.id });
    res.json({ message: 'Cancellation request rejected.' });
  } catch (err) { next(err); }
}

/* ============================================================
   REBOOKING
   ============================================================ */

async function rebookBooking(req, res, next) {
  try {
    const { new_checkin, new_checkout, admin_note } = req.body;
    if (!new_checkin || !new_checkout)
      return res.status(400).json({ error: 'new_checkin and new_checkout are required' });
    if (new_checkin >= new_checkout)
      return res.status(400).json({ error: 'Check-out must be after check-in' });

    const db      = getDB();
    const booking = db.findById('bookings', req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    if (['cancelled','checked_out'].includes(booking.status))
      return res.status(400).json({ error: `Cannot rebook a ${booking.status} booking` });

    const conflict = db.find('bookings', b =>
      b.room_id === booking.room_id && b.status !== 'cancelled' && b.id !== booking.id &&
      !(new_checkout <= b.checkin_date || new_checkin >= b.checkout_date)
    );
    if (conflict.length > 0)
      return res.status(409).json({ error: 'Room is not available for the selected new dates' });

    const blocked = db.find('blocked_dates', b =>
      (!b.room_id || b.room_id === booking.room_id) &&
      !(new_checkout <= b.date_from || new_checkin >= b.date_to)
    );
    if (blocked.length > 0)
      return res.status(409).json({ error: 'Selected new dates are blocked' });

    const pricingService = require('../services/pricingService');
    const { total: newTotal, nights: newNights } = await pricingService.calculate({
      roomId: booking.room_id, checkin: new_checkin, checkout: new_checkout,
      promoCode: null, db, dryRun: true,
    });

    const oldTotal     = booking.total_amount || 0;
    const priceDiff    = newTotal - oldTotal;
    const newReference = 'LDG-' + Date.now().toString(36).toUpperCase() + 'R';
    const oldCheckin   = booking.checkin_date;
    const oldCheckout  = booking.checkout_date;

    db.updateById('bookings', booking.id, {
      checkin_date: new_checkin, checkout_date: new_checkout,
      nights: newNights, total_amount: newTotal,
      reference: newReference, status: 'confirmed',
      rebook_note: admin_note || null, rebooked_at: new Date().toISOString(),
      rebooked_by: req.user.id, original_reference: booking.reference,
    });

    db.insert('audit_log', {
      user_id: req.user.id, action: 'booking.rebooked', entity: 'booking', entity_id: booking.id,
      note: `${booking.reference} → ${newReference} | ${oldCheckin}→${oldCheckout} to ${new_checkin}→${new_checkout} | diff PHP ${priceDiff}`,
      ip: req.ip,
    });

    const guest = db.findById('guests', booking.guest_id);
    const room  = db.findById('rooms',  booking.room_id);
    if (guest) {
      const emailService = require('../services/emailService');
      emailService.sendRebookingConfirmation({
        to: guest.email, name: guest.first_name,
        oldReference: booking.reference, newReference,
        room: room?.name || '—',
        oldCheckin, oldCheckout,
        newCheckin: new_checkin, newCheckout: new_checkout,
        priceDiff, newTotal,
      }).catch(e => logger.error('Rebook email failed', { error: e.message }));
    }

    logger.info('Booking rebooked', { oldRef: booking.reference, newRef: newReference, by: req.user.id });
    res.json({ message: 'Booking moved to new dates. Confirmation email sent to guest.', new_reference: newReference, new_total: newTotal, price_diff: priceDiff });
  } catch (err) { next(err); }
}

module.exports.submitCancelRequest  = submitCancelRequest;
module.exports.getCancelRequests    = getCancelRequests;
module.exports.approveCancelRequest = approveCancelRequest;
module.exports.rejectCancelRequest  = rejectCancelRequest;
module.exports.rebookBooking        = rebookBooking;
