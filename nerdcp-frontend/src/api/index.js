// src/api/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized API service for NERDCP.
//
// One import gives you every API call in the app:
//   import api from './api'
//
//   api.auth.login(email, password)
//   api.incidents.list({ status: 'REPORTED' })
//   api.vehicles.active()
//   api.analytics.dashboard()
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios'

// ─── 1. BASE URL CONFIG ───────────────────────────────────────────────────────
const URLS = {
  identity:  import.meta.env.VITE_IDENTITY_URL  || 'http://localhost:3001',
  incident:  import.meta.env.VITE_INCIDENT_URL  || 'http://localhost:3002',
  dispatch:  import.meta.env.VITE_DISPATCH_URL  || 'http://localhost:3003',
  analytics: import.meta.env.VITE_ANALYTICS_URL || 'http://localhost:3004',
}

// ─── 2. AXIOS INSTANCE FACTORY ────────────────────────────────────────────────
// Every microservice gets its own Axios instance sharing the same interceptors.
const createClient = (baseURL) => {
  const client = axios.create({
    baseURL,
    timeout: 12_000,
    headers: { 'Content-Type': 'application/json' },
  })

  // ── REQUEST INTERCEPTOR: attach JWT ────────────────────────────────────────
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('nerdcp_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    },
    (error) => Promise.reject(error)
  )

  // ── RESPONSE INTERCEPTOR: global error handling ────────────────────────────
  client.interceptors.response.use(
    // Success — return the response as-is
    (response) => response,

    // Error — normalize and handle globally
    (error) => {
      const status  = error.response?.status
      const message = error.response?.data?.message || error.message || 'Request failed'

      // 401 Unauthorized — token expired or invalid, force re-login
      if (status === 401) {
        localStorage.removeItem('nerdcp_token')
        localStorage.removeItem('nerdcp_user')
        localStorage.removeItem('nerdcp_refresh')
        window.location.href = '/login'
        return Promise.reject(new Error('Session expired. Please log in again.'))
      }

      // 403 Forbidden — user doesn't have the right role
      if (status === 403) {
        return Promise.reject(new Error('Access denied. You don\'t have permission for this action.'))
      }

      // 404 Not Found
      if (status === 404) {
        return Promise.reject(new Error('The requested resource was not found.'))
      }

      // 422 / 400 Validation errors — pass message straight through
      if (status === 400 || status === 422) {
        return Promise.reject(new Error(message))
      }

      // 500+ Server errors
      if (status >= 500) {
        return Promise.reject(new Error('Server error. Please try again in a moment.'))
      }

      // Network errors (no response at all)
      if (!error.response) {
        return Promise.reject(new Error('Cannot reach the server. Check your connection.'))
      }

      return Promise.reject(new Error(message))
    }
  )

  return client
}

// ─── 3. SERVICE CLIENTS ───────────────────────────────────────────────────────
const identity  = createClient(URLS.identity)
const incident  = createClient(URLS.incident)
const dispatch  = createClient(URLS.dispatch)
const analytics = createClient(URLS.analytics)

// ─── 4. API METHODS ───────────────────────────────────────────────────────────
// Each section maps cleanly to one microservice.
// All methods return Axios promises — await them in your components.

