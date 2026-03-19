// examples/dispatch-service.example.js
// ─────────────────────────────────────────────────────────────────────────────
// Shows how the Dispatch Service wires up RabbitMQ.
//
// PUBLISHES:
//   vehicle.assigned          — when a vehicle is linked to an incident
//   vehicle.location.updated  — when a GPS ping arrives
//
// CONSUMES:
//   incident.created          — alerts the dispatcher that a new job exists
//   incident.status.changed   — auto-completes assignments when incident closes
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const { connectRabbitMQ, publish, createConsumer, EVENTS } = require('../src');

const app = express();
app.use(express.json());

// ── RabbitMQ Handlers (consumer side) ────────────────────────────────────────

/**
 * A new incident just came in — log it so the dispatcher knows to act.
 * In production you might push a WebSocket notification to the dashboard.
 */
const handleIncidentCreated = async (data, meta) => {
  console.log(
    `[dispatch-service] New incident for dispatch: ${data.incidentId} [${data.type}] ` +
    `at (${data.latitude}, ${data.longitude})`
  );
};

/**
 * Incident resolved or closed — automatically complete any active assignments
 * so vehicles show as AVAILABLE again without dispatcher intervention.
 */
const handleIncidentStatusChanged = async (data, meta) => {
  if (data.newStatus === 'RESOLVED' || data.newStatus === 'CLOSED') {
    console.log(
      `[dispatch-service] Incident ${data.incidentId} ${data.newStatus} ` +
      `— releasing assigned vehicles`
    );
    // prisma.vehicleAssignment.updateMany({ where: { incidentId, status: 'ACTIVE' }, data: { status: 'COMPLETED' } })
  }
};

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  await connectRabbitMQ({ service: 'dispatch-service' });

  await createConsumer('dispatch.service.queue', {
    [EVENTS.INCIDENT_CREATED]:        handleIncidentCreated,
    [EVENTS.INCIDENT_STATUS_CHANGED]: handleIncidentStatusChanged,
  });

  app.listen(3003, () => console.log('Dispatch Service on :3003'));
};

// ── Route: PUT /vehicles/:id/assign ──────────────────────────────────────────
app.put('/vehicles/:id/assign', async (req, res) => {
  const vehicleId  = req.params.id;
  const { incidentId } = req.body;

  // ... validate availability, create DB assignment, set status DISPATCHED ...
  const vehicle = { id: vehicleId, callSign: 'AMB-01', type: 'AMBULANCE' };

  publish(EVENTS.VEHICLE_ASSIGNED, {
    vehicleId:   vehicle.id,
    callSign:    vehicle.callSign,
    type:        vehicle.type,
    incidentId,
    assignedBy:  req.user?.userId,
    latitude:    5.6037,  // vehicle's last known position
    longitude:   -0.1870,
  }, { source: 'dispatch-service' });

  res.json({ success: true, message: 'Vehicle assigned.' });
});

// ── Route: PUT /vehicles/:id/location ────────────────────────────────────────
// Called by the vehicle's GPS device on a regular interval (e.g. every 10s)
app.put('/vehicles/:id/location', async (req, res) => {
  const vehicleId = req.params.id;
  const { latitude, longitude, speed, heading } = req.body;

  // ... update vehicle row + append to location_pings ...
  const vehicle = { id: vehicleId, callSign: 'AMB-01', type: 'AMBULANCE', status: 'DISPATCHED' };

  publish(EVENTS.VEHICLE_LOCATION_UPDATED, {
    vehicleId:    vehicle.id,
    callSign:     vehicle.callSign,
    type:         vehicle.type,
    status:       vehicle.status,
    latitude,
    longitude,
    speed:        speed   ?? null,
    heading:      heading ?? null,
  }, { source: 'dispatch-service' });

  res.json({ success: true, message: 'Location updated.' });
});

start();
