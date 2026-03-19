# NERDCP — Analytics & Monitoring Service (Phase 5)

Passive event consumer and statistics API for the National Emergency Response and Dispatch Coordination Platform. Listens to the RabbitMQ event bus, builds an analytics data store from real-time events, and exposes query endpoints for dashboards and reports.

---

## Architecture

```
 [Identity Service]          [Incident Service]     [Dispatch Service]
        │                           │                       │
        └───────────────────────────┴───────────────────────┘
                                    │
                         RabbitMQ Topic Exchange
                          (nerdcp.events)
                                    │
                    ┌───────────────┴─────────────────┐
                    │ analytics.service.queue          │
                    │  • incident.created              │
                    │  • incident.status_updated       │
                    │  • vehicle.assigned              │
                    │  • vehicle.location.updated      │
                    └───────────────┬─────────────────┘
                                    │
                        Analytics Service (this)
                        ┌───────────────────────┐
                        │  PostgreSQL            │
                        │  • incident_logs       │
                        │  • assignment_logs     │
                        │  • location_logs       │
                        │  • daily_snapshots     │
                        └───────────────────────┘
                                    │
                         REST API (port 3004)
```

**Key design decisions:**
- This service never calls other services directly — it is 100% event-driven
- Raw events are stored as-is; statistics are computed at query time
- `upsert` on `incidentId` prevents duplicate rows from RabbitMQ redelivery
- Queries default to the last 30 days; all support `?from=&to=` overrides

---

## Features

| Feature | Detail |
|---|---|
| Event Ingestion | Consumes 4 RabbitMQ event types, writes structured rows |
| Response Times | Avg / min / max / P90 time-to-dispatch and time-to-resolve |
| Incidents by Region | Hotspot counts bucketed by 0.1° GPS grid cells |
| Resource Utilisation | Deployments, GPS activity, and top active vehicles per fleet type |
| Summary Dashboard | All metrics in a single parallel-query endpoint |

---

## Folder Structure

```
analytics-service/
├── prisma/
│   └── schema.prisma           # IncidentLog, AssignmentLog, LocationLog, DailySnapshot
├── src/
│   ├── controllers/
│   │   └── analytics.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   └── error.middleware.js
│   ├── routes/
│   │   └── analytics.routes.js
│   ├── services/
│   │   └── analytics.service.js   # All query logic
│   ├── utils/
│   │   ├── dateRange.js           # ?from / ?to parser + duration formatter
│   │   ├── logger.js
│   │   ├── prisma.js
│   │   ├── rabbitmq.js            # Consumer — subscribes to 4 event types
│   │   └── region.js              # GPS → region label (0.1° grid bucketing)
│   └── index.js
├── .env.example
└── package.json
```

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- RabbitMQ 3+
- At least one other NERDCP service running and publishing events

### Step 1 — Install
```bash
cd analytics-service
npm install
```

### Step 2 — Configure
```bash
cp .env.example .env
```

```env
PORT=3004
DATABASE_URL="postgresql://postgres:password@localhost:5432/nerdcp_analytics?schema=public"
JWT_ACCESS_SECRET="must-match-identity-service-secret"
RABBITMQ_URL="amqp://localhost:5672"
NODE_ENV=development
```

### Step 3 — Create database
```bash
createdb nerdcp_analytics
```

### Step 4 — Run migrations
```bash
npm run db:generate
npm run db:migrate
```

### Step 5 — Start
```bash
npm run dev    # development
npm start      # production
```

The service will immediately begin consuming events from RabbitMQ. Data accumulates automatically as other services publish events.

---

## API Reference

Base URL: `http://localhost:3004`

**Authentication:** All endpoints require `Authorization: Bearer <accessToken>`

**Roles allowed:** `ADMIN`, `DISPATCHER`, `ANALYST`

**Date filtering:** All endpoints accept optional `?from=<ISO8601>&to=<ISO8601>`. Default range is the **last 30 days**.

---

### GET /analytics/response-times

