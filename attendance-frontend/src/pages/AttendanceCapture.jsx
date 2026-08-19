import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listClasses } from '../api/classes'
import { startSession, getSession } from '../api/sessions'
import { detectFrame, uploadCapture } from '../api/attendance'

const DETECT_INTERVAL_MS = 1200
const VERDICT_COLORS = { GOOD: '#16a34a', WARNING: '#eab308', POOR: '#ef4444' }
const VERDICT_LABEL = { GOOD: 'Good', WARNING: 'Review', POOR: 'Poor' }

export default function AttendanceCapture() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionIdParam = searchParams.get('sessionId')

  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const capturingRef = useRef(false)
  const sessionRef = useRef(null)
  const resumeRef = useRef(false)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [subject, setSubject] = useState('')
  const [session, setSession] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [status, setStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [faces, setFaces] = useState([])
  const [guidance, setGuidance] = useState('')
  const [captures, setCaptures] = useState([])
  const [counts, setCounts] = useState({ recognized: 0, review: 0, unknown: 0, rejected: 0 })

  const waitForVideoElement = useCallback(async () => {
    for (let i = 0; i < 50; i++) {
      if (videoRef.current) return videoRef.current
      await new Promise((r) => requestAnimationFrame(r))
    }
    throw new Error('Camera video element is not available')
  }, [])

  const snapshotFrame = useCallback((quality = 0.92) => new Promise((resolve) => {
    const video = videoRef.current
    if (!video?.videoWidth || !video?.videoHeight) return resolve(null)
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return resolve(null)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality)
  }), [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Camera access is not supported by this browser.')
    if (!window.isSecureContext)
      throw new Error('Camera access requires a secure context. localhost is supported.')

    const video = await waitForVideoElement()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false,
    })
    streamRef.current = stream
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    try { await video.play() } catch (_) {}

    await new Promise((resolve) => {
      if (video.readyState >= 2 && video.videoWidth > 0) { resolve(); return }
      const onMeta = () => { video.removeEventListener('loadedmetadata', onMeta); resolve() }
      video.addEventListener('loadedmetadata', onMeta)
      setTimeout(() => { video.removeEventListener('loadedmetadata', onMeta); resolve() }, 3000)
    })

    if (!video.videoWidth) throw new Error('Camera started, but video frames are not available.')
    setCameraOn(true)
  }, [waitForVideoElement])

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null }
    setCameraOn(false)
    busyRef.current = false
    capturingRef.current = false
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const buildGuidance = (v) => {
    const total = v.GOOD + v.WARNING + v.POOR
    if (total === 0) return 'No face in view — position the camera on the classroom'
    if (v.GOOD >= 1 && v.POOR === 0 && v.WARNING === 0)
      return `${v.GOOD} good face(s) — ready to capture`
    return `${v.GOOD} good · ${v.WARNING} warning · ${v.POOR} poor — adjust framing or lighting`
  }

  const runDetect = useCallback(async () => {
    if (busyRef.current || !sessionRef.current || !videoRef.current?.videoWidth) return
    const blob = await snapshotFrame(0.8)
    if (!blob) return
    busyRef.current = true
    try {
      const res = await detectFrame(blob)
      const facesArr = res.faces || []
      setFaces(facesArr)
      const v = { GOOD: 0, WARNING: 0, POOR: 0 }
      facesArr.forEach((f) => { const k = f.quality?.verdict; if (v[k] !== undefined) v[k] += 1 })
      setGuidance(buildGuidance(v))
    } catch (err) {
      setFaces([])
      setGuidance(
        err?.response?.status === 503 || !err?.response
          ? 'Vision service unavailable — retrying…'
          : 'Guidance unavailable — retrying…'
      )
    } finally {
      busyRef.current = false
    }
  }, [snapshotFrame])

  const detectFnRef = useRef(runDetect)
  useEffect(() => { detectFnRef.current = runDetect }, [runDetect])

  const startDetectLoop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => detectFnRef.current(), DETECT_INTERVAL_MS)
  }, [])

  // Resume an active session when arriving with ?sessionId= (capture more photos).
  useEffect(() => {
    if (!sessionIdParam) {
      listClasses().then(setClasses).catch(() => setError('Failed to load classes'))
      return
    }
    if (resumeRef.current) return
    resumeRef.current = true
    getSession(sessionIdParam)
      .then(async (s) => {
        if (s.status !== 'ACTIVE') throw new Error('This session is no longer active — start a new one.')
        setSession(s)
        sessionRef.current = s
        setClassId(String(s.classId))
        setSubject(s.subject || '')
        setStatus('starting')
        setStatusMessage('Starting camera…')
        try {
          await startCamera()
          setStatus('capturing')
          setStatusMessage('Position the classroom in view, then capture a photo')
          startDetectLoop()
        } catch (err) {
          setStatus('error')
          setError(err?.message || 'Unable to access the camera')
        }
      })
      .catch((err) => {
        setStatus('error')
        setError(err?.message || err?.response?.data?.message || 'Failed to resume session')
      })
  }, [sessionIdParam, startCamera, startDetectLoop])

  const handleStart = async (e) => {
    e.preventDefault()
    if (!classId) { setError('Please select a class'); return }
    setError('')
    setStatus('starting')
    setStatusMessage('Starting session…')
    try {
      const newSession = await startSession({ classId: Number(classId), subject: subject.trim() || null })
      setSession(newSession)
      sessionRef.current = newSession
      setStatusMessage('Starting camera…')
      await startCamera()
      setStatus('capturing')
      setStatusMessage('Position the classroom in view, then capture a photo')
      startDetectLoop()
    } catch (err) {
      cleanup()
      setStatus('error')
      setError(err?.response?.data?.message || err?.message || 'Failed to start the session')
    }
  }

  const handleCapture = async () => {
    const s = sessionRef.current
    if (!s || busyRef.current || capturingRef.current) return
    setError('')
    const blob = await snapshotFrame(0.92)
    if (!blob) return
    capturingRef.current = true
    busyRef.current = true
    setStatusMessage('Capturing and processing high-resolution photo…')
    try {
      const result = await uploadCapture(s.id, blob)
      setCaptures((prev) => [result, ...prev])
      setCounts((prev) => ({
        recognized: prev.recognized + (result.recognized || 0),
        review: prev.review + (result.needsReview || 0),
        unknown: prev.unknown + (result.unknown || 0),
        rejected: prev.rejected + (result.rejected || 0),
      }))
      setStatusMessage(
        result.status === 'FAILED'
          ? `Photo failed to process${result.error ? `: ${result.error}` : ''}`
          : `Photo processed — ${result.recognized || 0} recognized, ${result.needsReview || 0} to review`
      )
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.detail || 'Upload failed — try again')
      setStatusMessage('Photo upload failed — try again')
    } finally {
      busyRef.current = false
      capturingRef.current = false
    }
  }

  const handleGoReview = () => {
    if (sessionRef.current) navigate(`/teacher/sessions/${sessionRef.current.id}/review`)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Classroom Capture</h1>
        <p className="text-text-secondary text-sm mt-1">
          Capture high-resolution photos of the class — recognition happens server-side after upload
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">
          <div>{error}</div>
          {!session && (
            <button onClick={() => { setError(''); window.location.reload() }} className="mt-2 underline font-medium">
              Go back
            </button>
          )}
        </div>
      )}

      {!session && (
        <form onSubmit={handleStart} className="card p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Class</label>
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="input"
              >
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Subject (optional)</label>
              <input
                maxLength={300}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input"
                placeholder="Mathematics"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={status === 'starting' || !classId}
            className="btn-primary"
          >
            {status === 'starting' ? 'Starting…' : 'Start Session & Camera'}
          </button>
          <p className="text-xs text-text-secondary">
            Camera access requires a secure context. localhost works; for testing on a phone serve the frontend over HTTPS.
          </p>
        </form>
      )}

      {session && (
        <>
          {/* Session status bar */}
          <div className="card px-6 py-4 mb-6 flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${status === 'capturing' ? 'bg-success animate-pulse' : 'bg-warning'}`} />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Session #{session.id} — {session.className}
                  {session.subject ? ` · ${session.subject}` : ''}
                </p>
                <p className="text-xs text-text-secondary">{statusMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>{captures.length} photo(s)</span>
              <span className="text-success font-medium">{counts.recognized} recognized</span>
              <span className="text-warning font-medium">{counts.review} to review</span>
              <button
                onClick={handleGoReview}
                disabled={captures.length === 0 || status === 'ended'}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Review Attendance →
              </button>
            </div>
          </div>

          {/* Camera + capture panel */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-navy rounded-xl overflow-hidden relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full block" />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm gap-3">
                  <span>Camera off</span>
                  <button
                    onClick={async () => {
                      try { await startCamera() } catch (err) { setError(err?.message || 'Unable to access the camera') }
                    }}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm transition-colors"
                  >
                    Start Camera
                  </button>
                </div>
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-3 text-[11px] font-medium text-white bg-black/40 rounded-lg px-3 py-1.5">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" /> Good</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" /> Review</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /> Poor</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="card p-4">
                <button
                  onClick={handleCapture}
                  disabled={capturingRef.current || !cameraOn || status === 'ended'}
                  className="btn-primary w-full"
                >
                  {capturingRef.current ? 'Processing…' : '📷 Capture Photo'}
                </button>
                <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                  {guidance || 'Position students so all faces are clearly visible, then capture.'}
                </p>
              </div>

              <div className="card p-4">
                <p className="text-sm font-semibold text-text-primary mb-3">Captured Photos</p>
                {captures.length === 0 ? (
                  <p className="text-sm text-text-secondary">No photos captured yet.</p>
                ) : (
                  <ul className="space-y-2 max-h-72 overflow-y-auto">
                    {captures.map((c, i) => (
                      <li key={`${c.captureId}-${i}`} className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-text-primary">Photo {captures.length - i}</p>
                          <p className="text-xs text-text-secondary">
                            {c.faceCount || 0} face(s) · {c.recognized || 0} recognized
                          </p>
                        </div>
                        <span className={
                          c.status === 'FAILED' ? 'badge-danger' : c.needsReview > 0 ? 'badge-warning' : 'badge-green'
                        }>
                          {c.status === 'FAILED' ? 'Failed' : `${c.recognized || 0}/${c.faceCount || 0} matched`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="card px-6 py-4 mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">
              When all students are captured, review the recognized faces and finalise attendance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleGoReview}
                disabled={captures.length === 0}
                className="btn-primary"
              >
                Review Attendance
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
