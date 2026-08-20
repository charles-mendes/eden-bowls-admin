import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

export type AdminRole = 'admin' | 'operator' | 'nutritionist' | 'readonly' | 'customer'

export type AdminUser = {
  userId: string
  email: string
  roles: AdminRole[]
  permissions: string[]
}

type AuthContextValue = {
  token: string | null
  user: AdminUser | null
  isReady: boolean
  login: (email: string, password: string) => Promise<AdminUser>
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (...roles: AdminRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'eden-bowls-admin-token'
const OPERATIONAL_ROLES: AdminRole[] = ['admin', 'operator', 'nutritionist', 'readonly']

export function isOperationalUser(user: AdminUser | null) {
  return Boolean(user && user.roles.some((role) => OPERATIONAL_ROLES.includes(role)))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setIsReady(true)
        return
      }

      try {
        const me = await apiRequest<AdminUser>('/admin/me', { token })
        setUser(me)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      } finally {
        setIsReady(true)
      }
    }

    void bootstrap()
  }, [token])

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    isReady,
    login: async (email, password) => {
      const result = await apiRequest<{ token: string }>('/auth/token', {
        method: 'POST',
        body: { username: email, password },
      })

      localStorage.setItem(TOKEN_KEY, result.token)
      const me = await apiRequest<AdminUser>('/admin/me', { token: result.token })
      if (!isOperationalUser(me)) {
        localStorage.removeItem(TOKEN_KEY)
        throw new Error('Esta conta não tem acesso ao painel administrativo.')
      }

      setToken(result.token)
      setUser(me)
      return me
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    },
    hasPermission: (permission) => Boolean(user?.permissions.includes(permission)),
    hasRole: (...roles) => Boolean(user?.roles.some((role) => roles.includes(role))),
  }), [token, user, isReady])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
