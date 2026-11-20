import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { TOKEN_KEY } from '../../contexts/AuthContext'
import { adminUser, operatorWriteUser, readonlyUser } from '../fixtures'
import { installAdminFetchMock } from '../mockAdminFetch'

function readinessCalls() {
  const fetchMock = globalThis.fetch as unknown as { mock: { calls: Array<[RequestInfo | URL]> } }
  return fetchMock.mock.calls.filter(([url]) => String(url).includes('/admin/checkout/readiness'))
}

function renderAt(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )
}

describe('checkout readiness route', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it.each([['readonly', readonlyUser], ['operator', operatorWriteUser]])('sends %s back to Pendências without asking the API', async (_role, profile) => {
    localStorage.setItem(TOKEN_KEY, 'token')
    installAdminFetchMock(profile)
    renderAt('/operations/checkout-readiness')

    expect(await screen.findByRole('heading', { name: 'Pendências' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Checkout da loja' })).not.toBeInTheDocument()
    expect(readinessCalls()).toHaveLength(0)
  })

  it('opens the screen for an admin, and the panel still lands on Pendências', async () => {
    localStorage.setItem(TOKEN_KEY, 'token')
    installAdminFetchMock(adminUser)
    renderAt('/operations/checkout-readiness')

    expect(await screen.findByRole('heading', { name: 'Checkout da loja' })).toBeInTheDocument()
    expect(await screen.findByText('Nada bloqueia o checkout da loja.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Checkout da loja' })).toBeInTheDocument()
  })

  it('/ still opens Pendências for an admin', async () => {
    localStorage.setItem(TOKEN_KEY, 'token')
    installAdminFetchMock(adminUser)
    renderAt('/')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Pendências' })).toBeInTheDocument())
  })
})
