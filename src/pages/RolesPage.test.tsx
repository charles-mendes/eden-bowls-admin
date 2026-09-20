import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RolesPage } from './RolesPage'
import { adminUser, operatorUser, staffUser, jsonResponse } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('RolesPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('blocks operators without users.roles.write', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser)
    renderAuthedPage(<RolesPage />, '/users/roles')

    await waitFor(() => {
      expect(screen.getByText('Sua conta não tem permissão para gerenciar papéis.')).toBeInTheDocument()
    })
  })

  it('assigns a role with PUT /admin/users/:id/roles', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<RolesPage />, '/users/roles')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ops@edenbowls.com' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ops@edenbowls.com' }))
    await user.selectOptions(screen.getByLabelText('Papel'), 'readonly')
    await user.click(screen.getByRole('button', { name: 'Salvar papel' }))

    await waitFor(() => {
      expect(screen.getByText(`Papel atualizado para ${staffUser.email}.`)).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === `/api/v1/admin/users/${staffUser.id}/roles`)
    expect(put?.body).toEqual({ role: 'readonly', market: 'BR' })
    expect(put?.authorization).toBe('Bearer access-token')
  })

  it('keeps the search button beside the email field', async () => {
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<RolesPage />, '/users/roles')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ops@edenbowls.com' })).toBeInTheDocument()
    })

    const field = screen.getByPlaceholderText('ops@edenbowls.com').closest('.filter-field')
    expect(field).toBeTruthy()
    expect(field).toContainElement(screen.getByRole('button', { name: 'Buscar' }))
  })

  it('revokes an assigned role with PUT customer', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<RolesPage />, '/users/roles')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ops@edenbowls.com' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ops@edenbowls.com' }))
    await user.click(screen.getByRole('button', { name: 'Remover acesso' }))

    await waitFor(() => {
      expect(screen.getByText(`Acesso ao painel removido de ${staffUser.email}.`)).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === `/api/v1/admin/users/${staffUser.id}/roles`)
    expect(put?.body).toEqual({ role: 'customer' })
  })

  it('omits market when assigning admin', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<RolesPage />, '/users/roles')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ops@edenbowls.com' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ops@edenbowls.com' }))
    await user.selectOptions(screen.getByLabelText('Papel'), 'admin')
    expect(screen.queryByLabelText('Mercado')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar papel' }))

    await waitFor(() => {
      expect(screen.getByText(`Papel atualizado para ${staffUser.email}.`)).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === `/api/v1/admin/users/${staffUser.id}/roles`)
    expect(put?.body).toEqual({ role: 'admin' })
  })

  it('disables papel and mercado when the account is allowlist-locked', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    const originalFetch = globalThis.fetch
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), 'http://admin.local')
      if (url.pathname === '/api/v1/admin/users/roles') {
        return jsonResponse({
          total: 1,
          page: 1,
          perPage: 50,
          totalPages: 1,
          items: [{ ...staffUser, lockedByAllowlist: true, roles: ['admin'] }],
          bootstrapEmails: ['ops@edenbowls.com'],
        })
      }
      return originalFetch(input, init)
    })
    renderAuthedPage(<RolesPage />, '/users/roles')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ops@edenbowls.com' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ops@edenbowls.com' }))
    expect(screen.getByLabelText('Papel')).toBeDisabled()
    expect(calls.some((call) => call.method === 'PUT')).toBe(false)
  })
})
