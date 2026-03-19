// src/utils/rabbitmq.js
// The analytics service is a PURE CONSUMER — it never publishes.
// It listens for three routing keys and writes structured rows into its own DB.

const amqp   = require('amqplib');
const logger = require('./logger');
const prisma = require('./prisma');
const { deriveRegion } = require('./region');

const EXCHANGE = 'nerdcp.events';
const QUEUE    = 'analytics.service.queue';

// ─────────────────────────────────────────────────────────────────────────────
// Connect & bind
// ─────────────────────────────────────────────────────────────────────────────
const connectRabbitMQ = async () => {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    const ch   = await conn.createChannel();

    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    const { queue } = await ch.assertQueue(QUEUE, { durable: true });

    // The three events this service cares about
    await ch.bindQueue(queue, EXCHANGE, 'incident.created');
    await ch.bindQueue(queue, EXCHANGE, 'incident.status_updated');
    await ch.bindQueue(queue, EXCHANGE, 'vehicle.assigned');
    await ch.bindQueue(queue, EXCHANGE, 'vehicle.location.updated');

    ch.prefetch(5); // process up to 5 messages concurrently
    ch.consume(queue, (msg) => handleMessage(ch, msg), { noAck: false });

    logger.info('RabbitMQ connected — consuming on analytics.service.queue');
    logger.info('  Bound: incident.created');
    logger.info('  Bound: incident.status_updated');
    logger.info('  Bound: vehicle.assigned');
    logger.info('  Bound: vehicle.location.updated');

    conn.on('error', (e) => logger.error('RabbitMQ connection error', e.message));
    conn.on('close', () => {
      logger.warn('RabbitMQ disconnected — retrying in 5s');
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (err) {
    logger.warn(`RabbitMQ unavailable (${err.message}) — retrying in 5s`);
    setTimeout(connectRabbitMQ, 5000);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Message router
// ─────────────────────────────────────────────────────────────────────────────
const handleMessage = async (ch, msg) => {
  if (!msg) return;

  const routingKey = msg.fields.routingKey;

  try {
    const payload = JSON.parse(msg.content.toString());
    logger.info(`Event received ← ${routingKey}`);

    switch (routingKey) {
      case 'incident.created':
        await onIncidentCreated(payload);
        break;
      case 'incident.status_updated':
        await onIncidentStatusUpdated(payload);
        break;
      case 'vehicle.assigned':
        await onVehicleAssigned(payload);
        break;
      case 'vehicle.location.updated':
        await onVehicleLocationUpdated(payload);
        break;
      default:
        logger.warn(`Unhandled routing key: ${routingKey}`);
    }

    ch.ack(msg);
  } catch (err) {
    logger.error(`Failed to process [${routingKey}]`, err.message);
    // nack without requeue — prevents poison-pill loops
    ch.nack(msg, false, false);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Handlers — one per event type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * incident.created
 * Creates a fresh IncidentLog row. This is the "birth" of the incident
 * in the analytics database.
 */
const onIncidentCreated = async (payload) => {
  const { incidentId, type, latitude, longitude, timestamp } = payload;

  const region     = deriveRegion(latitude, longitude);
  const reportedAt = timestamp ? new Date(timestamp) : new Date();

  // upsert guards against duplicate events (RabbitMQ at-least-once delivery)
  await prisma.incidentLog.upsert({
    where:  { incidentId },
    update: {}, // already exists — do nothing
    create: {
      incidentId,
      type:      type || 'OTHER',
      status:    'REPORTED',
      latitude,
      longitude,
      region,
      reportedAt,
    },
  });

  logger.info(`IncidentLog created: ${incidentId} [${type}] region=${region}`);
};

/**
 * incident.status_updated
 * Updates the IncidentLog with dispatch/resolve timestamps and
 * computes derived duration metrics.
 */
const onIncidentStatusUpdated = async (payload) => {
  const { incidentId, newStatus, timestamp } = payload;

  const log = await prisma.incidentLog.findUnique({ where: { incidentId } });
  if (!log) {
    // Edge case: status update arrived before created event (out-of-order)
    logger.warn(`IncidentLog not found for status update: ${incidentId} — skipping`);
    return;
  }

  const eventTime = timestamp ? new Date(timestamp) : new Date();
  const update    = { status: newStatus };

  if (newStatus === 'DISPATCHED' && !log.dispatchedAt) {
    update.dispatchedAt = eventTime;
    // Time from report to first dispatch (seconds)
    update.timeToDispatchSec = Math.round(
      (eventTime.getTime() - log.reportedAt.getTime()) / 1000
    );
  }

  if ((newStatus === 'RESOLVED' || newStatus === 'CLOSED') && !log.resolvedAt) {
    update.resolvedAt = eventTime;
    // Total time from report to resolution (seconds)
    update.timeToResolveSec = Math.round(
      (eventTime.getTime() - log.reportedAt.getTime()) / 1000
    );
  }

  await prisma.incidentLog.update({ where: { incidentId }, data: update });
  logger.info(`IncidentLog updated: ${incidentId} → ${newStatus}`);
};

/**
 * vehicle.assigned
 * Logs each dispatch assignment for resource utilisation tracking.
 */
const onVehicleAssigned = async (payload) => {
  const { vehicleId, callSign, type, incidentId, timestamp } = payload;

  await prisma.assignmentLog.create({
    data: {
      vehicleId,
      callSign:    callSign   || vehicleId,
      vehicleType: type       || 'UNKNOWN',
      incidentId,
      assignedAt:  timestamp ? new Date(timestamp) : new Date(),
    },
  });

  logger.info(`AssignmentLog created: ${callSign} → incident ${incidentId}`);
};

/**
 * vehicle.location.updated
 * Samples GPS pings for resource utilisation stats.
 * We skip identical back-to-back coordinates (vehicle parked) to reduce noise.
 */
const onVehicleLocationUpdated = async (payload) => {
  const { vehicleId, callSign, type, status, latitude, longitude, speed, timestamp } = payload;

  // Skip pings from OFFLINE or stationary vehicles (speed < 1 km/h)
  if (status === 'OFFLINE') return;
  if (speed != null && speed < 1) return;

  await prisma.locationLog.create({
    data: {
      vehicleId,
      callSign:      callSign || vehicleId,
      vehicleType:   type     || 'UNKNOWN',
      vehicleStatus: status   || 'UNKNOWN',
      latitude,
      longitude,
      speed: speed ?? null,
      recordedAt: timestamp ? new Date(timestamp) : new Date(),
    },
  });
};

module.exports = { connectRabbitMQ };
