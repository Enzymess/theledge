/* ============================================================
   THE LEDGE BAGUIO — main.js
   ============================================================ */

/* -----------------------------------------------------------
   1. STATE & CONFIG
------------------------------------------------------------ */
let rooms = [];
let currentUser = null;
let selectedRating = 5;
let homepageImages = {};

/* -----------------------------------------------------------
   2. INITIALIZATION
------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  // Load homepage images
  await loadHomepageImages();

  // Apply homepage images
  applyHomepageImages();

  // Load rooms
  await loadRooms();

  // Populate room selects
  populateRoomSelects();

  // Set default dates
  setDefaultDates();

  // Initialize calendar
  initCalendar();

  // Check auth status
  checkAuth();

  // Setup event listeners
  setupEventListeners();

  // Setup star rating
  setupStarRating();
});

/* -----------------------------------------------------------
   3. HOMEPAGE IMAGES
------------------------------------------------------------ */
async function loadHomepageImages() {
  try {
    homepageImages = await API.get('/api/homepage') || {};
  } catch (e) {
    console.log('Using default images');
    homepageImages = {};
  }
}

function applyHomepageImages() {
  // Hero background
  if (homepageImages.hero) {
    document.getElementById('hero-bg').style.backgroundImage = `url('${homepageImages.hero}')`;
  }

  // Showcase images
  for (let i = 1; i <= 5; i++) {
    const img = homepageImages[`showcase${i}`];
    if (img) {
      document.getElementById(`showcase-img-${i}`).style.backgroundImage = `url('${img}')`;
    }
  }

  // Room images
  if (homepageImages.room1) {
    document.getElementById('room-img-1').style.backgroundImage = `url('${homepageImages.room1}')`;
    document.getElementById('room-img-1').classList.remove('r1');
  }
  if (homepageImages.room2) {
    document.getElementById('room-img-2').style.backgroundImage = `url('${homepageImages.room2}')`;
    document.getElementById('room-img-2').classList.remove('r2');
  }
  if (homepageImages.room3) {
    document.getElementById('room-img-3').style.backgroundImage = `url('${homepageImages.room3}')`;
    document.getElementById('room-img-3').classList.remove('r3');
  }
}

/* -----------------------------------------------------------
   4. ROOMS
------------------------------------------------------------ */
async function loadRooms() {
  try {
    rooms = await API.get('/api/rooms');
  } catch (e) {
    console.error('Failed to load rooms', e);
    rooms = [];
  }
}

function populateRoomSelects() {
  const barRoom = document.getElementById('bar-room');
  const modalRoom = document.getElementById('modal-room');

  if (barRoom) {
    barRoom.innerHTML = '<option value="">Any Room</option>' +
      rooms.map(r => `<option value="${r._id}">${r.name}</option>`).join('');
  }

  if (modalRoom) {
    modalRoom.innerHTML = rooms.map(r =>
      `<option value="${r._id}">${r.name} — PHP ${r.basePrice?.toLocaleString() || '0'} / night</option>`
    ).join('');
  }
}

/* -----------------------------------------------------------
   5. DATES
------------------------------------------------------------ */
function setDefaultDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const formatDate = (d) => d.toISOString().split('T')[0];

  const checkin = document.getElementById('checkin');
  const checkout = document.getElementById('checkout');
  const modalCheckin = document.getElementById('modal-checkin');
  const modalCheckout = document.getElementById('modal-checkout');

  if (checkin) checkin.value = formatDate(today);
  if (checkout) checkout.value = formatDate(tomorrow);
  if (modalCheckin) modalCheckin.value = formatDate(today);
  if (modalCheckout) modalCheckout.value = formatDate(tomorrow);

  // Set min dates
  if (checkin) checkin.min = formatDate(today);
  if (modalCheckin) modalCheckin.min = formatDate(today);
}

/* -----------------------------------------------------------
   6. NAVIGATION
------------------------------------------------------------ */
function toggleMenu() {
  const menu = document.getElementById('mobileMenu');
  const hamburger = document.getElementById('hamburger');
  menu.classList.toggle('open');
  hamburger.classList.toggle('open');
}

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

