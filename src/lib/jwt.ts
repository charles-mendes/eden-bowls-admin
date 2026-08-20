export type JwtPayload = {
  exp?: number
  iat?: number
  [key: string]: unknown
}

function base64UrlDecode(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4))
    const padded = normalized + padding

    if (typeof atob === 'function') {
      return atob(padded)
    }

    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8')
    }

    return null
  } catch {
    return null
  }
}

export function decodeJwtPayload(token: string): JwtPayload | null {
  const normalized = token.trim()
  if (!normalized) {
    return null
  }

  const parts = normalized.split('.')
  if (parts.length < 2) {
    return null
  }

  const decoded = base64UrlDecode(parts[1])
  if (!decoded) {
    return null
  }

  try {
    const payload = JSON.parse(decoded) as JwtPayload
    return payload && typeof payload === 'object' ? payload : null
  } catch {
    return null
  }
}

export function isAuthTokenExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload) {
    return true
  }

  const exp = Number(payload.exp)
  if (!Number.isFinite(exp) || exp <= 0) {
    return true
  }

  return exp <= Math.floor(Date.now() / 1000) + Math.max(0, skewSeconds)
}
