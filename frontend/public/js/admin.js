/* ============================================================
   THE LEDGE BAGUIO — admin.js
   ============================================================ */

/* -----------------------------------------------------------
   1. STATE & CONFIG
------------------------------------------------------------ */
let currentPage = 'dashboard';
let currentUser = null;
let rooms = [];
let bookings = [];
let guests = [];
let feedbackList = [];
let blockedDates = [];
let seasons = [];
let promos = [];
let staff = [];
let auditLog = [];
let homepageImages = {};
let currentGuestFilter = 'all';
let currentFeedbackFilter = 'all';
let currentSchedFilter = 'all';
let currentSchedListFilter = 'all';

// Calendar state
let calView = 'month';
let calDate = new Date();
let calSelectionStart = null;
let calSelectionEnd = null;

// Charts
let revenueChart = null;
let statusChart = null;
let reportChart = null;

/* -----------------------------------------------------------
   2. AUTH & INITIALIZATION
------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  const token = localStorage.getItem('ledge_token');
  if (!token) {
    window.location.href = '/login';
    return;
  }

  try {
    const me = await API.get('/api/auth/me');
    currentUser = me;
    document.querySelector('.admin-name').textContent = me.name || 'Admin';
    document.querySelector('.admin-role').textContent = me.role || 'Admin';
    document.getElementById('av').textContent = (me.name || 'A').charAt(0).toUpperCase();
  } catch (e) {
    localStorage.removeItem('ledge_token');
    window.location.href = '/login';
    return;
  }

  // Load initial data
  await loadRooms();
  await loadBookings();
  await loadGuests();
  await loadBlockedDates();
  await loadSeasons();
  await loadPromos();
  await loadStaff();
  await loadAuditLog();
  await loadFeedback();
  await loadHomepageImages();

  // Init dashboard
  loadDashboard();
  initCalendar();

  // Setup file upload
  document.getElementById('file-upload').addEventListener('change', handleFileUpload);

  // Set default dates for block modal
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('bl-from').value = today;
  document.getElementById('bl-to').value = today;
});

function logout() {
  localStorage.removeItem('ledge_token');
  window.location.href = '/login';
}

/* -----------------------------------------------------------
   3. PAGE NAVIGATION
------------------------------------------------------------ */
function showPage(page, el) {
  currentPage = page;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');

  // Update topbar title
  const titles = {
    dashboard:    'Dashboard <em>Overview</em>',
    schedule:     'Schedule <em>& Calendar</em>',
    reservations: 'Reservations <em>Management</em>',
    rooms:        'Room <em>Settings</em>',
    pricing:      'Pricing <em>& Rates</em>',
    policies:     'Policies <em>& Rules</em>',
    images:       'Homepage <em>Images</em>',
    reports:      'Reports <em>& Analytics</em>',
    guests:       'Guest <em>Directory</em>',
    feedback:     'Guest <em>Feedback</em>',
    staff:        'Staff <em>& Access</em>',
    settings:     'System <em>Settings</em>',
    cancellations: 'Cancellation <em>Requests</em>',
    store:        'Honesty Store <em>Overview</em>',
  };
  document.getElementById('topbar-title').innerHTML = titles[page] || page;

  // Show page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  // Refresh data
  if (page === 'dashboard') loadDashboard();
  if (page === 'schedule') refreshCalendar();
  if (page === 'reservations') loadReservations();
  if (page === 'cancellations') loadCancellations();
  if (page === 'rooms') renderRoomsManager();
  if (page === 'pricing') loadPricing();
  if (page === 'images') renderImagesManager();
  if (page === 'reports') loadReports();
  if (page === 'guests') loadGuests();
  if (page === 'feedback') loadFeedback();
  if (page === 'staff') loadStaff();
  if (page === 'store') loadAdminStore();
}

/* -----------------------------------------------------------
   4. DASHBOARD
------------------------------------------------------------ */
async function loadDashboard() {
  const year = document.getElementById('chart-year').value || new Date().getFullYear();

  try {
    // BUG 3 FIX: /api/admin/stats doesn't exist — compose from existing endpoints
    const summary = await API.get('/api/reports/summary?year=' + year);

    const totals   = summary.totals || {};
    const monthly  = summary.monthly || [];

    // Metrics
    document.getElementById('m-revenue').innerHTML  = '<span>PHP</span>' + formatMoney(totals.total_revenue || 0);
    document.getElementById('m-bookings').textContent = totals.total_bookings || 0;
    document.getElementById('m-confirmed').textContent = bookings.filter(b => b.status === 'confirmed').length;
    document.getElementById('m-pending').textContent   = bookings.filter(b => b.status === 'pending').length;

    // Upcoming stays (next 7 days) — derive from already-loaded bookings array
    const today     = new Date().toISOString().split('T')[0];
    const in7days   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const upcoming  = bookings.filter(b =>
      ['confirmed', 'pending'].includes(b.status) &&
      b.checkin_date >= today && b.checkin_date <= in7days
    );
    renderUpcomingStays(upcoming);

    // Charts
    const monthlyRevenue = Array.from({ length: 12 }, (_, i) => {
      const m = monthly.find(x => x.month === i + 1);
      return m ? m.revenue : 0;
    });
    renderRevenueChart(monthlyRevenue);

    const statusCounts = {};
    bookings.forEach(b => { statusCounts[b.status] = (statusCounts[b.status] || 0) + 1; });
    renderStatusChart(statusCounts);

  } catch (e) {
    console.error('Failed to load dashboard', e);
    toast('Failed to load dashboard data');
  }
}

function renderUpcomingStays(upcoming) {
  const tbody = document.getElementById('upcoming-body');
  if (!upcoming.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No upcoming stays</td></tr>';
    return;
  }

  // BUG 8 FIX: backend returns flat snake_case fields, not nested guest/room objects
  tbody.innerHTML = upcoming.map(b => `
    <tr>
      <td>${b.first_name ? b.first_name + ' ' + b.last_name : '—'}</td>
      <td>${b.room_name || '—'}</td>
      <td>${formatDate(b.checkin_date)}</td>
      <td>${formatDate(b.checkout_date)}</td>
      <td>${b.nights || 0}</td>
      <td>PHP ${formatMoney(b.total_amount || 0)}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td><button class="action-btn" onclick="openBookingModal(${b.id})">View</button></td>
    </tr>
  `).join('');
}

function renderRevenueChart(data) {
  const ctx = document.getElementById('revenue-chart');
  if (!ctx) return;

  if (revenueChart) revenueChart.destroy();

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      datasets: [{
        label: 'Revenue',
        data: data,
        backgroundColor: 'rgba(197,162,85,0.25)',
        borderColor: 'rgba(197,162,85,0.5)',
        borderWidth: 1,
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(200,216,204,0.3)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(200,216,204,0.05)' }, ticks: { color: 'rgba(200,216,204,0.3)', font: { size: 10 } } }
      }
    }
  });
}

function renderStatusChart(counts) {
  const ctx = document.getElementById('status-chart');
  if (!ctx) return;

  if (statusChart) statusChart.destroy();

  const labels = ['Confirmed','Pending','Checked In','Checked Out','Cancelled'];
  const data = [
    counts.confirmed || 0,
    counts.pending || 0,
    counts.checked_in || 0,
    counts.checked_out || 0,
    counts.cancelled || 0
  ];
  const colors = ['#4caf80','#c5a255','#5a8fc5','#6b7b6b','#c0594a'];

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { display: false } }
    }
  });

  // Legend
  document.getElementById('donut-legend').innerHTML = labels.map((l, i) => `
    <div class="donut-legend-item">
      <span class="donut-dot" style="background:${colors[i]}"></span>
      ${l}: ${data[i]}
    </div>
  `).join('');
}

/* -----------------------------------------------------------
   5. CALENDAR & SCHEDULE
------------------------------------------------------------ */
function initCalendar() {
  refreshCalendar();
}

function switchCalView(view, btn) {
  calView = view;
  document.querySelectorAll('#cal-view-month, #cal-view-week').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.getElementById('cal-monthly-wrap').style.display = view === 'month' ? 'block' : 'none';
  document.getElementById('cal-weekly-wrap').style.display = view === 'week' ? 'block' : 'none';
  document.getElementById('room-occ-card').style.display = view === 'month' ? 'block' : 'none';

  refreshCalendar();
}

function calNav(dir) {
  if (calView === 'month') {
    calDate.setMonth(calDate.getMonth() + dir);
  } else {
    calDate.setDate(calDate.getDate() + (dir * 7));
  }
  refreshCalendar();
}

function goToday() {
  calDate = new Date();
  refreshCalendar();
}

function refreshCalendar() {
  if (calView === 'month') renderMonthlyCalendar();
  else renderWeeklySchedule();
}

