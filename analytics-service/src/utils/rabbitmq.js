// src/utils/rabbitmq.js
const amqp = require('amqplib');
const logger = require('./logger');

const EXCHANGE = 'nerdcp.events';
const QUEUE = 'analytics.queue'; // change per service

let channel = null;
let connection = null;

const connectRabbitMQ = async (routingKeys = []) => {
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';

  try {
    connection = await amqp.connect(url);
    channel = await connection.createChannel();

    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    const q = await channel.assertQueue(QUEUE, { durable: true });

    // Bind routing keys
    for (const key of routingKeys) {
      await channel.bindQueue(q.queue, EXCHANGE, key);
    }

    logger.info('RabbitMQ connected (Consumer ready)');

    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', err.message);
    });

    connection.on('close', () => {
      logger.warn('RabbitMQ disconnected — retrying in 5s');
      channel = null;
      setTimeout(() => connectRabbitMQ(routingKeys), 5000);
    });

  } catch (err) {
    logger.warn(`RabbitMQ unavailable (${err.message}) — retrying in 5s`);
    setTimeout(() => connectRabbitMQ(routingKeys), 5000);
  }
};

const consumeEvents = (handler) => {
  if (!channel) {
    logger.warn('Cannot consume — RabbitMQ not connected');
    return;
  }

  channel.consume(QUEUE, (msg) => {
    if (msg) {
      try {
        const data = JSON.parse(msg.content.toString());
        handler(data);

        channel.ack(msg);
      } catch (err) {
        logger.error('Error processing message', err.message);
        channel.nack(msg);
      }
    }
  });

  logger.info(`Listening for events on ${QUEUE}`);
};

module.exports = { connectRabbitMQ, consumeEvents };