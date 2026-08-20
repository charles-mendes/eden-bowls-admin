import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'
import { isOperationalUser, type AdminRole } from '../lib/roles'

export type { AdminRole }

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

export const TOKEN_KEY = 'eden-bowls-admin-token'

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // private browsing / quota
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // private browsing
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken())
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setUser(null)
        setIsReady(true)
        return
      }

      try {
        const me = await apiRequest<AdminUser>('/admin/me', { token })
        if (!isOperationalUser(me.roles)) {
          clearStoredToken()
          setToken(null)
          setUser(null)
          return
        }

        setUser(me)
      } catch {
        clearStoredToken()
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

      const me = await apiRequest<AdminUser>('/admin/me', { token: result.token })
      if (!isOperationalUser(me.roles)) {
        clearStoredToken()
        throw new Error('Esta conta não tem acesso ao painel administrativo.')
      }

      writeStoredToken(result.token)
      setToken(result.token)
      setUser(me)
      return me
    },
    logout: () => {
      clearStoredToken()
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

export { isOperationalUser }