function renderMonthlyCalendar() {
  const year = calDate.getFullYear();
  const month = calDate.getMonth();

  document.getElementById('cal-month-header').textContent = formatMonthYear(calDate);
  document.getElementById('cal-nav-label').textContent = formatMonthYear(calDate);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  let html = `
    <div class="cal-day-head">Mon</div><div class="cal-day-head">Tue</div>
    <div class="cal-day-head">Wed</div><div class="cal-day-head">Thu</div>
    <div class="cal-day-head">Fri</div><div class="cal-day-head">Sat</div>
    <div class="cal-day-head">Sun</div>
  `;

  // Previous month
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    html += `<div class="cal-m-cell other-month"><div class="cal-m-date">${prevMonthDays - i}</div></div>`;
  }

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const status = getDateStatus(dateStr);
    const dayBookings = bookings.filter(b => b.checkin_date <= dateStr && b.checkout_date > dateStr);

    html += `
      <div class="cal-m-cell ${status} ${isToday ? 'today' : ''}" data-date="${dateStr}" onclick="onCalCellClick('${dateStr}')">
        <div class="cal-m-date ${isToday ? 'today-num' : ''}">${d}</div>
        <span class="cal-m-status ${status}">${status.replace('status-', '')}</span>
        <div class="cal-m-rooms">
          ${dayBookings.slice(0, 3).map(b => `<div class="cal-m-room-dot" style="background:${getStatusColor(b.status)}"></div>`).join('')}
        </div>
      </div>
    `;
  }

  // Next month
  const remaining = (7 - ((startOffset + daysInMonth) % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="cal-m-cell other-month"><div class="cal-m-date">${d}</div></div>`;
  }

  document.getElementById('cal-monthly-grid').innerHTML = html;
  renderRoomOccupancy(year, month);
  renderSchedList();
}

function renderWeeklySchedule() {
  const startOfWeek = new Date(calDate);
  startOfWeek.setDate(calDate.getDate() - ((calDate.getDay() + 6) % 7));

  let html = '';
  const dayNames = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

  dayNames.forEach((day, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayBookings = bookings.filter(b => {
      if (currentSchedFilter !== 'all' && b.status !== currentSchedFilter) return false;
      return b.checkin_date <= dateStr && b.checkout_date > dateStr;
    });

    html += `<div class="sch-head">${day}<br><span style="font-size:0.5rem;opacity:0.6">${date.getDate()}</span></div>`;

    let cellHtml = `<div class="sch-cell" data-date="${dateStr}" onclick="onCalCellClick('${dateStr}')">`;
    cellHtml += `<div class="sch-date ${isToday(date) ? 'today' : ''}">${date.getDate()}</div>`;

    dayBookings.slice(0, 4).forEach(b => {
      cellHtml += `<div class="sch-booking ${b.status}" onclick="event.stopPropagation();openBookingModal(${b.id})">${b.first_name || 'Guest'}</div>`;
    });

    if (dayBookings.length > 4) {
      cellHtml += `<div class="sch-more">+${dayBookings.length - 4} more</div>`;
    }

    cellHtml += '</div>';
    html += cellHtml;
  });

  document.getElementById('sched-grid').innerHTML = html;
  document.getElementById('cal-nav-label').textContent = formatDateRange(startOfWeek, new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000));
}

function renderRoomOccupancy(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const rows = rooms.map(r => {
    let occupiedDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isBooked = bookings.some(b =>
        b.room_id === r.id &&
        b.status !== 'cancelled' &&
        b.checkin_date <= dateStr && b.checkout_date > dateStr
      );
      if (isBooked) occupiedDays++;
    }
    const pct = Math.round((occupiedDays / daysInMonth) * 100);
    const color = pct > 80 ? '#c0594a' : pct > 50 ? '#c5a255' : '#4caf80';

    return `
      <div class="room-occ-row">
        <div class="room-occ-label">${r.name}</div>
        <div class="room-occ-bar-wrap">
          <div class="room-occ-bar" style="width:${pct}%;background:${color}"></div>
        </div>
        <div class="room-occ-pct">${pct}%</div>
      </div>
    `;
  }).join('');

  document.getElementById('room-occ-rows').innerHTML = rows || '<p style="font-size:0.7rem;color:rgba(200,216,204,0.3)">No rooms configured</p>';
}

function renderSchedList() {
  let filtered = bookings;
  if (currentSchedListFilter !== 'all') {
    filtered = bookings.filter(b => b.status === currentSchedListFilter);
  }

  filtered = filtered.slice(0, 50);

  const tbody = document.getElementById('sched-list');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No bookings</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>${b.reference || '—'}</td>
      <td>${b.first_name ? b.first_name + ' ' + b.last_name : '—'}</td>
      <td>${b.room_name || '—'}</td>
      <td>${formatDate(b.checkin_date)}</td>
      <td>${formatDate(b.checkout_date)}</td>
      <td>${b.nights || 0}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td><button class="action-btn" onclick="openBookingModal(${b.id})">View</button></td>
    </tr>
  `).join('');
}

