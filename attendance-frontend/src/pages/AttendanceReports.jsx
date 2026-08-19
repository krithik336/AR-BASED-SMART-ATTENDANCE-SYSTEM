import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { listSessions, getSessionReport } from '../api/sessions'

const statusBadge = (status) =>
  status === 'ACTIVE' ? 'badge-green' : 'badge-neutral'

export default function AttendanceReports() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setSessions(await listSessions()) }
    catch (err) { setError(err.response?.data?.message || 'Failed to load sessions') }
    finally { setLoading(false) }
  }, [])

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setReport(await getSessionReport(id)) }
    catch (err) { setError(err.response?.data?.message || 'Failed to load report') }
    finally { setLoading(false) }
  }, [id])

  useEffect(() => {
    if (id) loadReport()
    else loadSessions()
  }, [id, loadReport, loadSessions])

  // ── Session report view ────────────────────────────────────────────────────
  if (id) {
    if (loading) return <PageShell><p className="text-sm text-text-secondary">Loading report…</p></PageShell>
    if (error)   return <PageShell><div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200">{error}</div></PageShell>
    if (!report) return <PageShell><p className="text-sm text-text-secondary">No report.</p></PageShell>

    const s = report.session
    return (
      <PageShell
        title="Session Report"
        action={
          <div className="flex gap-3">
            {s.status === 'ACTIVE' && (
              <button onClick={() => navigate(`/teacher/sessions/${s.id}/review`)} className="btn-primary text-xs">
                Review Attendance
              </button>
            )}
            <button onClick={() => navigate('/teacher/sessions')} className="btn-secondary text-xs">
              ← All sessions
            </button>
          </div>
        }
      >
        <div className="card p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                {s.className}{s.subject ? ` — ${s.subject}` : ''}
              </h2>
              <p className="text-sm text-text-secondary mt-0.5">
                Started {new Date(s.startedAt).toLocaleString()}
                {s.endedAt ? ` · Ended ${new Date(s.endedAt).toLocaleString()}` : ' · Ongoing'}
              </p>
            </div>
            <span className={statusBadge(s.status)}>{s.status}</span>
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <Stat label="Total"      value={s.totalStudents} />
            <Stat label="Present"    value={s.present}    color="text-success" />
            <Stat label="Absent"     value={s.absent}     color="text-danger" />
            <Stat label="Unverified" value={s.unverified} />
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h3 className="font-semibold text-text-primary">Attendance Records</h3>
          </div>
          {report.records.length === 0 ? (
            <p className="p-6 text-sm text-text-secondary">
              No records yet. Records are generated when a session ends.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border text-left">
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Roll</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Similarity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.records.map((r) => (
                  <tr key={r.studentId} className="hover:bg-surface transition-colors">
                    <td className="px-6 py-3 font-medium text-text-primary">{r.studentName}</td>
                    <td className="px-6 py-3 font-mono text-xs text-text-secondary">{r.rollNumber}</td>
                    <td className="px-6 py-3">
                      <span className={
                        r.status === 'PRESENT' ? 'badge-green' :
                        r.status === 'ABSENT'  ? 'badge-danger' : 'badge-neutral'
                      }>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-text-secondary">
                      {r.similarity > 0 ? `${(r.similarity * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </PageShell>
    )
  }

  // ── Sessions list view ─────────────────────────────────────────────────────
  return (
    <PageShell title="Sessions & Reports">
      {error && (
        <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">{error}</div>
      )}
      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-text-secondary">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="p-6 text-sm text-text-secondary">
            No sessions yet. Start one from the Attendance Scan page.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface border-b border-border text-left">
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Class</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Subject</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Started</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Present</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.map((s) => (
                <tr key={s.id} className="hover:bg-surface transition-colors cursor-pointer">
                  <td className="px-6 py-3">
                    <Link to={`/teacher/sessions/${s.id}`} className="text-primary font-medium hover:underline">
                      {s.id}
                    </Link>
                  </td>
                  <td className="px-6 py-3 font-medium text-text-primary">{s.className}</td>
                  <td className="px-6 py-3 text-text-secondary">{s.subject || '—'}</td>
                  <td className="px-6 py-3 text-text-secondary">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="px-6 py-3 text-text-secondary">{s.present}/{s.totalStudents}</td>
                  <td className="px-6 py-3">
                    <span className={statusBadge(s.status)}>{s.status}</span>
                  </td>
                  <td className="px-6 py-3">
                    {s.status === 'ACTIVE' ? (
                      <Link
                        to={`/teacher/sessions/${s.id}/review`}
                        className="text-primary font-medium hover:underline text-xs"
                      >
                        Review →
                      </Link>
                    ) : (
                      <span className="text-text-secondary text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  )
}

function PageShell({ children, title = 'Sessions & Reports', action }) {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
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
