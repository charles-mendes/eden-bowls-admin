import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, buildQueryString, getApiBaseUrl } from './api'

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
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: undefined,
    })
  })

  it('posts JSON bodies to the token endpoint', async () => {
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username: 'ops@edenbowls.com', password: 'secret' }),
    })
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
})