function setSchedFilter(filter, btn) {
  currentSchedFilter = filter;
  document.querySelectorAll('.schedule-filters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  refreshCalendar();
}

function setSchedListFilter(filter, btn) {
  currentSchedListFilter = filter;
  document.querySelectorAll('#slist-filter-all, #slist-filter-all ~ .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderSchedList();
}

function onCalCellClick(dateStr) {
  if (!calSelectionStart || (calSelectionStart && calSelectionEnd)) {
    calSelectionStart = dateStr;
    calSelectionEnd = null;
  } else if (calSelectionStart && !calSelectionEnd) {
    if (dateStr < calSelectionStart) {
      calSelectionEnd = calSelectionStart;
      calSelectionStart = dateStr;
    } else {
      calSelectionEnd = dateStr;
    }
  }
  refreshCalendar();
  highlightSelection();
}

function highlightSelection() {
  document.querySelectorAll('.cal-m-cell').forEach(cell => {
    cell.classList.remove('selected', 'in-range', 'range-start', 'range-end');
    const date = cell.dataset.date;
    if (!date) return;

    if (date === calSelectionStart) cell.classList.add('selected', 'range-start');
    if (date === calSelectionEnd) cell.classList.add('selected', 'range-end');
    if (calSelectionStart && calSelectionEnd && date > calSelectionStart && date < calSelectionEnd) {
      cell.classList.add('in-range');
    }
  });
}

function getDateStatus(dateStr) {
  const isBlocked = blockedDates.some(b => b.date_from <= dateStr && b.date_to >= dateStr);
  if (isBlocked) return 'status-blocked';

  const dayBookings = bookings.filter(b =>
    b.status !== 'cancelled' &&
    b.checkin_date <= dateStr && b.checkout_date > dateStr
  );

  const bookedRooms = new Set(dayBookings.map(b => b.room_id)).size;
  if (bookedRooms >= rooms.length) return 'status-full';
  if (bookedRooms > 0) return 'status-partial';
  return 'status-available';
}

function getStatusColor(status) {
  const colors = {
    confirmed: '#4caf80',
    pending: '#c5a255',
    checked_in: '#5a8fc5',
    checked_out: '#6b7b6b',
    cancelled: '#c0594a'
  };
  return colors[status] || '#888';
}

function isToday(date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/* -----------------------------------------------------------
   6. BLOCKED DATES
------------------------------------------------------------ */
function openBlockModal() {
  const roomSelect = document.getElementById('bl-room');
  roomSelect.innerHTML = '<option value="">All Rooms</option>' +
    rooms.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  openModal('block-modal');
}

async function doBlockDates() {
  const from = document.getElementById('bl-from').value;
  const to = document.getElementById('bl-to').value;
  const roomId = document.getElementById('bl-room').value;
  const reason = document.getElementById('bl-reason').value;

  if (!from || !to) {
    toast('Please select date range');
    return;
  }

  try {
    await API.post('/api/calendar/blocked', { date_from: from, date_to: to, room_id: roomId || null, reason });
    toast('Dates blocked successfully');
    closeModal('block-modal');
    await loadBlockedDates();
    refreshCalendar();
  } catch (e) {
    toast(e.message || 'Failed to block dates');
  }
}

async function unblockDate(id) {
  if (!confirm('Remove this block?')) return;
  try {
    await API.delete('/api/calendar/blocked/' + id);
    toast('Block removed');
    await loadBlockedDates();
    refreshCalendar();
  } catch (e) {
    toast('Failed to remove block');
  }
}

function renderBlockedDates() {
  const tbody = document.getElementById('blocked-list');
  if (!blockedDates.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No blocked dates</td></tr>';
    return;
  }

  tbody.innerHTML = blockedDates.map(b => `
    <tr>
      <td>${formatDate(b.date_from)}</td>
      <td>${formatDate(b.date_to)}</td>
      <td>${b.room_id ? (rooms.find(r => r.id === b.room_id)?.name || b.room_id) : "All Rooms"}</td>
      <td>${b.reason || '—'}</td>
      <td><button class="action-btn" onclick="unblockDate(${b.id})">Remove</button></td>
    </tr>
  `).join('');
}

/* -----------------------------------------------------------
   7. RESERVATIONS
------------------------------------------------------------ */
async function loadReservations() {
  const search = document.getElementById('res-search').value;
  const status = document.getElementById('res-status').value;

  try {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);

    const data = await API.get('/api/bookings?' + params.toString());
    bookings = data;
    renderReservations();
  } catch (e) {
    toast('Failed to load reservations');
  }
}

function renderReservations() {
  const tbody = document.getElementById('reservations-body');
  if (!bookings.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No reservations found</td></tr>';
    return;
  }

  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td>${b.reference || '—'}</td>
      <td>${b.first_name ? b.first_name + ' ' + b.last_name : '—'}</td>
      <td>${b.room_name || '—'}</td>
      <td>${formatDate(b.checkin_date)}</td>
      <td>${formatDate(b.checkout_date)}</td>
      <td>${b.guests_count || 1}</td>
      <td>PHP ${formatMoney(b.total_amount || 0)}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td><button class="action-btn" onclick="openBookingModal(${b.id})">View</button></td>
    </tr>
  `).join('');
}

function openBookingModal(id) {
  const b = bookings.find(x => x.id == id);
  if (!b) return;

  document.getElementById('bm-ref').textContent = b.reference || '—';
  document.getElementById('bm-body').innerHTML = `
    <div class="detail-row"><span class="detail-label">Guest</span><span class="detail-value">${b.first_name ? b.first_name + ' ' + b.last_name : '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${b.email || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Phone</span><span class="detail-value">${b.phone || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Room</span><span class="detail-value">${b.room_name || '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Check In</span><span class="detail-value">${formatDate(b.checkin_date)}</span></div>
    <div class="detail-row"><span class="detail-label">Check Out</span><span class="detail-value">${formatDate(b.checkout_date)}</span></div>
    <div class="detail-row"><span class="detail-label">Nights</span><span class="detail-value">${b.nights || 0}</span></div>
    <div class="detail-row"><span class="detail-label">Guests</span><span class="detail-value">${b.guests_count || 1}</span></div>
    <div class="detail-row"><span class="detail-label">Subtotal</span><span class="detail-value">PHP ${formatMoney(b.total_amount || 0)}</span></div>
    <div class="detail-row"><span class="detail-label">Discount</span><span class="detail-value">${b.discount_amount ? '-PHP ' + formatMoney(b.discount_amount) : '—'}</span></div>
    <div class="detail-row"><span class="detail-label">Total</span><span class="detail-value">PHP ${formatMoney(b.total_amount || 0)}</span></div>
    <div class="detail-row"><span class="detail-label">Source</span><span class="detail-value">${b.source || 'website'}</span></div>
    <div class="detail-row"><span class="detail-label">Created</span><span class="detail-value">${formatDateTime(b.created_at)}</span></div>
  `;

  const statusSelect = document.getElementById('bm-status');
  statusSelect.innerHTML = `
    <option value="pending" ${b.status === 'pending' ? 'selected' : ''}>Pending</option>
    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
    <option value="checked_in" ${b.status === 'checked_in' ? 'selected' : ''}>Checked In</option>
    <option value="checked_out" ${b.status === 'checked_out' ? 'selected' : ''}>Checked Out</option>
    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
  `;
  statusSelect.dataset.bookingId = b.id;
  currentRebookId = b.id; // wire rebook panel

  openModal('booking-modal');
}

async function saveStatus() {
  const select = document.getElementById('bm-status');
  const id = select.dataset.bookingId;
  const status = select.value;

  try {
    await API.patch('/api/bookings/' + id + '/status', { status });
    toast('Status updated');
    closeModal('booking-modal');
    await loadBookings();
    loadDashboard();
    refreshCalendar();
    loadReservations();
  } catch (e) {
    toast('Failed to update status');
  }
}

function openManualReservationModal() {
  const roomSelect = document.getElementById('mr-room');
  roomSelect.innerHTML = rooms.map(r => `<option value="${r.id}">${r.name} - PHP ${r.base_price}/night</option>`).join('');

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('mr-checkin').value = today;
  document.getElementById('mr-checkout').value = today;

  openModal('manual-res-modal');
}

async function submitManualReservation() {
  const data = {
    first_name:       document.getElementById('mr-firstname').value,
    last_name:        document.getElementById('mr-lastname').value,
    email:            document.getElementById('mr-email').value,
    phone:            document.getElementById('mr-phone').value,
    room_id:          document.getElementById('mr-room').value,
    checkin_date:     document.getElementById('mr-checkin').value,
    checkout_date:    document.getElementById('mr-checkout').value,
    guests_count:     parseInt(document.getElementById('mr-guests').value),
    source:           document.getElementById('mr-source').value,
    special_requests: document.getElementById('mr-special').value,
    promo_code:       document.getElementById('mr-promo').value
  };

  if (!data.first_name || !data.last_name || !data.email || !data.room_id || !data.checkin_date || !data.checkout_date) {
    toast('Please fill in all required fields');
    return;
  }

  try {
    await API.post('/api/bookings', data);
    toast('Reservation created successfully');
    closeModal('manual-res-modal');
    await loadBookings();
    loadDashboard();
    refreshCalendar();
    loadReservations();
  } catch (e) {
    toast(e.message || 'Failed to create reservation');
  }
}

function exportCSV() {
  if (!bookings.length) {
    toast('No data to export');
    return;
  }

  const headers = ['Reference','Guest','Email','Phone','Room','Check In','Check Out','Nights','Guests','Subtotal','Discount','Total','Status','Source','Created'];
  const rows = bookings.map(b => [
    b.reference || '',
    b.first_name ? b.first_name + ' ' + b.last_name : '',
    b.email || '',
    b.phone || '',
    b.room_name || '',
    b.checkin_date || '',
    b.checkout_date || '',
    b.nights || 0,
    b.guests_count || 1,
    b.total_amount || 0,
    b.discount_amount || 0,
    b.total_amount || 0,
    b.status || '',
    b.source || '',
    b.created_at || ''
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservations_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -----------------------------------------------------------
   8. ROOMS
------------------------------------------------------------ */
async function loadRooms() {
  try {
    rooms = await API.get('/api/rooms');
  } catch (e) {
    console.error('Failed to load rooms', e);
    rooms = [];
  }
}

function renderRoomsManager() {
  const container = document.getElementById('rooms-manager');
  if (!rooms.length) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:rgba(200,216,204,0.28)">No rooms configured</div>';
    return;
  }

  container.innerHTML = rooms.map(r => `
    <div class="room-card-edit" data-id="${r.id}">
      <div class="room-photo-area">
        ${r.images?.[0] ? `<img src="${r.images[0]}" alt="${r.name}">` : `
          <div class="room-photo-placeholder">
            <span>+</span>
            <p>Add Photo</p>
          </div>
        `}
        <div class="photo-overlay">
          <button class="photo-btn" onclick="triggerPhotoUpload('${r.id}')">Upload</button>
          <button class="photo-btn" onclick="setHeroPhoto('${r.id}')">Set Hero</button>
        </div>
      </div>
      <div class="photo-thumbs">
        ${(r.images || []).slice(0, 4).map((p, i) => `
          <div class="photo-thumb ${i === 0 ? 'active-thumb' : ''}">
            <img src="${p}" onclick="setActivePhoto('${r.id}', ${i})">
            <button class="photo-thumb-del" onclick="deletePhoto('${r.id}', ${i})">x</button>
          </div>
        `).join('')}
        <button class="photo-add-btn" onclick="triggerPhotoUpload('${r.id}')">+</button>
      </div>
      <div class="room-fields">
        <div class="room-field-row">
          <div class="form-group">
            <label class="form-label">Room Name</label>
            <input class="mini-input" value="${r.name}" onchange="updateRoomField('${r.id}', 'name', this.value)">
          </div>
          <div class="form-group">
            <label class="form-label">Base Price</label>
            <input class="mini-input" type="number" value="${r.base_price}" onchange="updateRoomField('${r.id}', 'base_price', this.value)">
          </div>
        </div>
        <div class="room-field-row">
          <div class="form-group">
            <label class="form-label">Weekday Price</label>
            <input class="mini-input" type="number" value="${r.weekday_price || r.base_price}" onchange="updateRoomField('${r.id}', 'weekday_price', this.value)">
          </div>
          <div class="form-group">
            <label class="form-label">Weekend Price</label>
            <input class="mini-input" type="number" value="${r.weekend_price || r.base_price}" onchange="updateRoomField('${r.id}', 'weekend_price', this.value)">
          </div>
        </div>
        <div class="room-field-row">
          <div class="form-group">
            <label class="form-label">Max Occupancy</label>
            <input class="mini-input" type="number" value="${r.max_occupancy || 2}" onchange="updateRoomField('${r.id}', 'max_occupancy', this.value)">
          </div>
          <div class="form-group">
            <label class="form-label">Bed Type</label>
            <input class="mini-input" value="${r.bed_type || 'Queen Bed'}" onchange="updateRoomField('${r.id}', 'bed_type', this.value)">
          </div>
        </div>
        <div class="room-field-full">
          <label class="form-label">Description</label>
          <textarea class="mini-input" rows="2" onchange="updateRoomField('${r.id}', 'description', this.value)">${r.description || ''}</textarea>
        </div>
        <div class="room-field-full">
          <label class="form-label">Amenities</label>
          <div class="amenity-tags" id="amenities-${r.id}">
            ${(r.amenities || []).map(a => `
              <span class="amenity-tag">${a} <button onclick="removeAmenity('${r.id}', '${a}')">x</button></span>
            `).join('')}
          </div>
          <div class="amenity-add-row">
            <input class="mini-input" placeholder="Add amenity..." id="amenity-input-${r.id}" onkeypress="if(event.key==='Enter')addAmenity('${r.id}')">
            <button class="action-btn" onclick="addAmenity('${r.id}')">Add</button>
          </div>
        </div>
      </div>
      <div class="room-footer">
        <div class="status-toggle-wrap">
          <span>Active</span>
          <button class="toggle ${r.is_active !== false ? 'on' : ''}" onclick="toggleRoomActive('${r.id}', this)"></button>
        </div>
        <div class="room-actions">
          <button class="action-btn" onclick="saveRoom('${r.id}')">Save</button>
          <button class="action-btn" onclick="deleteRoom('${r.id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('') + `
    <div class="room-card-add" onclick="openRoomModal()">
      <span>+</span>
      <p>Add New Room</p>
    </div>
  `;
}

function openRoomModal() {
  document.getElementById('rm-modal-title').textContent = 'Add Room';
  document.getElementById('rm-id').value = '';
  document.getElementById('rm-name').value = '';
  document.getElementById('rm-price').value = '';
  document.getElementById('rm-occ').value = '';
  document.getElementById('rm-weekday').value = '';
  document.getElementById('rm-weekend').value = '';
  document.getElementById('rm-bed').value = '';
  document.getElementById('rm-desc').value = '';
  openModal('room-modal');
}

function editRoom(id) {
  const r = rooms.find(x => x.id == id);
  if (!r) return;

  document.getElementById('rm-modal-title').textContent = 'Edit Room';
  document.getElementById('rm-id').value = id;
  document.getElementById('rm-name').value = r.name;
  document.getElementById('rm-price').value = r.base_price;
  document.getElementById('rm-occ').value = r.max_occupancy;
  document.getElementById('rm-weekday').value = r.weekday_price || r.base_price;
  document.getElementById('rm-weekend').value = r.weekend_price || r.base_price;
  document.getElementById('rm-bed').value = r.bed_type || '';
  document.getElementById('rm-desc').value = r.description || '';
  openModal('room-modal');
}

async function saveRoomModal() {
  const id = document.getElementById('rm-id').value;
  const data = {
    name: document.getElementById('rm-name').value,
    base_price:    parseInt(document.getElementById('rm-price').value) || 0,
    max_occupancy: parseInt(document.getElementById('rm-occ').value) || 2,
    weekday_price: parseInt(document.getElementById('rm-weekday').value) || parseInt(document.getElementById('rm-price').value) || 0,
    weekend_price: parseInt(document.getElementById('rm-weekend').value) || parseInt(document.getElementById('rm-price').value) || 0,
    bed_type:      document.getElementById('rm-bed').value,
    description: document.getElementById('rm-desc').value
  };

  try {
    if (id) {
      await API.patch('/api/rooms/' + id, data);
      toast('Room updated');
    } else {
      await API.post('/api/rooms', data);
      toast('Room created');
    }
    closeModal('room-modal');
    await loadRooms();
    renderRoomsManager();
  } catch (e) {
    toast('Failed to save room');
  }
}

async function updateRoomField(id, field, value) {
  const room = rooms.find(r => r.id === id);
  if (room) {
    room[field] = value;
  }
}

async function saveRoom(id) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;

  try {
    await API.patch('/api/rooms/' + id, room);
    toast('Room saved');
  } catch (e) {
    toast('Failed to save room');
  }
}

async function deleteRoom(id) {
  if (!confirm('Delete this room? This cannot be undone.')) return;
  try {
    await API.delete('/api/rooms/' + id);
    toast('Room deleted');
    await loadRooms();
    renderRoomsManager();
  } catch (e) {
    toast('Failed to delete room');
  }
}

async function toggleRoomActive(id, btn) {
  const room = rooms.find(r => r.id === id);
  if (!room) return;

  room.is_active = !room.is_active;
  btn.classList.toggle('on');

  try {
    await API.patch('/api/rooms/' + id, { is_active: room.is_active });
  } catch (e) {
    toast('Failed to update room');
    room.is_active = !room.is_active;
    btn.classList.toggle('on');
  }
}

function addAmenity(roomId) {
  const input = document.getElementById('amenity-input-' + roomId);
  const value = input.value.trim();
  if (!value) return;

  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  if (!room.amenities) room.amenities = [];
  if (!room.amenities.includes(value)) {
    room.amenities.push(value);
    renderAmenities(roomId);
  }
  input.value = '';
}

function removeAmenity(roomId, amenity) {
  const room = rooms.find(r => r.id === roomId);
  if (!room || !room.amenities) return;

  room.amenities = room.amenities.filter(a => a !== amenity);
  renderAmenities(roomId);
}

function renderAmenities(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;

  const container = document.getElementById('amenities-' + roomId);
  container.innerHTML = (room.amenities || []).map(a => `
    <span class="amenity-tag">${a} <button onclick="removeAmenity('${roomId}', '${a}')">x</button></span>
  `).join('');
}

let uploadTargetRoom = null;
function triggerPhotoUpload(roomId) {
  uploadTargetRoom = roomId;
  document.getElementById('file-upload').click();
}

async function handleFileUpload(e) {
  const files = e.target.files;
  if (!files.length || !uploadTargetRoom) return;

  const formData = new FormData();
  for (const file of files) {
    formData.append('photos', file);
  }

  try {
    const result = await API.upload('/api/rooms/' + uploadTargetRoom + '/photos', formData);
    toast('Photos uploaded');
    await loadRooms();
    renderRoomsManager();
  } catch (err) {
    toast('Upload failed');
  }

  uploadTargetRoom = null;
  e.target.value = '';
}

async function deletePhoto(roomId, index) {
  try {
    await API.delete('/api/rooms/' + roomId + '/photos/' + index);
    toast('Photo deleted');
    await loadRooms();
    renderRoomsManager();
  } catch (e) {
    toast('Failed to delete photo');
  }
}

function setActivePhoto(roomId, index) {
  const room = rooms.find(r => r.id === roomId);
  if (!room || !room.photos) return;

  const photos = [...room.photos];
  const [active] = photos.splice(index, 1);
  photos.unshift(active);
  room.photos = photos;

  renderRoomsManager();
}

async function setHeroPhoto(roomId) {
  toast('Hero photo set');
}

/* -----------------------------------------------------------
   9. PRICING
------------------------------------------------------------ */
async function loadPricing() {
  renderRates();
  renderSeasons();
  renderPromos();
}

function renderRates() {
  const tbody = document.getElementById('rates-body');
  tbody.innerHTML = rooms.map(r => `
    <tr>
      <td>${r.name}</td>
      <td><input class="mini-input" type="number" value="${r.weekday_price || r.base_price}" onchange="updateRoomPrice('${r.id}', 'weekday_price', this.value)"></td>
      <td><input class="mini-input" type="number" value="${r.weekend_price || r.base_price}" onchange="updateRoomPrice('${r.id}', 'weekend_price', this.value)"></td>
    </tr>
  `).join('');
}

async function updateRoomPrice(id, field, value) {
  const room = rooms.find(r => r.id === id);
  if (room) {
    room[field] = parseInt(value) || 0;
  }
}

async function saveRates() {
  try {
    for (const room of rooms) {
      await API.patch('/api/rooms/' + room.id, {
        weekday_price: room.weekday_price,
        weekend_price: room.weekend_price
      });
    }
    toast('Rates saved');
  } catch (e) {
    toast('Failed to save rates');
  }
}

async function loadSeasons() {
  try {
    seasons = await API.get('/api/pricing/seasons');
    renderSeasons();
  } catch (e) {
    seasons = [];
  }
}

function renderSeasons() {
  const tbody = document.getElementById('seasons-body');
  if (!seasons.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.28)">No seasonal pricing</td></tr>';
    return;
  }

  tbody.innerHTML = seasons.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${formatDate(s.start_date)} - ${formatDate(s.end_date)}</td>
      <td>+${s.modifier_percent}%</td>
      <td><button class="action-btn" onclick="deleteSeason(${s.id})">Remove</button></td>
    </tr>
  `).join('');
}

async function addSeason() {
  const data = {
    name: document.getElementById('s-name').value,
    modifier_percent: parseInt(document.getElementById('s-mod').value) || 0,
    start_date: document.getElementById('s-start').value,
    end_date: document.getElementById('s-end').value
  };

  if (!data.name || !data.start_date || !data.end_date) {
    toast('Please fill in all fields');
    return;
  }

  try {
    await API.post('/api/pricing/seasons', data);
    toast('Season added');
    toggleEl('add-season-form');
    await loadSeasons();
  } catch (e) {
    toast('Failed to add season');
  }
}

async function deleteSeason(id) {
  if (!confirm('Remove this seasonal pricing?')) return;
  try {
    await API.delete('/api/pricing/seasons/' + id);
    toast('Season removed');
    await loadSeasons();
  } catch (e) {
    toast('Failed to remove season');
  }
}

async function loadPromos() {
  try {
    promos = await API.get('/api/pricing/promos');
    renderPromos();
  } catch (e) {
    promos = [];
  }
}

function renderPromos() {
  const tbody = document.getElementById('promos-body');
  if (!promos.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.28)">No promo codes</td></tr>';
    return;
  }

  tbody.innerHTML = promos.map(p => {
    // BUG 12 FIX: backend returns valid_until, uses_count, max_uses, discount_type, discount_value
    const isExpired  = p.valid_until && new Date(p.valid_until) < new Date();
    const uses       = p.uses_count || 0;
    const maxUses    = p.max_uses;
    const isDepleted = maxUses && uses >= maxUses;

    return `
      <tr>
        <td><strong>${p.code}</strong></td>
        <td>${p.discount_type === 'percent' ? p.discount_value + '%' : 'PHP ' + p.discount_value}</td>
        <td>${p.valid_until ? formatDate(p.valid_until) : 'No expiry'}</td>
        <td>${uses}${maxUses ? '/' + maxUses : ''}</td>
        <td><span class="badge badge-${isExpired || isDepleted ? 'cancelled' : 'confirmed'}">${isExpired ? 'Expired' : isDepleted ? 'Depleted' : 'Active'}</span></td>
        <td><button class="action-btn" onclick="deletePromo(${p.id})">Delete</button></td>
      </tr>
    `;
  }).join('');
}

async function addPromo() {
  const data = {
    code: document.getElementById('p-code').value.toUpperCase(),
    discount_type:  document.getElementById('p-type').value,
    discount_value: parseInt(document.getElementById('p-val').value) || 0,
    valid_until:    document.getElementById('p-until').value || null,
    max_uses:       parseInt(document.getElementById('p-uses').value) || null
  };

  if (!data.code || !data.value) {
    toast('Please fill in code and value');
    return;
  }

  try {
    await API.post('/api/pricing/promos', data);
    toast('Promo code created');
    toggleEl('add-promo-form');
    await loadPromos();
  } catch (e) {
    toast('Failed to create promo');
  }
}

async function deletePromo(id) {
  if (!confirm('Delete this promo code?')) return;
  try {
    await API.delete('/api/pricing/promos/' + id);
    toast('Promo deleted');
    await loadPromos();
  } catch (e) {
    toast('Failed to delete promo');
  }
}

/* -----------------------------------------------------------
   10. POLICIES
------------------------------------------------------------ */
async function savePolicies() {
  const data = {
    cancellation: {
      freeHours: parseInt(document.getElementById('pol-cancel-hours').value) || 72,
      feeType: document.getElementById('pol-cancel-fee').value,
      note: document.getElementById('pol-cancel-note').value
    },
    checkInOut: {
      checkInTime: document.getElementById('pol-checkin-time').value,
      checkOutTime: document.getElementById('pol-checkout-time').value,
      earlyCheckIn: document.getElementById('pol-early-ci').value
    },
    houseRules: {
      smoking: document.getElementById('pol-smoking').value,
      pets: document.getElementById('pol-pets').value,
      quietHours: document.getElementById('pol-quiet').value,
      additionalRules: document.getElementById('pol-rules').value
    },
    payment: {
      depositRequired: document.getElementById('pol-deposit').value,
      note: document.getElementById('pol-pay-note').value
    }
  };

  try {
    await API.put('/api/settings/policies', data);
    toast('Policies saved');
  } catch (e) {
    toast('Failed to save policies');
  }
}

/* -----------------------------------------------------------
   11. HOMEPAGE IMAGES
------------------------------------------------------------ */
async function loadHomepageImages() {
  try {
    homepageImages = await API.get('/api/homepage/admin') || {};
  } catch (e) {
    homepageImages = {};
  }
}

function renderImagesManager() {
  const container = document.getElementById('images-manager');

  const images = [
    { key: 'hero', label: 'Hero Background', description: 'Main hero section background image' },
    { key: 'showcase1', label: 'Showcase Image 1', description: 'Large showcase image (left)' },
    { key: 'showcase2', label: 'Showcase Image 2', description: 'Showcase image (top right)' },
    { key: 'showcase3', label: 'Showcase Image 3', description: 'Showcase image (middle right)' },
    { key: 'showcase4', label: 'Showcase Image 4', description: 'Showcase image (bottom left)' },
    { key: 'showcase5', label: 'Showcase Image 5', description: 'Showcase image (bottom right)' },
    { key: 'room1', label: 'Mist Room Image', description: 'The Mist Room photo' },
    { key: 'room2', label: 'Pine Suite Image', description: 'The Pine Suite photo' },
    { key: 'room3', label: 'Ledge Suite Image', description: 'The Ledge Suite photo' }
  ];

  container.innerHTML = images.map(img => `
    <div class="image-card">
      <div class="image-card-header">
        <span class="image-card-title">${img.label}</span>
      </div>
      <div class="image-preview" id="preview-${img.key}" style="background-image: url('${homepageImages[img.key] || ''}')"></div>
      <div class="image-card-body">
        <p style="font-size:0.65rem;color:rgba(200,216,204,0.4);margin-bottom:0.8rem">${img.description}</p>
        <div class="form-group">
          <label>Image URL</label>
          <input type="text" id="img-url-${img.key}" value="${homepageImages[img.key] || ''}" placeholder="/photos/image.jpg" onchange="updateImagePreview('${img.key}')">
        </div>
        <div class="form-group">
          <label>Or Upload</label>
          <button class="action-btn" onclick="uploadHomepageImage('${img.key}')">Choose File</button>
        </div>
      </div>
    </div>
  `).join('');
}

function updateImagePreview(key) {
  const url = document.getElementById('img-url-' + key).value;
  document.getElementById('preview-' + key).style.backgroundImage = url ? `url('${url}')` : '';
  homepageImages[key] = url;
}

async function uploadHomepageImage(key) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const result = await API.upload('/api/homepage/' + key, formData);
      document.getElementById('img-url-' + key).value = result.url;
      document.getElementById('preview-' + key).style.backgroundImage = `url('${result.url}')`;
      homepageImages[key] = result.url;
      toast('Image uploaded');
    } catch (err) {
      toast('Upload failed');
    }
  };
  input.click();
}

