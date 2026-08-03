import api from './axios'

// Sends one webcam frame (JPEG base64) to be recognised against the active
// session's gallery. Supports multiple faces per frame.
export const scanFrame = (sessionId, imageBase64) =>
  api.post('/attendance/scan', { sessionId, imageBase64 }).then((r) => r.data)
