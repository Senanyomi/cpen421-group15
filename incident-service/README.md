# NERDCP — Emergency Incident Service (Phase 3)

Manages the full lifecycle of emergency incidents — from the moment they're reported to when they're closed and archived.

---

## Features

| Feature | Detail |
|---|---|
| Create Incident | Reports a new emergency with GPS coordinates |
| Get All Incidents | Paginated list with optional `status` and `type` filters |
| Get Active Incidents | All incidents not yet RESOLVED or CLOSED |
| Get Incident by ID | Full detail including all notes |
| Update Status | Lifecycle transitions enforced (see diagram below) |
| Assign Responder | Links a vehicle/unit, auto-advances status to DISPATCHED |
| Add Note | Field-level notes attached to an incident |
| Delete Incident | Hard delete — only allowed on RESOLVED or CLOSED incidents |
| Nearest Responders | Haversine distance search across available units |

---

## Tech Stack

- **Node.js** + **Express.js**
- **PostgreSQL** via **Prisma ORM**
- **RabbitMQ** (amqplib) — publishes events on every state change
- **JWT** — tokens verified locally using the shared `JWT_ACCESS_SECRET`

---

## Folder Structure

```
incident-service/
├── prisma/
│   ├── schema.prisma          # Incident, IncidentNote, Responder models
│   └── seed.js                # Seeds 10 mock responders around Accra, Ghana
├── src/
│   ├── controllers/
│   │   └── incident.controller.js   # HTTP layer only
│   ├── middleware/
│   │   ├── auth.middleware.js        # JWT verification + role guard
│   │   └── error.middleware.js       # Global error handler
│   ├── routes/
│   │   ├── incident.routes.js
│   │   └── responder.routes.js
│   ├── services/
│   │   └── incident.service.js      # All business logic
│   ├── utils/
│   │   ├── geo.js                   # Haversine formula
│   │   ├── logger.js
│   │   ├── prisma.js
│   │   └── rabbitmq.js
│   ├── validators/
│   │   └── incident.validators.js
│   └── index.js
├── .env.example
└── package.json
```

---

## Incident Status Lifecycle

```
  REPORTED ──► ACKNOWLEDGED ──► DISPATCHED ──► IN_PROGRESS ──► RESOLVED ──► CLOSED
     │               │               │               │               │
     └───────────────┴───────────────┴───────────────┴───────────────┴──► CLOSED
```

Each arrow is an allowed transition — the service will reject invalid jumps with a `400` error.

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- RabbitMQ 3+ (optional — service starts without it)
- Identity Service running (shared `JWT_ACCESS_SECRET`)

### Step 1 — Install dependencies
```bash
cd incident-service
npm install
```

### Step 2 — Configure environment
```bash
cp .env.example .env
```

```env
PORT=3002
DATABASE_URL="postgresql://postgres:password@localhost:5432/nerdcp_incidents?schema=public"
JWT_ACCESS_SECRET="must-match-identity-service-secret"
RABBITMQ_URL="amqp://localhost:5672"
NODE_ENV=development
```

### Step 3 — Create the database
```bash
createdb nerdcp_incidents
```

### Step 4 — Run migrations
```bash
npm run db:generate
npm run db:migrate
```

### Step 5 — Seed mock responders
```bash
npm run db:seed
```
Inserts 10 mock responders (fire trucks, ambulances, police cars, etc.) around Accra, Ghana.
Edit `prisma/seed.js` to change the coordinates to your region.

### Step 6 — Start
```bash
npm run dev     # development
npm start       # production
```

---

## API Reference

Base URL: `http://localhost:3002`

All endpoints require: `Authorization: Bearer <accessToken>`

---

### POST /incidents

Create a new incident.

**Body:**
```json
{
  "type": "FIRE",
  "description": "Building fire on the 3rd floor, smoke visible from street.",
  "latitude": 5.6037,
  "longitude": -0.1870
}
```

Valid types: `FIRE`, `MEDICAL`, `POLICE`, `NATURAL_DISASTER`, `HAZMAT`, `TRAFFIC`, `OTHER`

