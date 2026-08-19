
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { listClasses } from '../api/classes'
import { startSession, endSession } from '../api/sessions'
import {
  detectFrame,
  uploadCapture,
  getSessionReview,
} from '../api/attendance'

const SCAN_INTERVAL_MS = 1500
const FRAME_JPEG_QUALITY = 0.8
const CAPTURE_JPEG_QUALITY = 0.95

export default function AttendanceScan() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const videoRef = useRef(null)
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

  const [framesScanned, setFramesScanned] = useState(0)
  const [qualityFaces, setQualityFaces] = useState([])
  const [captureLoading, setCaptureLoading] = useState(false)
  const [captureComplete, setCaptureComplete] = useState(false)
  const [reviewData, setReviewData] = useState(null)

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch(() => setError('Failed to load classes'))
  }, [])

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setCameraOn(false)
    inFlightRef.current = false
  }, [])

  useEffect(() => {
    return () => cleanup()
  }, [cleanup])

  const waitForVideoElement = useCallback(async () => {
    for (let i = 0; i < 50; i++) {
      if (videoRef.current) return videoRef.current

      await new Promise((resolve) =>
        requestAnimationFrame(resolve)
      )
    }

    throw new Error('Camera video element is not available')
  }, [])

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Camera access is not supported by this browser.'
      )
    }

    if (!window.isSecureContext) {
      throw new Error(
        'Camera access requires HTTPS or localhost.'
      )
    }

    const video = await waitForVideoElement()

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: { ideal: 'environment' },
      },
      audio: false,
    })

    streamRef.current = stream

    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    video.autoplay = true

    try {
      await video.play()
    } catch (_) {}

    await new Promise((resolve) => {
      if (
        video.readyState >= 2 &&
        video.videoWidth > 0
      ) {
        resolve()
        return
      }

      const onMeta = () => {
        video.removeEventListener(
          'loadedmetadata',
          onMeta
        )
        resolve()
      }

      video.addEventListener(
        'loadedmetadata',
        onMeta
      )

      setTimeout(() => {
        video.removeEventListener(
          'loadedmetadata',
          onMeta
        )
        resolve()
      }, 3000)
    })

    if (!video.videoWidth) {
      throw new Error(
        'Camera started, but video frames are not available.'
      )
    }

    setCameraOn(true)

requestAnimationFrame(() => {
  drawOverlay([])
})

    // Draw the initial guide immediately.
    // No face has been detected yet, so it starts RED.
  }, [waitForVideoElement])

  /*
   * Capture the current video frame as a JPEG Blob.
   * Blob is required by detectFrame() and uploadCapture().
   */
  const captureFrameBlob = (
    quality = FRAME_JPEG_QUALITY
  ) => {
    const video = videoRef.current

    if (
      !video?.videoWidth ||
      !video?.videoHeight
    ) {
      return null
    }

    const canvas = document.createElement('canvas')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')

    if (!ctx) return null

    ctx.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    )

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        quality
      )
    })
  }

  /*
   * LIVE FACE VISIBILITY GUIDE
   *
   * GREEN = face detected
   * RED   = no face detected
   *
   * This is only a camera-position guide.
   * Recognition happens after Capture.
   */
