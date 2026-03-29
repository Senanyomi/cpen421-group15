import { dispatchApi } from './axios'

export const vehiclesApi = {
  list:      (params)          => dispatchApi.get('/vehicles', { params }),
  get:       (id)              => dispatchApi.get(`/vehicles/${id}`),
  register:  (data)            => dispatchApi.post('/vehicles/register', data),
  location:  (id)              => dispatchApi.get(`/vehicles/${id}/location`),
  history:   (id, params)      => dispatchApi.get(`/vehicles/${id}/history`, { params }),
  updateLoc: (id, data)        => dispatchApi.put(`/vehicles/${id}/location`, data),
  updateStatus: (id, status)   => dispatchApi.put(`/vehicles/${id}/status`, { status }),
  assign:    (id, incidentId)  => dispatchApi.put(`/vehicles/${id}/assign`, { incidentId }),
  active:    ()                => dispatchApi.get('/tracking/active'),
  byIncident:(id)              => dispatchApi.get(`/tracking/incident/${id}`),
}
