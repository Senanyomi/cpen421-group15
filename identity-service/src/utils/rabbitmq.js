// src/utils/rabbitmq.js
const amqp = require('amqplib');
const logger = require('./logger');

const EXCHANGE = 'nerdcp.events';

let channel = null;
let connection = null;

const connectRabbitMQ = async () => {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    logger.info('RabbitMQ connected');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', err.message);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ disconnected — retrying in 5s');
      channel = null;
      setTimeout(connectRabbitMQ, 5000);
    });

  } catch (err) {
    logger.warn(`RabbitMQ unavailable (${err.message}) — retrying in 5s`);
    setTimeout(connectRabbitMQ, 5000);
  }
};

const publishEvent = async (routingKey, payload) => {
  if (!channel) {
    logger.warn('Cannot publish event — RabbitMQ not connected');
    return;
  }

  try {
    const message = Buffer.from(
      JSON.stringify({
        ...payload,
        timestamp: new Date().toISOString(),
      })
    );

    channel.publish(EXCHANGE, routingKey, message, {
      persistent: true,
    });

    logger.info(`Event published → ${routingKey}`);
  } catch (err) {
    logger.error('Failed to publish event', err.message);
  }
};

module.exports = { connectRabbitMQ, publishEvent };