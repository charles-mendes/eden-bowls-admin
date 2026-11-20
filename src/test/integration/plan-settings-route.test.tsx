import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { TOKEN_KEY } from '../../contexts/AuthContext'
import { adminUser, operatorWriteUser, readonlyUser } from '../fixtures'
import { installAdminFetchMock } from '../mockAdminFetch'

function planCalls() {
  const fetchMock = globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL]> } }
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/admin/catalog/plan-settings'))
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Loja › Plano route', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it.each([['readonly', readonlyUser], ['operator', operatorWriteUser]])('sends %s back to Pendências without asking the API', async (_role, profile) => {
    localStorage.setItem(TOKEN_KEY, 'token')
    installAdminFetchMock(profile)
    renderAt('/catalog/plan?market=BR')

    expect(await screen.findByRole('heading', { name: 'Pendências' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Plano' })).not.toBeInTheDocument()
    expect(planCalls()).toHaveLength(0)
  })

  it('opens the screen for an admin', async () => {
    localStorage.setItem(TOKEN_KEY, 'token')
    installAdminFetchMock(adminUser)
    renderAt('/catalog/plan?market=BR')

    expect(await screen.findByRole('link', { name: 'Plano' })).toBeInTheDocument()
    await vi.waitFor(() => expect(planCalls().length).toBeGreaterThan(0))
  })
})
