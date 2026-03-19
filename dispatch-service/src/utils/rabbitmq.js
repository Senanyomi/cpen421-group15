// src/utils/rabbitmq.js
const amqp   = require('amqplib');
const logger = require('./logger');

const EXCHANGE  = 'nerdcp.events';
const QUEUE     = 'dispatch.service.queue';
let channel     = null;

// ─── Connect ──────────────────────────────────────────────────────────────────
const connectRabbitMQ = async () => {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel    = await conn.createChannel();

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    // This service CONSUMES incident events and PUBLISHES vehicle events
    const { queue } = await channel.assertQueue(QUEUE, { durable: true });
    await channel.bindQueue(queue, EXCHANGE, 'incident.created');
    await channel.bindQueue(queue, EXCHANGE, 'incident.status_updated');

    channel.prefetch(1); // process one message at a time
    channel.consume(queue, handleIncomingMessage, { noAck: false });

    logger.info('RabbitMQ connected — listening on dispatch.service.queue');

    conn.on('error', (e) => logger.error('RabbitMQ error', e.message));
    conn.on('close', () => {
      logger.warn('RabbitMQ disconnected — retrying in 5s');
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (err) {
    logger.warn(`RabbitMQ unavailable (${err.message}) — retrying in 5s`);
    setTimeout(connectRabbitMQ, 5000);
  }
};

// ─── Incoming message router ──────────────────────────────────────────────────
const handleIncomingMessage = async (msg) => {
  if (!msg) return;
  try {
    const payload    = JSON.parse(msg.content.toString());
    const routingKey = msg.fields.routingKey;

    logger.info(`Event received ← ${routingKey}`);

    if (routingKey === 'incident.created') {
      logger.info(`New incident queued for dispatch: ${payload.incidentId} [${payload.type}]`);
      // Dispatcher will use POST /vehicles/:id/assign to act on this
    }

    if (routingKey === 'incident.status_updated') {
      // If an incident is CLOSED, auto-complete active assignments for it
      if (['RESOLVED', 'CLOSED'].includes(payload.newStatus)) {
        const prisma = require('./prisma');
        const updated = await prisma.vehicleAssignment.updateMany({
          where:  { incidentId: payload.incidentId, status: 'ACTIVE' },
          data:   { status: 'COMPLETED', completedAt: new Date() },
        });
        if (updated.count > 0) {
          logger.info(`Auto-completed ${updated.count} assignment(s) for incident ${payload.incidentId}`);
        }
      }
    }

    channel.ack(msg);
  } catch (err) {
    logger.error('Failed to process message', err.message);
    channel.nack(msg, false, false); // discard — don't requeue poison messages
  }
};

// ─── Publish ──────────────────────────────────────────────────────────────────
const publishEvent = (routingKey, payload) => {
  if (!channel) {
    logger.warn(`Cannot publish "${routingKey}" — RabbitMQ not ready`);
    return;
  }
  try {
    const msg = Buffer.from(
      JSON.stringify({ ...payload, source: 'dispatch-service', timestamp: new Date().toISOString() })
    );
    channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
    logger.info(`Event published → ${routingKey}`);
  } catch (err) {
    logger.error('Failed to publish event', err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent };
