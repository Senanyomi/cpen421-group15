// src/routes/vehicle.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/vehicle.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

// ─── Registration ──────────────────────────────────────────────────────────
// POST /vehicles/register — must come BEFORE /:id to avoid route collision
router.post('/register', authorize('ADMIN', 'DISPATCHER'), ctrl.registerVehicle);

// ─── Fleet Listing ─────────────────────────────────────────────────────────
router.get('/', ctrl.getAllVehicles);

// ─── Single Vehicle ────────────────────────────────────────────────────────
router.get('/:id',          ctrl.getVehicleById);
router.get('/:id/location', ctrl.getVehicleLocation);
router.get('/:id/history',  ctrl.getLocationHistory);

// ─── Updates ───────────────────────────────────────────────────────────────
// GPS ping — called by the vehicle device/app, no special role needed
router.put('/:id/location', ctrl.updateLocation);

// Status change — any authenticated user (they can update their own vehicle)
router.put('/:id/status', ctrl.updateStatus);

// Assign to incident — dispatcher/admin only
router.put('/:id/assign', authorize('ADMIN', 'DISPATCHER'), ctrl.assignVehicle);

module.exports = router;
