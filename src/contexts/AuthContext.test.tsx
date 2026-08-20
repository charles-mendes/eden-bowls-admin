import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TOKEN_KEY, useAuth } from './AuthContext'
import { customerUser, jsonResponse, operatorUser } from '../test/fixtures'
import { renderWithAuth } from '../test/renderWithAuth'

function AuthProbe() {
  const { isReady, token, user } = useAuth()

  if (!isReady) {
    return <div>loading</div>
  }

  return (
    <div>
      <span>{token ? 'has-token' : 'no-token'}</span>
      <span>{user?.email ?? 'anonymous'}</span>
    </div>
  )
}

function LoginProbe() {
  const { login } = useAuth()

  return (
    <button type="button" onClick={() => void login('ops@edenbowls.com', 'secret').catch(() => undefined)}>
      login
    </button>
  )
}

describe('AuthProvider', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('bootstraps the operational profile from /admin/me', async () => {
    localStorage.setItem(TOKEN_KEY, 'stored-token')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(operatorUser))
    vi.stubGlobal('fetch', fetchMock)

    renderWithAuth(<AuthProbe />)

    await waitFor(() => {
      expect(screen.getByText('ops@edenbowls.com')).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer stored-token' }),
      }),
    )
    expect(localStorage.getItem(TOKEN_KEY)).toBe('stored-token')
    expect(localStorage.getItem('eden-bowls-admin-user')).toBeNull()
  })

  it('clears a stored token when /admin/me returns a customer account', async () => {
    localStorage.setItem(TOKEN_KEY, 'customer-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(customerUser)))

    renderWithAuth(<AuthProbe />)

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('clears the session when /admin/me fails', async () => {
    localStorage.setItem(TOKEN_KEY, 'dead-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ message: 'Unauthorized' }, 401)))

    renderWithAuth(<AuthProbe />)

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('logs in with username and persists only the access token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/token') && init?.method === 'POST') {
        expect(JSON.parse(String(init.body))).toEqual({
          username: 'ops@edenbowls.com',
          password: 'secret',
        })
        return jsonResponse({ token: 'fresh-token' })
      }

      if (url.endsWith('/admin/me')) {
        return jsonResponse(operatorUser)
      }

      return jsonResponse({ message: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithAuth(
      <>
        <LoginProbe />
        <AuthProbe />
      </>,
    )

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    })

    screen.getByRole('button', { name: 'login' }).click()

    await waitFor(() => {
      expect(screen.getByText('ops@edenbowls.com')).toBeInTheDocument()
    })

    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token')
    expect(Object.keys(localStorage).filter((key) => key !== TOKEN_KEY)).toEqual([])
  })

  it('rejects customer accounts on login without persisting a token', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/token')) {
        return jsonResponse({ token: 'customer-token' })
      }

      return jsonResponse(customerUser)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithAuth(
      <>
        <LoginProbe />
        <AuthProbe />
      </>,
    )

    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    })

    screen.getByRole('button', { name: 'login' }).click()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByText('anonymous')).toBeInTheDocument()
    })

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
