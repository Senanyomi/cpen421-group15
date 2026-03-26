# NERDCP Frontend — Phase 3 Client Interface

## Folder Structure

```
nerdcp-frontend/
├── index.html
├── vite.config.js
├── package.json
├── .env.example              ← copy to .env and fill in URLs
└── src/
    ├── main.jsx              ← React entry point
    ├── App.jsx               ← Router + sidebar shell + protected routes
    ├── AuthUI.jsx            ← YOUR EXISTING FILE (from PDF) — copy here
    ├── api/
    │   └── api.js            ← Centralized Axios API service
    └── pages/
        ├── IncidentsPage.jsx     ← YOUR EXISTING FILE (from PDF) — copy here
        ├── DispatchDashboard.jsx ← Active incidents + assign responders
        ├── VehicleTrackingPage.jsx  ← Vehicle list + live GPS
        ├── AnalyticsDashboard.jsx   ← Response times + region stats + utilization
        └── RoleAdminView.jsx        ← Hospital / Police / Fire admin views
```

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set the URLs for your running backend services

# 3. Copy your two existing files
cp /path/to/AuthUI.jsx       src/AuthUI.jsx
cp /path/to/IncidentsPage.jsx  src/pages/IncidentsPage.jsx

# 4. Start dev server
npm run dev
# Opens at http://localhost:5173
```

## Pages and Routes

| Route             | Page                  | Roles                              |
|-------------------|-----------------------|------------------------------------|
| /login            | Login page            | Public                             |
| /incidents        | Incident Management   | ADMIN, DISPATCHER, OPERATOR, RESPONDER |
| /dispatch         | Dispatch Dashboard    | ADMIN, DISPATCHER                  |
| /vehicles         | Vehicle Tracking      | ADMIN, DISPATCHER, RESPONDER       |
| /analytics        | Analytics Dashboard   | ADMIN, ANALYST, DISPATCHER         |
| /admin            | Role-specific view    | ADMIN, HOSPITAL_ADMIN, POLICE_ADMIN, FIRE_ADMIN |
| /admin/hospital   | Hospital Admin        | HOSPITAL_ADMIN                     |
| /admin/police     | Police Admin          | POLICE_ADMIN                       |
| /admin/fire       | Fire Service Admin    | FIRE_ADMIN                         |

## What Each File Does

### src/api/api.js
Single Axios instance shared across all pages. Automatically:
- Attaches JWT token from localStorage to every request
- Handles 401 responses — clears token and redirects to /login
- Exports named functions for every API call: login(), getIncidents(), getVehicles(), etc.

### src/pages/DispatchDashboard.jsx
- Loads all open (non-closed) incidents via GET /incidents/open
- Shows stat cards: Reported / Acknowledged / Dispatched / In Progress counts
- Inline status advance buttons (enforces valid transitions)
- Assign Responder modal with nearest unit finder
- Auto-refreshes every 30 seconds

### src/pages/VehicleTrackingPage.jsx
- Lists all vehicles via GET /vehicles
- Filter by type (AMBULANCE, FIRE_TRUCK, POLICE_CAR, etc.) and status
- Click any vehicle → side drawer with live location from GET /vehicles/:id/location
- GPS map placeholder showing coordinate grid + vehicle pin (ready for Leaflet/Google Maps)
- Auto-refreshes every 20 seconds

### src/pages/AnalyticsDashboard.jsx
- Loads data from all 4 analytics endpoints in parallel
- Shows summary metric cards: avg response time, P90, total incidents, fleet availability
- CSS-only bar charts for region breakdown and resource utilization
- Hospital capacity section with per-hospital bed availability bars
- System health section with service status indicators
- Period selector: 7d / 30d / 90d
- Graceful fallback when Analytics service is not yet running

### src/pages/RoleAdminView.jsx
- HospitalAdminView: filters to MEDICAL incidents + AMBULANCE fleet
- PoliceAdminView: filters to POLICE + TRAFFIC incidents + POLICE_CAR fleet
- FireAdminView: filters to FIRE + HAZMAT incidents + FIRE_TRUCK fleet
- Auto-routes based on user.role from JWT
- ADMIN users see all three as tabs
