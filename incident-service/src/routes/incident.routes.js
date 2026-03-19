// src/routes/incident.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/incident.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All incident routes require a valid JWT
router.use(authenticate);

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: /incidents/open must come BEFORE /incidents/:id
// Express matches routes in registration order — "open" would be treated as
// an :id parameter if the parameterised route was declared first.
// ─────────────────────────────────────────────────────────────────────────────

// GET  /incidents/open         — active (non-closed) incidents
router.get('/open', ctrl.getActiveIncidents);

// POST /incidents               — create
router.post('/', ctrl.createIncident);

// GET  /incidents               — list all (with filters + pagination)
router.get('/', ctrl.getAllIncidents);

// GET  /incidents/:id           — single incident + full notes
router.get('/:id', ctrl.getIncidentById);

// PUT  /incidents/:id/status    — lifecycle update
router.put('/:id/status',
  authorize('ADMIN', 'DISPATCHER', 'OPERATOR'),
  ctrl.updateStatus
);

// PUT  /incidents/:id/assign    — assign vehicle/responder
router.put('/:id/assign',
  authorize('ADMIN', 'DISPATCHER'),
  ctrl.assignResponder
);

// POST /incidents/:id/notes     — add a field note
router.post('/:id/notes', ctrl.addNote);

// DELETE /incidents/:id         — hard delete (RESOLVED/CLOSED only)
router.delete('/:id',
  authorize('ADMIN'),
  ctrl.deleteIncident
);

module.exports = router;
