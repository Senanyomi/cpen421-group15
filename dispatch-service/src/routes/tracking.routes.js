// src/routes/tracking.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/tracking.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /tracking/active               — all DISPATCHED and ON_SCENE vehicles
router.get('/active', ctrl.getActiveVehicles);

// GET /tracking/incident/:id         — all vehicles linked to a specific incident
router.get('/incident/:id', ctrl.getVehiclesByIncident);

module.exports = router;
