// src/routes/responder.routes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/incident.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

// GET /responders/nearest?lat=5.6&lon=-0.18&limit=5&type=AMBULANCE&status=AVAILABLE
router.get('/nearest', ctrl.getNearestResponders);

module.exports = router;
