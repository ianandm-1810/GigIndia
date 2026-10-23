import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { LoadingState } from './StateMessage.jsx'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingState message="Checking your sign-in..." />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'client' ? '/client' : '/student'} replace />
  }

  return <Outlet />
}
