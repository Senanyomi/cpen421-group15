import { analyticsApi } from './axios'

export const analyticsApiCalls = {
  dashboard:    (params) => analyticsApi.get('/analytics/summary-dashboard', { params }),
  responseTimes:(params) => analyticsApi.get('/analytics/response-times', { params }),
  byRegion:     (params) => analyticsApi.get('/analytics/incidents-by-region', { params }),
  utilization:  (params) => analyticsApi.get('/analytics/resource-utilization', { params }),
}
