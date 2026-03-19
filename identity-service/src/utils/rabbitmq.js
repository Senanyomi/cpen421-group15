// src/utils/rabbitmq.js
const amqp = require('amqplib');
const logger = require('./logger');

const EXCHANGE = 'nerdcp.events';
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const conn = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await conn.createChannel();
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
    logger.info('RabbitMQ connected');

    conn.on('error', (e) => logger.error('RabbitMQ error', e.message));
    conn.on('close', () => {
      logger.warn('RabbitMQ disconnected — retrying in 5s');
      setTimeout(connectRabbitMQ, 5000);
    });
  } catch (err) {
    logger.warn(`RabbitMQ unavailable (${err.message}) — retrying in 5s`);
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishEvent = (routingKey, payload) => {
  if (!channel) return;
  try {
    const msg = Buffer.from(JSON.stringify({ ...payload, timestamp: new Date() }));
    channel.publish(EXCHANGE, routingKey, msg, { persistent: true });
    logger.info(`Event published → ${routingKey}`);
  } catch (err) {
    logger.error('Failed to publish event', err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent };
