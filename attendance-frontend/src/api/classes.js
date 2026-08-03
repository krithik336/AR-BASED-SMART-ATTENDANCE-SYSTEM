import api from './axios'

export const listClasses = () => api.get('/classes').then((r) => r.data)

export const createClass = (payload) => api.post('/classes', payload).then((r) => r.data)

export const getClass = (id) => api.get(`/classes/${id}`).then((r) => r.data)

export const updateClass = (id, payload) => api.put(`/classes/${id}`, payload).then((r) => r.data)

export const deleteClass = (id) => api.delete(`/classes/${id}`)