async function saveHomepageImages() {
  try {
    // Collect all values
    const keys = ['hero', 'showcase1', 'showcase2', 'showcase3', 'showcase4', 'showcase5', 'room1', 'room2', 'room3'];
    keys.forEach(key => {
      const url = document.getElementById('img-url-' + key)?.value;
      if (url) homepageImages[key] = url;
    });

    await API.post('/api/homepage/admin', homepageImages);
    toast('Homepage images saved');
  } catch (e) {
    toast('Failed to save images');
  }
}

/* -----------------------------------------------------------
   12. REPORTS
------------------------------------------------------------ */
async function loadReports() {
  try {
    // BUG 4 FIX: /api/admin/reports doesn't exist — call the 3 real endpoints
    const [summary, occupancy, sources] = await Promise.all([
      API.get('/api/reports/summary'),
      API.get('/api/reports/occupancy'),
      API.get('/api/reports/sources'),
    ]);

    const totals  = summary.totals  || {};
    const monthly = summary.monthly || [];

    // Current month metrics
    const now        = new Date();
    const thisMonth  = now.getMonth() + 1;
    const thisMonthD = monthly.find(m => m.month === thisMonth) || {};

    document.getElementById('rpt-mrev').innerHTML   = '<span>PHP</span>' + formatMoney(thisMonthD.revenue || 0);
    document.getElementById('rpt-mstays').textContent = thisMonthD.bookings || 0;
    document.getElementById('rpt-avg').innerHTML    = '<span>PHP</span>' + formatMoney(totals.avg_booking_value || 0);

    const cancelRate = totals.total_bookings
      ? Math.round((totals.cancellations / totals.total_bookings) * 100)
      : 0;
    document.getElementById('rpt-cancel').innerHTML = cancelRate + '<span>%</span>';

    // Chart: 12-month revenue array
    const monthlyData = Array.from({ length: 12 }, (_, i) => {
      const m = monthly.find(x => x.month === i + 1);
      return { month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], revenue: m ? m.revenue : 0 };
    });
    renderReportChart(monthlyData);

    // Occupancy table — backend returns { room_name, bookings, revenue, booked_nights }
    renderOccupancyTable(occupancy);

    // Sources table — backend returns { source, count, revenue }
    renderSourceTable(sources);

  } catch (e) {
    console.error('loadReports error', e);
    toast('Failed to load reports');
  }
}

