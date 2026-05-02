const nodemailer = require('nodemailer');
const logger     = require('../utils/logger');
const path       = require('path');
const fs         = require('fs');

function isSMTPConfigured() {
  return !!(process.env.SMTP_USER &&
    process.env.SMTP_USER !== 'your_email@gmail.com' &&
    process.env.SMTP_PASS &&
    process.env.SMTP_PASS !== 'your_gmail_app_password');
}

// FIX: read notification prefs from settings.json
function getNotificationPrefs() {
  try {
    const fp = path.join(__dirname, '../../data/settings.json');
    const s  = JSON.parse(fs.readFileSync(fp, 'utf8'));
    return s.notifications || {};
  } catch { return {}; }
}

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendBookingConfirmation({ to, name, reference, room, checkin, checkout, total, breakdown }) {
  if (!isSMTPConfigured()) { logger.warn('Email skipped — SMTP not configured'); return; }

  // FIX: respect notification preference for guest confirmation emails
  const prefs = getNotificationPrefs();
  if (prefs.guestConfirmation === false) { logger.info('Booking confirmation email suppressed by settings'); return; }

  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3a2e20;">
      <div style="background: #1a2e1a; padding: 2rem; text-align: center;">
        <p style="font-size: 1.6rem; color: #f5f0e8; font-weight: 300; margin: 0;">The <em style="color: #c5a255;">Ledge</em></p>
        <p style="font-size: 0.65rem; letter-spacing: 0.25em; color: rgba(200,216,204,0.5); margin: 0.3rem 0 0; text-transform: uppercase;">Baguio City, Benguet</p>
      </div>
      <div style="padding: 2rem; background: #f5f0e8;">
        <p style="font-size: 1.3rem; font-weight: 300; margin-bottom: 0.5rem;">Dear ${name},</p>
        <p style="font-size: 0.85rem; line-height: 1.8; color: rgba(58,46,32,0.7); margin-bottom: 1.5rem;">
          Thank you for your reservation. We have received your booking request and will confirm it shortly.
        </p>
        <div style="border: 1px solid rgba(58,46,32,0.15); padding: 1.2rem; margin-bottom: 1.5rem;">
          <p style="font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: #c5a255; margin-bottom: 0.8rem;">Booking Details</p>
          <table style="width:100%; font-size:0.82rem; border-collapse:collapse;">
            <tr><td style="padding:0.4rem 0; color:rgba(58,46,32,0.5)">Reference</td><td style="font-weight:600">${reference}</td></tr>
            <tr><td style="padding:0.4rem 0; color:rgba(58,46,32,0.5)">Room</td><td>${room}</td></tr>
            <tr><td style="padding:0.4rem 0; color:rgba(58,46,32,0.5)">Check In</td><td>${checkin}</td></tr>
            <tr><td style="padding:0.4rem 0; color:rgba(58,46,32,0.5)">Check Out</td><td>${checkout}</td></tr>
            <tr><td style="padding:0.4rem 0; color:rgba(58,46,32,0.5)">Total</td><td style="font-weight:600; color:#1a2e1a">PHP ${total.toLocaleString()}</td></tr>
          </table>
        </div>
        <p style="font-size: 0.8rem; line-height: 1.8; color: rgba(58,46,32,0.6);">
          To confirm your reservation, please send your downpayment via GCash, Maya, or bank transfer and message us your proof of payment on
          <a href="https://www.facebook.com/TheLedgeBaguio" style="color:#1a2e1a">Facebook</a> or
          <a href="https://www.instagram.com/theledgebaguio__/" style="color:#1a2e1a">Instagram</a>.
        </p>
      </div>
      <div style="background:#1a2e1a; padding:1rem 2rem; text-align:center;">
        <p style="font-size:0.65rem; color:rgba(200,216,204,0.35); letter-spacing:0.08em;">
          &copy; ${new Date().getFullYear()} The Ledge Baguio. Baguio City, Benguet, Philippines 2600
        </p>
      </div>
    </div>`;

  await createTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `Booking Request Received — ${reference} | The Ledge Baguio`,
    html,
  });
  logger.info('Confirmation email sent', { to, reference });
}

async function sendReminder({ to, name, reference, checkin }) {
  if (!isSMTPConfigured()) return;

  // FIX: respect notification preference for 24h reminders
  const prefs = getNotificationPrefs();
  if (prefs.reminder24h === false) { logger.info('Reminder email suppressed by settings'); return; }

  await createTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `Your stay is tomorrow — ${reference} | The Ledge Baguio`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3a2e20;">
        <div style="background: #1a2e1a; padding: 2rem; text-align: center;">
          <p style="font-size: 1.6rem; color: #f5f0e8; font-weight: 300; margin: 0;">The <em style="color:#c5a255">Ledge</em></p>
        </div>
        <div style="padding: 2rem; background: #f5f0e8;">
          <p style="font-size: 1.1rem;">Hi ${name},</p>
          <p style="font-size: 0.85rem; line-height: 1.8; color: rgba(58,46,32,0.7);">
            Just a reminder that your stay at The Ledge Baguio begins tomorrow, <strong>${checkin}</strong>.<br><br>
            Standard check-in is at <strong>2:00 PM</strong>. Please message us if you need early check-in arrangements.
          </p>
          <p style="font-size: 0.8rem; color: rgba(58,46,32,0.5);">Booking reference: ${reference}</p>
        </div>
      </div>`,
  });
  logger.info('Reminder email sent', { to, reference });
}

