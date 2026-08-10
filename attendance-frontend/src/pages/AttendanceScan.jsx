// import { useState, useEffect, useRef, useCallback } from 'react'
// import { useNavigate } from 'react-router-dom'
// import { listClasses } from '../api/classes'
// import { startSession, endSession } from '../api/sessions'
// import { scanFrame } from '../api/attendance'

// const SCAN_INTERVAL_MS = 1500
// const FRAME_JPEG_QUALITY = 0.8

// export default function AttendanceScan() {
//   const navigate = useNavigate()

//   const videoRef = useRef(null)
//   const overlayRef = useRef(null)
//   const streamRef = useRef(null)
//   const timerRef = useRef(null)
//   const inFlightRef = useRef(false)

//   const [classes, setClasses] = useState([])
//   const [classId, setClassId] = useState('')
//   const [subject, setSubject] = useState('')
//   const [session, setSession] = useState(null) // active session
//   const [cameraOn, setCameraOn] = useState(false)
//   const [status, setStatus] = useState('idle') // idle | starting | scanning | ended | error
//   const [statusMessage, setStatusMessage] = useState('')
//   const [error, setError] = useState('')
//   const [results, setResults] = useState([]) // latest frame RecognizedFace[]
//   const [present, setPresent] = useState(new Map()) // studentId -> {name, roll, similarity, marked}
//   const [framesScanned, setFramesScanned] = useState(0)
//   const [unknownCount, setUnknownCount] = useState(0)

//   const sessionRef = useRef(session)
//   sessionRef.current = session

//   useEffect(() => {
//     listClasses()
//       .then(setClasses)
//       .catch(() => setError('Failed to load classes'))
//   }, [])

//   useEffect(() => () => cleanup(), []) // eslint-disable-line react-hooks/exhaustive-deps

//   const cleanup = useCallback(() => {
//     if (timerRef.current) {
//       clearInterval(timerRef.current)
//       timerRef.current = null
//     }
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach((t) => t.stop())
//       streamRef.current = null
//     }
//   }, [])

//   const startCamera = useCallback(async () => {
//     const stream = await navigator.mediaDevices.getUserMedia({
//       video: { width: { ideal: 960 }, height: { ideal: 720 }, facingMode: 'user' },
//       audio: false,
//     })
//     streamRef.current = stream
//     if (videoRef.current) {
//       videoRef.current.srcObject = stream
//       await videoRef.current.play()
//     }
//     setCameraOn(true)
//   }, [])

//   const stopCamera = useCallback(() => {
//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach((t) => t.stop())
//       streamRef.current = null
//     }
//     setCameraOn(false)
//   }, [])

//   const handleStart = async (e) => {
//     e.preventDefault()
//     if (!classId) return
//     setError('')
//     setStatus('starting')
//     setStatusMessage('Starting session…')
//     try {
//       const s = await startSession({ classId: Number(classId), subject: subject.trim() || null })
//       setSession(s)
//       setStatusMessage('Starting camera…')
//       await startCamera()
//       setStatus('scanning')
//       setStatusMessage('Scanning — keep students in front of the camera')
//       startScanLoop()
//     } catch (err) {
//       setStatus('error')
//       setError(err.response?.data?.message || 'Failed to start the session')
//     }
//   }

//   const startScanLoop = () => {
//     if (timerRef.current) clearInterval(timerRef.current)
//     timerRef.current = setInterval(sendFrame, SCAN_INTERVAL_MS)
//   }

//   const captureFrame = () => {
//     const video = videoRef.current
//     if (!video || !video.videoWidth) return null
//     const canvas = document.createElement('canvas')
//     canvas.width = video.videoWidth
//     canvas.height = video.videoHeight
//     canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
//     return canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY).split(',')[1]
//   }

//   const sendFrame = async () => {
//     if (inFlightRef.current || !sessionRef.current || !videoRef.current?.videoWidth) return
//     const frame = captureFrame()
//     if (!frame) return

