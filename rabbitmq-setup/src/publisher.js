// src/publisher.js
// ─────────────────────────────────────────────────────────────────────────────
// Publishes a single event to the nerdcp.events exchange.
//
// Every message automatically receives:
//   - timestamp  — ISO string of when the event was emitted
//   - source     — the service name passed to connectRabbitMQ()
//   - eventType  — copy of the routing key, handy for consumers
//
// Usage:
//   const { publish } = require('./publisher');
//   const { EVENTS }  = require('./events');
//
//   publish(EVENTS.INCIDENT_CREATED, {
//     incidentId: 'abc-123',
//     type: 'FIRE',
//     latitude: 5.60,
//     longitude: -0.18,
//   });
// ─────────────────────────────────────────────────────────────────────────────

const { getChannel, isConnected } = require('./connection');
const { EXCHANGE } = require('./events');

const log = (level, msg) => {
  const ts  = new Date().toISOString();
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(`[${ts}] ${level.toUpperCase().padEnd(5)} [rabbitmq:publisher] ${msg}`);
};

/**
 * Publish an event to the exchange.
 *
 * @param {string} routingKey   One of the EVENTS constants, e.g. 'incident.created'
 * @param {object} payload      Any serialisable object
 * @param {object} [options]
 * @param {string} [options.source]    Service name added to the message envelope
 * @param {boolean}[options.persistent] Survive broker restart (default: true)
 * @returns {boolean}  true if published, false if channel not ready
 */
const publish = (routingKey, payload, { source = 'unknown', persistent = true } = {}) => {
  if (!isConnected()) {
    log('warn', `Cannot publish "${routingKey}" — channel not ready. Event dropped.`);
    return false;
  }

  try {
    const envelope = {
      eventType:  routingKey,
      source,
      timestamp:  new Date().toISOString(),
      data:       payload,
    };

    const buffer  = Buffer.from(JSON.stringify(envelope));
    const channel = getChannel();

    channel.publish(EXCHANGE, routingKey, buffer, { persistent });

    log('info', `→ published  [${routingKey}]`);
    return true;

  } catch (err) {
    log('error', `Failed to publish "${routingKey}": ${err.message}`);
    return false;
  }
};

module.exports = { publish };
