import { Navigate, useLocation } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { isVeterinarianOnly, isOperationalUser } from '../lib/roles'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, user, isReady } = useAuth()
  const location = useLocation()

  if (!isReady) {
    return <div className="screen-center">Carregando sessão...</div>
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isOperationalUser(user?.roles)) {
    return <Navigate to="/login" replace />
  }

  if (user?.mustChangePassword && location.pathname !== '/account/password') {
    return <Navigate to="/account/password" replace />
  }

  if (isVeterinarianOnly(user?.roles) && location.pathname !== '/nutrition/simulate' && location.pathname !== '/account/password') {
    return <Navigate to="/nutrition/simulate" replace />
  }

  return children
}
