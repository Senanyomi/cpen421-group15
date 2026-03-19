// src/utils/rabbitmq.js
const amqp   = require('amqplib');
const logger = require('./logger');

const EXCHANGE = 'nerdcp.events';
let channel   = null;

// ─── Connect ──────────────────────────────────────────────────────────────────
const connectRabbitMQ = async () => {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel    = await conn.createChannel();

    // Topic exchange — routing keys like "incident.created", "incident.status_updated"
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    logger.info('RabbitMQ connected');

    conn.on('error', (e) => logger.error('RabbitMQ connection error', e.message));
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

// ─── Publish ──────────────────────────────────────────────────────────────────
const publishEvent = (routingKey, payload) => {
  if (!channel) {
    logger.warn(`Cannot publish "${routingKey}" — RabbitMQ not connected`);
    return;
  }
  try {
    const msg = Buffer.from(
      JSON.stringify({ ...payload, source: 'incident-service', timestamp: new Date().toISOString() })
    );
    channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
    logger.info(`Event published → ${routingKey}`);
  } catch (err) {
    logger.error('Failed to publish event', err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent };
