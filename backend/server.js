const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const path    = require('path');

const { loadEnv }   = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const logger        = require('./src/utils/logger');
const errorHandler  = require('./src/middleware/errorHandler');

loadEnv();

const authRoutes     = require('./src/routes/auth');
const bookingRoutes  = require('./src/routes/bookings');
const roomRoutes     = require('./src/routes/rooms');
const guestRoutes    = require('./src/routes/guests');
const pricingRoutes  = require('./src/routes/pricing');
const reportRoutes   = require('./src/routes/reports');
const staffRoutes    = require('./src/routes/staff');
const calendarRoutes = require('./src/routes/calendar');
const settingsRoutes = require('./src/routes/settings');
const feedbackRoutes = require('./src/routes/feedback');
const homepageRoutes = require('./src/routes/homepage');
const storeRoutes    = require('./src/routes/store');        // ← NEW

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security: Helmet with a real CSP ─────────────────────────
// FIX: contentSecurityPolicy was disabled entirely. Enable it with
// a practical policy that still allows Google Fonts, Chart.js CDN,
// and the QR server used by the store POS.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "https://api.qrserver.com"],
      connectSrc:  ["'self'"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  // Prevent browsers from sniffing MIME types
  noSniff: true,
  // Don't send X-Powered-By: Express
  hidePoweredBy: true,
  // HSTS — only in production
  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
  // Prevent clickjacking
  frameguard: { action: 'deny' },
}));

// ── Security: CORS locked to allowed origins ─────────────────
// FIX: was origin: '*' which allows any website to make credentialed
// requests to this API. Lock to the actual deployment origin.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5000')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn('CORS blocked request', { origin });
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── Serve uploaded files ──────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  // Prevent directory traversal — only serve files with safe extensions
  setHeaders: (res, filePath) => {
    res.set('X-Content-Type-Options', 'nosniff');
  },
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms',    roomRoutes);
app.use('/api/guests',   guestRoutes);
app.use('/api/pricing',  pricingRoutes);
app.use('/api/reports',  reportRoutes);
app.use('/api/staff',    staffRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/store',    storeRoutes);              // ← NEW

// ── Health check (no sensitive info in production) ───────────
app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  env:    process.env.NODE_ENV,
  // Don't expose db type or internals in production
  ...(process.env.NODE_ENV !== 'production' && { db: 'json-file' }),
}));

// ── Serve frontend ────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/',            (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/index.html')));
app.get('/admin',       (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/admin.html')));
app.get('/login',       (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/login.html')));
app.get('/store',       (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/honesty-store.html'))); // ← NEW
app.get('/store-staff', (req, res) => res.sendFile(path.join(__dirname, '../frontend/pages/store.html')));         // ← NEW

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

connectDB().then(() => {
  app.listen(PORT, () => {
    logger.info(`Server running → http://localhost:${PORT}`);
    logger.info(`Admin login  → http://localhost:${PORT}/login`);
    logger.info(`Store staff  → http://localhost:${PORT}/store-staff`);
    logger.info(`Honesty store → http://localhost:${PORT}/store`);
  });
}).catch(err => { logger.error('Startup failed', { error: err.message }); process.exit(1); });
