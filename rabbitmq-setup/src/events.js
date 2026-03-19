// src/events.js
// ─────────────────────────────────────────────────────────────────────────────
// All RabbitMQ routing keys used across NERDCP services.
//
// Copy this file into each microservice's src/utils/ folder so every service
// references the same constant names rather than hard-coding strings.
// ─────────────────────────────────────────────────────────────────────────────

const EVENTS = {
  // ── Incident Service publishes ────────────────────────────────────────────
  INCIDENT_CREATED:        'incident.created',
  INCIDENT_STATUS_CHANGED: 'incident.status.changed',

  // ── Dispatch Service publishes ────────────────────────────────────────────
  VEHICLE_ASSIGNED:          'vehicle.assigned',
  VEHICLE_LOCATION_UPDATED:  'vehicle.location.updated',
  VEHICLE_STATUS_UPDATED:    'vehicle.status.updated',

  // ── Identity Service publishes ────────────────────────────────────────────
  USER_CREATED:    'user.created',
  USER_DEACTIVATED:'user.deactivated',
};

// The single exchange all NERDCP services use.
// Type: topic — routing keys with wildcards (e.g. "incident.*") work here.
const EXCHANGE = 'nerdcp.events';

module.exports = { EVENTS, EXCHANGE };
