// src/routes/analytics.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/analytics.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All analytics endpoints require a valid JWT.
// ANALYST, ADMIN, and DISPATCHER can all read analytics.
router.use(authenticate);
router.use(authorize('ADMIN', 'DISPATCHER', 'ANALYST'));

// ─── Analytics Endpoints ──────────────────────────────────────────────────────
// All support optional ?from=<ISO>&to=<ISO> date range.
// Default range is the last 30 days when not specified.

// Average, min, max, P90 response times — overall and per incident type
// Optional: ?type=FIRE  ?from=2025-01-01  ?to=2025-01-31
router.get('/response-times', ctrl.getResponseTimes);

// Incident hotspot map data — counts per geographic region bucket
// Optional: ?type=MEDICAL
router.get('/incidents-by-region', ctrl.getIncidentsByRegion);

// Fleet utilisation — deployments, GPS activity, most active vehicles
router.get('/resource-utilization', ctrl.getResourceUtilization);

// All-in-one dashboard payload — parallel queries, single response
router.get('/summary-dashboard', ctrl.getSummaryDashboard);

module.exports = router;
