// src/connection.js
// ─────────────────────────────────────────────────────────────────────────────
// Manages a single RabbitMQ connection + channel for the process.
//
// Usage in any service:
//   const { getChannel, connectRabbitMQ } = require('./connection');
//   await connectRabbitMQ();           // call once at startup
//   const channel = getChannel();      // use anywhere after that
// ─────────────────────────────────────────────────────────────────────────────

const amqp   = require('amqplib');
const { EXCHANGE } = require('./events');

// Module-level references — one connection and one channel per process
let connection = null;
let channel    = null;

// Track which service this is (set at connect time, used in log output)
let serviceName = 'service';

// ─── Simple console logger ────────────────────────────────────────────────────
const log = (level, msg) => {
  const ts  = new Date().toISOString();
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(`[${ts}] ${level.toUpperCase().padEnd(5)} [${serviceName}] [rabbitmq] ${msg}`);
};

// ─── Connect ──────────────────────────────────────────────────────────────────
/**
 * Establishes the connection and creates the shared channel.
 * Automatically retries every 5 seconds if RabbitMQ is not yet available —
 * useful during container startup where the broker may boot after the app.
 *
 * @param {object} options
 * @param {string} options.url         RabbitMQ URL (default: process.env.RABBITMQ_URL)
 * @param {string} options.service     Label used in log output (default: 'service')
 * @param {number} options.retryDelay  Ms between reconnect attempts (default: 5000)
 */
const connectRabbitMQ = async ({
  url         = process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  service     = 'service',
  retryDelay  = 5000,
} = {}) => {
  serviceName = service;

  try {
    log('info', `Connecting to ${url} ...`);

    connection = await amqp.connect(url);
    channel    = await connection.createChannel();

    // Declare the topic exchange — idempotent, safe to call repeatedly
    await channel.assertExchange(EXCHANGE, 'topic', { durable: true });

    log('info', `Connected. Exchange "${EXCHANGE}" ready.`);

    // ── Reconnect handlers ────────────────────────────────────────────────────
    connection.on('error', (err) => {
      log('error', `Connection error: ${err.message}`);
    });

    connection.on('close', () => {
      log('warn', `Connection closed — reconnecting in ${retryDelay}ms ...`);
      connection = null;
      channel    = null;
      setTimeout(() => connectRabbitMQ({ url, service, retryDelay }), retryDelay);
    });

  } catch (err) {
    log('warn', `Could not connect (${err.message}) — retrying in ${retryDelay}ms ...`);
    await new Promise((resolve) => setTimeout(resolve, retryDelay));
    return connectRabbitMQ({ url, service, retryDelay });
  }
};

// ─── Getters ──────────────────────────────────────────────────────────────────
/**
 * Returns the active channel.
 * Throws if connectRabbitMQ() has not been called yet.
 */
const getChannel = () => {
  if (!channel) throw new Error('RabbitMQ channel not ready. Call connectRabbitMQ() first.');
  return channel;
};

const getConnection = () => connection;

const isConnected = () => channel !== null;

module.exports = { connectRabbitMQ, getChannel, getConnection, isConnected };
