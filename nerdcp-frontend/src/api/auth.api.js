import { identityApi } from './axios'

export const authApi = {
  login:   (email, password)   => identityApi.post('/auth/login', { email, password }),
  logout:  (refreshToken)      => identityApi.post('/auth/logout', { refreshToken }),
  profile: ()                  => identityApi.get('/auth/profile'),
  users:   (params)            => identityApi.get('/auth/users', { params }),
  deactivate: (id)             => identityApi.put(`/auth/users/${id}/deactivate`),
}
