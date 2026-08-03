import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { listSessions, getSessionReport } from '../api/sessions'

const statusBadge = (status) =>
  status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'

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
    try {
      setSessions(await listSessions())
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setReport(await getSessionReport(id))
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) loadReport()
    else loadSessions()
  }, [id, loadReport, loadSessions])

  if (id) {
    if (loading) return <Shell>Loading report…</Shell>
    if (error) return <Shell>{error}</Shell>
    if (!report) return <Shell>No report.</Shell>

    const s = report.session
    return (
      <Shell
        title="Session Report"
        back={
          <button onClick={() => navigate('/teacher/sessions')} className="text-sm text-slate-600 hover:text-brand">
            ← All sessions
          </button>
        }
      >
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                {s.className} {s.subject ? `— ${s.subject}` : ''}
              </h2>
              <p className="text-sm text-slate-500">
                Started {new Date(s.startedAt).toLocaleString()} ·{' '}
                {s.endedAt ? `Ended ${new Date(s.endedAt).toLocaleString()}` : 'Ongoing'}
              </p>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusBadge(s.status)}`}>
              {s.status}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-4 mt-4 text-center">
            <Stat label="Total" value={s.totalStudents} />
            <Stat label="Present" value={s.present} color="text-green-600" />
            <Stat label="Absent" value={s.absent} color="text-red-600" />
            <Stat label="Unverified" value={s.unverified} />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="font-medium text-slate-800">Attendance Records</h3>
          </div>
          {report.records.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">
              No records yet. Records are generated when a session ends.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Roll</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Similarity</th>
                </tr>
              </thead>
              <tbody>
                {report.records.map((r) => (
                  <tr key={r.studentId} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-3">{r.studentName}</td>
                    <td className="px-6 py-3 font-mono text-xs">{r.rollNumber}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.status === 'PRESENT'
                            ? 'bg-green-100 text-green-700'
                            : r.status === 'ABSENT'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-600">
                      {r.similarity > 0 ? `${(r.similarity * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Shell>
    )
  }

  return (
    <Shell
      title="Sessions & Reports"
      back={
        <button onClick={() => navigate('/teacher')} className="text-sm text-slate-600 hover:text-brand">
          ← Back to dashboard
        </button>
      }
    >
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            No sessions yet. Start one from the Attendance Scan page.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-6 py-3 font-medium">#</th>
                <th className="px-6 py-3 font-medium">Class</th>
                <th className="px-6 py-3 font-medium">Subject</th>
                <th className="px-6 py-3 font-medium">Started</th>
                <th className="px-6 py-3 font-medium">Present</th>
                <th className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <Link to={`/teacher/sessions/${s.id}`} className="text-brand font-medium">
                      {s.id}
                    </Link>
                  </td>
                  <td className="px-6 py-3">{s.className}</td>
                  <td className="px-6 py-3">{s.subject || '—'}</td>
                  <td className="px-6 py-3 text-slate-500">{new Date(s.startedAt).toLocaleString()}</td>
                  <td className="px-6 py-3">
                    {s.present}/{s.totalStudents}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBadge(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  )
}

function Shell({ children, title, back }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-semibold text-brand-dark">{title || 'Attendance'}</h1>
        </div>
        {back}
      </header>
      <main className="p-6 max-w-4xl mx-auto space-y-6">{children}</main>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="rounded-lg bg-slate-50 py-3">
      <p className={`text-2xl font-semibold ${color || 'text-slate-800'}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