/* -----------------------------------------------------------
   7. MODAL
------------------------------------------------------------ */
function openModal() {
  const modal = document.getElementById('modal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

function handleBackdropClick(e) {
  if (e.target === e.currentTarget) {
    closeModal();
  }
}

/* -----------------------------------------------------------
   8. BOOKING FORM
------------------------------------------------------------ */
async function submitBooking() {
  const data = {
    first_name:       document.getElementById('modal-firstname').value,
    last_name:        document.getElementById('modal-lastname').value,
    email:            document.getElementById('modal-email').value,
    phone:            document.getElementById('modal-phone').value,
    room_id:          document.getElementById('modal-room').value,
    checkin_date:     document.getElementById('modal-checkin').value,
    checkout_date:    document.getElementById('modal-checkout').value,
    guests_count:     parseInt(document.getElementById('modal-guests').value),
    special_requests: document.getElementById('modal-requests').value,
    promo_code:       document.getElementById('modal-promo').value
  };

  // Validation
  if (!data.first_name || !data.last_name || !data.email || !data.checkin_date || !data.checkout_date) {
    toast('Please fill in all required fields');
    return;
  }

  try {
    const result = await API.post('/api/bookings', data);
    toast('Booking submitted successfully! Check your email for confirmation.');
    closeModal();

    // Clear form
    document.getElementById('modal-firstname').value = '';
    document.getElementById('modal-lastname').value = '';
    document.getElementById('modal-email').value = '';
    document.getElementById('modal-phone').value = '';
    document.getElementById('modal-requests').value = '';
    document.getElementById('modal-promo').value = '';
  } catch (e) {
    toast(e.message || 'Failed to submit booking. Please try again.');
  }
}

async function checkBarAvailability() {
  const checkIn = document.getElementById('checkin').value;
  const checkOut = document.getElementById('checkout').value;
  const guests = document.getElementById('bar-guests').value;
  const roomId = document.getElementById('bar-room').value;

  if (!checkIn || !checkOut) {
    toast('Please select check-in and check-out dates');
    return;
  }

  if (new Date(checkIn) >= new Date(checkOut)) {
    toast('Check-out must be after check-in');
    return;
  }

  // Pre-fill modal
  document.getElementById('modal-checkin').value = checkIn;
  document.getElementById('modal-checkout').value = checkOut;
  document.getElementById('modal-guests').value = guests;
  if (roomId) document.getElementById('modal-room').value = roomId;

  openModal();
}

/* -----------------------------------------------------------
   9. CALENDAR
------------------------------------------------------------ */
let pubCalDate = new Date();
let pubCalSelectionStart = null;
let pubCalSelectionEnd = null;

function initCalendar() {
  renderPubCalendar();
}

function pubCalNav(dir) {
  pubCalDate.setMonth(pubCalDate.getMonth() + dir);
  renderPubCalendar();
}

async function renderPubCalendar() {
  const year = pubCalDate.getFullYear();
  const month = pubCalDate.getMonth();

  document.getElementById('pub-cal-label').textContent = pubCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  try {
    const calData = await API.get(`/api/calendar/month?year=${year}&month=${month + 1}`);

    // FIX: backend returns { days: [{date, status, ...}] } — convert to date-keyed map
    const availability = {};
    (calData.days || []).forEach(d => { availability[d.date] = d.status; });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;

    let html = '';

    // Previous month
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      html += `<div class="avail-cell other-month"><span class="avail-cell-date">${prevMonthDays - i}</span></div>`;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === todayStr;
      const status = availability[dateStr] || 'available';

      html += `
        <div class="avail-cell ${status} ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="onPubCalClick('${dateStr}')">
          <span class="avail-cell-date ${isToday ? 'today' : ''}">${d}</span>
          <span class="avail-cell-dot"></span>
        </div>
      `;
    }

    // Next month
    const remaining = (7 - ((startOffset + daysInMonth) % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      html += `<div class="avail-cell other-month"><span class="avail-cell-date">${d}</span></div>`;
    }

    document.getElementById('pub-cal-grid').innerHTML = html;
    document.getElementById('pub-cal-loading').style.display = 'none';

  } catch (e) {
    document.getElementById('pub-cal-grid').innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:rgba(200,216,204,0.3)">Failed to load calendar</div>';
  }
}

function onPubCalClick(dateStr) {
  if (!pubCalSelectionStart || (pubCalSelectionStart && pubCalSelectionEnd)) {
    pubCalSelectionStart = dateStr;
    pubCalSelectionEnd = null;
  } else if (pubCalSelectionStart && !pubCalSelectionEnd) {
    if (dateStr < pubCalSelectionStart) {
      pubCalSelectionEnd = pubCalSelectionStart;
      pubCalSelectionStart = dateStr;
    } else {
      pubCalSelectionEnd = dateStr;
    }
  }
  highlightPubSelection();
  updateSelectionInfo();
}

function highlightPubSelection() {
  document.querySelectorAll('#pub-cal-grid .avail-cell').forEach(cell => {
    cell.classList.remove('selected', 'in-range', 'range-start', 'range-end');
    const date = cell.dataset.date;
    if (!date) return;

    if (date === pubCalSelectionStart) cell.classList.add('selected', 'range-start');
    if (date === pubCalSelectionEnd) cell.classList.add('selected', 'range-end');
    if (pubCalSelectionStart && pubCalSelectionEnd && date > pubCalSelectionStart && date < pubCalSelectionEnd) {
      cell.classList.add('in-range');
    }
  });
}

function updateSelectionInfo() {
  const selection = document.getElementById('avail-selection');
  const dates = document.getElementById('avail-sel-dates');
  const info = document.getElementById('avail-sel-info');

  if (pubCalSelectionStart && pubCalSelectionEnd) {
    const start = new Date(pubCalSelectionStart);
    const end = new Date(pubCalSelectionEnd);
    const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));

    dates.textContent = `${formatShortDate(start)} - ${formatShortDate(end)}`;
    info.textContent = `${nights} night${nights > 1 ? 's' : ''}`;
    selection.style.display = 'block';
  } else if (pubCalSelectionStart) {
    dates.textContent = formatShortDate(new Date(pubCalSelectionStart));
    info.textContent = 'Select check-out date';
    selection.style.display = 'block';
  } else {
    selection.style.display = 'none';
  }
}

