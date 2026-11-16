import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivacyRequestsPage } from './PrivacyRequestsPage'
import { jsonResponse, operatorUser, operatorWriteUser, privacyRequestItem, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('PrivacyRequestsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads DSAR queue with overdue badge and hides writes for readonly', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })

    const listCall = findCall(calls, 'GET', '/admin/privacy/requests')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(document.querySelector('.badge-warning')?.textContent).toBe('Atrasado')
    expect(screen.getByRole('link', { name: 'Ver solicitação 41' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova solicitação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tratar solicitação 41' })).not.toBeInTheDocument()
  })

  it('filters overdue items and shows write actions for operators', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Atrasado' }), 'true')

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.path.includes('/admin/privacy/requests') && call.search.includes('overdue=true'))).toBe(true)
    })
    expect(screen.getByRole('button', { name: 'Nova solicitação' })).toBeEnabled()
    expect(screen.getByRole('link', { name: 'Tratar solicitação 41' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('offers only "Ver" for a request that is already closed', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests' && method === 'GET'
        ? jsonResponse({ total: 1, page: 1, perPage: 20, totalPages: 1, items: [{ ...privacyRequestItem, status: 'completed', overdue: false }] })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    expect(await screen.findByRole('link', { name: 'Ver solicitação 41' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tratar solicitação 41' })).not.toBeInTheDocument()
  })

  it('opens the e-mail request form in a dialog, finds the customer by name and closes after creating', async () => {
    const user = userEvent.setup()
    seedAuth()
    const ana = { id: '77', email: 'ana@edenbowls.com', country: 'BR', status: 'active', profile: { fullName: 'Ana Costa' } }
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/users' && method === 'GET'
        ? jsonResponse({ total: 1, page: 1, perPage: 8, totalPages: 1, items: [ana] })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Nova solicitação' }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar solicitação recebida por e-mail' })
    expect(within(dialog).queryByRole('textbox', { name: 'User ID' })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /nota/i }))
    expect(within(dialog).getByText(/O cliente vê esta nota no perfil/)).toBeInTheDocument()

    await user.type(within(dialog).getByRole('searchbox', { name: 'Cliente' }), 'Ana')
    await user.click(await within(dialog).findByRole('button', { name: /Ana Costa/ }))
    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/users' && call.search.includes('q=Ana'))).toBe(true)
    })
    expect(within(dialog).getByRole('button', { name: 'Trocar' })).toBeInTheDocument()

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Tipo da solicitação' }), 'access')
    await user.click(within(dialog).getByRole('button', { name: 'Registrar solicitação' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    const createCall = findCall(calls, 'POST', '/admin/privacy/requests')
    expect(createCall?.body).toMatchObject({ userId: 77, type: 'access' })
    expect(screen.getByText('Solicitação registrada.')).toBeInTheDocument()
  })

  it('opens the dialog with the customer from the customer screen already chosen', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/users/77' && method === 'GET'
        ? jsonResponse({ id: '77', email: 'ana@edenbowls.com', status: 'active', profile: { fullName: 'Ana Costa' } })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests?userId=77', '/privacy/requests')

    await user.click(await screen.findByRole('button', { name: 'Nova solicitação' }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar solicitação recebida por e-mail' })
    expect(await within(dialog).findByText('Ana Costa')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Trocar' })).toBeInTheDocument()
  })

  it('filters the queue by a customer found by name, not by id', async () => {
    const user = userEvent.setup()
    seedAuth()
    const ana = { id: '77', email: 'ana@edenbowls.com', country: 'BR', status: 'active', profile: { fullName: 'Ana Costa' } }
    const { calls } = installAdminFetchMock(operatorUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/users' && method === 'GET'
        ? jsonResponse({ total: 1, page: 1, perPage: 8, totalPages: 1, items: [ana] })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('textbox', { name: 'User ID' })).not.toBeInTheDocument()

    await user.type(screen.getByRole('searchbox', { name: 'Cliente' }), 'Ana')
    await user.click(await screen.findByRole('button', { name: /Ana Costa/ }))

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/privacy/requests' && call.search.includes('userId=77'))).toBe(true)
    })
    expect(screen.getByText('Ana Costa')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Limpar cliente' }))
    expect(screen.getByRole('searchbox', { name: 'Cliente' })).toBeInTheDocument()
    await waitFor(() => {
      const lists = calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/privacy/requests')
      expect(lists.at(-1)?.search.includes('userId=')).toBe(false)
    })
  })

  it('does not create a request before a customer is chosen', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await user.click(await screen.findByRole('button', { name: 'Nova solicitação' }))
    const dialog = screen.getByRole('dialog', { name: 'Registrar solicitação recebida por e-mail' })
    await user.click(within(dialog).getByRole('button', { name: 'Registrar solicitação' }))

    expect(within(dialog).getByRole('alert')).toHaveTextContent('Escolha o cliente.')
    expect(findCall(calls, 'POST', '/admin/privacy/requests')).toBeUndefined()
  })

  it('does not show the create form to read-only operators', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Nova solicitação' })).not.toBeInTheDocument()
  })
})
