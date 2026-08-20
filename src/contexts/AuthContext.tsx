import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, logoutRefreshSession, onAccessTokenRefreshed, refreshAccessToken } from '../lib/api'
import { decodeJwtPayload, isAuthTokenExpired } from '../lib/jwt'
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

function persistAccessToken(token: string) {
  writeStoredToken(token)
}

async function rejectNonOperationalSession() {
  await logoutRefreshSession()
  clearStoredToken()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken())
  const [user, setUser] = useState<AdminUser | null>(null)
  const [isReady, setIsReady] = useState(false)
  const skipCookieRestoreRef = useRef(false)

  const clearSession = useCallback(() => {
    clearStoredToken()
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    return onAccessTokenRefreshed((nextToken) => {
      persistAccessToken(nextToken)
      setToken(nextToken)
    })
  }, [])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      if (!token) {
        if (skipCookieRestoreRef.current) {
          skipCookieRestoreRef.current = false
          setUser(null)
          setIsReady(true)
          return
        }

        const refreshed = await refreshAccessToken()
        if (cancelled) {
          return
        }

        if (refreshed) {
          persistAccessToken(refreshed)
          setToken(refreshed)
          return
        }

        setUser(null)
        setIsReady(true)
        return
      }

      try {
        const me = await apiRequest<AdminUser>('/admin/me', { token })
        if (cancelled) {
          return
        }

        if (!isOperationalUser(me.roles)) {
          skipCookieRestoreRef.current = true
          await rejectNonOperationalSession()
          if (cancelled) {
            return
          }

          setToken(null)
          setUser(null)
          return
        }

        setUser(me)
      } catch {
        if (cancelled) {
          return
        }

        skipCookieRestoreRef.current = true
        clearSession()
      } finally {
        if (!cancelled) {
          setIsReady(true)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [clearSession, token])

  useEffect(() => {
    if (!token || isAuthTokenExpired(token)) {
      return
    }

    const payload = decodeJwtPayload(token)
    const exp = Number(payload?.exp)
    if (!Number.isFinite(exp) || exp <= 0) {
      return
    }

    const issuedAt = Number(payload?.iat) || Math.floor(Date.now() / 1000)
    const delayMs = Math.max(0, (issuedAt + (exp - issuedAt) * 0.8 - Date.now() / 1000) * 1000)
    const timer = window.setTimeout(() => {
      void refreshAccessToken()
    }, delayMs)

    return () => window.clearTimeout(timer)
  }, [token])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !token || !decodeJwtPayload(token)) {
        return
      }

      if (isAuthTokenExpired(token)) {
        void refreshAccessToken()
      }
    }

    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [token])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiRequest<{ token: string }>('/auth/token', {
      method: 'POST',
      body: { username: email, password },
    })

    const me = await apiRequest<AdminUser>('/admin/me', { token: result.token })
    if (!isOperationalUser(me.roles)) {
      skipCookieRestoreRef.current = true
      await rejectNonOperationalSession()
      throw new Error('Esta conta não tem acesso ao painel administrativo.')
    }

    persistAccessToken(result.token)
    setToken(result.token)
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => {
    skipCookieRestoreRef.current = true
    void logoutRefreshSession()
    clearSession()
  }, [clearSession])

  const value = useMemo<AuthContextValue>(() => ({
    token,
    user,
    isReady,
    login,
    logout,
    hasPermission: (permission) => Boolean(user?.permissions.includes(permission)),
    hasRole: (...roles) => Boolean(user?.roles.some((role) => roles.includes(role))),
  }), [isReady, login, logout, token, user])

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
