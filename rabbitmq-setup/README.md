# NERDCP — RabbitMQ Communication Layer

Shared connection, publisher, and consumer utilities used by all four NERDCP microservices.

---

## How It Works

```
                     nerdcp.events  (topic exchange)
                     ┌──────────────────────────────────────────────┐
                     │                                              │
  identity-service ──┼──► user.created                             │
                     │    user.deactivated                         │
                     │                                              │
  incident-service ──┼──► incident.created          ──────────────►├──► dispatch.service.queue
                     │    incident.status.changed   ──────────────►├──► analytics.service.queue
                     │                                              │
  dispatch-service ──┼──► vehicle.assigned          ──────────────►├──► analytics.service.queue
                     │    vehicle.location.updated  ──────────────►├──► analytics.service.queue
                     │    vehicle.status.updated                   │
                     │                                              │
                     └──────────────────────────────────────────────┘
```

Each service has its own **durable queue**. Messages are routed by routing key pattern.

---

## File Structure

```
rabbitmq-setup/
├── src/
│   ├── index.js        ← single import point (copy this folder into each service)
│   ├── connection.js   ← connect(), getChannel(), reconnect logic
│   ├── publisher.js    ← publish(routingKey, payload)
│   ├── consumer.js     ← createConsumer(queueName, { routingKey: handler })
│   └── events.js       ← EVENTS constants + EXCHANGE name
├── examples/
│   ├── identity-service.example.js   ← publishes user.created
│   ├── incident-service.example.js   ← publishes incident.*, consumes user.created
│   ├── dispatch-service.example.js   ← publishes vehicle.*, consumes incident.*
│   ├── analytics-service.example.js  ← consumes everything, publishes nothing
│   ├── publisher.example.js          ← runnable demo: fires one of each event
│   └── consumer.example.js           ← runnable demo: prints every event received
└── package.json
```

---

## Quick Start

### 1. Start RabbitMQ

```bash
# Docker (easiest)
docker run -d --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management

# Management UI: http://localhost:15672  (guest / guest)
```

### 2. Install

```bash
cd rabbitmq-setup
npm install
```

### 3. Configure

```bash
cp .env.example .env
# RABBITMQ_URL=amqp://localhost:5672
```

### 4. Run the demo

Open two terminals:

**Terminal 1 — start the consumer first:**
```bash
npm run example:consumer
# Listening for all NERDCP events. Run publisher.example.js in another terminal.
```

**Terminal 2 — fire the events:**
```bash
npm run example:publisher
```

**Expected output in Terminal 1:**
```
  [USER_CREATED]
    userId : user-001
    name   : Kwame Mensah
    role   : DISPATCHER

  [INCIDENT_CREATED]
    incidentId : inc-001
    type       : FIRE
    location   : (5.6037, -0.187)

  [VEHICLE_ASSIGNED]
    vehicle    : FIRE-01 (FIRE_TRUCK)
    incidentId : inc-001

  [INCIDENT_STATUS_CHANGED]
    transition : REPORTED → DISPATCHED

  [VEHICLE_LOCATION_UPDATED]
    vehicle  : FIRE-01  status=DISPATCHED
    speed    : 72.4 km/h   heading: 215°

  [INCIDENT_STATUS_CHANGED]
    transition : IN_PROGRESS → RESOLVED
```

---

## Using in Your Services

### Step 1 — Copy the `src/` folder

Drop the `src/` folder from this project into your service as `src/utils/rabbitmq/`.

### Step 2 — Connect at startup

```js
// src/index.js
const { connectRabbitMQ } = require('./utils/rabbitmq');

const start = async () => {
  await connectRabbitMQ({ service: 'my-service-name' });
  // start express...
};
```

### Step 3 — Publish events

```js
const { publish, EVENTS } = require('./utils/rabbitmq');

// Inside a route handler or service function:
publish(EVENTS.INCIDENT_CREATED, {
  incidentId: incident.id,
  type:       incident.type,
  latitude:   incident.latitude,
  longitude:  incident.longitude,
}, { source: 'incident-service' });
```

