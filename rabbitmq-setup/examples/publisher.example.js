// examples/publisher.example.js
// Run with: npm run example:publisher
// Publishes one of each event type so you can watch them arrive in the consumer.

require('dotenv').config();
const { connectRabbitMQ, publish, EVENTS } = require('../src');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  await connectRabbitMQ({ service: 'publisher-demo' });

  console.log('\nPublishing sample events ...\n');

  // 1. user.created
  publish(EVENTS.USER_CREATED, {
    userId: 'user-001',
    name:   'Kwame Mensah',
    email:  'kwame@nerdcp.gov',
    role:   'DISPATCHER',
  }, { source: 'identity-service' });
  await sleep(300);

  // 2. incident.created
  publish(EVENTS.INCIDENT_CREATED, {
    incidentId: 'inc-001',
    type:       'FIRE',
    status:     'REPORTED',
    latitude:   5.6037,
    longitude:  -0.1870,
    reportedBy: 'user-001',
  }, { source: 'incident-service' });
  await sleep(300);

  // 3. vehicle.assigned
  publish(EVENTS.VEHICLE_ASSIGNED, {
    vehicleId:   'veh-001',
    callSign:    'FIRE-01',
    type:        'FIRE_TRUCK',
    incidentId:  'inc-001',
    assignedBy:  'user-001',
    latitude:    5.6100,
    longitude:   -0.1820,
  }, { source: 'dispatch-service' });
  await sleep(300);

  // 4. incident.status.changed
  publish(EVENTS.INCIDENT_STATUS_CHANGED, {
    incidentId: 'inc-001',
    prevStatus: 'REPORTED',
    newStatus:  'DISPATCHED',
    changedBy:  'user-001',
  }, { source: 'incident-service' });
  await sleep(300);

  // 5. vehicle.location.updated
  publish(EVENTS.VEHICLE_LOCATION_UPDATED, {
    vehicleId:  'veh-001',
    callSign:   'FIRE-01',
    type:       'FIRE_TRUCK',
    status:     'DISPATCHED',
    latitude:   5.6055,
    longitude:  -0.1845,
    speed:      72.4,
    heading:    215,
  }, { source: 'dispatch-service' });
  await sleep(300);

  // 6. incident resolved
  publish(EVENTS.INCIDENT_STATUS_CHANGED, {
    incidentId: 'inc-001',
    prevStatus: 'IN_PROGRESS',
    newStatus:  'RESOLVED',
    changedBy:  'user-001',
  }, { source: 'incident-service' });

  console.log('\nAll events published. Exiting in 1s ...\n');
  await sleep(1000);
  process.exit(0);
};

run().catch((err) => { console.error(err); process.exit(1); });
