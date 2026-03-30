// src/middleware/rateLimiter.middleware.js
const rateLimit = require('express-rate-limit');

// ─── Auth endpoints (login, register) — relaxed for development ────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 200,  // 200 in dev, 20 in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

// ─── General API endpoints — more lenient ─────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,  // 1000 in dev, 100 in prod
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

module.exports = { authLimiter, apiLimiter };
