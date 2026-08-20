import { Navigate, useLocation } from 'react-router-dom'
import { type ReactNode } from 'react'
import { isOperationalUser, useAuth } from '../contexts/AuthContext'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, isReady } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return <div className="screen-center">Carregando sessão...</div>
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isOperationalUser(user)) {
    return <Navigate to="/login" replace />
  }

  if (user?.roles.includes('nutritionist') && !user.roles.some((role) => role === 'admin' || role === 'operator')) {
    if (location.pathname !== '/nutrition/simulate') {
      return <Navigate to="/nutrition/simulate" replace />
    }
  }

  return children
}