function renderReportChart(data) {
  const ctx = document.getElementById('rpt-chart');
  if (!ctx) return;

  if (reportChart) reportChart.destroy();

  reportChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [{
        label: 'Revenue',
        data: data.map(d => d.revenue),
        backgroundColor: 'rgba(197,162,85,0.25)',
        borderColor: 'rgba(197,162,85,0.5)',
        borderWidth: 1,
        borderRadius: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: 'rgba(200,216,204,0.3)', font: { size: 10 } } },
        y: { grid: { color: 'rgba(200,216,204,0.05)' }, ticks: { color: 'rgba(200,216,204,0.3)', font: { size: 10 } } }
      }
    }
  });
}

function renderOccupancyTable(stats) {
  const tbody = document.getElementById('occ-body');
  if (!stats.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.28)">No data</td></tr>';
    return;
  }

  // BUG 4 FIX: backend returns room_name, bookings, revenue, booked_nights
  tbody.innerHTML = stats.map(s => `
    <tr>
      <td>${s.room_name || s.name || '—'}</td>
      <td>${s.bookings}</td>
      <td>PHP ${formatMoney(s.revenue)}</td>
      <td>${s.booked_nights || s.nights || 0}</td>
    </tr>
  `).join('');
}

function renderSourceTable(stats) {
  const tbody = document.getElementById('src-body');
  if (!stats.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.28)">No data</td></tr>';
    return;
  }

  tbody.innerHTML = stats.map(s => `
    <tr>
      <td>${s.source}</td>
      <td>${s.count}</td>
      <td>PHP ${formatMoney(s.revenue)}</td>
    </tr>
  `).join('');
}

