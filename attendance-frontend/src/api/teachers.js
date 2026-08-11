import api from './axios'

export const listTeachers = () => api.get('/admin/teachers').then((r) => r.data)

export const createTeacher = (payload) => api.post('/admin/teachers', payload).then((r) => r.data)

export const updateTeacher = (id, payload) => api.put(`/admin/teachers/${id}`, payload).then((r) => r.data)

export const deleteTeacher = (id) => api.delete(`/admin/teachers/${id}`)

export const assignTeacher = (classId, teacherId) =>
  api.put(`/classes/${classId}/assign-teacher/${teacherId}`).then((r) => r.data)

export const myClasses = () => api.get('/classes/my-classes').then((r) => r.data)
