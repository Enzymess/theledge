const rateLimit = require('express-rate-limit');
const logger    = require('../utils/logger');

// Strict limiter for login — 5 attempts per 15 minutes
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              5,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler: (req, res) => {
    logger.warn('Rate limit hit on login', { ip: req.ip });
    res.status(429).json({
      error: 'Too many login attempts. Please wait 15 minutes and try again.',
    });
  },
});

// General API limiter — 100 requests per minute
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      100,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
  },
});

module.exports = { loginLimiter, apiLimiter };
