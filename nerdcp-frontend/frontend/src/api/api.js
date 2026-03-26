/**
 * NERDCP — Centralized API Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Axios instance shared across the entire app.
 *
 * - Base URLs pulled from Vite env vars (fall back to localhost defaults)
 * - JWT token auto-attached to every request from localStorage
 * - Global error handler: 401 → clears token and redirects to /login
 *
 * Usage:
 *   import api from '../api/api'
 *   const { data } = await api.getIncidents()
 * ─────────────────────────────────────────────────────────────────────────────
 */
import axios from 'axios'

// ─── Base URLs ────────────────────────────────────────────────────────────────
const IDENTITY_URL =
  import.meta.env?.VITE_IDENTITY_URL || 'http://localhost:3001'
const INCIDENT_URL =
  import.meta.env?.VITE_INCIDENT_URL || 'http://localhost:3002'
const DISPATCH_URL =
  import.meta.env?.VITE_DISPATCH_URL || 'http://localhost:3003'
const ANALYTICS_URL =
  import.meta.env?.VITE_ANALYTICS_URL || 'http://localhost:3004'

// ─── Token helpers ────────────────────────────────────────────────────────────
export const getToken   = ()        => localStorage.getItem('nerdcp_token') || ''
export const setToken   = (t)       => localStorage.setItem('nerdcp_token', t)
export const clearToken = ()        => {
  localStorage.removeItem('nerdcp_token')
  localStorage.removeItem('nerdcp_user')
  localStorage.removeItem('nerdcp_refresh')
}
export const getUser = () => {
  try { return JSON.parse(localStorage.getItem('nerdcp_user')) } catch { return null }
}

// ─── Factory: create one Axios instance per service ──────────────────────────
const makeClient = (baseURL) => {
  const client = axios.create({ baseURL, timeout: 15000 })

  // Attach JWT on every outgoing request
  client.interceptors.request.use((config) => {
    const token = getToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  // Global response error handler
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        // Token expired or invalid — clear session and redirect
        clearToken()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
      }
      // Normalise error message so callers can always read err.message
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'An unexpected error occurred.'
      err.message = msg
      return Promise.reject(err)
    }
  )

  return client
}

// ─── One client per service ───────────────────────────────────────────────────
const identityClient  = makeClient(IDENTITY_URL)
const incidentClient  = makeClient(INCIDENT_URL)
const dispatchClient  = makeClient(DISPATCH_URL)
const analyticsClient = makeClient(ANALYTICS_URL)

// ═════════════════════════════════════════════════════════════════════════════
// AUTH — Identity Service (port 3001)
// ═════════════════════════════════════════════════════════════════════════════
export const login = (email, password) =>
  identityClient.post('/auth/login', { email, password })

export const register = (name, email, password, role) =>
  identityClient.post('/auth/register', { name, email, password, role })

export const logout = (refreshToken) =>
  identityClient.post('/auth/logout', { refreshToken })

export const getProfile = () =>
  identityClient.get('/auth/profile')

export const updateProfile = (data) =>
  identityClient.put('/auth/profile', data)

export const getUsers = (params = {}) =>
  identityClient.get('/auth/users', { params })

export const deactivateUser = (id) =>
  identityClient.put(`/auth/users/${id}/deactivate`)

export const refreshTokens = (refreshToken) =>
  identityClient.post('/auth/refresh-token', { refreshToken })

// ═════════════════════════════════════════════════════════════════════════════
// INCIDENTS — Incident Service (port 3002)
// ═════════════════════════════════════════════════════════════════════════════
export const getIncidents = (params = {}) =>
  incidentClient.get('/incidents', { params })

export const getOpenIncidents = () =>
  incidentClient.get('/incidents/open')

export const getIncidentById = (id) =>
  incidentClient.get(`/incidents/${id}`)

export const createIncident = (data) =>
  incidentClient.post('/incidents', data)

export const updateIncidentStatus = (id, status) =>
  incidentClient.put(`/incidents/${id}/status`, { status })

export const assignResponder = (id, assignedVehicleId) =>
  incidentClient.put(`/incidents/${id}/assign`, { assignedVehicleId })

export const addIncidentNote = (id, content) =>
  incidentClient.post(`/incidents/${id}/notes`, { content })

export const deleteIncident = (id) =>
  incidentClient.delete(`/incidents/${id}`)

export const getNearestResponders = (params = {}) =>
  incidentClient.get('/responders/nearest', { params })

// ═════════════════════════════════════════════════════════════════════════════
// VEHICLES — Dispatch Service (port 3003)
// ═════════════════════════════════════════════════════════════════════════════
export const getVehicles = (params = {}) =>
  dispatchClient.get('/vehicles', { params })

export const getVehicleById = (id) =>
  dispatchClient.get(`/vehicles/${id}`)

export const getVehicleLocation = (id) =>
  dispatchClient.get(`/vehicles/${id}/location`)

export const registerVehicle = (data) =>
  dispatchClient.post('/vehicles', data)

export const updateVehicleLocation = (id, lat, lng) =>
  dispatchClient.post(`/vehicles/${id}/location`, { latitude: lat, longitude: lng })

// ═════════════════════════════════════════════════════════════════════════════
// ANALYTICS — Analytics Service (port 3004)
// ═════════════════════════════════════════════════════════════════════════════
export const getResponseTimes = (params = {}) =>
  analyticsClient.get('/analytics/response-times', { params })

export const getIncidentsByRegion = (params = {}) =>
  analyticsClient.get('/analytics/incidents-by-region', { params })

export const getResourceUtilization = (params = {}) =>
  analyticsClient.get('/analytics/resource-utilization', { params })

export const getHospitalCapacity = (params = {}) =>
  analyticsClient.get('/analytics/hospital-capacity', { params })

export const getSystemHealth = () =>
  analyticsClient.get('/analytics/system-health')

// ─── Default export — namespace all calls ────────────────────────────────────
const api = {
  // auth
  login, register, logout, getProfile, updateProfile,
  getUsers, deactivateUser, refreshTokens,
  // incidents
  getIncidents, getOpenIncidents, getIncidentById, createIncident,
  updateIncidentStatus, assignResponder, addIncidentNote,
  deleteIncident, getNearestResponders,
  // vehicles
  getVehicles, getVehicleById, getVehicleLocation,
  registerVehicle, updateVehicleLocation,
  // analytics
  getResponseTimes, getIncidentsByRegion, getResourceUtilization,
  getHospitalCapacity, getSystemHealth,
}

export default api
