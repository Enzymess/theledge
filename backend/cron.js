// ================================================================
// THE LEDGE BAGUIO — cron.js (fixed: adds weekly summary)
// Run daily at 9AM:  node cron.js
// ================================================================

require('dotenv').config();
const { connectDB, getDB } = require('./src/config/db');
const emailService         = require('./src/services/emailService');
const { getAdminEmails }   = require('./src/config/env');
const BookingModel         = require('./src/models/Booking');
const logger               = require('./src/utils/logger');

async function runDailyJobs() {
  await connectDB();
  logger.info('Cron started');

  const today = new Date();
  const isMonday = today.getDay() === 1; // send weekly summary every Monday

  await Promise.allSettled([
    sendCheckinReminders(),
    autoExpireOldPending(),
    ...(isMonday ? [sendWeeklySummary()] : []),
  ]);

  logger.info('Cron finished');
  process.exit(0);
}

async function sendCheckinReminders() {
  try {
    const bookings = BookingModel.getUpcomingCheckins(1);
    logger.info(`Reminders: ${bookings.length} check-ins tomorrow`);
    for (const b of bookings) {
      try {
        await emailService.sendReminder({
          to: b.email, name: b.first_name, reference: b.reference, checkin: b.checkin_date,
        });
        logger.info('Reminder sent', { reference: b.reference });
      } catch (err) {
        logger.error('Reminder failed', { reference: b.reference, error: err.message });
      }
    }
  } catch (err) { logger.error('sendCheckinReminders failed', { error: err.message }); }
}

async function autoExpireOldPending() {
  try {
    const db     = getDB();
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const count  = db.update('bookings',
      b => b.status === 'pending' && b.created_at < cutoff,
      { status: 'cancelled' }
    );
    if (count > 0) {
      logger.info(`Auto-expired ${count} stale pending bookings`);
      db.insert('audit_log', {
        user_id: null, action: 'booking.auto_expired',
        note: `${count} bookings expired`, ip: 'cron',
      });
    }
  } catch (err) { logger.error('autoExpireOldPending failed', { error: err.message }); }
}

// FIX: weekly summary email sent every Monday
async function sendWeeklySummary() {
  try {
    const db        = getDB();
    const weekAgo   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const bookings  = db.all('bookings');

    const thisWeek  = bookings.filter(b => b.created_at >= weekAgo && b.status !== 'cancelled');
    const pending   = bookings.filter(b => b.status === 'pending');
    const revenue   = thisWeek.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Find top room by bookings this week
    const roomCounts = {};
    thisWeek.forEach(b => { roomCounts[b.room_id] = (roomCounts[b.room_id] || 0) + 1; });
    const topRoomId = Object.keys(roomCounts).sort((a, b) => roomCounts[b] - roomCounts[a])[0];
    const topRoom   = topRoomId ? db.findById('rooms', topRoomId)?.name : null;

    const adminEmails = getAdminEmails();
    if (!adminEmails.length) return;

    await emailService.sendWeeklySummary({
      adminEmails,
      totalBookings: thisWeek.length,
      totalRevenue:  revenue,
      pendingCount:  pending.length,
      topRoom,
    });
    logger.info('Weekly summary sent');
  } catch (err) { logger.error('sendWeeklySummary failed', { error: err.message }); }
}

runDailyJobs().catch(err => { logger.error('Cron crashed', { error: err.message }); process.exit(1); });
