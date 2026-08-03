import api from './axios'

export const startSession = (payload) => api.post('/sessions', payload).then((r) => r.data)

export const endSession = (id) => api.post(`/sessions/${id}/end`).then((r) => r.data)

export const listSessions = () => api.get('/sessions').then((r) => r.data)

export const getSession = (id) => api.get(`/sessions/${id}`).then((r) => r.data)

export const getSessionReport = (id) => api.get(`/sessions/${id}/report`).then((r) => r.data)
