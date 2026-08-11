import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { myClasses } from '../api/teachers'

export default function MyClasses() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try { setClasses(await myClasses()) }
    catch (err) { setError(err.response?.data?.message || 'Failed to load classes') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">My Classes</h1>
        <p className="text-text-secondary text-sm mt-1">Classes assigned to you by the administrator</p>
      </div>

      {error && <div className="bg-red-50 text-danger text-sm rounded-lg px-4 py-3 border border-red-200 mb-6">{error}</div>}

      {loading ? (
        <p className="text-text-secondary text-sm">Loading…</p>
      ) : classes.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className="font-semibold text-text-primary mb-1">No classes assigned</p>
          <p className="text-text-secondary text-sm">No classes have been assigned to you yet. Contact your administrator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((c) => (
            <div key={c.id} className="card p-6 hover:border-primary hover:shadow-card-md transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                  </svg>
                </div>
                <span className="font-mono text-xs bg-primary-light text-primary px-2 py-1 rounded">{c.code}</span>
              </div>
              <h3 className="font-semibold text-text-primary mb-1">{c.name}</h3>
              <p className="text-sm text-text-secondary mb-5">
                {c.studentCount} {c.studentCount === 1 ? 'student' : 'students'} enrolled
              </p>
              <button
                onClick={() => navigate(`/teacher/scan?classId=${c.id}`)}
                className="btn-primary w-full text-center"
              >
                Open Class
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
