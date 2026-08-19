import { useNavigate } from 'react-router-dom'
import AnalyticsDashboard from '../components/AnalyticsDashboard'

export default function TeacherDashboard() {
  const navigate = useNavigate()

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary text-sm mt-1">Overview of your class attendance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
        <button
          onClick={() => navigate('/teacher/scan')}
          className="card p-5 text-left hover:border-primary hover:shadow-card-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors">
              <path d="M23 7l-7 5 7 5V7z M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1z" />
            </svg>
          </div>
          <p className="font-semibold text-text-primary text-sm">Start Attendance Scan</p>
          <p className="text-xs text-text-secondary mt-0.5">Capture classroom photos and review recognized students</p>
        </button>

        <button
          onClick={() => navigate('/teacher/sessions')}
          className="card p-5 text-left hover:border-primary hover:shadow-card-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center mb-3 group-hover:bg-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="group-hover:stroke-white transition-colors">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />
            </svg>
          </div>
          <p className="font-semibold text-text-primary text-sm">Sessions &amp; Reports</p>
          <p className="text-xs text-text-secondary mt-0.5">Review past attendance sessions and per-student records</p>
        </button>
      </div>

      <AnalyticsDashboard role="TEACHER" />
    </div>
  )
}