const api = {

  // ── AUTH (Identity Service :3001) ──────────────────────────────────────────
  auth: {
    /** POST /auth/login → { accessToken, refreshToken, user } */
    login: (email, password) =>
      identity.post('/auth/login', { email, password }),

    /** POST /auth/logout — revoke refresh token */
    logout: (refreshToken) =>
      identity.post('/auth/logout', { refreshToken }),

    /** POST /auth/refresh-token → new token pair */
    refreshToken: (refreshToken) =>
      identity.post('/auth/refresh-token', { refreshToken }),

    /** GET /auth/profile → current user */
    profile: () =>
      identity.get('/auth/profile'),

    /** PUT /auth/profile → updated user */
    updateProfile: (data) =>
      identity.put('/auth/profile', data),

    /** GET /auth/users → paginated user list [ADMIN] */
    users: (params) =>
      identity.get('/auth/users', { params }),

    /** PUT /auth/users/:id/deactivate [ADMIN] */
    deactivateUser: (id) =>
      identity.put(`/auth/users/${id}/deactivate`),

    /** POST /auth/reset-password → request reset token */
    requestPasswordReset: (email) =>
      identity.post('/auth/reset-password', { email }),

    /** POST /auth/reset-password/confirm → set new password */
    confirmPasswordReset: (token, newPassword) =>
      identity.post('/auth/reset-password/confirm', { token, newPassword }),
  },

  // ── INCIDENTS (Incident Service :3002) ────────────────────────────────────
  incidents: {
    /** GET /incidents → paginated list */
    list: (params) =>
      incident.get('/incidents', { params }),

    /** GET /incidents/open → active (non-closed) incidents */
    active: () =>
      incident.get('/incidents/open'),

    /** GET /incidents/:id → single incident + notes */
    get: (id) =>
      incident.get(`/incidents/${id}`),

    /** POST /incidents → create new incident */
    create: (data) =>
      incident.post('/incidents', data),

    /** PUT /incidents/:id/status → advance lifecycle */
    updateStatus: (id, status) =>
      incident.put(`/incidents/${id}/status`, { status }),

    /** PUT /incidents/:id/assign → link a vehicle */
    assign: (id, assignedVehicleId) =>
      incident.put(`/incidents/${id}/assign`, { assignedVehicleId }),

    /** POST /incidents/:id/notes → add a field note */
    addNote: (id, content) =>
      incident.post(`/incidents/${id}/notes`, { content }),

    /** DELETE /incidents/:id [ADMIN — must be CLOSED first] */
    delete: (id) =>
      incident.delete(`/incidents/${id}`),

    /** GET /responders/nearest?lat=&lon=&limit=&type= */
    nearestResponders: (lat, lon, params = {}) =>
      incident.get('/responders/nearest', { params: { lat, lon, ...params } }),
  },

  // ── VEHICLES (Dispatch Service :3003) ─────────────────────────────────────
  vehicles: {
    /** GET /vehicles → fleet list */
    list: (params) =>
      dispatch.get('/vehicles', { params }),

    /** GET /vehicles/:id → single vehicle + active assignment */
    get: (id) =>
      dispatch.get(`/vehicles/${id}`),

    /** POST /vehicles/register [ADMIN, DISPATCHER] */
    register: (data) =>
      dispatch.post('/vehicles/register', data),

    /** GET /vehicles/:id/location → latest GPS fix */
    location: (id) =>
      dispatch.get(`/vehicles/${id}/location`),

    /** GET /vehicles/:id/history → GPS ping history */
    history: (id, params) =>
      dispatch.get(`/vehicles/${id}/history`, { params }),

    /** PUT /vehicles/:id/location → GPS ping from device */
    updateLocation: (id, data) =>
      dispatch.put(`/vehicles/${id}/location`, data),

    /** PUT /vehicles/:id/status → lifecycle change */
    updateStatus: (id, status) =>
      dispatch.put(`/vehicles/${id}/status`, { status }),

    /** PUT /vehicles/:id/assign [ADMIN, DISPATCHER] */
    assign: (id, incidentId) =>
      dispatch.put(`/vehicles/${id}/assign`, { incidentId }),
  },

  // ── TRACKING (Dispatch Service :3003) ─────────────────────────────────────
  tracking: {
    /** GET /tracking/active → DISPATCHED + ON_SCENE vehicles */
    active: () =>
      dispatch.get('/tracking/active'),

    /** GET /tracking/incident/:id → all vehicles for one incident */
    byIncident: (incidentId) =>
      dispatch.get(`/tracking/incident/${incidentId}`),
  },

  // ── ANALYTICS (Analytics Service :3004) ───────────────────────────────────
  analytics: {
    /** GET /analytics/summary-dashboard → all metrics in one call */
    dashboard: (params) =>
      analytics.get('/analytics/summary-dashboard', { params }),

    /** GET /analytics/response-times */
    responseTimes: (params) =>
      analytics.get('/analytics/response-times', { params }),

    /** GET /analytics/incidents-by-region */
    byRegion: (params) =>
      analytics.get('/analytics/incidents-by-region', { params }),

    /** GET /analytics/resource-utilization */
    utilization: (params) =>
      analytics.get('/analytics/resource-utilization', { params }),
  },
}

export default api

// ─── 5. NAMED EXPORTS (optional convenience) ──────────────────────────────────
// Use these if you want to import individual clients directly:
//   import { identityClient } from './api'
export { identity as identityClient, incident as incidentClient, dispatch as dispatchClient, analytics as analyticsClient }

// ─── 6. ERROR HELPER ──────────────────────────────────────────────────────────
// Extracts a clean string from any Axios error.
// Usage: catch(err) { setError(apiError(err)) }
export const apiError = (err) =>
  err?.message || 'An unexpected error occurred.'
