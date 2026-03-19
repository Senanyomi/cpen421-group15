// examples/consumer.example.js
// Run with: npm run example:consumer  (start this BEFORE publisher.example.js)
// Subscribes to all NERDCP events and prints them to the console.

require('dotenv').config();
const { connectRabbitMQ, createConsumer, EVENTS } = require('../src');

// ── One handler per event type ────────────────────────────────────────────────

const onUserCreated = async (data, meta) => {
  console.log(`\n  [USER_CREATED]`);
  console.log(`    userId : ${data.userId}`);
  console.log(`    name   : ${data.name}`);
  console.log(`    email  : ${data.email}`);
  console.log(`    role   : ${data.role}`);
  console.log(`    source : ${meta.source}  at ${meta.timestamp}`);
};

const onIncidentCreated = async (data, meta) => {
  console.log(`\n  [INCIDENT_CREATED]`);
  console.log(`    incidentId : ${data.incidentId}`);
  console.log(`    type       : ${data.type}`);
  console.log(`    location   : (${data.latitude}, ${data.longitude})`);
  console.log(`    reportedBy : ${data.reportedBy}`);
  console.log(`    source     : ${meta.source}  at ${meta.timestamp}`);
};

const onIncidentStatusChanged = async (data, meta) => {
  console.log(`\n  [INCIDENT_STATUS_CHANGED]`);
  console.log(`    incidentId : ${data.incidentId}`);
  console.log(`    transition : ${data.prevStatus} → ${data.newStatus}`);
  console.log(`    changedBy  : ${data.changedBy}`);
  console.log(`    source     : ${meta.source}  at ${meta.timestamp}`);
};

const onVehicleAssigned = async (data, meta) => {
  console.log(`\n  [VEHICLE_ASSIGNED]`);
  console.log(`    vehicle    : ${data.callSign} (${data.type})`);
  console.log(`    incidentId : ${data.incidentId}`);
  console.log(`    assignedBy : ${data.assignedBy}`);
  console.log(`    source     : ${meta.source}  at ${meta.timestamp}`);
};

const onVehicleLocationUpdated = async (data, meta) => {
  console.log(`\n  [VEHICLE_LOCATION_UPDATED]`);
  console.log(`    vehicle  : ${data.callSign}  status=${data.status}`);
  console.log(`    position : (${data.latitude}, ${data.longitude})`);
  console.log(`    speed    : ${data.speed ?? 'n/a'} km/h   heading: ${data.heading ?? 'n/a'}°`);
  console.log(`    source   : ${meta.source}  at ${meta.timestamp}`);
};

// ── Start ─────────────────────────────────────────────────────────────────────
const run = async () => {
  await connectRabbitMQ({ service: 'consumer-demo' });

  await createConsumer('demo.consumer.queue', {
    [EVENTS.USER_CREATED]:              onUserCreated,
    [EVENTS.INCIDENT_CREATED]:          onIncidentCreated,
    [EVENTS.INCIDENT_STATUS_CHANGED]:   onIncidentStatusChanged,
    [EVENTS.VEHICLE_ASSIGNED]:          onVehicleAssigned,
    [EVENTS.VEHICLE_LOCATION_UPDATED]:  onVehicleLocationUpdated,
  });

  console.log('\nListening for all NERDCP events. Run publisher.example.js in another terminal.\n');
  // Stay alive
};

run().catch((err) => { console.error(err); process.exit(1); });