### Step 4 — Consume events

```js
const { createConsumer, EVENTS } = require('./utils/rabbitmq');

// Call once after connectRabbitMQ():
await createConsumer('my-service.queue', {
  [EVENTS.INCIDENT_CREATED]: async (data, meta) => {
    console.log('New incident:', data.incidentId);
  },
  [EVENTS.VEHICLE_ASSIGNED]: async (data, meta) => {
    console.log('Vehicle dispatched:', data.callSign);
  },
});
```

---

## Event Reference

### Message Envelope

Every message published through `publish()` is wrapped in this envelope:

```json
{
  "eventType":  "incident.created",
  "source":     "incident-service",
  "timestamp":  "2025-01-15T10:30:00.000Z",
  "data": {
    // ... your payload ...
  }
}
```

Your handler receives `data` and the rest as `meta`.

---

### `incident.created`

Published by: **Incident Service**  
Consumed by: **Dispatch Service**, **Analytics Service**

```json
{
  "incidentId": "uuid",
  "type":       "FIRE",
  "status":     "REPORTED",
  "latitude":   5.6037,
  "longitude":  -0.1870,
  "reportedBy": "user-uuid"
}
```

---

### `incident.status.changed`

Published by: **Incident Service**  
Consumed by: **Dispatch Service** (to release vehicles), **Analytics Service** (to record durations)

```json
{
  "incidentId": "uuid",
  "prevStatus": "REPORTED",
  "newStatus":  "DISPATCHED",
  "changedBy":  "user-uuid"
}
```

---

### `vehicle.assigned`

Published by: **Dispatch Service**  
Consumed by: **Analytics Service**

```json
{
  "vehicleId":   "uuid",
  "callSign":    "FIRE-01",
  "type":        "FIRE_TRUCK",
  "incidentId":  "uuid",
  "assignedBy":  "user-uuid",
  "latitude":    5.6100,
  "longitude":   -0.1820
}
```

---

### `vehicle.location.updated`

Published by: **Dispatch Service** (on every GPS ping)  
Consumed by: **Analytics Service**

```json
{
  "vehicleId":  "uuid",
  "callSign":   "FIRE-01",
  "type":       "FIRE_TRUCK",
  "status":     "DISPATCHED",
  "latitude":   5.6055,
  "longitude":  -0.1845,
  "speed":      72.4,
  "heading":    215
}
```

---

### `user.created`

Published by: **Identity Service**  
Consumed by: **Incident Service** (optional cache), **Analytics Service**

```json
{
  "userId": "uuid",
  "name":   "Kwame Mensah",
  "email":  "kwame@nerdcp.gov",
  "role":   "DISPATCHER"
}
```

---

## Service Queue Map

| Service | Queue Name | Bound Events |
|---|---|---|
| Dispatch | `dispatch.service.queue` | `incident.created`, `incident.status.changed` |
| Analytics | `analytics.service.queue` | `incident.created`, `incident.status.changed`, `vehicle.assigned`, `vehicle.location.updated`, `user.created` |
| Incident | `incident.service.queue` | `user.created` |

---

## Key Design Decisions

**Why a topic exchange?**  
Topic exchanges route by pattern. Binding `incident.*` would match both `incident.created` and `incident.status.changed`. Right now we use exact keys, but patterns are available when needed.

**Why durable queues?**  
If a service restarts, messages that arrived while it was down are still in its queue waiting to be processed. Nothing is lost.

**Why nack without requeue on errors?**  
Re-queuing a message that threw an exception would cause an infinite retry loop. The safe default is to discard it (nack + no requeue). In production, route these to a dead-letter exchange for inspection.

**Why one channel per service?**  
A single channel is sufficient for the load of a single microservice. Each publish is fast and non-blocking. Multiple channels per connection are only needed for high-throughput publishers.
