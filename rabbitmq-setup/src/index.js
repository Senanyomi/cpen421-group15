// src/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Drop this entire src/ folder into any NERDCP microservice.
// Import everything from this single entry point:
//
//   const {
//     connectRabbitMQ,
//     publish,
//     createConsumer,
//     EVENTS,
//     EXCHANGE,
//   } = require('./utils/rabbitmq');
// ─────────────────────────────────────────────────────────────────────────────

const { connectRabbitMQ, getChannel, isConnected } = require('./connection');
const { publish }         = require('./publisher');
const { createConsumer }  = require('./consumer');
const { EVENTS, EXCHANGE } = require('./events');

module.exports = {
  // ── Setup ────────────────────────────────────────────────────────────────
  connectRabbitMQ,
  getChannel,
  isConnected,

  // ── Publishing ────────────────────────────────────────────────────────────
  publish,

  // ── Consuming ────────────────────────────────────────────────────────────
  createConsumer,

  // ── Constants ─────────────────────────────────────────────────────────────
  EVENTS,
  EXCHANGE,
};
