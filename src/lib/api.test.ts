import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, buildQueryString, getApiBaseUrl, refreshAccessToken } from './api'

describe('api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the admin API base URL', () => {
    expect(getApiBaseUrl()).toBe('/api/v1')
  })

  it('omits empty query values', () => {
    expect(buildQueryString({ page: 2, q: '', perPage: undefined, active: null })).toBe('?page=2')
  })

  it('sends Bearer tokens on authenticated requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ userId: '1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/admin/me', { token: 'access-token' })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/admin/me', {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: undefined,
    })
  })

  it('posts JSON bodies to the token endpoint with the refresh cookie credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: 'jwt' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/auth/token', {
      method: 'POST',
      body: { username: 'ops@edenbowls.com', password: 'secret' },
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/token', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ username: 'ops@edenbowls.com', password: 'secret' }),
    })
  })

  it('retries once after refreshing an expired access token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/admin/me') && fetchMock.mock.calls.length === 1) {
        return new Response(JSON.stringify({
          success: false,
          message: 'JWT token is invalid.',
          details: { code: 'jwt_auth_invalid_token' },
        }), { status: 403, headers: { 'Content-Type': 'application/json' } })
      }

      if (url.endsWith('/auth/refresh')) {
        return new Response(JSON.stringify({ token: 'refreshed-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ userId: '1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(apiRequest('/admin/me', { token: 'expired-token' })).resolves.toEqual({ userId: '1' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/admin/me', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer refreshed-token' }),
    }))
  })

  it('reads error messages from the backend envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'invalid_credentials', message: 'Invalid username or password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    await expect(apiRequest('/auth/token', { method: 'POST', body: {} })).rejects.toThrow('Invalid username or password')
  })

  it('returns null for empty successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))

    await expect(apiRequest('/admin/ping')).resolves.toBeNull()
  })

  it('returns null when the refresh cookie is missing or rejected', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 'refresh_token_invalid', message: 'Authentication is required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    ))

    await expect(refreshAccessToken()).resolves.toBeNull()
  })
})
