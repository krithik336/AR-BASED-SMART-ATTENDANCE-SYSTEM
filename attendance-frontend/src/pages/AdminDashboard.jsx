import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-semibold text-brand-dark">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.name}</span>
          <button onClick={logout} className="text-sm text-red-600 hover:underline">
            Log out
          </button>
        </div>
      </header>

      <main className="p-6 max-w-3xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => navigate('/admin/classes')}
            className="bg-white rounded-xl border border-slate-200 p-8 text-left hover:border-brand hover:shadow-sm transition-colors"
          >
            <p className="font-semibold text-slate-800 mb-1">Class Management</p>
            <p className="text-sm text-slate-500">
              Create classes and manage the list of classes for enrollment.
            </p>
          </button>

          <button
            onClick={() => navigate('/admin/students/register')}
            className="bg-white rounded-xl border border-slate-200 p-8 text-left hover:border-brand hover:shadow-sm transition-colors"
          >
            <p className="font-semibold text-slate-800 mb-1">Student Registration</p>
            <p className="text-sm text-slate-500">
              Enroll a student with multiple face photos. ArcFace embeddings are generated automatically.
            </p>
          </button>
        </div>
      </main>
    </div>
  )
}
