// examples/incident-service.example.js
// ─────────────────────────────────────────────────────────────────────────────
// Shows how the Incident Service wires up RabbitMQ.
//
// PUBLISHES:
//   incident.created        — when a new incident is reported
//   incident.status.changed — when the lifecycle status changes
//
// CONSUMES:
//   user.created            — to verify reporter IDs exist (optional cache warm-up)
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const { connectRabbitMQ, publish, createConsumer, EVENTS } = require('../src');

const app = express();
app.use(express.json());

// ── RabbitMQ Handlers (consumer side) ────────────────────────────────────────

/**
 * When a new user registers we cache their ID locally so we can
 * validate "reportedBy" without calling the Identity Service on every request.
 */
const handleUserCreated = async (data, meta) => {
  console.log(`[incident-service] Caching new user: ${data.email} [${data.role}]`);
  // e.g. knownUserIds.add(data.userId);
};

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  await connectRabbitMQ({ service: 'incident-service' });

  // Subscribe to events this service cares about
  await createConsumer('incident.service.queue', {
    [EVENTS.USER_CREATED]: handleUserCreated,
  });

  app.listen(3002, () => console.log('Incident Service on :3002'));
};

// ── Route: POST /incidents ────────────────────────────────────────────────────
app.post('/incidents', async (req, res) => {
  const { type, description, latitude, longitude } = req.body;

  // ... save to DB ...
  const incident = {
    id:          'inc-uuid-001',
    type,
    description,
    latitude,
    longitude,
    status:      'REPORTED',
    reportedBy:  req.user?.userId || 'anonymous',
    createdAt:   new Date().toISOString(),
  };

  // Notify Dispatch and Analytics that a new incident exists
  publish(EVENTS.INCIDENT_CREATED, {
    incidentId:  incident.id,
    type:        incident.type,
    status:      incident.status,
    latitude:    incident.latitude,
    longitude:   incident.longitude,
    reportedBy:  incident.reportedBy,
  }, { source: 'incident-service' });

  res.status(201).json({ success: true, data: incident });
});

// ── Route: PUT /incidents/:id/status ─────────────────────────────────────────
app.put('/incidents/:id/status', async (req, res) => {
  const { id }     = req.params;
  const { status } = req.body;

  // ... update in DB, enforce transition rules ...
  const prevStatus = 'REPORTED'; // fetched from DB in real code

  publish(EVENTS.INCIDENT_STATUS_CHANGED, {
    incidentId:  id,
    prevStatus,
    newStatus:   status,
    changedBy:   req.user?.userId,
  }, { source: 'incident-service' });

  res.json({ success: true, message: `Status updated to ${status}.` });
});

start();
