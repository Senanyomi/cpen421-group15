import axios from 'axios'

// Base URLs for each microservice
export const SERVICES = {
  identity:  import.meta.env.VITE_IDENTITY_URL  || 'http://localhost:3001',
  incident:  import.meta.env.VITE_INCIDENT_URL  || 'http://localhost:3002',
  dispatch:  import.meta.env.VITE_DISPATCH_URL  || 'http://localhost:3003',
  analytics: import.meta.env.VITE_ANALYTICS_URL || 'http://localhost:3004',
}

// Factory — creates an Axios instance pointed at a specific service
const createClient = (baseURL) => {
  const client = axios.create({
    baseURL,
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
  })

  // Attach JWT to every request automatically
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('nerdcp_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  // Global error handling — redirect to login on 401
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        localStorage.removeItem('nerdcp_token')
        localStorage.removeItem('nerdcp_user')
        window.location.href = '/login'
      }
      return Promise.reject(err)
    }
  )

  return client
}

export const identityApi  = createClient(SERVICES.identity)
export const incidentApi  = createClient(SERVICES.incident)
export const dispatchApi  = createClient(SERVICES.dispatch)
export const analyticsApi = createClient(SERVICES.analytics)
