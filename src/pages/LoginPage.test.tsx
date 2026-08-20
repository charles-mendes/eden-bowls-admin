import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'
import { TOKEN_KEY } from '../contexts/AuthContext'
import { jsonResponse, nutritionistUser, operatorUser } from '../test/fixtures'
import { renderWithAuth } from '../test/renderWithAuth'

describe('LoginPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('submits username/password and lands operators on the dashboard', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/token')) {
        return jsonResponse({ token: 'operator-token' })
      }

      return jsonResponse(operatorUser)
    })
    vi.stubGlobal('fetch', fetchMock)

    renderWithAuth(<LoginPage />, '/login')

    await user.type(screen.getByLabelText('E-mail'), 'ops@edenbowls.com')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe('operator-token')
    })
  })

  it('keeps nutritionists on the simulator after login', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/token')) {
        return jsonResponse({ token: 'nutri-token' })
      }

      return jsonResponse(nutritionistUser)
    }))

    renderWithAuth(<LoginPage />, '/login')

    await user.type(screen.getByLabelText('E-mail'), 'nutri@edenbowls.com')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(localStorage.getItem(TOKEN_KEY)).toBe('nutri-token')
    })
  })
})
