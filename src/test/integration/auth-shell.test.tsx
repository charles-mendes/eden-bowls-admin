import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from '../../App'
import { TOKEN_KEY } from '../../contexts/AuthContext'
import { jsonResponse, nutritionistUser, operatorUser } from '../fixtures'

function mockAdminApi(profile: typeof operatorUser | typeof nutritionistUser) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)

    if (url.endsWith('/auth/token')) {
      return jsonResponse({ token: 'session-token' })
    }

    if (url.includes('/admin/me')) {
      return jsonResponse(profile)
    }

    if (url.includes('/admin/onboarding/metrics')) {
      return jsonResponse({
        totalCheckouts: 4,
        linkedToStripe: 3,
        stripeActive: 2,
        withSimplified: 1,
        generatedAt: '2026-08-19T12:00:00.000Z',
      })
    }

    if (url.includes('/admin/catalog/sync/health')) {
      return jsonResponse({
        market: 'BR',
        currency: 'BRL',
        totalExpected: 10,
        totalMapped: 10,
        gaps: [],
      })
    }

    if (url.includes('/admin/catalog/sync/status')) {
      return jsonResponse({ syncJobId: 'job-1', status: 'idle' })
    }

    if (url.includes('/breeds')) {
      return jsonResponse({ success: true, data: { items: [] } })
    }

    return jsonResponse({ message: 'not mocked' }, 404)
  })
}

describe('admin auth shell', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('lets an operator sign in and see the operational shell', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', mockAdminApi(operatorUser))

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText('E-mail'), 'ops@edenbowls.com')
    await user.type(screen.getByLabelText('Senha'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })

    expect(screen.getByRole('navigation', { name: 'Seções do painel' })).toBeInTheDocument()
    expect(screen.getByText('ops@edenbowls.com')).toBeInTheDocument()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('session-token')
  })

  it('keeps a nutritionist inside the simulator', async () => {
    localStorage.setItem(TOKEN_KEY, 'nutri-token')
    vi.stubGlobal('fetch', mockAdminApi(nutritionistUser))

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nutrition simulator' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Simulador nutricional' })).toBeInTheDocument()
  })
})
