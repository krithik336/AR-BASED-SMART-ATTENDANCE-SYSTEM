import api from './axios'

// ── Legacy live-scan (kept for backward compatibility) ─────────────────────
// Sends one webcam frame (JPEG base64) to be recognised against the active
// session's gallery. Supports multiple faces per frame.
export const scanFrame = (sessionId, imageBase64) =>
  api.post('/attendance/scan', { sessionId, imageBase64 }).then((r) => r.data)

// ── Capture-and-process flow ───────────────────────────────────────────────
// Camera-guidance preview: detect faces + assess quality only. Returns faces
// with green/yellow/red quality verdicts. No recognition runs here.
export const detectFrame = (jpegBlob) =>
  api
    .post('/attendance/detect', jpegBlob, {
      headers: { 'Content-Type': 'image/jpeg' },
      timeout: 15000,
    })
    .then((r) => r.data)

// Uploads one high-resolution classroom image and processes it for the session.
export const uploadCapture = (sessionId, jpegBlob) => {
  const form = new FormData()
  form.append('sessionId', sessionId)
  form.append('file', jpegBlob, `capture-${Date.now()}.jpg`)
  return api
    .post('/attendance/captures', form, { timeout: 120000 })
    .then((r) => r.data)
}

// Full review state of a session: recognized / review / not-detected + rows.
export const getSessionReview = (sessionId) =>
  api.get(`/attendance/sessions/${sessionId}/review`).then((r) => r.data)

// Teacher decision on one reviewed student (PRESENT or ABSENT).
export const reviewStudent = (sessionId, studentId, status) =>
  api
    .post(`/attendance/sessions/${sessionId}/students/${studentId}/review`, { status })
    .then((r) => r.data)

// Finalises attendance after review.
export const submitSession = (sessionId) =>
  api.post(`/attendance/sessions/${sessionId}/submit`).then((r) => r.data)

// Abandons a session without producing final attendance.
export const cancelSession = (sessionId) =>
  api.post(`/attendance/sessions/${sessionId}/cancel`).then((r) => r.data)
