// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

// ─── Public (no token needed) ─────────────────────────────────────────────────
router.post('/register',       authLimiter, ctrl.register);
router.post('/login',          authLimiter, ctrl.login);

// Refresh token — NO rate limiting (called automatically during token expiry)
router.post('/refresh-token',  ctrl.refreshToken);

// Two-step password reset — also public (user isn't logged in when they forget their password)
router.post('/reset-password',         authLimiter, ctrl.resetPasswordRequest);
router.post('/reset-password/confirm', authLimiter, ctrl.resetPasswordConfirm);

// ─── Protected (valid access token required) ──────────────────────────────────
router.post('/logout',  authenticate, ctrl.logout);
router.get('/profile',  authenticate, ctrl.getProfile);
router.put('/profile',  authenticate, ctrl.updateProfile);

// ─── Admin only ───────────────────────────────────────────────────────────────
router.get('/users',                authenticate, authorize('ADMIN'), ctrl.getAllUsers);
router.put('/users/:id/deactivate', authenticate, authorize('ADMIN'), ctrl.deactivateUser);

module.exports = router;
