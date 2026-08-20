const DEFAULT_API_BASE_URL = '/api/v1'
const JWT_AUTH_INVALID_TOKEN_CODE = 'jwt_auth_invalid_token'
const COOKIE_AUTH_PATHS = new Set(['/auth/token', '/auth/refresh', '/auth/logout'])

export function getApiBaseUrl() {
  return import.meta.env.VITE_ADMIN_API_BASE_URL ?? DEFAULT_API_BASE_URL
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

type AccessTokenListener = (token: string) => void

const accessTokenListeners = new Set<AccessTokenListener>()
let refreshInFlight: Promise<string | null> | null = null

export function onAccessTokenRefreshed(listener: AccessTokenListener) {
  accessTokenListeners.add(listener)
  return () => {
    accessTokenListeners.delete(listener)
  }
}

function notifyAccessTokenRefreshed(token: string) {
  accessTokenListeners.forEach((listener) => listener(token))
}

function isCookieAuthPath(path: string) {
  return COOKIE_AUTH_PATHS.has(path)
}

function readErrorCode(errorBody: unknown) {
  if (!errorBody || typeof errorBody !== 'object') {
    return ''
  }

  const body = errorBody as { code?: unknown; details?: { code?: unknown } }
  if (typeof body.details?.code === 'string') {
    return body.details.code
  }

  return typeof body.code === 'string' ? body.code : ''
}

function isJwtInvalidError(errorBody: unknown) {
  return readErrorCode(errorBody) === JWT_AUTH_INVALID_TOKEN_CODE
}

export async function refreshAccessToken() {
  if (refreshInFlight) {
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
        },
      })

      if (!response?.ok) {
        return null
      }

      const body = await response.json().catch(() => null) as { token?: unknown } | null
      const token = typeof body?.token === 'string' ? body.token.trim() : ''
      if (!token) {
        return null
      }

      notifyAccessTokenRefreshed(token)
      return token
    } catch {
      return null
    } finally {
      refreshInFlight = null
    }
  })()

  return refreshInFlight
}

export async function logoutRefreshSession() {
  try {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
  } catch {
    // Local logout still proceeds when the cookie request fails.
  }
}

type RequestOptions = {
  token?: string | null
  body?: unknown
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  skipRefresh?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const cookieAuth = isCookieAuthPath(path)
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    credentials: cookieAuth ? 'include' : 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(cookieAuth ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
      ...(!cookieAuth && options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    if (!options.skipRefresh && !cookieAuth && options.token && isJwtInvalidError(errorBody)) {
      const nextToken = await refreshAccessToken()
      if (nextToken) {
        return apiRequest<T>(path, { ...options, token: nextToken, skipRefresh: true })
      }
    }

    const message = errorBody?.message ?? response.statusText
    throw new Error(typeof message === 'string' ? message : 'request_failed')
  }

  if (response.status === 204) {
    return null as T
  }

  const text = await response.text()
  if (!text) {
    return null as T
  }

  return JSON.parse(text) as T
}