function clearCalSelection() {
  pubCalSelectionStart = null;
  pubCalSelectionEnd = null;
  highlightPubSelection();
  document.getElementById('avail-selection').style.display = 'none';
}

function bookFromCalendar() {
  if (pubCalSelectionStart && pubCalSelectionEnd) {
    document.getElementById('modal-checkin').value = pubCalSelectionStart;
    document.getElementById('modal-checkout').value = pubCalSelectionEnd;
    openModal();
  }
}

/* -----------------------------------------------------------
   10. FEEDBACK SYSTEM
------------------------------------------------------------ */
function setupStarRating() {
  const stars = document.querySelectorAll('#star-rating .star');
  const ratingInput = document.getElementById('feedback-rating');

  stars.forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.rating);
      selectedRating = rating;
      ratingInput.value = rating;
      updateStarDisplay(rating);
    });

    star.addEventListener('mouseenter', () => {
      updateStarDisplay(parseInt(star.dataset.rating));
    });
  });

  document.getElementById('star-rating').addEventListener('mouseleave', () => {
    updateStarDisplay(selectedRating);
  });
}

function updateStarDisplay(rating) {
  const stars = document.querySelectorAll('#star-rating .star');
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active');
      star.innerHTML = '&#9733;';
    } else {
      star.classList.remove('active');
      star.innerHTML = '&#9734;';
    }
  });
}

async function submitFeedback(e) {
  e.preventDefault();

  const data = {
    name: document.getElementById('feedback-name').value,
    email: document.getElementById('feedback-email').value,
    rating: parseInt(document.getElementById('feedback-rating').value),
    message: document.getElementById('feedback-message').value
  };

  if (!data.name || !data.email || !data.message) {
    toast('Please fill in all required fields');
    return;
  }

  try {
    await API.post('/api/feedback', data);
    toast('Thank you for your feedback! It will be reviewed shortly.');

    // Clear form
    document.getElementById('feedback-name').value = '';
    document.getElementById('feedback-email').value = '';
    document.getElementById('feedback-message').value = '';
    selectedRating = 5;
    document.getElementById('feedback-rating').value = '5';
    updateStarDisplay(5);
  } catch (err) {
    toast(err.message || 'Failed to submit feedback. Please try again.');
  }
}

/* -----------------------------------------------------------
   11. AUTH & USER MENU
------------------------------------------------------------ */
function checkAuth() {
  const token = localStorage.getItem('token');
  if (token) {
    // Verify token and get user info
    API.get('/api/me')
      .then(user => {
        currentUser = user;
        showUserMenu(user);
      })
      .catch(() => {
        localStorage.removeItem('token');
        showSigninButton();
      });
  } else {
    showSigninButton();
  }
}