//     inFlightRef.current = true
//     try {
//       const scan = await scanFrame(sessionRef.current.id, frame)
//       setFramesScanned((n) => n + 1)
//       setUnknownCount(scan.unknown)
//       setResults(scan.results)
//       setPresent((prev) => {
//         const next = new Map(prev)
//         scan.results
//           .filter((r) => r.matched && r.studentId != null)
//           .forEach((r) => {
//             const existing = next.get(r.studentId)
//             if (!existing || r.similarity > existing.similarity) {
//               next.set(r.studentId, {
//                 name: r.studentName,
//                 roll: r.rollNumber,
//                 similarity: r.similarity,
//                 marked: r.marked,
//               })
//             }
//           })
//         return next
//       })
//       drawOverlay(scan.results)
//       setStatusMessage(
//         scan.faceCount === 0
//           ? 'Scanning — no face in view'
//           : `Scanning — ${scan.recognized} recognized, ${scan.unknown} unknown`
//       )
//     } catch (err) {
//       if (err.response?.status === 503 || !err.response) {
//         setStatusMessage('Vision service unavailable — retrying…')
//       } else if (err.response?.status === 400 && err.response?.data?.message) {
//         setStatusMessage(err.response.data.message)
//       } else {
//         setStatusMessage(err.response?.data?.message || 'Scan failed')
//       }
//     } finally {
//       inFlightRef.current = false
//     }
//   }

//   const drawOverlay = (faceResults) => {
//     const canvas = overlayRef.current
//     const video = videoRef.current
//     if (!canvas || !video?.videoWidth) return
//     canvas.width = video.videoWidth
//     canvas.height = video.videoHeight
//     const ctx = canvas.getContext('2d')
//     ctx.clearRect(0, 0, canvas.width, canvas.height)
//     faceResults.forEach((r) => {
//       const x = r.bbox.x
//       const y = r.bbox.y
//       const w = r.bbox.width
//       const h = r.bbox.height
//       ctx.strokeStyle = r.matched ? '#16a34a' : '#f43f5e'
//       ctx.lineWidth = 3
//       ctx.strokeRect(x, y, w, h)
//       const label = r.matched ? `${r.studentName} (${(r.similarity * 100).toFixed(0)}%)` : 'Unknown'
//       ctx.font = '14px sans-serif'
//       const textWidth = ctx.measureText(label).width
//       ctx.fillStyle = r.matched ? '#16a34a' : '#f43f5e'
//       ctx.fillRect(x, y - 22, textWidth + 8, 20)
//       ctx.fillStyle = '#ffffff'
//       ctx.fillText(label, x + 4, y - 7)
//     })
//   }

//   const handleEnd = async () => {
//     if (!session) return
//     setStatus('ended')
//     setStatusMessage('Ending session…')
//     cleanup()
//     try {
//       const ended = await endSession(session.id)
//       navigate(`/teacher/sessions/${ended.id}`)
//     } catch (err) {
//       setStatusMessage(err.response?.data?.message || 'Session ended, but report failed to load')
//       setStatus('error')
//     }
//   }

//   return (
//     <div className="min-h-screen bg-slate-50">
//       <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
//         <div>
//           <h1 className="font-semibold text-brand-dark">Attendance Scan</h1>
//           <p className="text-sm text-slate-500">
//             Real-time face recognition — frames are matched against the class gallery
//           </p>
//         </div>
//         <button
//           onClick={() => navigate('/teacher')}
//           className="text-sm text-slate-600 hover:text-brand"
//         >
//           ← Back to dashboard
//         </button>
//       </header>

//       <main className="p-6 max-w-5xl mx-auto space-y-6">
//         {error && (
//           <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-2 border border-red-200">
//             {error}
//           </div>
//         )}