/* -----------------------------------------------------------
   13. GUESTS - WITH PAYMENT STATUS
------------------------------------------------------------ */
async function loadGuests() {
  try {
    const data = await API.get('/api/guests');
    guests = data;
    renderGuests();
  } catch (e) {
    toast('Failed to load guests');
  }
}

function renderGuests() {
  const search = document.getElementById('guest-search').value.toLowerCase();

  let filtered = guests;

  // Search filter
  if (search) {
    filtered = filtered.filter(g =>
      (g.first_name + ' ' + (g.last_name||'')).toLowerCase().includes(search) ||
      (g.email || '').toLowerCase().includes(search)
    );
  }

  // Payment status filter
  if (currentGuestFilter !== 'all') {
    filtered = filtered.filter(g => {
      if (currentGuestFilter === 'not-emailed') return !g.email_sent;
      return g.payment_status === currentGuestFilter;
    });
  }

  const tbody = document.getElementById('guests-body');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No guests found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(g => `
    <tr onclick="openGuestDetailModal(${g.id})" style="cursor:pointer">
      <td><strong>${((g.first_name || '') + ' ' + (g.last_name || '')).trim() || '—'}</strong></td>
      <td>${g.email || '—'}</td>
      <td>${g.phone || '—'}</td>
      <td>${g.total_stays || 0}</td>
      <td>${g.last_stay ? formatDate(g.last_stay) : '—'}</td>
      <td>PHP ${formatMoney(g.total_spent || 0)}</td>
      <td>${renderPaymentBadge(g.payment_status)}</td>
      <td>${renderEmailStatus(g.email_sent)}</td>
      <td><button class="action-btn" onclick="event.stopPropagation();openGuestDetailModal(${g.id})">View</button></td>
    </tr>
  `).join('');
}

function renderPaymentBadge(status) {
  const badges = {
    paid: '<span class="payment-badge paid">Paid</span>',
    pending: '<span class="payment-badge pending">Pending</span>',
    partial: '<span class="payment-badge partial">Partial</span>',
    'not-emailed': '<span class="payment-badge not-emailed">Not Emailed</span>'
  };
  return badges[status] || '<span class="payment-badge pending">Pending</span>';
}

function renderEmailStatus(sent) {
  if (sent) {
    return '<span class="email-status sent">Sent</span>';
  }
  return '<span class="email-status not-sent">Not Sent</span>';
}

