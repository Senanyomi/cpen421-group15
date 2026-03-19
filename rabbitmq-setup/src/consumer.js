// src/consumer.js
// ─────────────────────────────────────────────────────────────────────────────
// Creates a named, durable queue and starts consuming messages.
//
// Each service calls createConsumer() once at startup with its own queue name
// and a map of { routingKey → handlerFn }.
//
// Usage:
//   const { createConsumer } = require('./consumer');
//   const { EVENTS } = require('./events');
//
//   await createConsumer('analytics.service.queue', {
//     [EVENTS.INCIDENT_CREATED]:       handleIncidentCreated,
//     [EVENTS.VEHICLE_ASSIGNED]:       handleVehicleAssigned,
//     [EVENTS.VEHICLE_LOCATION_UPDATED]: handleLocationUpdate,
//   });
//
// Handler signature:
//   async function handleIncidentCreated(data, meta) {
//     // data = the payload object you published
//     // meta = { eventType, source, timestamp, rawMessage }
//   }
// ─────────────────────────────────────────────────────────────────────────────

const { getChannel } = require('./connection');
const { EXCHANGE }   = require('./events');

const log = (level, msg) => {
  const ts  = new Date().toISOString();
  const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  out(`[${ts}] ${level.toUpperCase().padEnd(5)} [rabbitmq:consumer] ${msg}`);
};

/**
 * @param {string}  queueName   Unique name for this service's queue.
 *                              Messages survive restarts because the queue is durable.
 * @param {object}  handlers    Map of routingKey → async function(data, meta)
 * @param {object}  [options]
 * @param {number}  [options.prefetch]  Max unacked messages in flight (default: 5)
 */
const createConsumer = async (queueName, handlers, { prefetch = 5 } = {}) => {
  const channel = getChannel();

  // Durable queue — survives RabbitMQ restarts, messages are not lost
  await channel.assertQueue(queueName, { durable: true });

  // Bind every routing key the caller cares about
  const routingKeys = Object.keys(handlers);
  for (const key of routingKeys) {
    await channel.bindQueue(queueName, EXCHANGE, key);
    log('info', `  bound: "${key}" → ${queueName}`);
  }

  // Process at most `prefetch` messages at once before sending more acks
  channel.prefetch(prefetch);

  // Start consuming
  channel.consume(queueName, async (msg) => {
    if (!msg) return; // consumer cancelled by broker

    const routingKey = msg.fields.routingKey;

    try {
      // Parse the envelope written by publisher.js
      const envelope = JSON.parse(msg.content.toString());
      const { data, eventType, source, timestamp } = envelope;

      log('info', `← received  [${routingKey}] from=${source} at=${timestamp}`);

      const handler = handlers[routingKey];

      if (!handler) {
        // Bound but no handler — this shouldn't happen, but ack and move on
        log('warn', `No handler registered for "${routingKey}" — message acked and skipped`);
        channel.ack(msg);
        return;
      }

      // Call the handler — pass data and the full envelope as meta
      await handler(data, { eventType, source, timestamp, rawMessage: msg });

      channel.ack(msg); // tell RabbitMQ the message was processed successfully

    } catch (err) {
      log('error', `Handler for "${routingKey}" threw: ${err.message}`);
      // nack without requeue — prevents poison messages from looping forever
      // In production you'd route these to a dead-letter exchange instead
      channel.nack(msg, false, false);
    }
  });

  log('info', `Consumer ready on queue "${queueName}" (${routingKeys.length} binding(s))`);
};

module.exports = { createConsumer };