How quickly is the platform responding to incidents?

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `from` | ISO date | Start of range |
| `to` | ISO date | End of range |
| `type` | string | Filter to one incident type (e.g. `FIRE`) |

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": { "from": "2025-01-01T00:00:00.000Z", "to": "2025-01-31T23:59:59.000Z" },
    "totalIncidents": 142,
    "timeToDispatch": {
      "avgSec": 187,
      "avgFormatted": "3m 7s",
      "minSec": 23,
      "minFormatted": "23s",
      "maxSec": 1840,
      "maxFormatted": "30m 40s",
      "p90Sec": 420,
      "p90Formatted": "7m 0s",
      "sampleSize": 138
    },
    "timeToResolve": {
      "avgSec": 3420,
      "avgFormatted": "57m 0s",
      ...
    },
    "byType": [
      {
        "type": "MEDICAL",
        "incidentCount": 67,
        "timeToDispatch": { "avgSec": 142, "avgFormatted": "2m 22s", ... },
        "timeToResolve":  { "avgSec": 2100, "avgFormatted": "35m 0s", ... }
      },
      ...
    ]
  }
}
```

---

### GET /analytics/incidents-by-region

Which areas are generating the most incidents?

**Query Parameters:** `from`, `to`, `type`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": { ... },
    "grandTotal": 142,
    "regionCount": 18,
    "regions": [
      {
        "region": "5.6N_0.1W",
        "totalIncidents": 34,
        "sharePercent": 23.9,
        "byType": [
          { "type": "MEDICAL", "count": 18 },
          { "type": "FIRE",    "count": 10 },
          { "type": "POLICE",  "count": 6  }
        ]
      },
      ...
    ]
  }
}
```

Region labels use a 0.1° grid bucket (≈11 km²), e.g. `5.6N_0.1W` means the cell at 5.6°N, 0.1°W. In production, replace `region.js` with a reverse-geocoding call to get named district labels.

---

### GET /analytics/resource-utilization

How hard is each fleet type working?

**Query Parameters:** `from`, `to`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": { ... },
    "totalDeployments": 189,
    "byVehicleType": [
      {
        "vehicleType": "AMBULANCE",
        "deployments": 84,
        "locationPings": 3420,
        "uniqueVehicles": 6,
        "deploymentSharePercent": 44.4
      },
      {
        "vehicleType": "POLICE_CAR",
        "deployments": 61,
        "locationPings": 2180,
        "uniqueVehicles": 8,
        "deploymentSharePercent": 32.3
      },
      ...
    ],
    "mostActiveVehicles": [
      { "vehicleId": "uuid", "callSign": "AMB-01", "vehicleType": "AMBULANCE", "deployments": 22 },
      ...
    ]
  }
}
```

---

### GET /analytics/summary-dashboard

Single endpoint — everything the command-centre screen needs.

**Query Parameters:** `from`, `to`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "period": { "from": "...", "to": "..." },

    "incidents": {
      "total": 142,
      "resolved": 119,
      "resolutionRate": "83.8%",
      "openByStatus": [
        { "status": "REPORTED",     "count": 4  },
        { "status": "DISPATCHED",   "count": 11 },
        { "status": "IN_PROGRESS",  "count": 8  }
      ],
      "byType": [
        { "type": "MEDICAL", "count": 67 },
        { "type": "FIRE",    "count": 35 }
      ]
    },

    "responseTimes": {
      "avgTimeToDispatch": { "sec": 187, "formatted": "3m 7s",  "minSec": 23,   "maxSec": 1840 },
      "avgTimeToResolve":  { "sec": 3420,"formatted": "57m 0s", "minSec": 300,  "maxSec": 18000 }
    },

    "resources": {
      "totalDeployments": 189,
      "deploymentsPerIncident": 1.3
    },

    "recentActivity": {
      "incidents": [ { "incidentId": "...", "type": "FIRE", "status": "IN_PROGRESS", ... } ],
      "assignments": [ { "callSign": "FIRE-01", "incidentId": "...", "assignedAt": "..." } ]
    },

    "trend": [
      { "date": "2025-01-14T00:00:00.000Z", "incidentCount": 6 },
      { "date": "2025-01-15T00:00:00.000Z", "incidentCount": 9 },
      { "date": "2025-01-16T00:00:00.000Z", "incidentCount": 4 }
    ]
  }
}
```

---

## Events Consumed

| Routing Key | DB Table | What is stored |
|---|---|---|
| `incident.created` | `incident_logs` | incidentId, type, lat/lon, region, reportedAt |
| `incident.status_updated` | `incident_logs` (update) | status, dispatchedAt/resolvedAt, computed durations |
| `vehicle.assigned` | `assignment_logs` | vehicleId, callSign, vehicleType, incidentId, assignedAt |
| `vehicle.location.updated` | `location_logs` | vehicleId, position, speed, vehicleStatus |

Events are idempotent — duplicate delivery (RabbitMQ at-least-once) is handled safely:
- `incident_logs` uses `upsert` on `incidentId`
- `assignment_logs` and `location_logs` are append-only — duplicates cause no harm at query time