function showUserMenu(user) {
  document.getElementById('nav-signin-btn').style.display = 'none';
  document.getElementById('nav-user-menu').style.display = 'block';
  document.getElementById('nav-username').textContent = user.name || 'Guest';
  document.getElementById('nav-avatar').textContent = (user.name || 'G').charAt(0).toUpperCase();

  if (user.role === 'admin' || user.role === 'manager') {
    document.getElementById('nav-admin-link').style.display = 'block';
  }
}

function showSigninButton() {
  document.getElementById('nav-signin-btn').style.display = 'inline-flex';
  document.getElementById('nav-user-menu').style.display = 'none';
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('nav-dropdown');
  dropdown.classList.toggle('open');
}

function handlePublicSignin(e) {
  e.preventDefault();
  window.location.href = '/login';
}

function signOutPublic() {
  localStorage.removeItem('token');
  currentUser = null;
  showSigninButton();
  toast('Signed out successfully');
}

/* -----------------------------------------------------------
   12. MY BOOKINGS
------------------------------------------------------------ */
function openMyBookings() {
  if (!currentUser) {
    toast('Please sign in to view your bookings');
    return;
  }

  const backdrop = document.getElementById('my-bookings-backdrop');
  const body = document.getElementById('mbp-body');

  document.getElementById('mbp-avatar').textContent = (currentUser.name || 'G').charAt(0).toUpperCase();
  document.getElementById('mbp-name').textContent = currentUser.name || 'Guest';
  document.getElementById('mbp-email').textContent = currentUser.email || '';

  body.innerHTML = '<div class="mbp-empty"><p>Loading...</p></div>';
  backdrop.classList.add('active');

  API.get('/api/bookings/my')
    .then(bookings => {
      if (!bookings.length) {
        body.innerHTML = '<div class="mbp-empty"><p>No bookings found</p><a href="#" onclick="closeMyBookings();openModal();return false">Make your first booking</a></div>';
        return;
      }

      body.innerHTML = bookings.map(b => {
        const payLabel   = b.payment_status === 'paid'    ? '<span class="mbp-label paid">Paid</span>'
                         : b.payment_status === 'partial' ? '<span class="mbp-label partial">Partial</span>'
                         :                                  '<span class="mbp-label pending-pay">Payment Pending</span>';
        const emailLabel = b.email_sent
          ? '<span class="mbp-label emailed">Confirmation Sent</span>'
          : '<span class="mbp-label no-email">Email Pending</span>';

        const canAct = ['pending','confirmed'].includes(b.status);
        const actBtns = canAct ? `
          <div style="display:flex;gap:0.5rem;margin-top:0.8rem;padding-top:0.8rem;border-top:1px solid rgba(58,46,32,0.08)">
            <button onclick="openCancelModal('${esc(b.reference)}')"
              style="flex:1;padding:0.45rem;border:1px solid rgba(192,89,74,0.35);background:transparent;color:rgba(192,89,74,0.8);font-family:'Jost',sans-serif;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer">
              Request Cancellation
            </button>
            <button onclick="openRebookModal('${esc(b.reference)}')"
              style="flex:1;padding:0.45rem;border:1px solid rgba(197,162,85,0.35);background:transparent;color:rgba(197,162,85,0.8);font-family:'Jost',sans-serif;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer">
              Request Rebooking
            </button>
          </div>` : '';

        return `
          <div class="booking-item">
            <div class="booking-item-head">
              <span class="booking-ref">${esc(b.reference || '—')}</span>
              <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">
                <span class="bstatus ${esc(b.status)}">${esc(b.status.replace('_',' '))}</span>
                ${payLabel} ${emailLabel}
              </div>
            </div>
            <div class="booking-item-body">
              <div class="booking-row"><span class="booking-row-label">Room</span><span class="booking-row-val">${esc(b.room_name || '—')}</span></div>
              <div class="booking-row"><span class="booking-row-label">Check In</span><span class="booking-row-val">${formatDate(b.checkin_date)}</span></div>
              <div class="booking-row"><span class="booking-row-label">Check Out</span><span class="booking-row-val">${formatDate(b.checkout_date)}</span></div>
              <div class="booking-row"><span class="booking-row-label">Nights</span><span class="booking-row-val">${b.nights || 0}</span></div>
              <div class="booking-row"><span class="booking-row-label">Total</span><span class="booking-row-val">PHP ${formatMoney(b.total_amount || 0)}</span></div>
            </div>
            ${actBtns}
          </div>`;
      }).join('');
    })
    .catch(() => {
      body.innerHTML = '<div class="mbp-empty"><p>Failed to load bookings</p></div>';
    });
}

