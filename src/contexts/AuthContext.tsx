import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../lib/api'

export type AdminRole = 'admin' | 'operator' | 'readonly' | 'customer'

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
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const TOKEN_KEY = 'eden-bowls-admin-token'

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
        const me = await apiRequest<AdminUser>('/auth/me', { token })
        setUser(me)
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
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
      const result = await apiRequest<{ accessToken: string; user?: AdminUser }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      })

      localStorage.setItem(TOKEN_KEY, result.accessToken)
      setToken(result.accessToken)

      if (result.user) {
        setUser(result.user)
      } else {
        const me = await apiRequest<AdminUser>('/auth/me', { token: result.accessToken })
        setUser(me)
      }
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    },
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
