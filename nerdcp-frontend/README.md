# NERDCP Frontend

React + Vite frontend for the National Emergency Response and Dispatch Coordination Platform.

## Pages

| Route | Page | API Used |
|---|---|---|
| `/login` | Login | `POST /auth/login` |
| `/` | Dashboard | `GET /analytics/summary-dashboard`, `GET /incidents/open` |
| `/incidents` | Incident Management | `GET/POST /incidents`, `PUT /incidents/:id/status`, `PUT /incidents/:id/assign` |
| `/vehicles` | Vehicle Tracking | `GET /vehicles`, `GET /vehicles/:id/location` |
| `/analytics` | Analytics Dashboard | `GET /analytics/response-times`, `/incidents-by-region`, `/resource-utilization` |

## Setup

```bash
npm install
cp .env.example .env    # fill in your backend URLs
npm run dev             # http://localhost:5173
```

## API Service

All API calls go through `src/api/index.js`:

```js
import api from './api'

// Auth
const res = await api.auth.login(email, password)

// Incidents
const list   = await api.incidents.list({ status: 'REPORTED', page: 1 })
const single = await api.incidents.get(id)
await api.incidents.create({ type, description, latitude, longitude })
await api.incidents.updateStatus(id, 'DISPATCHED')
await api.incidents.assign(id, vehicleId)

// Vehicles
const fleet  = await api.vehicles.list({ status: 'AVAILABLE' })
const loc    = await api.vehicles.location(id)
const active = await api.tracking.active()

// Analytics
const dash   = await api.analytics.dashboard()
const times  = await api.analytics.responseTimes({ from, to })
```

## Folder Structure

```
src/
├── api/
│   ├── index.js          ← centralized API service (single import)
│   ├── axios.js          ← axios instances (used internally)
│   ├── auth.api.js       ← legacy named exports
│   ├── incidents.api.js
│   ├── vehicles.api.js
│   └── analytics.api.js
├── components/
│   ├── layout/
│   │   └── AppLayout.jsx   ← sidebar + outlet
│   └── ui/
│       ├── Badge.jsx
│       ├── Button.jsx
│       └── Input.jsx
├── context/
│   └── AuthContext.jsx     ← JWT state, login/logout
├── pages/
│   ├── LoginPage.jsx
│   ├── DashboardPage.jsx
│   ├── IncidentsPage.jsx
│   ├── VehiclesPage.jsx
│   └── AnalyticsPage.jsx
├── utils/
│   └── helpers.js          ← formatting utilities
├── App.jsx                 ← router
├── main.jsx
└── index.css
```

## Environment Variables

```
VITE_IDENTITY_URL   = http://localhost:3001
VITE_INCIDENT_URL   = http://localhost:3002
VITE_DISPATCH_URL   = http://localhost:3003
VITE_ANALYTICS_URL  = http://localhost:3004
```
