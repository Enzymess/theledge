/* ============================================================
   THE LEDGE BAGUIO — api.js
   ============================================================ */

const API_BASE = '';

const API = {
  async request(method, endpoint, data = null, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    // Add auth token if available
    const token = localStorage.getItem('ledge_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        delete config.headers['Content-Type'];
        config.body = data;
      } else {
        config.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(url, config);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Request failed');
      }

      return result.data || result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  get(endpoint) {
    return this.request('GET', endpoint);
  },

  post(endpoint, data) {
    return this.request('POST', endpoint, data);
  },

  patch(endpoint, data) {
    return this.request('PATCH', endpoint, data);
  },

  put(endpoint, data) {
    return this.request('PUT', endpoint, data);
  },

  delete(endpoint) {
    return this.request('DELETE', endpoint);
  },

  upload(endpoint, formData) {
    return this.request('POST', endpoint, formData, {});
  }
};

// Public API endpoints
const PublicAPI = {
  // Rooms
  getRooms: () => API.get('/api/rooms'),

  // Bookings
  createBooking: (data) => API.post('/api/bookings', data),
  checkAvailability: (params) => API.get(`/api/availability?${new URLSearchParams(params)}`),

  // Feedback
  submitFeedback: (data) => API.post('/api/feedback', data),
  getApprovedFeedback: () => API.get('/api/feedback/approved'),

  // Homepage Images
  getHomepageImages: () => API.get('/api/homepage'),

  // User
  getMe: () => API.get('/api/me'),
  getMyBookings: () => API.get('/api/my-bookings'),
  login: (email, password) => API.post('/api/auth/login', { email, password }),
  register: (data) => API.post('/api/auth/register', data),
  googleLogin: (token) => API.post('/api/auth/google', { token })
};

// Admin API endpoints
const AdminAPI = {
  // Dashboard
  getStats: (year) => API.get(`/api/admin/stats?year=${year}`),

  // Bookings
  getBookings: (params) => API.get(`/api/admin/bookings?${new URLSearchParams(params)}`),
  getBooking: (id) => API.get(`/api/admin/bookings/${id}`),
  updateBooking: (id, data) => API.patch(`/api/admin/bookings/${id}`, data),
  createBooking: (data) => API.post('/api/admin/bookings', data),

  // Rooms
  getRooms: () => API.get('/api/admin/rooms'),
  createRoom: (data) => API.post('/api/admin/rooms', data),
  updateRoom: (id, data) => API.patch(`/api/admin/rooms/${id}`, data),
  deleteRoom: (id) => API.delete(`/api/admin/rooms/${id}`),
  uploadRoomPhotos: (id, formData) => API.upload(`/api/admin/rooms/${id}/photos`, formData),
  deleteRoomPhoto: (id, index) => API.delete(`/api/admin/rooms/${id}/photos/${index}`),

  // Guests
  getGuests: () => API.get('/api/admin/guests'),
  updateGuest: (id, data) => API.patch(`/api/admin/guests/${id}`, data),

  // Pricing
  getSeasons: () => API.get('/api/admin/seasons'),
  createSeason: (data) => API.post('/api/admin/seasons', data),
  deleteSeason: (id) => API.delete(`/api/admin/seasons/${id}`),
  getPromos: () => API.get('/api/admin/promos'),
  createPromo: (data) => API.post('/api/admin/promos', data),
  deletePromo: (id) => API.delete(`/api/admin/promos/${id}`),

  // Calendar
  getBlockedDates: () => API.get('/api/admin/blocked-dates'),
  blockDates: (data) => API.post('/api/admin/blocked-dates', data),
  unblockDates: (id) => API.delete(`/api/admin/blocked-dates/${id}`),

  // Feedback
  getFeedback: (status) => API.get(`/api/admin/feedback${status ? '?status=' + status : ''}`),
  updateFeedbackStatus: (id, status) => API.patch(`/api/admin/feedback/${id}`, { status }),
  deleteFeedback: (id) => API.delete(`/api/admin/feedback/${id}`),
  getFeedbackStats: () => API.get('/api/admin/feedback/stats'),

  // Homepage Images
  getHomepageImages: () => API.get('/api/homepage/admin'),
  updateHomepageImages: (data) => API.post('/api/homepage', data),
  uploadHomepageImage: (key, formData) => API.upload(`/api/homepage/${key}`, formData),

  // Reports
  getReports: () => API.get('/api/admin/reports'),

  // Staff
  getStaff: () => API.get('/api/admin/staff'),
  createStaff: (data) => API.post('/api/admin/staff', data),
  updateStaff: (id, data) => API.patch(`/api/admin/staff/${id}`, data),

  // Audit Log
  getAuditLog: () => API.get('/api/admin/audit-log'),

  // Settings
  getSettings: () => API.get('/api/admin/settings'),
  updateSettings: (data) => API.post('/api/admin/settings', data),

  // Policies
  getPolicies: () => API.get('/api/admin/policies'),
  updatePolicies: (data) => API.post('/api/admin/policies', data)
};

// Make available globally
window.API = API;
window.PublicAPI = PublicAPI;
window.AdminAPI = AdminAPI;