// FIX: weekly summary email — new function
async function sendWeeklySummary({ adminEmails, totalBookings, totalRevenue, pendingCount, topRoom }) {
  if (!isSMTPConfigured()) return;

  const prefs = getNotificationPrefs();
  if (prefs.weeklySummary === false) { logger.info('Weekly summary suppressed by settings'); return; }

  const to = Array.isArray(adminEmails) ? adminEmails.join(',') : adminEmails;
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    + ' – ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  await createTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: `Weekly Summary — The Ledge Baguio (${weekLabel})`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #3a2e20;">
        <div style="background: #1a2e1a; padding: 2rem; text-align: center;">
          <p style="font-size: 1.6rem; color: #f5f0e8; font-weight: 300; margin: 0;">The <em style="color:#c5a255">Ledge</em></p>
          <p style="font-size: 0.65rem; letter-spacing: 0.2em; color: rgba(200,216,204,0.4); margin-top: 0.3rem; text-transform: uppercase;">Weekly Summary</p>
        </div>
        <div style="padding: 2rem; background: #f5f0e8;">
          <p style="font-size: 0.7rem; letter-spacing: 0.15em; text-transform: uppercase; color: rgba(58,46,32,0.45); margin-bottom: 1.2rem;">${weekLabel}</p>
          <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
            <tr style="border-bottom:1px solid rgba(58,46,32,0.1)"><td style="padding:0.6rem 0;color:rgba(58,46,32,0.5)">New Bookings</td><td style="font-weight:600">${totalBookings}</td></tr>
            <tr style="border-bottom:1px solid rgba(58,46,32,0.1)"><td style="padding:0.6rem 0;color:rgba(58,46,32,0.5)">Revenue</td><td style="font-weight:600;color:#1a2e1a">PHP ${(totalRevenue || 0).toLocaleString()}</td></tr>
            <tr style="border-bottom:1px solid rgba(58,46,32,0.1)"><td style="padding:0.6rem 0;color:rgba(58,46,32,0.5)">Pending Bookings</td><td style="font-weight:600;color:#c5a255">${pendingCount}</td></tr>
            <tr><td style="padding:0.6rem 0;color:rgba(58,46,32,0.5)">Top Room</td><td>${topRoom || '—'}</td></tr>
          </table>
          <p style="margin-top:1.5rem;font-size:0.8rem;color:rgba(58,46,32,0.55);">Log in to your admin panel for full details.</p>
        </div>
        <div style="background:#1a2e1a;padding:1rem 2rem;text-align:center;">
          <p style="font-size:0.65rem;color:rgba(200,216,204,0.35);">&copy; ${new Date().getFullYear()} The Ledge Baguio</p>
        </div>
      </div>`,
  });
  logger.info('Weekly summary sent', { to });
}

// see bottom for exports

async function sendCancellationConfirmation({ to, name, reference, room, checkin, checkout, refundAmount, refundMethod }) {
  if (!isSMTPConfigured()) { logger.warn('Email skipped — SMTP not configured'); return; }
  const prefs = getNotificationPrefs();
  if (prefs.guestConfirmation === false) return;

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM, to,
    subject: `Booking Cancelled — ${reference} | The Ledge Baguio`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#3a2e20">
      <div style="background:#1a2e1a;padding:2rem;text-align:center">
        <p style="font-size:1.6rem;color:#f5f0e8;font-weight:300;margin:0">The <em style="color:#c5a255">Ledge</em></p>
        <p style="font-size:0.65rem;letter-spacing:0.25em;color:rgba(200,216,204,0.5);margin:0.3rem 0 0;text-transform:uppercase">Baguio City, Benguet</p>
      </div>
      <div style="padding:2rem;background:#f5f0e8">
        <p style="font-size:1.3rem;font-weight:300;margin-bottom:0.5rem">Dear ${name},</p>
        <p style="font-size:0.85rem;line-height:1.8;color:rgba(58,46,32,0.7);margin-bottom:1.5rem">Your reservation has been cancelled as requested. We hope to welcome you to The Ledge Baguio in the future.</p>
        <div style="border:1px solid rgba(58,46,32,0.15);padding:1.2rem;margin-bottom:1.5rem">
          <p style="font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;color:#c5a255;margin-bottom:0.8rem">Cancellation Details</p>
          <table style="width:100%;font-size:0.82rem;border-collapse:collapse">
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Reference</td><td style="font-weight:600">${reference}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Room</td><td>${room}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Check-In</td><td>${checkin}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Check-Out</td><td>${checkout}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Refund Amount</td><td style="font-weight:600;color:#1a2e1a">PHP ${(refundAmount||0).toLocaleString()}</td></tr>
            ${refundMethod ? `<tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Refund Via</td><td>${refundMethod}</td></tr>` : ''}
          </table>
        </div>
        <p style="font-size:0.8rem;line-height:1.8;color:rgba(58,46,32,0.6)">Questions? Message us on <a href="https://www.facebook.com/TheLedgeBaguio" style="color:#1a2e1a">Facebook</a> or <a href="https://www.instagram.com/theledgebaguio__/" style="color:#1a2e1a">Instagram</a>.</p>
      </div>
      <div style="background:#1a2e1a;padding:1rem 2rem;text-align:center">
        <p style="font-size:0.65rem;color:rgba(200,216,204,0.35)">&copy; ${new Date().getFullYear()} The Ledge Baguio</p>
      </div>
    </div>`,
  });
  logger.info('Cancellation email sent', { to, reference });
}