const drawOverlay = (faceResults = []) => {
  const canvas = overlayRef.current
  const video = videoRef.current

  if (!canvas || !video?.videoWidth) return

  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')

  if (!ctx) return

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  )

  const faces = Array.isArray(faceResults)
    ? faceResults.filter(
        (face) => face?.bbox
      )
    : []

  /*
   * Fixed guide box.
   * This box is ALWAYS displayed.
   */
  const guideWidth = Math.min(
    canvas.width * 0.45,
    420
  )

  const guideHeight = Math.min(
    canvas.height * 0.60,
    520
  )

  const guideX =
    (canvas.width - guideWidth) / 2

  const guideY =
    (canvas.height - guideHeight) / 2

  /*
   * Face detected = GREEN
   * No face = RED
   */
  const boxColor =
    faces.length > 0
      ? '#22c55e'
      : '#ef4444'

  /*
   * Draw the permanent guide.
   */
  ctx.strokeStyle = boxColor
  ctx.lineWidth = 6
  ctx.setLineDash([14, 10])

  ctx.strokeRect(
    guideX,
    guideY,
    guideWidth,
    guideHeight
  )

  ctx.setLineDash([])

  /*
   * Draw status label.
   */
  const label =
    faces.length > 0
      ? 'FACE VISIBLE'
      : 'FACE NOT VISIBLE'

  ctx.font =
    'bold 18px Arial'

  const textWidth =
    ctx.measureText(label).width

  const labelWidth =
    textWidth + 28

  const labelHeight = 36

  const labelX =
    (canvas.width - labelWidth) / 2

  const labelY =
    Math.max(
      10,
      guideY - labelHeight - 10
    )

  ctx.fillStyle = boxColor

  ctx.fillRect(
    labelX,
    labelY,
    labelWidth,
    labelHeight
  )

  ctx.fillStyle = '#ffffff'

  ctx.fillText(
    label,
    labelX + 14,
    labelY + 25
  )

  /*
   * If a face is detected,
   * draw its actual bounding box too.
   */
  faces.forEach((face) => {
    const {
      x,
      y,
      width,
      height,
    } = face.bbox

    ctx.strokeStyle = '#22c55e'
    ctx.lineWidth = 4
    ctx.setLineDash([])

    ctx.strokeRect(
      x,
      y,
      width,
      height
    )
  })
}

  /*
   * LIVE CAMERA GUIDANCE
   *
   * This does NOT recognize students.
   * It only detects faces and checks quality.
   */
  const sendFrame = async () => {
    if (
      inFlightRef.current ||
      !sessionRef.current ||
      !videoRef.current?.videoWidth
    ) {
      return
    }

    const frameBlob =
      await captureFrameBlob(
        FRAME_JPEG_QUALITY
      )

    if (!frameBlob) return

    inFlightRef.current = true

    try {
      const result =
        await detectFrame(frameBlob)

      setFramesScanned(
        (count) => count + 1
      )

      const faces =
        result?.faces || []

      setQualityFaces(faces)

      if (faces.length === 0) {
  setStatusMessage(
    '🔴 Face not visible — move the face into the camera view'
  )
} else {
  setStatusMessage(
    `🟢 Face visible — ${faces.length} face${
      faces.length === 1 ? '' : 's'
    } detected`
  )
}
    } catch (err) {
      if (
        err?.response?.status === 503 ||
        !err?.response
      ) {
        setStatusMessage(
          'Vision service unavailable — retrying…'
        )
      } else {
        setStatusMessage(
          err?.response?.data?.message ||
          'Face detection failed — retrying…'
        )
      }
    } finally {
      inFlightRef.current = false
    }
  }

  const startScanLoop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current =
      setInterval(
        sendFrame,
        SCAN_INTERVAL_MS
      )
  }

  /*
   * FINAL CLASSROOM CAPTURE
   *
   * This is the manual capture button.
   * The image is sent at higher JPEG quality.
   *
   * Backend then performs:
   * detection + quality + recognition + attendance processing
   */
  const handleCapture = async () => {
    if (
      !sessionRef.current ||
      !videoRef.current?.videoWidth
    ) {
      setError(
        'Camera is not ready.'
      )
      return
    }

    setCaptureLoading(true)
    setCaptureComplete(false)
    setError('')

    setStatusMessage(
      'Capturing classroom image…'
    )

    try {
      const captureBlob =
        await captureFrameBlob(
          CAPTURE_JPEG_QUALITY
        )

      if (!captureBlob) {
        throw new Error(
          'Failed to capture classroom image.'
        )
      }

      setStatusMessage(
        'Processing classroom image…'
      )

      const result =
        await uploadCapture(
          sessionRef.current.id,
          captureBlob
        )

      setCaptureComplete(true)

      /*
       * Load the complete attendance review state
       * after the classroom image is processed.
       */
      const review =
        await getSessionReview(
          sessionRef.current.id
        )

      setReviewData(review)

      /*
       * We intentionally don't assume the exact
       * CaptureUploadResponse field names here.
       */
      const faceCount =
        result?.faceCount ??
        result?.face_count

      if (faceCount != null) {
        setStatusMessage(
          `Capture processed successfully — ${faceCount} face${faceCount === 1 ? '' : 's'} detected.`
        )
      } else {
        setStatusMessage(
          'Capture processed successfully. Review the attendance results.'
        )
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to process classroom capture.'
      )

      setStatusMessage(
        'Capture failed.'
      )
    } finally {
      setCaptureLoading(false)
    }
  }

  const handleStart = async (e) => {
    e.preventDefault()

    if (!classId) {
      setError(
        'Please select a class'
      )
      return
    }

    setError('')
    setStatus('starting')
    setStatusMessage(
      'Starting session…'
    )

    try {
      const newSession =
        await startSession({
          classId: Number(classId),
          subject:
            subject.trim() || null,
        })

      setSession(newSession)
      sessionRef.current =
        newSession

      setStatusMessage(
        'Starting camera…'
      )

      await startCamera()

      setStatus('scanning')

      setStatusMessage(
        'Scanning — keep all students visible'
      )

      startScanLoop()
    } catch (err) {
      cleanup()

      setStatus('error')

      setError(
        err?.response?.data?.message ||
        err?.message ||
        'Failed to start the session'
      )
    }
  }

  const handleRetryCamera = async () => {
    setError('')
    setStatus('starting')

    setStatusMessage(
      'Starting camera…'
    )

    try {
      await startCamera()

      setStatus('scanning')

      setStatusMessage(
        'Scanning — keep all students visible'
      )

      startScanLoop()
    } catch (err) {
      setStatus('error')

      setError(
        err?.message ||
        'Unable to access the camera'
      )
    }
  }

  const handleEnd = async () => {
    if (!session) return

    setStatus('ended')

    setStatusMessage(
      'Ending session…'
    )

    cleanup()

    try {
      const ended =
        await endSession(
          session.id
        )

      navigate(
        `/teacher/sessions/${ended.id}`
      )
    } catch (err) {
      setStatusMessage(
        err?.response?.data?.message ||
        'Session ended, but report failed to load'
      )

      setStatus('error')
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Attendance Scan
        </h1>

        <p className="text-text-secondary text-sm mt-1">
          Position the camera so all students are visible,
          then capture the classroom.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">
          <div>{error}</div>

          {session && !cameraOn && (
            <button
              onClick={handleRetryCamera}
              className="mt-2 underline font-medium"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* Start Session */}
      {!session && (
        <form
          onSubmit={handleStart}
          className="card p-6 space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Class
              </label>

              <select
                required
                value={classId}
                onChange={(e) =>
                  setClassId(e.target.value)
                }
                className="input"
              >
                <option value="">
                  Select a class…
                </option>

                {classes.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Subject (optional)
              </label>

              <input
                maxLength={300}
                value={subject}
                onChange={(e) =>
                  setSubject(e.target.value)
                }
                className="input"
                placeholder="Mathematics"
              />
            </div>

          </div>

          <button
            type="submit"
            disabled={
              status === 'starting' ||
              !classId
            }
            className="btn-primary"
          >
            {status === 'starting'
              ? 'Starting…'
              : 'Start Session & Camera'}
          </button>

          <p className="text-xs text-text-secondary">
            For phone testing, use HTTPS or localhost.
          </p>
        </form>
      )}

      {/* Active Session */}
      {session && (
        <>
          {/* Session status bar */}
          <div className="card px-6 py-4 mb-6 flex items-center justify-between flex-wrap gap-4">

            <div className="flex items-center gap-3">

              <span
                className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                  status === 'scanning'
                    ? 'bg-success animate-pulse'
                    : 'bg-warning'
                }`}
              />

              <div>
                <p className="text-sm font-medium text-text-primary">
                  Session #{session.id} — {session.className}
                  {session.subject
                    ? ` · ${session.subject}`
                    : ''}
                </p>

                <p className="text-xs text-text-secondary">
                  {statusMessage}
                </p>
              </div>

            </div>

            <div className="flex items-center gap-3 flex-wrap text-sm">

              <span className="text-text-secondary">
                {framesScanned} scans
              </span>

              <span
                className={
                  qualityFaces.length > 0
                    ? 'text-success font-medium'
                    : 'text-danger font-medium'
                }
              >
                {qualityFaces.length > 0
                  ? '🟢 Face visible'
                  : '🔴 Face not visible'}
              </span>

              <span className="text-text-secondary">
                {qualityFaces.length} face
                {qualityFaces.length === 1 ? '' : 's'}
              </span>

              <button
                onClick={handleCapture}
                disabled={
                  captureLoading ||
                  !cameraOn ||
                  qualityFaces.length === 0
                }
                className="btn-primary text-xs px-3 py-1.5"
              >
                {captureLoading
                  ? 'Processing…'
                  : '📸 Capture Classroom'}
              </button>

              <button
                onClick={handleEnd}
                disabled={
                  status === 'ended'
                }
                className="btn-danger text-xs px-3 py-1.5"
              >
                End Session
              </button>

            </div>
          </div>

          {/* Attendance Review */}
          {reviewData && (
            <div className="card p-6 mb-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">
                    Attendance Review
                  </h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Results from the latest classroom capture.
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="text-text-secondary">
                    Total:{' '}
                    <strong className="text-text-primary">
                      {reviewData.totalStudents ?? 0}
                    </strong>
                  </span>

                  <span className="text-success font-medium">
                    Present: {reviewData.recognized ?? 0}
                  </span>

                  <span className="text-warning font-medium">
                    Review: {reviewData.needsReview ?? 0}
                  </span>

                  <span className="text-text-secondary">
                    Not detected: {reviewData.notDetected ?? 0}
                  </span>
                </div>
              </div>

              {Array.isArray(reviewData.records) &&
              reviewData.records.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-3 pr-4 font-semibold text-text-secondary">
                          Roll No.
                        </th>
                        <th className="py-3 pr-4 font-semibold text-text-secondary">
                          Student
                        </th>
                        <th className="py-3 pr-4 font-semibold text-text-secondary">
                          Status
                        </th>
                        <th className="py-3 pr-4 font-semibold text-text-secondary">
                          Similarity
                        </th>
                        <th className="py-3 pr-4 font-semibold text-text-secondary">
                          Margin
                        </th>
                        <th className="py-3 font-semibold text-text-secondary">
                          Evidence
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {reviewData.records.map((record) => {
                        const status = String(
                          record?.status || 'UNVERIFIED'
                        ).toUpperCase()

                        let statusClass =
                          'bg-gray-100 text-gray-700'

                        if (status === 'PRESENT') {
                          statusClass =
                            'bg-green-100 text-green-700'
                        } else if (status === 'REVIEW') {
                          statusClass =
                            'bg-yellow-100 text-yellow-700'
                        } else if (status === 'ABSENT') {
                          statusClass =
                            'bg-red-100 text-red-700'
                        }

                        return (
                          <tr
                            key={record.studentId}
                            className="border-b last:border-b-0"
                          >
                            <td className="py-3 pr-4 text-text-primary">
                              {record.rollNumber || '-'}
                            </td>

                            <td className="py-3 pr-4 font-medium text-text-primary">
                              {record.studentName || '-'}
                            </td>

                            <td className="py-3 pr-4">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}
                              >
                                {status}
                              </span>
                            </td>

                            <td className="py-3 pr-4 text-text-primary">
                              {Number.isFinite(
                                Number(record.similarity)
                              )
                                ? Number(record.similarity).toFixed(3)
                                : '-'}
                            </td>

                            <td className="py-3 pr-4 text-text-primary">
                              {Number.isFinite(
                                Number(record.margin)
                              )
                                ? Number(record.margin).toFixed(3)
                                : '-'}
                            </td>

                            <td className="py-3 text-text-primary">
                              {record.evidenceCount ?? 0}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  No attendance records are available yet.
                </p>
              )}
            </div>
          )}

          {/* Camera + Guidance */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Camera */}
            <div className="lg:col-span-2 bg-navy rounded-xl overflow-hidden relative isolate">

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full block"
              />

              {/* 
                LIVE FACE VISIBILITY GUIDE

                This is intentionally a normal HTML/CSS overlay,
                not a canvas. This guarantees the box is visible
                above the camera video.

                RED   = no face detected yet
                GREEN = at least one face detected
              */}
              <div
                className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
              >
                <div
                  className={`relative w-[45%] h-[60%] min-w-[180px] min-h-[220px] max-w-[420px] max-h-[520px] rounded-2xl border-[6px] border-dashed transition-colors duration-200 ${
                    qualityFaces.length > 0
                      ? 'border-green-500'
                      : 'border-red-500'
                  }`}
                >
                  <div
                    className={`absolute left-1/2 -translate-x-1/2 -top-11 px-4 py-2 rounded-lg text-white text-sm font-bold whitespace-nowrap shadow-lg ${
                      qualityFaces.length > 0
                        ? 'bg-green-600'
                        : 'bg-red-600'
                    }`}
                  >
                    {qualityFaces.length > 0
                      ? '🟢 FACE VISIBLE'
                      : '🔴 FACE NOT VISIBLE'}
                  </div>
                </div>
              </div>

              {!cameraOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm gap-3">

                  <span>
                    Camera off
                  </span>

                  <button
                    onClick={handleRetryCamera}
                    className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm transition-colors"
                  >
                    Start Camera
                  </button>

                </div>
              )}

              {/* Capture completed overlay */}
              {captureComplete && (
                <div className="absolute top-4 left-4 right-4 bg-green-600/90 text-white rounded-lg px-4 py-3 text-sm font-medium">
                  ✅ Classroom capture processed successfully.
                </div>
              )}

            </div>

            {/* Guidance Panel */}
            <div className="card p-5">

              <p className="text-sm font-semibold text-text-primary mb-4">
                Camera Guidance
              </p>

              <div className="space-y-4">

                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    Face status
                  </span>

                  <span
                    className={
                      qualityFaces.length > 0
                        ? 'font-semibold text-success'
                        : 'font-semibold text-danger'
                    }
                  >
                    {qualityFaces.length > 0
                      ? '🟢 FACE VISIBLE'
                      : '🔴 FACE NOT VISIBLE'}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">
                    Faces detected
                  </span>

                  <span className="font-semibold text-text-primary">
                    {qualityFaces.length}
                  </span>
                </div>

                <div className="border-t pt-4">

                  <p className="text-xs font-semibold text-text-primary mb-2">
                    Camera box
                  </p>

                  <div className="space-y-2 text-xs">

                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-green-600" />
                      <span className="text-text-secondary">
                        GREEN — face is visible
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-text-secondary">
                        RED — face is not visible
                      </span>
                    </div>

                  </div>

                </div>

                <div className="border-t pt-4">

                  <p className="text-xs text-text-secondary leading-5">
                    The box is RED when no face is
                    detected and GREEN when at least one
                    face is detected. Once the box is
                    GREEN, position the students clearly
                    and press <strong>Capture Classroom</strong>.
                  </p>

                </div>

              </div>
            </div>

          </div>
        </>
      )}
    </div>
  )
}
