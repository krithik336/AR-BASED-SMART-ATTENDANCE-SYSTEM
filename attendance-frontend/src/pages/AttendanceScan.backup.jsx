import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listClasses } from '../api/classes'
import { startSession, endSession } from '../api/sessions'
import { scanFrame } from '../api/attendance'

const SCAN_INTERVAL_MS = 1500
const FRAME_JPEG_QUALITY = 0.8

export default function AttendanceScan() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const inFlightRef = useRef(false)
  const sessionRef = useRef(null)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState(searchParams.get('classId') || '')
  const [subject, setSubject] = useState('')
  const [session, setSession] = useState(null)
  const [cameraOn, setCameraOn] = useState(false)
  const [status, setStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')
  const [present, setPresent] = useState(new Map())
  const [framesScanned, setFramesScanned] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch(() => setError('Failed to load classes'))
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.srcObject = null }
    setCameraOn(false)
    inFlightRef.current = false
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const waitForVideoElement = useCallback(async () => {
    for (let i = 0; i < 50; i++) {
      if (videoRef.current) return videoRef.current
      await new Promise((r) => requestAnimationFrame(r))
    }
    throw new Error('Camera video element is not available')
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia)
      throw new Error('Camera access is not supported by this browser.')
    if (!window.isSecureContext)
      throw new Error('Camera access requires a secure context. localhost is supported.')

    const video = await waitForVideoElement()
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
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

  const captureFrame = () => {
    const video = videoRef.current
    if (!video?.videoWidth || !video?.videoHeight) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY).split(',')[1]
  }

  const drawOverlay = (faceResults) => {
    const canvas = overlayRef.current
    const video = videoRef.current
    if (!canvas || !video?.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    faceResults.forEach((r) => {
      if (!r.bbox) return
      const { x, y, width, height } = r.bbox
      ctx.strokeStyle = r.matched ? '#16a34a' : '#f43f5e'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, width, height)
      const label = r.matched ? `${r.studentName} (${(r.similarity * 100).toFixed(0)}%)` : 'Unknown'
      ctx.font = '14px sans-serif'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = r.matched ? '#16a34a' : '#f43f5e'
      ctx.fillRect(x, y - 22, tw + 8, 20)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(label, x + 4, y - 7)
    })
  }

  const sendFrame = async () => {
    if (inFlightRef.current || !sessionRef.current || !videoRef.current?.videoWidth) return
    const frame = captureFrame()
    if (!frame) return
    inFlightRef.current = true
    try {
      const scan = await scanFrame(sessionRef.current.id, frame)
      setFramesScanned((n) => n + 1)
      setUnknownCount(scan.unknown || 0)
      setPresent((prev) => {
        const next = new Map(prev)
        ;(scan.results || [])
          .filter((r) => r.matched && r.studentId != null)
          .forEach((r) => {
            const ex = next.get(r.studentId)
            if (!ex || r.similarity > ex.similarity)
              next.set(r.studentId, { name: r.studentName, roll: r.rollNumber, similarity: r.similarity, marked: r.marked })
          })
        return next
      })
      drawOverlay(scan.results || [])
      setStatusMessage(
        scan.faceCount === 0
          ? 'Scanning — no face in view'
          : `Scanning — ${scan.recognized || 0} recognized, ${scan.unknown || 0} unknown`
      )
    } catch (err) {
      if (err?.response?.status === 503 || !err?.response)
        setStatusMessage('Vision service unavailable — retrying…')
      else
        setStatusMessage(err?.response?.data?.message || 'Scan failed — retrying…')
    } finally {
      inFlightRef.current = false
    }
  }

  const startScanLoop = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(sendFrame, SCAN_INTERVAL_MS)
  }

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
      setStatus('scanning')
      setStatusMessage('Scanning — keep students in front of the camera')
      startScanLoop()
    } catch (err) {
      cleanup()
      setStatus('error')
      setError(err?.response?.data?.message || err?.message || 'Failed to start the session')
    }
  }

  const handleRetryCamera = async () => {
    setError('')
    setStatus('starting')
    setStatusMessage('Starting camera…')
    try {
      await startCamera()
      setStatus('scanning')
      setStatusMessage('Scanning — keep students in front of the camera')
      startScanLoop()
    } catch (err) {
      setStatus('error')
      setError(err?.message || 'Unable to access the camera')
    }
  }

  const handleEnd = async () => {
    if (!session) return
    setStatus('ended')
    setStatusMessage('Ending session…')
    cleanup()
    try {
      const ended = await endSession(session.id)
      navigate(`/teacher/sessions/${ended.id}`)
    } catch (err) {
      setStatusMessage(err?.response?.data?.message || 'Session ended, but report failed to load')
      setStatus('error')
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Attendance Scan</h1>
        <p className="text-text-secondary text-sm mt-1">
          Real-time face recognition — frames are matched against the class gallery
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">
          <div>{error}</div>
          {session && !cameraOn && (
            <button onClick={handleRetryCamera} className="mt-2 underline font-medium">Try Again</button>
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
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${status === 'scanning' ? 'bg-success animate-pulse' : 'bg-warning'}`} />
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Session #{session.id} — {session.className}
                  {session.subject ? ` · ${session.subject}` : ''}
                </p>
                <p className="text-xs text-text-secondary">{statusMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary">
              <span>{framesScanned} frames</span>
              <span className="text-success font-medium">{present.size} present</span>
              <span className="text-danger font-medium">{unknownCount} unknown</span>
              <button
                onClick={handleEnd}
                disabled={status === 'ended'}
                className="btn-danger text-xs px-3 py-1.5"
              >
                End Session
              </button>
            </div>
          </div>

          {/* Camera + recognized students */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-navy rounded-xl overflow-hidden relative">
              <video ref={videoRef} autoPlay playsInline muted className="w-full block" />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm gap-3">
                  <span>Camera off</span>
                  <button
                    onClick={handleRetryCamera}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm transition-colors"
                  >
                    Start Camera
                  </button>
                </div>
              )}
            </div>

            <div className="card p-4">
              <p className="text-sm font-semibold text-text-primary mb-3">Recognized Students</p>
              {present.size === 0 ? (
                <p className="text-sm text-text-secondary">Waiting for the first recognition…</p>
              ) : (
                <ul className="space-y-2 max-h-96 overflow-y-auto">
                  {[...present.entries()].map(([id, s]) => (
                    <li key={id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="font-medium text-text-primary">
                          {s.name}{' '}
                          {s.marked && (
                            <span className="ml-1 text-[10px] uppercase bg-green-100 text-success px-1.5 py-0.5 rounded">new</span>
                          )}
                        </p>
                        <p className="text-xs text-text-secondary">{s.roll}</p>
                      </div>
                      <span className="text-xs font-mono text-text-secondary">
                        {(s.similarity * 100).toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