//         {!session && (
//           <form onSubmit={handleStart} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
//                 <select
//                   required
//                   value={classId}
//                   onChange={(e) => setClassId(e.target.value)}
//                   className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
//                 >
//                   <option value="">Select a class…</option>
//                   {classes.map((c) => (
//                     <option key={c.id} value={c.id}>
//                       {c.name} ({c.code})
//                     </option>
//                   ))}
//                 </select>
//               </div>
//               <div>
//                 <label className="block text-sm font-medium text-slate-700 mb-1">Subject (optional)</label>
//                 <input
//                   maxLength={300}
//                   value={subject}
//                   onChange={(e) => setSubject(e.target.value)}
//                   className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
//                   placeholder="Mathematics"
//                 />
//               </div>
//             </div>
//             <button
//               type="submit"
//               disabled={status === 'starting' || !classId}
//               className="bg-brand hover:bg-brand-dark text-white font-medium rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-60"
//             >
//               {status === 'starting' ? 'Starting…' : 'Start Session & Camera'}
//             </button>
//             <p className="text-xs text-slate-400">
//               Camera access requires a secure context. localhost works; for testing on a phone serve
//               the frontend over HTTPS.
//             </p>
//           </form>
//         )}

//         {session && (
//           <>
//             <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-6 py-4">
//               <div className="flex items-center gap-3">
//                 <span
//                   className={`h-2.5 w-2.5 rounded-full ${
//                     status === 'scanning' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'
//                   }`}
//                 />
//                 <div>
//                   <p className="text-sm font-medium text-slate-800">
//                     Session #{session.id} — {session.className}
//                     {session.subject ? ` · ${session.subject}` : ''}
//                   </p>
//                   <p className="text-xs text-slate-500">{statusMessage}</p>
//                 </div>
//               </div>
//               <div className="flex items-center gap-4 text-sm text-slate-600">
//                 <span>{framesScanned} frames</span>
//                 <span>{present.size} marked present</span>
//                 <span className="text-red-600">{unknownCount} unknown</span>
//                 <button
//                   onClick={handleEnd}
//                   disabled={status === 'ended'}
//                   className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-60"
//                 >
//                   End Session
//                 </button>
//               </div>
//             </div>

//             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//               <div className="lg:col-span-2 bg-black rounded-xl overflow-hidden relative">
//                 <video ref={videoRef} autoPlay playsInline muted className="w-full" />
//                 <canvas
//                   ref={overlayRef}
//                   className="absolute inset-0 w-full h-full pointer-events-none"
//                 />
//                 {!cameraOn && (
//                   <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
//                     Camera off
//                   </div>
//                 )}
//               </div>

//               <div className="bg-white rounded-xl border border-slate-200 p-4">
//                 <h2 className="text-sm font-medium text-slate-800 mb-3">Recognized Students</h2>
//                 {present.size === 0 ? (
//                   <p className="text-sm text-slate-400">Waiting for the first recognition…</p>
//                 ) : (
//                   <ul className="space-y-2 max-h-96 overflow-y-auto">
//                     {[...present.entries()].map(([id, s]) => (
//                       <li key={id} className="flex items-center justify-between text-sm">
//                         <div>
//                           <p className="font-medium text-slate-800">
//                             {s.name}{' '}
//                             {s.marked && (
//                               <span className="ml-1 text-[10px] uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
//                                 new
//                               </span>
//                             )}
//                           </p>
//                           <p className="text-xs text-slate-400">{s.roll}</p>
//                         </div>
//                         <span className="text-xs font-mono text-slate-600">
//                           {(s.similarity * 100).toFixed(0)}%
//                         </span>
//                       </li>
//                     ))}
//                   </ul>
//                 )}
//               </div>
//             </div>
//           </>
//         )}
//       </main>
//     </div>
//   )
// }
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listClasses } from '../api/classes'
import { startSession, endSession } from '../api/sessions'
import { scanFrame } from '../api/attendance'

const SCAN_INTERVAL_MS = 1500
const FRAME_JPEG_QUALITY = 0.8