**Response 201:**
```json
{
  "success": true,
  "message": "Incident reported.",
  "data": {
    "id": "uuid",
    "type": "FIRE",
    "description": "Building fire...",
    "latitude": 5.6037,
    "longitude": -0.187,
    "status": "REPORTED",
    "assignedVehicleId": null,
    "reportedBy": "user-uuid",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**RabbitMQ event published:** `incident.created`

---

### GET /incidents

Paginated list of all incidents.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string | Filter by status |
| `type` | string | Filter by incident type |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |

```
GET /incidents?status=REPORTED&type=FIRE&page=1&limit=10
```

---

### GET /incidents/open

Returns all incidents with status `REPORTED`, `ACKNOWLEDGED`, `DISPATCHED`, or `IN_PROGRESS`.
Sorted by status stage then by age (oldest first).

---

### GET /incidents/:id

Full incident detail including all notes.

---

### PUT /incidents/:id/status

🔒 Role: `ADMIN`, `DISPATCHER`, `OPERATOR`

Update the incident lifecycle status.

**Body:**
```json
{ "status": "ACKNOWLEDGED" }
```

Invalid transitions return a `400` with a message listing allowed next states.

**RabbitMQ event published:** `incident.status_updated`

---

### PUT /incidents/:id/assign

🔒 Role: `ADMIN`, `DISPATCHER`

Assign a vehicle/unit to the incident. Automatically advances status to `DISPATCHED` if the incident is still `REPORTED` or `ACKNOWLEDGED`.

**Body:**
```json
{ "assignedVehicleId": "vehicle-uuid-from-dispatch-service" }
```

**RabbitMQ event published:** `incident.responder_assigned`

---

### POST /incidents/:id/notes

Add a field note to an incident (cannot add to CLOSED incidents).

**Body:**
```json
{ "content": "Fire contained to one room. No casualties. Power cut to building." }
```

**RabbitMQ event published:** `incident.note_added`

---

### DELETE /incidents/:id

🔒 Role: `ADMIN`

Hard-deletes the incident. The incident must be `RESOLVED` or `CLOSED` first.

---

### GET /responders/nearest

Finds available responders sorted by Haversine distance from the given coordinates.

**Query Parameters:**
| Param | Type | Required | Description |
|---|---|---|---|
| `lat` | float | ✅ | Incident latitude |
| `lon` | float | ✅ | Incident longitude |
| `limit` | int | | Max results to return (default: 5) |
| `type` | string | | Filter by responder type |
| `status` | string | | Filter by status (default: `AVAILABLE`) |

```
GET /responders/nearest?lat=5.6037&lon=-0.1870&limit=3&type=AMBULANCE
```

**Response 200:**
```json
{
  "success": true,
  "count": 3,
  "query": { "lat": 5.6037, "lon": -0.187, "limit": 3, "status": "AVAILABLE", "type": "AMBULANCE" },
  "data": [
    {
      "id": "uuid",
      "name": "Ambulance A1 — Korle-Bu",
      "type": "AMBULANCE",
      "status": "AVAILABLE",
      "latitude": 5.5364,
      "longitude": -0.2275,
      "distanceKm": 8.41
    },
    ...
  ]
}
```

---

## RabbitMQ Events Published

All events go to the `nerdcp.events` topic exchange.

| Routing Key | Trigger | Payload |
|---|---|---|
| `incident.created` | New incident reported | `incidentId`, `type`, `status`, `latitude`, `longitude`, `reportedBy` |
| `incident.status_updated` | Status changed | `incidentId`, `prevStatus`, `newStatus`, `updatedBy` |
| `incident.responder_assigned` | Vehicle assigned | `incidentId`, `assignedVehicleId`, `newStatus`, `assignedBy` |
| `incident.note_added` | Note attached | `incidentId`, `noteId`, `authorId` |
| `incident.deleted` | Incident removed | `incidentId` |

---

## Haversine Distance Formula

The nearest-responder endpoint uses the Haversine formula to calculate great-circle distance between two GPS points. It accounts for the curvature of the Earth and is accurate to within ~0.5% for typical emergency dispatch distances.

```
a = sin²(Δlat/2) + cos(lat1) × cos(lat2) × sin²(Δlon/2)
d = 2R × atan2(√a, √(1-a))
```

Where `R = 6371 km` (Earth's mean radius).
