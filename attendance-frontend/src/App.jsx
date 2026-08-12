import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import ClassManagement from './pages/ClassManagement'
import StudentRegistration from './pages/StudentRegistration'
import AttendanceScan from './pages/AttendanceScan'
import AttendanceReports from './pages/AttendanceReports'
import TeacherManagement from './pages/TeacherManagement'
import MyClasses from './pages/MyClasses'

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = ({ path, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const ICONS = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  classes:   'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  students:  'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
  teachers:  'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  scan:      'M23 7l-7 5 7 5V7z M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1z',
  sessions:  'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  logout:    'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9',
}

// ── Sidebar link ──────────────────────────────────────────────────────────────
function SideLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to.split('/').length <= 2}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary text-white'
            : 'text-sidebar-text hover:bg-navy-800 hover:text-white'
        }`
      }
    >
      <Icon path={ICONS[icon]} />
      {label}
    </NavLink>
  )
}

// ── Admin Sidebar ─────────────────────────────────────────────────────────────
function AdminSidebar() {
  const { user, logout } = useAuth()
  return (
    <aside className="w-60 flex-shrink-0 bg-navy flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-navy-800">
        <p className="text-white font-bold text-base tracking-tight">SmartAttend</p>
        <p className="text-sidebar-text text-xs mt-0.5">Admin Portal</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <SideLink to="/admin"           icon="dashboard" label="Dashboard" />
        <SideLink to="/admin/classes"   icon="classes"   label="Classes" />
        <SideLink to="/admin/students/register" icon="students" label="Register Student" />
        <SideLink to="/admin/teachers"  icon="teachers"  label="Teachers" />
      </nav>
      <div className="px-3 py-4 border-t border-navy-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-sidebar-text text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-navy-800 hover:text-white transition-colors"
        >
          <Icon path={ICONS.logout} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

// ── Teacher Sidebar ───────────────────────────────────────────────────────────
function TeacherSidebar() {
  const { user, logout } = useAuth()
  return (
    <aside className="w-60 flex-shrink-0 bg-navy flex flex-col h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-navy-800">
        <p className="text-white font-bold text-base tracking-tight">SmartAttend</p>
        <p className="text-sidebar-text text-xs mt-0.5">Teacher Portal</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <SideLink to="/teacher"              icon="dashboard" label="Dashboard" />
        <SideLink to="/teacher/my-classes"   icon="classes"   label="My Classes" />
        <SideLink to="/teacher/scan"         icon="scan"      label="Attendance Scan" />
        <SideLink to="/teacher/sessions"     icon="sessions"  label="Sessions & Reports" />
      </nav>
      <div className="px-3 py-4 border-t border-navy-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? 'T'}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.name}</p>
            <p className="text-sidebar-text text-xs truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-text hover:bg-navy-800 hover:text-white transition-colors"
        >
          <Icon path={ICONS.logout} />
          Sign out
        </button>
      </div>
    </aside>
  )
}

// ── Layouts ───────────────────────────────────────────────────────────────────
function AdminLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

function TeacherLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-surface">
      <TeacherSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}

// ── Root redirect ─────────────────────────────────────────────────────────────
function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/teacher'} replace />
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Admin routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout><AdminDashboard /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/classes" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout><ClassManagement /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/students/register" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout><StudentRegistration /></AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="/admin/teachers" element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminLayout><TeacherManagement /></AdminLayout>
            </ProtectedRoute>
          } />

          {/* Teacher routes */}
          <Route path="/teacher" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
              <TeacherLayout><TeacherDashboard /></TeacherLayout>
            </ProtectedRoute>
          } />
          <Route path="/teacher/my-classes" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
              <TeacherLayout><MyClasses /></TeacherLayout>
            </ProtectedRoute>
          } />
          <Route path="/teacher/scan" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
              <TeacherLayout><AttendanceScan /></TeacherLayout>
            </ProtectedRoute>
          } />
          <Route path="/teacher/sessions" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
              <TeacherLayout><AttendanceReports /></TeacherLayout>
            </ProtectedRoute>
          } />
          <Route path="/teacher/sessions/:id" element={
            <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
              <TeacherLayout><AttendanceReports /></TeacherLayout>
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
