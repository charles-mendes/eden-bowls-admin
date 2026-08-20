import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import App from '../../App'
import { TOKEN_KEY } from '../../contexts/AuthContext'
import { readonlyUser } from '../fixtures'
import { installAdminFetchMock } from '../mockAdminFetch'

describe('readonly admin shell', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('hides write-heavy menu items and billing mutations', async () => {
    localStorage.setItem(TOKEN_KEY, 'readonly-token')
    installAdminFetchMock(readonlyUser)

    render(
      <MemoryRouter initialEntries={['/billing']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Assinantes' })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Onboarding 360' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Checkouts' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Frete' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cupons 1ª compra' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Papéis' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sync catálogo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).not.toBeInTheDocument()
  })
})
