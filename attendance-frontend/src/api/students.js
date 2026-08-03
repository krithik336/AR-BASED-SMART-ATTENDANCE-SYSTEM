import api from './axios'

export const listStudents = (classId) =>
  api.get('/students', { params: classId ? { classId } : {} }).then((r) => r.data)

// `files` is an array of File objects; the FormData content type is set
// automatically by axios (do NOT hard-code multipart/form-data).
export const registerStudent = ({ name, rollNumber, email, classId, files }) => {
  const formData = new FormData()
  formData.append('name', name)
  formData.append('rollNumber', rollNumber)
  formData.append('classId', classId)
  if (email) formData.append('email', email)
  files.forEach((file) => formData.append('files', file))
  return api.post('/students', formData).then((r) => r.data)
}

export const getStudent = (id) => api.get(`/students/${id}`).then((r) => r.data)

export const deleteStudent = (id) => api.delete(`/students/${id}`)

export const studentPhotoUrl = (id, fileName) =>
  `${api.defaults.baseURL}/students/${id}/photos/${fileName}`
