import { incidentApi } from './axios'

export const incidentsApi = {
  list:    (params)           => incidentApi.get('/incidents', { params }),
  active:  ()                 => incidentApi.get('/incidents/open'),
  get:     (id)               => incidentApi.get(`/incidents/${id}`),
  create:  (data)             => incidentApi.post('/incidents', data),
  updateStatus: (id, status)  => incidentApi.put(`/incidents/${id}/status`, { status }),
  assign:  (id, vehicleId)    => incidentApi.put(`/incidents/${id}/assign`, { assignedVehicleId: vehicleId }),
  addNote: (id, content)      => incidentApi.post(`/incidents/${id}/notes`, { content }),
  delete:  (id)               => incidentApi.delete(`/incidents/${id}`),
  nearest: (lat, lon, params) => incidentApi.get('/responders/nearest', { params: { lat, lon, ...params } }),
}