async function sendRebookingConfirmation({ to, name, oldReference, newReference, room, oldCheckin, oldCheckout, newCheckin, newCheckout, priceDiff, newTotal }) {
  if (!isSMTPConfigured()) { logger.warn('Email skipped — SMTP not configured'); return; }
  const prefs = getNotificationPrefs();
  if (prefs.guestConfirmation === false) return;

  const diffLine = priceDiff > 0
    ? `<tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Additional Payment</td><td style="font-weight:600;color:#c5a255">PHP ${priceDiff.toLocaleString()}</td></tr>`
    : priceDiff < 0
    ? `<tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Refund Due</td><td style="font-weight:600;color:#3d8b6a">PHP ${Math.abs(priceDiff).toLocaleString()}</td></tr>`
    : '';

  await createTransporter().sendMail({
    from: process.env.EMAIL_FROM, to,
    subject: `Booking Moved to New Dates — ${newReference} | The Ledge Baguio`,
    html: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#3a2e20">
      <div style="background:#1a2e1a;padding:2rem;text-align:center">
        <p style="font-size:1.6rem;color:#f5f0e8;font-weight:300;margin:0">The <em style="color:#c5a255">Ledge</em></p>
      </div>
      <div style="padding:2rem;background:#f5f0e8">
        <p style="font-size:1.3rem;font-weight:300;margin-bottom:0.5rem">Dear ${name},</p>
        <p style="font-size:0.85rem;line-height:1.8;color:rgba(58,46,32,0.7);margin-bottom:1.5rem">Your reservation has been moved to new dates. Here are the updated details.</p>
        <div style="border:1px solid rgba(58,46,32,0.15);padding:1.2rem;margin-bottom:1.5rem">
          <p style="font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;color:#c5a255;margin-bottom:0.8rem">Updated Booking</p>
          <table style="width:100%;font-size:0.82rem;border-collapse:collapse">
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">New Reference</td><td style="font-weight:600">${newReference}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Room</td><td>${room}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">New Check-In</td><td style="font-weight:600;color:#1a2e1a">${newCheckin}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">New Check-Out</td><td style="font-weight:600;color:#1a2e1a">${newCheckout}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">Previous Dates</td><td style="color:rgba(58,46,32,0.5)">${oldCheckin} to ${oldCheckout}</td></tr>
            <tr><td style="padding:0.4rem 0;color:rgba(58,46,32,0.5)">New Total</td><td style="font-weight:600;color:#1a2e1a">PHP ${(newTotal||0).toLocaleString()}</td></tr>
            ${diffLine}
          </table>
        </div>
        <p style="font-size:0.8rem;line-height:1.8;color:rgba(58,46,32,0.6)">
          ${priceDiff > 0 ? 'Please send the additional payment via GCash, Maya, or bank transfer and message us your proof of payment. ' : ''}
          Questions? Message us on <a href="https://www.facebook.com/TheLedgeBaguio" style="color:#1a2e1a">Facebook</a> or <a href="https://www.instagram.com/theledgebaguio__/" style="color:#1a2e1a">Instagram</a>.
        </p>
      </div>
      <div style="background:#1a2e1a;padding:1rem 2rem;text-align:center">
        <p style="font-size:0.65rem;color:rgba(200,216,204,0.35)">&copy; ${new Date().getFullYear()} The Ledge Baguio</p>
      </div>
    </div>`,
  });
  logger.info('Rebooking email sent', { to, oldReference, newReference });
}

module.exports = { sendBookingConfirmation, sendReminder, sendWeeklySummary, sendCancellationConfirmation, sendRebookingConfirmation };
