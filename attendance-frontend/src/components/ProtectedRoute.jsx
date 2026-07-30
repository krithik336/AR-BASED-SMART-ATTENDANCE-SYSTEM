import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Wrap any route that needs login. Pass allowedRoles={['ADMIN']} to also
// restrict by role - if omitted, any logged-in user can access it.
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return children
}
