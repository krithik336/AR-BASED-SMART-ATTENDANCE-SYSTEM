import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSessionReview, reviewStudent, submitSession, cancelSession } from '../api/attendance'

const STATUS_BADGE = {
  PRESENT: 'badge-green',
  ABSENT: 'badge-danger',
  REVIEW: 'badge-warning',
  UNVERIFIED: 'badge-neutral',
}

export default function AttendanceReview() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [overriding, setOverriding] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setReview(await getSessionReview(id))
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load review')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const session = review?.session
  const active = session?.status === 'ACTIVE'

  const counts = (review?.records || []).reduce(
    (acc, r) => {
      if (r.status === 'PRESENT') acc.present += 1
      else if (r.status === 'REVIEW') acc.review += 1
      else if (r.status === 'ABSENT') acc.absent += 1
      else acc.notDetected += 1
      return acc
    },
    { present: 0, review: 0, absent: 0, notDetected: 0 }
  )

  const handleOverride = async (studentId, status) => {
    if (!active || overriding[studentId]) return
    setOverriding((o) => ({ ...o, [studentId]: true }))
    setError('')
    try {
      const updated = await reviewStudent(id, studentId, status)
      setReview((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          records: prev.records.map((r) =>
            r.studentId === studentId ? { ...r, status: updated.status } : r
          ),
        }
      })
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to update student status')
    } finally {
      setOverriding((o) => { const next = { ...o }; delete next[studentId]; return next })
    }
  }

  const handleSubmit = async () => {
    if (!active || busy) return
    if (!window.confirm(
      'Submit attendance? Every student not marked PRESENT will be recorded as ABSENT. This cannot be undone.'
    )) return
    setBusy(true)
    setError('')
    try {
      const s = await submitSession(id)
      navigate(`/teacher/sessions/${s.id}`)
    } catch (err) {
      setBusy(false)
      setError(err?.response?.data?.message || 'Failed to submit attendance')
    }
  }

  const handleCancel = async () => {
    if (!active || busy) return
    if (!window.confirm(
      'Cancel this session? No final attendance will be produced. Captured photos are kept for audit.'
    )) return
    setBusy(true)
    setError('')
    try {
      await cancelSession(id)
      navigate('/teacher/sessions')
    } catch (err) {
      setBusy(false)
      setError(err?.response?.data?.message || 'Failed to cancel session')
    }
  }

  if (loading) {
    return <Shell><p className="text-sm text-text-secondary">Loading review…</p></Shell>
  }

  if (error && !review) {
    return (
      <Shell>
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200">{error}</div>
        <button onClick={() => navigate('/teacher/sessions')} className="btn-secondary mt-4 text-xs">← Sessions</button>
      </Shell>
    )
  }

  if (!review) return null

  return (
    <Shell
      title="Review Attendance"
      action={
        <button onClick={() => navigate('/teacher/sessions')} className="btn-secondary text-xs">← All sessions</button>
      }
    >
      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">{error}</div>
      )}

      {!active && (
        <div className="bg-surface border border-border text-text-secondary text-sm rounded-lg px-4 py-3 mb-6">
          This session is {session?.status === 'CANCELLED' ? 'cancelled' : 'already submitted'} — editing is closed.
        </div>
      )}

      <div className="card p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {session?.className}{session?.subject ? ` — ${session.subject}` : ''}
            </h2>
            <p className="text-sm text-text-secondary mt-0.5">
              Session #{session?.id} · Started {session?.startedAt ? new Date(session.startedAt).toLocaleString() : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/teacher/scan?sessionId=${id}`)}
              disabled={!active}
              className="btn-secondary text-xs"
              title="Go back to the camera and capture more photos"
            >
              Capture More Photos
            </button>
            <span className={STATUS_BADGE[session?.status] || 'badge-neutral'}>{session?.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <Stat label="Recognized" value={counts.present} color="text-success" />
          <Stat label="Needs Review" value={counts.review} color="text-warning" />
          <Stat label="Not Detected" value={counts.notDetected} color="text-danger" />
          <Stat label="Photos" value={review?.photosCaptured ?? 0} />
        </div>
      </div>

      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-text-primary">Students</h3>
          <p className="text-xs text-text-secondary">
            {review?.records?.length ?? 0} of {review?.totalStudents ?? 0} enrolled · click Present / Absent to override
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Student</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Similarity</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Margin</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Evidence</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Teacher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(review?.records || []).map((r) => (
                <tr key={r.studentId} className="hover:bg-surface transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-text-primary">{r.studentName}</p>
                    <p className="font-mono text-xs text-text-secondary">{r.rollNumber}</p>
                  </td>
                  <td className="px-6 py-3">
                    <span className={STATUS_BADGE[r.status] || 'badge-neutral'}>{r.status}</span>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary">
                    {r.similarity > 0 ? `${(r.similarity * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-text-secondary">
                    {r.margin > 0 ? `${(r.margin * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-6 py-3 text-xs text-text-secondary">
                    {r.evidenceCount > 0 ? `${r.evidenceCount} photo(s)` : '—'}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOverride(r.studentId, 'PRESENT')}
                        disabled={!active || overriding[r.studentId] || r.status === 'PRESENT'}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          r.status === 'PRESENT'
                            ? 'bg-green-50 text-success border border-green-200'
                            : 'border border-border text-text-secondary hover:bg-green-50 hover:text-success'
                        }`}
                      >
                        Present
                      </button>
                      <button
                        onClick={() => handleOverride(r.studentId, 'ABSENT')}
                        disabled={!active || overriding[r.studentId] || r.status === 'ABSENT'}
                        className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          r.status === 'ABSENT'
                            ? 'bg-red-50 text-danger border border-red-200'
                            : 'border border-border text-text-secondary hover:bg-red-50 hover:text-danger'
                        }`}
                      >
                        Absent
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          {counts.present} present, {counts.review} unresolved, {counts.notDetected} not detected.
          Submit marks everyone not PRESENT as ABSENT.
        </p>
        <div className="flex gap-3">
          <button onClick={handleCancel} disabled={!active || busy} className="btn-danger">
            {busy ? 'Working…' : 'Cancel Session'}
          </button>
          <button onClick={handleSubmit} disabled={!active || busy} className="btn-primary">
            {busy ? 'Submitting…' : 'Submit Attendance'}
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, title = 'Review Attendance', action }) {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          <p className="text-text-secondary text-sm mt-1">
            Verify recognized students, resolve flagged faces, then submit the final attendance
          </p>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg bg-surface py-3 border border-border">
      <p className={`text-2xl font-semibold ${color || 'text-text-primary'}`}>{value}</p>
      <p className="text-xs text-text-secondary mt-0.5">{label}</p>
    </div>
  )
}