export default function AttendanceScan() {
  const navigate = useNavigate()

  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const inFlightRef = useRef(false)

  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [subject, setSubject] = useState('')
  const [session, setSession] = useState(null)

  const [cameraOn, setCameraOn] = useState(false)
  const [status, setStatus] = useState('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [error, setError] = useState('')

  const [results, setResults] = useState([])
  const [present, setPresent] = useState(new Map())
  const [framesScanned, setFramesScanned] = useState(0)
  const [unknownCount, setUnknownCount] = useState(0)

  const sessionRef = useRef(session)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  // ------------------------------------------------------------
  // LOAD CLASSES
  // ------------------------------------------------------------

  useEffect(() => {
    listClasses()
      .then(setClasses)
      .catch(() => setError('Failed to load classes'))
  }, [])

  // ------------------------------------------------------------
  // CLEANUP
  // ------------------------------------------------------------

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
    return () => {
      cleanup()
    }
  }, [cleanup])

  // ------------------------------------------------------------
  // WAIT FOR VIDEO ELEMENT
  // ------------------------------------------------------------

  const waitForVideoElement = useCallback(async () => {
    for (let i = 0; i < 50; i++) {
      if (videoRef.current) {
        return videoRef.current
      }

      await new Promise((resolve) => {
        requestAnimationFrame(resolve)
      })
    }

    throw new Error('Camera video element is not available')
  }, [])

  // ------------------------------------------------------------
  // START CAMERA
  // ------------------------------------------------------------

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Camera access is not supported by this browser. Use Chrome, Edge, or Firefox.'
      )
    }

    if (!window.isSecureContext) {
      throw new Error(
        'Camera access requires a secure context. localhost is supported.'
      )
    }

    // Get the video element AFTER React has rendered it
    const video = await waitForVideoElement()

    // Request camera permission
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      audio: false,
    })

    streamRef.current = stream

    // Attach stream to video
    video.srcObject = stream

    video.muted = true
    video.playsInline = true
    video.autoplay = true

    try {
      await video.play()
    } catch (playError) {
      console.warn('Video autoplay/play warning:', playError)
    }

    // Wait until browser knows video dimensions
    await new Promise((resolve) => {
      if (video.readyState >= 2 && video.videoWidth > 0) {
        resolve()
        return
      }

      const handleLoadedMetadata = () => {
        video.removeEventListener(
          'loadedmetadata',
          handleLoadedMetadata
        )
        resolve()
      }

      video.addEventListener(
        'loadedmetadata',
        handleLoadedMetadata
      )

      // Safety timeout
      setTimeout(() => {
        video.removeEventListener(
          'loadedmetadata',
          handleLoadedMetadata
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

    return video
  }, [waitForVideoElement])

  // ------------------------------------------------------------
  // STOP CAMERA
  // ------------------------------------------------------------

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop()
      })

      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setCameraOn(false)
  }, [])

  // ------------------------------------------------------------
  // START SESSION
  // ------------------------------------------------------------

  const handleStart = async (e) => {
    e.preventDefault()

    if (!classId) {
      setError('Please select a class')
      return
    }

    setError('')
    setStatus('starting')
    setStatusMessage('Starting session…')

    try {
      // 1. Create backend attendance session
      const newSession = await startSession({
        classId: Number(classId),
        subject: subject.trim() || null,
      })

      // 2. Store session
      setSession(newSession)
      sessionRef.current = newSession

      setStatusMessage('Starting camera…')

      // IMPORTANT:
      // React needs time to render <video>.
      // waitForVideoElement() handles that.
      await startCamera()

      setStatus('scanning')
      setStatusMessage(
        'Scanning — keep students in front of the camera'
      )

      startScanLoop()
    } catch (err) {
      console.error('Failed to start attendance session:', err)

      // If camera/session failed, clean up
      cleanup()

      setStatus('error')

      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to start the session'

      setError(message)
      setStatusMessage('Unable to start camera')
    }
  }

  // ------------------------------------------------------------
  // SCAN LOOP
  // ------------------------------------------------------------

  const startScanLoop = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }

    timerRef.current = setInterval(
      sendFrame,
      SCAN_INTERVAL_MS
    )
  }

  // ------------------------------------------------------------
  // CAPTURE FRAME
  // ------------------------------------------------------------

  const captureFrame = () => {
    const video = videoRef.current

    if (
      !video ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return null
    }

    const canvas = document.createElement('canvas')

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')

    if (!context) {
      return null
    }

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height
    )

    return canvas
      .toDataURL('image/jpeg', FRAME_JPEG_QUALITY)
      .split(',')[1]
  }

  // ------------------------------------------------------------
  // SEND FRAME TO BACKEND
  // ------------------------------------------------------------

  const sendFrame = async () => {
    if (
      inFlightRef.current ||
      !sessionRef.current ||
      !videoRef.current?.videoWidth
    ) {
      return
    }

    const frame = captureFrame()

    if (!frame) {
      return
    }

    inFlightRef.current = true

    try {
      const scan = await scanFrame(
        sessionRef.current.id,
        frame
      )

      setFramesScanned((n) => n + 1)

      setUnknownCount(scan.unknown || 0)

      setResults(scan.results || [])

      setPresent((previous) => {
        const next = new Map(previous)

        ;(scan.results || [])
          .filter(
            (result) =>
              result.matched &&
              result.studentId != null
          )
          .forEach((result) => {
            const existing = next.get(result.studentId)

            if (
              !existing ||
              result.similarity > existing.similarity
            ) {
              next.set(result.studentId, {
                name: result.studentName,
                roll: result.rollNumber,
                similarity: result.similarity,
                marked: result.marked,
              })
            }
          })

        return next
      })

      drawOverlay(scan.results || [])

      if (scan.faceCount === 0) {
        setStatusMessage(
          'Scanning — no face in view'
        )
      } else {
        setStatusMessage(
          `Scanning — ${scan.recognized || 0} recognized, ${
            scan.unknown || 0
          } unknown`
        )
      }
    } catch (err) {
      console.error('Frame scan failed:', err)

      if (
        err?.response?.status === 401 ||
        err?.response?.status === 403
      ) {
        setStatusMessage(
          'Authentication expired — please login again'
        )
      } else if (
        err?.response?.status === 503 ||
        !err?.response
      ) {
        setStatusMessage(
          'Vision service unavailable — retrying…'
        )
      } else if (
        err?.response?.status === 400 &&
        err?.response?.data?.message
      ) {
        setStatusMessage(
          err.response.data.message
        )
      } else {
        setStatusMessage(
          err?.response?.data?.message ||
            'Scan failed — retrying…'
        )
      }
    } finally {
      inFlightRef.current = false
    }
  }

  // ------------------------------------------------------------
  // DRAW FACE OVERLAY
  // ------------------------------------------------------------

  const drawOverlay = (faceResults) => {
    const canvas = overlayRef.current
    const video = videoRef.current

    if (
      !canvas ||
      !video ||
      !video.videoWidth ||
      !video.videoHeight
    ) {
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')

    if (!context) {
      return
    }

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    )

    faceResults.forEach((result) => {
      if (!result.bbox) {
        return
      }

      const x = result.bbox.x
      const y = result.bbox.y
      const width = result.bbox.width
      const height = result.bbox.height

      context.strokeStyle = result.matched
        ? '#16a34a'
        : '#f43f5e'

      context.lineWidth = 3

      context.strokeRect(
        x,
        y,
        width,
        height
      )

      const label = result.matched
        ? `${result.studentName} (${(
            result.similarity * 100
          ).toFixed(0)}%)`
        : 'Unknown'

      context.font = '14px sans-serif'

      const textWidth =
        context.measureText(label).width

      context.fillStyle = result.matched
        ? '#16a34a'
        : '#f43f5e'

      context.fillRect(
        x,
        y - 22,
        textWidth + 8,
        20
      )

      context.fillStyle = '#ffffff'

      context.fillText(
        label,
        x + 4,
        y - 7
      )
    })
  }

  // ------------------------------------------------------------
  // END SESSION
  // ------------------------------------------------------------

  const handleEnd = async () => {
    if (!session) {
      return
    }

    setStatus('ended')
    setStatusMessage('Ending session…')

    cleanup()

    try {
      const ended = await endSession(
        session.id
      )

      navigate(
        `/teacher/sessions/${ended.id}`
      )
    } catch (err) {
      console.error(
        'Failed to end session:',
        err
      )

      setStatusMessage(
        err?.response?.data?.message ||
          'Session ended, but report failed to load'
      )

      setStatus('error')
    }
  }

  // ------------------------------------------------------------
  // RETRY CAMERA
  // ------------------------------------------------------------

  const handleRetryCamera = async () => {
    try {
      setError('')
      setStatus('starting')
      setStatusMessage('Starting camera…')

      await startCamera()

      setStatus('scanning')
      setStatusMessage(
        'Scanning — keep students in front of the camera'
      )

      startScanLoop()
    } catch (err) {
      console.error(
        'Retry camera failed:',
        err
      )

      setStatus('error')

      setError(
        err?.message ||
          'Unable to access the camera'
      )
    }
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50">

      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-brand-dark">
            Attendance Scan
          </h1>

          <p className="text-sm text-slate-500">
            Real-time face recognition — frames
            are matched against the class gallery
          </p>
        </div>

        <button
          onClick={() => navigate('/teacher')}
          className="text-sm text-slate-600 hover:text-brand"
        >
          ← Back to dashboard
        </button>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">

        {/* ERROR */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-md px-3 py-3 border border-red-200">
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

        {/* START SESSION FORM */}
        {!session && (
          <form
            onSubmit={handleStart}
            className="bg-white rounded-xl border border-slate-200 p-6 space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* CLASS */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Class
                </label>

                <select
                  required
                  value={classId}
                  onChange={(e) =>
                    setClassId(e.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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

              {/* SUBJECT */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Subject (optional)
                </label>

                <input
                  maxLength={300}
                  value={subject}
                  onChange={(e) =>
                    setSubject(e.target.value)
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
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
              className="bg-brand hover:bg-brand-dark text-white font-medium rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-60"
            >
              {status === 'starting'
                ? 'Starting…'
                : 'Start Session & Camera'}
            </button>

            <p className="text-xs text-slate-400">
              Camera access requires a secure
              context. localhost works; for
              testing on a phone serve the
              frontend over HTTPS.
            </p>
          </form>
        )}

        {/* ACTIVE SESSION */}
        {session && (
          <>
            {/* SESSION HEADER */}
            <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-6 py-4">

              <div className="flex items-center gap-3">

                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    status === 'scanning'
                      ? 'bg-green-500 animate-pulse'
                      : 'bg-amber-500'
                  }`}
                />

                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Session #{session.id} —{' '}
                    {session.className}
                    {session.subject
                      ? ` · ${session.subject}`
                      : ''}
                  </p>

                  <p className="text-xs text-slate-500">
                    {statusMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-slate-600">

                <span>
                  {framesScanned} frames
                </span>

                <span>
                  {present.size} marked present
                </span>

                <span className="text-red-600">
                  {unknownCount} unknown
                </span>

                <button
                  onClick={handleEnd}
                  disabled={
                    status === 'ended'
                  }
                  className="bg-red-600 hover:bg-red-700 text-white font-medium rounded-md px-3 py-1.5 text-xs transition-colors disabled:opacity-60"
                >
                  End Session
                </button>

              </div>
            </div>

            {/* CAMERA + RESULTS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* CAMERA */}
              <div className="lg:col-span-2 bg-black rounded-xl overflow-hidden relative">

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full block"
                />

                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                />

                {!cameraOn && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/70 text-sm gap-3">
                    <span>
                      Camera off
                    </span>

                    <button
                      onClick={handleRetryCamera}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-md px-3 py-1.5 text-white"
                    >
                      Start Camera
                    </button>
                  </div>
                )}

              </div>

              {/* RECOGNIZED STUDENTS */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">

                <h2 className="text-sm font-medium text-slate-800 mb-3">
                  Recognized Students
                </h2>

                {present.size === 0 ? (
                  <p className="text-sm text-slate-400">
                    Waiting for the first recognition…
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-96 overflow-y-auto">

                    {[...present.entries()].map(
                      ([id, student]) => (
                        <li
                          key={id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div>

                            <p className="font-medium text-slate-800">
                              {student.name}{' '}

                              {student.marked && (
                                <span className="ml-1 text-[10px] uppercase bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                  new
                                </span>
                              )}
                            </p>

                            <p className="text-xs text-slate-400">
                              {student.roll}
                            </p>

                          </div>

                          <span className="text-xs font-mono text-slate-600">
                            {(
                              student.similarity *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        </li>
                      )
                    )}

                  </ul>
                )}

              </div>

            </div>
          </>
        )}

      </main>
    </div>
  )
}