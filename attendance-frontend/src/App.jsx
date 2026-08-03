import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

function HomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/teacher'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/classes"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ClassManagement />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/students/register"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <StudentRegistration />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/scan"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <AttendanceScan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/sessions"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <AttendanceReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/sessions/:id"
            element={
              <ProtectedRoute allowedRoles={['TEACHER', 'ADMIN']}>
                <AttendanceReports />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
