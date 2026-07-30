import { useAuth } from '../context/AuthContext'

export default function TeacherDashboard() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="font-semibold text-brand-dark">Teacher Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{user?.name}</span>
          <button onClick={logout} className="text-sm text-red-600 hover:underline">
            Log out
          </button>
        </div>
      </header>

      <main className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
          <p className="font-medium text-slate-700 mb-1">Phase 1 checkpoint reached ✅</p>
          <p className="text-sm">
            Your class list and "Start Scan Session" button (Phase 3) will render here next.
          </p>
        </div>
      </main>
    </div>
  )
}
