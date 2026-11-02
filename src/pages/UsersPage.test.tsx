import { screen, waitFor, within } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'
import { jsonResponse, operatorUser, operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('UsersPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the customer list with Bearer and page/perPage', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.getByText('Ana Costa')).toBeInTheDocument()
    const listCall = findCall(calls, 'GET', '/admin/users')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('page=1')
    expect(listCall?.search).toContain('perPage=20')
  })

  it('sends the search query on the users list request', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'ana' } })

    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/admin/users') && call.search.includes('q=ana'))).toBe(true)
    })
  })

  it('shows the country and opens the customer from the row, with no edit action in the list', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UsersPage />, '/users')

    const link = await screen.findByRole('link', { name: 'ana@edenbowls.com' })
    const row = link.closest('tr') as HTMLElement
    expect(within(row).getByText('Brasil')).toBeInTheDocument()
    expect(within(row).queryByRole('button')).not.toBeInTheDocument()

    await user.click(within(row).getByText('Brasil'))
    // The test router has only this route, so leaving the list empties the screen.
    await waitFor(() => expect(screen.queryByRole('link', { name: 'ana@edenbowls.com' })).not.toBeInTheDocument())
  })

  it('shows market_required in an alert instead of an empty table', async () => {
    seedAuth()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/admin/me')) {
        return jsonResponse(operatorUser)
      }
      if (url.includes('/admin/users')) {
        return jsonResponse({ message: 'Atribua um mercado a esta conta.', code: 'market_required' }, 403)
      }
      return jsonResponse({ message: 'not found' }, 404)
    })
    vi.stubGlobal('fetch', fetchMock)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByText('Atribua um mercado a esta conta.')).toBeInTheDocument()
    })

    expect(screen.getByText('Atribua um mercado a esta conta.').closest('.alert')).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'E-mail' })).not.toBeInTheDocument()
  })

  it('changes the page size from the toolbar select', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<UsersPage />, '/users')

    await screen.findByRole('link', { name: 'ana@edenbowls.com' })
    await user.selectOptions(screen.getByRole('combobox', { name: 'Por página' }), '50')

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/users' && call.search.includes('perPage=50') && call.search.includes('page=1'))).toBe(true)
    })
  })

  it('says when the search finds no account', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/users' && method === 'GET'
        ? jsonResponse({ total: 0, page: 1, perPage: 20, totalPages: 1, items: [] })
        : undefined),
    })
    renderAuthedPage(<UsersPage />, '/users')

    expect(await screen.findByText('Nenhuma conta encontrada.')).toBeInTheDocument()
  })
})
