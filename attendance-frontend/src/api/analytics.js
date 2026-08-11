import api from './axios'

export const getAdminAnalytics = (days = 30) =>
  api.get('/analytics', { params: { days } }).then((r) => r.data)

export const getTeacherAnalytics = (days = 30) =>
  api.get('/analytics/my', { params: { days } }).then((r) => r.data)
