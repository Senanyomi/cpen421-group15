# NERDCP — Dispatch Tracking Service (Phase 4)

Real-time vehicle fleet management for the National Emergency Response and Dispatch Coordination Platform. Tracks GPS positions, manages vehicle lifecycles, assigns units to incidents, and publishes live location events to RabbitMQ.

---

## Features

| Feature | Detail |
|---|---|
| Register Vehicle | Adds a new unit to the fleet with type and optional starting position |
| Get All Vehicles | Paginated fleet list with optional `status` / `type` filters |
| Get Vehicle by ID | Full detail including active assignment |
| Get Current Location | Latest GPS fix for a specific vehicle |
| Update GPS Location | Stores current ping + appends to history, auto-prunes old records |
| Get Location History | Paginated movement trail with optional time range filter |
| Update Status | Lifecycle transitions enforced |
| Assign to Incident | Links vehicle to incident, advances status to DISPATCHED, publishes event |
| Active Vehicles | All DISPATCHED and ON_SCENE units with their current positions |
| Vehicles by Incident | All units ever assigned to a specific incident |

---

## Tech Stack

- **Node.js** + **Express.js**
- **PostgreSQL** via **Prisma ORM**
- **RabbitMQ** — consumes `incident.*` events, publishes `vehicle.*` events
- **JWT** — verified locally using the shared `JWT_ACCESS_SECRET`

---

## Folder Structure

```
dispatch-service/
├── prisma/
│   ├── schema.prisma          # Vehicle, LocationPing, VehicleAssignment
│   └── seed.js                # Seeds 13 vehicles around Accra, Ghana
├── src/
│   ├── controllers/
│   │   ├── vehicle.controller.js
│   │   └── tracking.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   └── error.middleware.js
│   ├── routes/
│   │   ├── vehicle.routes.js
│   │   └── tracking.routes.js
│   ├── services/
│   │   └── vehicle.service.js    # All business logic
│   ├── utils/
│   │   ├── geo.js               # Haversine distance
│   │   ├── logger.js
│   │   ├── prisma.js
│   │   └── rabbitmq.js          # Publisher + consumer
│   ├── validators/
│   │   └── dispatch.validators.js
│   └── index.js
├── .env.example
└── package.json
```

---

## Vehicle Status Lifecycle

```
  AVAILABLE ──► DISPATCHED ──► ON_SCENE ──► RETURNING ──► AVAILABLE
      │               │             │                          │
      └───────────────┴─────────────┴─── OFFLINE ─────────────┘
                                             │
                                         AVAILABLE
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- RabbitMQ 3+ (optional — service starts without it)
- Identity Service running (shared `JWT_ACCESS_SECRET`)

### Step 1 — Install
```bash
cd dispatch-service
npm install
```

### Step 2 — Configure
```bash
cp .env.example .env
```

```env
PORT=3003
DATABASE_URL="postgresql://postgres:password@localhost:5432/nerdcp_dispatch?schema=public"
JWT_ACCESS_SECRET="must-match-identity-service-secret"
RABBITMQ_URL="amqp://localhost:5672"
GPS_HISTORY_LIMIT=500
```

### Step 3 — Create database
```bash
createdb nerdcp_dispatch
```

### Step 4 — Run migrations
```bash
npm run db:generate
npm run db:migrate
```

### Step 5 — Seed fleet
```bash
npm run db:seed
```
Seeds 13 vehicles (fire trucks, ambulances, police cars, hazmat, rescue, command).

### Step 6 — Start
```bash
npm run dev    # development
npm start      # production
```

---

## API Reference

Base URL: `http://localhost:3003`

All endpoints require: `Authorization: Bearer <accessToken>`

---

### POST /vehicles/register

🔒 Role: `ADMIN`, `DISPATCHER`

Register a new vehicle in the fleet.

**Body:**
```json
{
  "callSign": "AMB-08",
  "type": "AMBULANCE",
  "latitude": 5.6037,
  "longitude": -0.1870
}
```

Valid types: `AMBULANCE`, `POLICE_CAR`, `FIRE_TRUCK`, `HAZMAT_UNIT`, `RESCUE_TEAM`, `COMMAND_UNIT`

**Response 201:**
```json
{
  "success": true,
  "message": "Vehicle registered.",
  "data": {
    "id": "uuid",
    "callSign": "AMB-08",
    "type": "AMBULANCE",
    "status": "AVAILABLE",
    "latitude": 5.6037,
    "longitude": -0.187,
    "lastUpdated": "2025-01-15T10:30:00.000Z"
  }
}
```

---

### GET /vehicles

List all vehicles. Supports filters and pagination.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string | `AVAILABLE`, `DISPATCHED`, `ON_SCENE`, `RETURNING`, `OFFLINE` |
| `type` | string | Vehicle type filter |
| `page` | number | Page number (default: 1) |
| `limit` | number | Per page (default: 20) |

