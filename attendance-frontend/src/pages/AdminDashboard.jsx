import { useNavigate } from 'react-router-dom'
import AnalyticsDashboard from '../components/AnalyticsDashboard'

export default function AdminDashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Overview of your institution's attendance</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        <button
          onClick={() => navigate('/admin/classes')}
          className="card p-5 text-left hover:border-primary hover:shadow-card-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <p className="font-semibold text-text-primary text-sm">Class Management</p>
          <p className="text-xs text-text-secondary mt-0.5">Create and manage classes</p>
        </button>

        <button
          onClick={() => navigate('/admin/students/register')}
          className="card p-5 text-left hover:border-primary hover:shadow-card-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <p className="font-semibold text-text-primary text-sm">Register Student</p>
          <p className="text-xs text-text-secondary mt-0.5">Enroll with face photos</p>
        </button>

        <button
          onClick={() => navigate('/admin/teachers')}
          className="card p-5 text-left hover:border-primary hover:shadow-card-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </svg>
          </div>
          <p className="font-semibold text-text-primary text-sm">Teacher Management</p>
          <p className="text-xs text-text-secondary mt-0.5">Add teachers & assign classes</p>
        </button>
      </div>

      <AnalyticsDashboard role="ADMIN" />
    </div>
  )
}
