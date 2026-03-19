// examples/analytics-service.example.js
// ─────────────────────────────────────────────────────────────────────────────
// Shows how the Analytics Service wires up RabbitMQ.
//
// PUBLISHES: nothing — this service is a pure consumer
//
// CONSUMES:
//   incident.created          — creates an IncidentLog row
//   incident.status.changed   — updates timestamps, computes durations
//   vehicle.assigned          — creates an AssignmentLog row
//   vehicle.location.updated  — creates a LocationLog row (moving vehicles only)
//   user.created              — optional: track user growth over time
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const express = require('express');
const { connectRabbitMQ, createConsumer, EVENTS } = require('../src');

const app = express();
app.use(express.json());

// ── Handlers ──────────────────────────────────────────────────────────────────

const handleIncidentCreated = async (data, meta) => {
  console.log(`[analytics] Logging new incident: ${data.incidentId} [${data.type}]`);
  // prisma.incidentLog.upsert({
  //   where:  { incidentId: data.incidentId },
  //   update: {},
  //   create: {
  //     incidentId: data.incidentId,
  //     type:       data.type,
  //     latitude:   data.latitude,
  //     longitude:  data.longitude,
  //     region:     deriveRegion(data.latitude, data.longitude),
  //     reportedAt: new Date(meta.timestamp),
  //   },
  // });
};

const handleIncidentStatusChanged = async (data, meta) => {
  console.log(
    `[analytics] Incident ${data.incidentId}: ${data.prevStatus} → ${data.newStatus}`
  );
  // if (data.newStatus === 'DISPATCHED') update dispatchedAt + compute timeToDispatch
  // if (data.newStatus === 'RESOLVED')  update resolvedAt  + compute timeToResolve
};

const handleVehicleAssigned = async (data, meta) => {
  console.log(`[analytics] Vehicle assigned: ${data.callSign} → ${data.incidentId}`);
  // prisma.assignmentLog.create({ data: { vehicleId, callSign, vehicleType, incidentId, assignedAt } })
};

const handleVehicleLocationUpdated = async (data, meta) => {
  // Skip parked vehicles (speed < 1 km/h) to keep the table lean
  if (data.speed != null && data.speed < 1) return;
  console.log(`[analytics] GPS ping: ${data.callSign} at (${data.latitude}, ${data.longitude})`);
  // prisma.locationLog.create({ data: { ... } })
};

const handleUserCreated = async (data, meta) => {
  console.log(`[analytics] New user registered: ${data.email} [${data.role}]`);
  // Track user growth / role distribution over time
};

// ── Startup ───────────────────────────────────────────────────────────────────
const start = async () => {
  await connectRabbitMQ({ service: 'analytics-service' });

  // Single consumer — all analytics events funnel through one queue
  await createConsumer('analytics.service.queue', {
    [EVENTS.INCIDENT_CREATED]:          handleIncidentCreated,
    [EVENTS.INCIDENT_STATUS_CHANGED]:   handleIncidentStatusChanged,
    [EVENTS.VEHICLE_ASSIGNED]:          handleVehicleAssigned,
    [EVENTS.VEHICLE_LOCATION_UPDATED]:  handleVehicleLocationUpdated,
    [EVENTS.USER_CREATED]:              handleUserCreated,
  });

  app.listen(3004, () => console.log('Analytics Service on :3004'));
};

start();