function filterGuestsByPayment(filter, btn) {
  currentGuestFilter = filter;
  document.querySelectorAll('#page-guests .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGuests();
}

function openGuestDetailModal(id) {
  const g = guests.find(x => x.id == id);
  if (!g) return;

  document.getElementById('gd-id').value = id;
  document.getElementById('gd-name').textContent = ((g.first_name || '') + ' ' + (g.last_name || '')).trim() || 'Guest';
  document.getElementById('gd-email').textContent = g.email || '—';
  document.getElementById('gd-phone').textContent = g.phone || '—';
  document.getElementById('gd-payment-status').value = g.payment_status || 'pending';
  document.getElementById('gd-notes').value = g.notes || '';

  const emailToggle = document.getElementById('gd-email-sent');
  if (g.email_sent) emailToggle.classList.add('on');
  else emailToggle.classList.remove('on');

  // Load guest bookings
  const guestBookings = bookings.filter(b => b.guest_id === id);
  document.getElementById('gd-bookings').innerHTML = guestBookings.map(b => `
    <tr>
      <td>${b.reference || '—'}</td>
      <td>${b.room_name || '—'}</td>
      <td>${formatDate(b.checkin_date)}</td>
      <td>${formatDate(b.checkout_date)}</td>
      <td>PHP ${formatMoney(b.total_amount || 0)}</td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.28)">No bookings</td></tr>';

  openModal('guest-detail-modal');
}

async function saveGuestDetails() {
  const id   = document.getElementById('gd-id').value;
  const data = {
    payment_status: document.getElementById('gd-payment-status').value,
    email_sent:     document.getElementById('gd-email-sent').classList.contains('on'),
    notes:          document.getElementById('gd-notes').value
  };

  try {
    await API.put('/api/guests/' + id, data);
    toast('Guest details updated');
    closeModal('guest-detail-modal');
    await loadGuests();
  } catch (e) {
    toast('Failed to update guest');
  }
}

/* -----------------------------------------------------------
   14. FEEDBACK - WITH ADMIN VERIFICATION
------------------------------------------------------------ */
async function loadFeedback() {
  try {
    feedbackList = await API.get('/api/feedback');
    renderFeedback();
  } catch (e) {
    toast('Failed to load feedback');
  }
}

function renderFeedback() {
  let filtered = feedbackList;

  if (currentFeedbackFilter !== 'all') {
    filtered = filtered.filter(f => f.status === currentFeedbackFilter);
  }

  const container = document.getElementById('feedback-container');
  if (!filtered.length) {
    container.innerHTML = '<div style="text-align:center;padding:3rem;color:rgba(200,216,204,0.28)">No feedback found</div>';
    return;
  }

  container.innerHTML = filtered.map(f => `
    <div class="feedback-card ${f.status}">
      <div class="feedback-header">
        <div>
          <div class="feedback-author">${f.name || 'Anonymous'}</div>
          <div class="feedback-email">${f.email || '—'}</div>
        </div>
        <div class="feedback-rating">${'&#9733;'.repeat(f.rating || 5)}</div>
      </div>
      <div class="feedback-message">${f.message || '—'}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="feedback-date">${formatDateTime(f.createdAt)}</div>
        <div class="feedback-actions">
          ${f.status === 'pending' ? `
            <button class="action-btn" onclick="approveFeedback(${f.id})">Approve</button>
            <button class="action-btn" onclick="rejectFeedback(${f.id})">Reject</button>
          ` : f.status === 'approved' ? `
            <button class="action-btn" onclick="rejectFeedback(${f.id})">Unapprove</button>
          ` : `
            <button class="action-btn" onclick="approveFeedback(${f.id})">Approve</button>
          `}
          <button class="action-btn" onclick="deleteFeedback(${f.id})">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function filterFeedback(filter, btn) {
  currentFeedbackFilter = filter;
  document.querySelectorAll('#page-feedback .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeedback();
}

async function approveFeedback(id) {
  try {
    await API.patch('/api/feedback/' + id, { status: 'approved' });
    toast('Feedback approved');
    await loadFeedback();
  } catch (e) {
    toast('Failed to approve feedback');
  }
}

async function rejectFeedback(id) {
  try {
    await API.patch('/api/feedback/' + id, { status: 'rejected' });
    toast('Feedback rejected');
    await loadFeedback();
  } catch (e) {
    toast('Failed to reject feedback');
  }
}

async function deleteFeedback(id) {
  if (!confirm('Delete this feedback permanently?')) return;
  try {
    await API.delete('/api/feedback/' + id);
    toast('Feedback deleted');
    await loadFeedback();
  } catch (e) {
    toast('Failed to delete feedback');
  }
}

/* -----------------------------------------------------------
   15. STAFF & AUDIT LOG
------------------------------------------------------------ */
async function loadStaff() {
  try {
    staff = await API.get('/api/staff');
    renderStaff();
  } catch (e) {
    toast('Failed to load staff');
  }
}

function renderStaff() {
  const tbody = document.getElementById('staff-body');
  if (!staff.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No staff accounts</td></tr>';
    return;
  }

  tbody.innerHTML = staff.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.email}</td>
      <td>${s.role}</td>
      <td>${s.last_login ? formatDateTime(s.last_login) : '—'}</td>
      <td><span class="badge badge-${s.is_active ? 'confirmed' : 'cancelled'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
      <td><button class="action-btn" onclick="${s.is_active ? 'deactivateStaff' : 'activateStaff'}('${s.id}')">${s.is_active ? 'Deactivate' : 'Activate'}</button></td>
    </tr>
  `).join('');
}

async function doCreateStaff() {
  const data = {
    name: document.getElementById('sf-name').value,
    email: document.getElementById('sf-email').value,
    password: document.getElementById('sf-pass').value,
    role: document.getElementById('sf-role').value
  };

  if (!data.name || !data.email || !data.password) {
    toast('Please fill in all fields');
    return;
  }

  if (data.password.length < 8) {
    toast('Password must be at least 8 characters');
    return;
  }

  try {
    await API.post('/api/staff', data);
    toast('Staff account created');
    closeModal('staff-modal');
    await loadStaff();
  } catch (e) {
    toast(e.message || 'Failed to create staff');
  }
}

async function deactivateStaff(id) {
  // BUG 25 FIX: backend uses a toggle endpoint, not PATCH with body
  try {
    await API.patch('/api/staff/' + id + '/toggle');
    toast('Staff deactivated');
    await loadStaff();
  } catch (e) {
    toast('Failed to deactivate');
  }
}

async function activateStaff(id) {
  // BUG 25 FIX: backend uses a toggle endpoint, not PATCH with body
  try {
    await API.patch('/api/staff/' + id + '/toggle');
    toast('Staff activated');
    await loadStaff();
  } catch (e) {
    toast('Failed to activate');
  }
}

async function loadAuditLog() {
  try {
    auditLog = await API.get('/api/staff/audit-log');
    renderAuditLog();
  } catch (e) {
    console.error('Failed to load audit log', e);
  }
}

function renderAuditLog() {
  const tbody = document.getElementById('audit-body');
  if (!auditLog.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:rgba(200,216,204,0.28)">No activity</td></tr>';
    return;
  }

  tbody.innerHTML = auditLog.slice(0, 50).map(a => `
    <tr>
      <td>${formatDateTime(a.createdAt)}</td>
      <td>${a.user?.name || 'System'}</td>
      <td>${a.action}</td>
      <td>${a.note || '—'}</td>
    </tr>
  `).join('');
}

/* -----------------------------------------------------------
   16. SETTINGS
------------------------------------------------------------ */
async function saveSettings() {
  const data = {
    name: document.getElementById('set-name').value,
    tagline: document.getElementById('set-tagline').value,
    address: document.getElementById('set-address').value,
    facebook: document.getElementById('set-fb').value,
    instagram: document.getElementById('set-ig').value,
    tiktok: document.getElementById('set-tiktok').value,
    email: document.getElementById('set-email').value,
    vat: parseInt(document.getElementById('set-vat').value) || 0,
    tourismFee: parseInt(document.getElementById('set-tourism').value) || 0,
    notifications: {
      newReservation: document.getElementById('notif-new').classList.contains('on'),
      cancellation: document.getElementById('notif-cancel').classList.contains('on'),
      guestConfirmation: document.getElementById('notif-confirm').classList.contains('on'),
      reminder24h: document.getElementById('notif-reminder').classList.contains('on'),
      weeklySummary: document.getElementById('notif-weekly').classList.contains('on')
    }
  };

  try {
    await API.put('/api/settings', data);
    toast('Settings saved');
  } catch (e) {
    toast('Failed to save settings');
  }
}

/* -----------------------------------------------------------
   17. MODAL UTILITIES
------------------------------------------------------------ */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function toggleEl(id) {
  const el = document.getElementById(id);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

/* -----------------------------------------------------------
   18. DATA LOADERS
------------------------------------------------------------ */
async function loadBookings() {
  try {
    bookings = await API.get('/api/bookings');
  } catch (e) {
    bookings = [];
  }
}

async function loadBlockedDates() {
  try {
    blockedDates = await API.get('/api/calendar/blocked');
    renderBlockedDates();
  } catch (e) {
    blockedDates = [];
  }
}

/* -----------------------------------------------------------
   19. HONESTY STORE (admin panel)
------------------------------------------------------------ */

let honestyAdminFilter = 'all';
let honestyAdminList   = [];

async function loadAdminStore() {
  try {
    const [reports, honesty] = await Promise.all([
      API.get('/api/store/reports'),
      API.get('/api/store/honesty'),
    ]);

    document.getElementById('sm-today-orders').textContent   = reports.today_orders  || 0;
    document.getElementById('sm-today-rev').innerHTML        = '<span>PHP</span>' + formatMoney(reports.today_revenue  || 0);
    document.getElementById('sm-total-orders').textContent   = reports.total_orders  || 0;
    document.getElementById('sm-pending-logs').textContent   = honesty.filter(h => h.status === 'pending').length;

    honestyAdminList = honesty;
    renderHonestyAdmin();

    const bsBody = document.getElementById('store-bestsellers');
    if (bsBody) {
      if (!(reports.best_sellers || []).length) {
        bsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.25)">No sales data yet</td></tr>';
      } else {
        bsBody.innerHTML = (reports.best_sellers || []).map(s => `
          <tr><td>${esc(s.name)}</td><td>${Number(s.qty)}</td><td>PHP ${formatMoney(s.revenue)}</td></tr>
        `).join('');
      }
    }

    const lsBody = document.getElementById('store-lowstock');
    if (lsBody) {
      if (!(reports.low_stock || []).length) {
        lsBody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:1rem;color:rgba(200,216,204,0.38)">✓ All stock levels OK</td></tr>';
      } else {
        lsBody.innerHTML = (reports.low_stock || []).map(p => `
          <tr>
            <td>${esc(p.name)}</td>
            <td>${esc(p.category || '—')}</td>
            <td style="color:${p.stock === 0 ? 'var(--danger)' : 'var(--warning)'}">${p.stock === 0 ? '❌ Out' : '⚠ ' + Number(p.stock)}</td>
          </tr>
        `).join('');
      }
    }
  } catch(e) {
    console.error('loadAdminStore error', e);
    toast('Failed to load store data');
  }
}

function filterHonestyAdmin(filter, btn) {
  honestyAdminFilter = filter;
  document.querySelectorAll('#page-store .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHonestyAdmin();
}

function renderHonestyAdmin() {
  const container = document.getElementById('honesty-admin-list');
  if (!container) return;

  let list = honestyAdminList;
  if (honestyAdminFilter !== 'all') list = list.filter(h => h.status === honestyAdminFilter);

  if (!list.length) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(200,216,204,0.25);font-size:0.72rem">No entries found</div>';
    return;
  }

  const safeStatuses = ['pending','verified','disputed'];

  container.innerHTML = list.map(h => {
    const date        = formatDateTime(h.created_at);
    const safeStatus  = safeStatuses.includes(h.status) ? h.status : 'pending';
    const statusLabel = { pending: 'Pending Review', verified: 'Verified', disputed: 'Disputed' }[safeStatus];
    const badgeClass  = safeStatus === 'verified' ? 'confirmed' : safeStatus === 'disputed' ? 'cancelled' : 'pending';

    return `
      <div class="honesty-card ${safeStatus}">
        <div class="honesty-head">
          <div>
            <div class="honesty-guest">${esc(h.guest_email || '—')}</div>
            <div class="honesty-email">Entry #${Number(h.id)} · ${esc(date)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:0.8rem">
            <div class="honesty-total">₱${formatMoney(h.total)}</div>
            <span class="badge badge-${badgeClass}">${esc(statusLabel)}</span>
          </div>
        </div>
        <div class="honesty-items-list">
          ${(h.items || []).map(i => `
            <div class="honesty-item-r">
              <span>${esc(i.name)} × ${Number(i.quantity)}</span>
              <span>₱${formatMoney(i.price * i.quantity)}</span>
            </div>
          `).join('')}
        </div>
        ${h.note ? `<div class="honesty-note-text">"${esc(h.note)}"</div>` : ''}
        ${h.reviewer_note ? `<div style="font-size:0.65rem;color:var(--danger);margin-bottom:0.6rem">Staff note: ${esc(h.reviewer_note)}</div>` : ''}
        <div class="honesty-actions">
          ${safeStatus !== 'verified'  ? `<button class="btn-verify"  onclick="reviewHonestyEntry(${Number(h.id)},'verified')">✓ Verify — Honest</button>` : ''}
          ${safeStatus !== 'disputed'  ? `<button class="btn-dispute" onclick="promptDisputeEntry(${Number(h.id)})">⚠ Dispute</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function reviewHonestyEntry(id, status, note) {
  try {
    await API.patch('/api/store/honesty/' + id + '/verify', { status, note: note || '' });
    toast(status === 'verified' ? 'Entry verified ✓' : 'Entry disputed');
    await loadAdminStore();
  } catch(e) {
    toast('Failed to update entry');
  }
}

function promptDisputeEntry(id) {
  const note = prompt('Enter a note explaining the dispute (optional):');
  if (note === null) return; // user cancelled
  reviewHonestyEntry(id, 'disputed', note);
}

/* -----------------------------------------------------------
   20. UTILITIES
------------------------------------------------------------ */
function formatMoney(n) {
  return (n || 0).toLocaleString('en-PH');
}

/* -----------------------------------------------------------
   CANCELLATIONS & REBOOKING
------------------------------------------------------------ */

let currentRebookId = null;

async function loadCancellations() {
  const statusFilter = document.getElementById('cancel-status-filter')?.value || '';
  const container    = document.getElementById('cancel-list');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(200,216,204,0.25);font-size:0.72rem">Loading…</div>';
  try {
    const url      = '/api/bookings/cancel-requests' + (statusFilter ? '?status=' + statusFilter : '');
    const requests = await API.get(url);

    if (!requests.length) {
      container.innerHTML = '<div style="text-align:center;padding:3rem;color:rgba(200,216,204,0.25);font-size:0.72rem">No cancellation requests found</div>';
      return;
    }

    const safeStatuses = ['pending','approved','rejected'];
    container.innerHTML = requests.map(r => {
      const safeStatus = safeStatuses.includes(r.status) ? r.status : 'pending';
      const badgeColor = safeStatus === 'approved' ? 'confirmed' : safeStatus === 'rejected' ? 'cancelled' : 'pending';
      return `
        <div class="section-card" style="padding:1.2rem 1.4rem">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.6rem;margin-bottom:0.8rem">
            <div>
              <div style="font-family:var(--font-serif);font-size:1rem;font-weight:300">${esc(r.guest_name || r.booking_name)}</div>
              <div style="font-size:0.62rem;color:rgba(200,216,204,0.4);margin-top:0.1rem">
                ${esc(r.guest_email || '')} &nbsp;&middot;&nbsp; Ref: <strong>${esc(r.reference)}</strong>
                &nbsp;&middot;&nbsp; ${formatDateTime(r.created_at)}
              </div>
            </div>
            <span class="badge badge-${badgeColor}">${safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:0.5rem;margin-bottom:0.8rem;font-size:0.72rem">
            <div><span style="color:rgba(200,216,204,0.4);font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;display:block;margin-bottom:0.2rem">Check-In</span>${r.checkin_date ? formatDate(r.checkin_date) : '—'}</div>
            <div><span style="color:rgba(200,216,204,0.4);font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;display:block;margin-bottom:0.2rem">Check-Out</span>${r.checkout_date ? formatDate(r.checkout_date) : '—'}</div>
            <div><span style="color:rgba(200,216,204,0.4);font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;display:block;margin-bottom:0.2rem">Booking Total</span>PHP ${formatMoney(r.total_amount || 0)}</div>
            ${r.refund_amount !== null && r.refund_amount !== undefined ? `<div><span style="color:rgba(200,216,204,0.4);font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;display:block;margin-bottom:0.2rem">Refund Approved</span><strong style="color:var(--success)">PHP ${formatMoney(r.refund_amount)}</strong></div>` : ''}
          </div>

          <div style="font-size:0.72rem;margin-bottom:0.8rem">
            <span style="color:rgba(200,216,204,0.4);font-size:0.56rem;letter-spacing:0.12em;text-transform:uppercase;display:block;margin-bottom:0.25rem">Refund Details Provided by Guest</span>
            <span style="color:rgba(245,240,232,0.8);white-space:pre-wrap">${esc(r.payment_details || '—')}</span>
          </div>

          ${r.reason ? `<div style="font-size:0.7rem;color:rgba(200,216,204,0.45);margin-bottom:0.8rem;font-style:italic">"${esc(r.reason)}"</div>` : ''}
          ${r.admin_note ? `<div style="font-size:0.7rem;color:rgba(197,162,85,0.7);margin-bottom:0.5rem">Admin note: ${esc(r.admin_note)}</div>` : ''}
          ${r.refund_method ? `<div style="font-size:0.7rem;color:rgba(200,216,204,0.5);margin-bottom:0.8rem">Refunded via: ${esc(r.refund_method)}</div>` : ''}

          ${safeStatus === 'pending' ? `
            <div style="display:flex;gap:0.5rem;padding-top:0.8rem;border-top:1px solid var(--border);flex-wrap:wrap">
              <button class="btn-save" style="padding:0.4rem 1.1rem;font-size:0.65rem" onclick="openApproveModal(${Number(r.id)}, ${Number(r.total_amount || 0)})">
                Approve &amp; Set Refund
              </button>
              <button class="btn-del" style="padding:0.4rem 1rem;font-size:0.65rem" onclick="doRejectCancelRequest(${Number(r.id)})">
                Reject
              </button>
            </div>` : ''}
        </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:2rem;color:rgba(200,216,204,0.25)">Failed to load cancellation requests</div>';
    console.error('loadCancellations error', e);
  }
}

function openApproveModal(requestId, bookingTotal) {
  const refund = prompt(
    'Approve cancellation #' + requestId + '\n' +
    'Booking total: PHP ' + bookingTotal.toLocaleString() + '\n\n' +
    'Enter refund amount (PHP):'
  );
  if (refund === null) return;

  const method = prompt('Refund method (e.g. GCash, Bank Transfer, Cash):');
  if (method === null) return;

  const note = prompt('Admin note for your records (optional):') || '';
  doApproveCancelRequest(requestId, parseFloat(refund) || 0, method.trim(), note.trim());
}

async function doApproveCancelRequest(id, refundAmount, refundMethod, adminNote) {
  try {
    await API.patch('/api/bookings/cancel-requests/' + id + '/approve', {
      refund_amount: refundAmount,
      refund_method: refundMethod,
      admin_note:    adminNote,
    });
    toast('Cancellation approved. Room slot reopened. Confirmation email sent to guest.');
    await loadCancellations();
  } catch (e) { toast(e.message || 'Failed to approve cancellation'); }
}

async function doRejectCancelRequest(id) {
  const note = prompt('Reason for rejection (optional — shown as admin note):');
  if (note === null) return;
  try {
    await API.patch('/api/bookings/cancel-requests/' + id + '/reject', { admin_note: note || '' });
    toast('Cancellation request rejected');
    await loadCancellations();
  } catch (e) { toast(e.message || 'Failed to reject request'); }
}

/* ── Rebook Panel (inside booking detail modal) ── */

function openRebookPanel() {
  document.getElementById('rebook-panel').style.display = 'block';
  document.getElementById('rb-price-preview').textContent = '';
  document.getElementById('rb-note').value     = '';
  document.getElementById('rb-checkin').value  = '';
  document.getElementById('rb-checkout').value = '';
}

function closeRebookPanel() {
  document.getElementById('rebook-panel').style.display = 'none';
}

async function previewRebookPrice() {
  const checkin  = document.getElementById('rb-checkin').value;
  const checkout = document.getElementById('rb-checkout').value;
  const preview  = document.getElementById('rb-price-preview');
  if (!checkin || !checkout || !currentRebookId) { preview.textContent = ''; return; }

  const b = bookings.find(x => x.id == currentRebookId);
  if (!b) return;

  try {
    const res      = await API.post('/api/bookings/preview', { room_id: b.room_id, checkin_date: checkin, checkout_date: checkout });
    const oldTotal = b.total_amount || 0;
    const diff     = res.total - oldTotal;
    const diffStr  = diff === 0
      ? 'Same price as original booking'
      : diff > 0
        ? '+PHP ' + Math.abs(diff).toLocaleString() + ' additional payment required'
        : '−PHP ' + Math.abs(diff).toLocaleString() + ' refund due to guest';
    const diffColor = diff > 0 ? 'var(--warning)' : diff < 0 ? 'var(--success)' : 'rgba(200,216,204,0.4)';
    preview.innerHTML = '<span style="color:var(--gold)">New total: PHP ' + res.total.toLocaleString() + '</span>'
      + ' &nbsp;&middot;&nbsp; <span style="color:' + diffColor + '">' + diffStr + '</span>';
  } catch (e) {
    preview.textContent = e.message || 'Cannot calculate price for those dates';
    preview.style.color = 'var(--danger)';
  }
}

async function confirmRebook() {
  if (!currentRebookId) { toast('No booking selected'); return; }
  const checkin  = document.getElementById('rb-checkin').value;
  const checkout = document.getElementById('rb-checkout').value;
  const note     = document.getElementById('rb-note').value.trim();

  if (!checkin || !checkout) { toast('Please select new check-in and check-out dates'); return; }

  const preview = document.getElementById('rb-price-preview').textContent;
  if (!confirm('Move this booking to the new dates?\n\n' + (preview || '') + '\n\nA confirmation email will be sent to the guest.')) return;

  try {
    const res = await API.patch('/api/bookings/' + currentRebookId + '/rebook', {
      new_checkin: checkin, new_checkout: checkout, admin_note: note,
    });
    toast('Booking moved. New ref: ' + res.new_reference + '. Email sent to guest.');
    closeRebookPanel();
    closeModal('booking-modal');
    await loadReservations();
  } catch (e) { toast(e.message || 'Failed to rebook'); }
}

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
         date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatMonthYear(d) {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDateRange(start, end) {
  return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' - ' +
         end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}