---

### GET /vehicles/:id

Single vehicle with its active assignment (if any).

---

### GET /vehicles/:id/location

Latest GPS fix for a vehicle.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "callSign": "AMB-01",
    "type": "AMBULANCE",
    "status": "DISPATCHED",
    "latitude": 5.5502,
    "longitude": -0.2174,
    "lastUpdated": "2025-01-15T10:31:44.000Z"
  }
}
```

---

### PUT /vehicles/:id/location

Submit a GPS ping. Called by the vehicle device or app. Publishes `vehicle.location.updated` event.

**Body:**
```json
{
  "latitude": 5.5502,
  "longitude": -0.2174,
  "speed": 65.5,
  "heading": 270
}
```

`speed` (km/h) and `heading` (0–360°) are optional. Every ping is stored in history. Old pings beyond `GPS_HISTORY_LIMIT` are automatically pruned.

**RabbitMQ event published:** `vehicle.location.updated`

---

### GET /vehicles/:id/history

Full GPS movement trail for a vehicle.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `page` | number | Page (default: 1) |
| `limit` | number | Pings per page (default: 50) |
| `from` | ISO date | Start of time range |
| `to` | ISO date | End of time range |

```
GET /vehicles/uuid/history?from=2025-01-15T08:00:00Z&to=2025-01-15T12:00:00Z
```

**Response 200:**
```json
{
  "success": true,
  "vehicle": { "id": "uuid", "callSign": "AMB-01", "type": "AMBULANCE" },
  "data": [
    { "id": "uuid", "latitude": 5.55, "longitude": -0.21, "speed": 60, "heading": 180, "recordedAt": "..." },
    ...
  ],
  "pagination": { "page": 1, "limit": 50, "total": 243, "pages": 5 }
}
```

---

### PUT /vehicles/:id/status

Update vehicle operational status.

**Body:**
```json
{ "status": "ON_SCENE" }
```

Invalid transitions return `400` with allowed next states listed.

**RabbitMQ event published:** `vehicle.status_updated`

---

### PUT /vehicles/:id/assign

🔒 Role: `ADMIN`, `DISPATCHER`

Assign a vehicle to an incident. Vehicle must be `AVAILABLE`. Automatically advances to `DISPATCHED`.

**Body:**
```json
{ "incidentId": "incident-uuid" }
```

**RabbitMQ event published:** `vehicle.assigned`

---

### GET /tracking/active

All vehicles currently `DISPATCHED` or `ON_SCENE`, with their latest position and active assignment.

**Response 200:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "uuid",
      "callSign": "AMB-03",
      "type": "AMBULANCE",
      "status": "DISPATCHED",
      "latitude": 5.61,
      "longitude": -0.182,
      "lastUpdated": "2025-01-15T10:32:00.000Z",
      "assignments": [{ "incidentId": "...", "assignedAt": "...", "status": "ACTIVE" }]
    }
  ]
}
```

---

### GET /tracking/incident/:id

All vehicle assignments ever made to a specific incident (active + completed).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "incidentId": "uuid",
    "total": 2,
    "active": 1,
    "assignments": [
      {
        "assignmentId": "uuid",
        "status": "ACTIVE",
        "assignedAt": "2025-01-15T10:30:00.000Z",
        "completedAt": null,
        "vehicle": {
          "callSign": "FIRE-01",
          "type": "FIRE_TRUCK",
          "status": "ON_SCENE",
          "latitude": 5.6037,
          "longitude": -0.187,
          "lastUpdated": "..."
        }
      }
    ]
  }
}
```

---

## RabbitMQ

### Events Published

| Routing Key | Trigger | Key Payload Fields |
|---|---|---|
| `vehicle.location.updated` | GPS ping received | `vehicleId`, `callSign`, `latitude`, `longitude`, `speed`, `heading` |
| `vehicle.assigned` | Vehicle assigned to incident | `vehicleId`, `callSign`, `incidentId`, `assignmentId`, `assignedBy` |
| `vehicle.status_updated` | Status changed | `vehicleId`, `callSign`, `prevStatus`, `newStatus` |

### Events Consumed

| Routing Key | Action |
|---|---|
| `incident.created` | Logs new incident available for dispatch |
| `incident.status_updated` | Auto-completes active assignments when incident is RESOLVED/CLOSED |

---

## GPS History Management

Every `PUT /vehicles/:id/location` call:
1. Updates `vehicles.latitude`, `vehicles.longitude`, `vehicles.lastUpdated`
2. Inserts a new `LocationPing` record
3. Counts total pings for that vehicle
4. If count exceeds `GPS_HISTORY_LIMIT` (default: 500), deletes the oldest records

This keeps the `location_pings` table bounded while preserving recent movement history.