function closeMyBookings() {
  document.getElementById('my-bookings-backdrop').classList.remove('active');
  document.getElementById('nav-dropdown').classList.remove('open');
}

/* -----------------------------------------------------------
   13. FAQ
------------------------------------------------------------ */
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const isOpen = answer.classList.contains('open');

  // Close all
  document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('open'));
  document.querySelectorAll('.faq-question').forEach(q => q.classList.remove('open'));
  document.querySelectorAll('.faq-icon').forEach(i => i.textContent = '+');

  if (!isOpen) {
    answer.classList.add('open');
    btn.classList.add('open');
    btn.querySelector('.faq-icon').textContent = '-';
  }
}

/* -----------------------------------------------------------
   14. EVENT LISTENERS
------------------------------------------------------------ */
function setupEventListeners() {
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('nav-dropdown');
    const btn = document.getElementById('nav-user-btn');
    if (dropdown && btn && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Date change listeners for validation
  const checkin = document.getElementById('modal-checkin');
  const checkout = document.getElementById('modal-checkout');

  if (checkin && checkout) {
    checkin.addEventListener('change', () => {
      checkout.min = checkin.value;
      if (checkout.value && checkout.value <= checkin.value) {
        const nextDay = new Date(checkin.value);
        nextDay.setDate(nextDay.getDate() + 1);
        checkout.value = nextDay.toISOString().split('T')[0];
      }
    });
  }
}

/* -----------------------------------------------------------
   15. UTILITIES
------------------------------------------------------------ */
function formatMoney(n) {
  return (n || 0).toLocaleString('en-PH');
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toast(msg) {
  // Create toast if not exists
  let t = document.getElementById('pub-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pub-toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }

  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
/* ── Cancellation Request Modal ── */
function openCancelModal(reference) {
  const refEl = document.getElementById('cr-reference');
  if (refEl && reference) refEl.value = reference;
  document.getElementById('cancel-form-step').style.display    = 'block';
  document.getElementById('cancel-success-step').style.display = 'none';
  const bd = document.getElementById('cancel-request-backdrop');
  if (bd) { bd.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
}

function closeCancelModal() {
  const bd = document.getElementById('cancel-request-backdrop');
  if (bd) bd.style.display = 'none';
  document.body.style.overflow = '';
  ['cr-reference','cr-name','cr-payment','cr-reason'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const dateEl = document.getElementById('cr-date');
  if (dateEl) dateEl.value = '';
}

async function submitCancelRequest() {
  const reference       = (document.getElementById('cr-reference')?.value || '').trim();
  const booking_name    = (document.getElementById('cr-name')?.value     || '').trim();
  const booking_date    = document.getElementById('cr-date')?.value      || '';
  const payment_details = (document.getElementById('cr-payment')?.value  || '').trim();
  const reason          = (document.getElementById('cr-reason')?.value   || '').trim();

  if (!reference || !booking_name || !payment_details) {
    toast('Please fill in your booking reference, name, and refund details'); return;
  }

  const btn = document.querySelector('#cancel-form-step .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    await API.post('/api/bookings/cancel-request', { reference, booking_name, booking_date, payment_details, reason });
    document.getElementById('cancel-form-step').style.display    = 'none';
    document.getElementById('cancel-success-step').style.display = 'block';
  } catch (e) {
    toast(e.message || 'Failed to submit. Please check your reference number and try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Cancellation Request'; }
  }
}

// Rebooking — guest sends a Messenger message to the property
// (actual date change is done by admin in the panel)
function openRebookModal(reference) {
  const msg   = encodeURIComponent('Hi! I would like to rebook my reservation.\n\nBooking Reference: ' + reference + '\n\nPlease advise on available alternative dates. Thank you!');
  const fbUrl = 'https://m.me/TheLedgeBaguio?text=' + msg;
  window.open(fbUrl, '_blank', 'noopener,noreferrer');
}
