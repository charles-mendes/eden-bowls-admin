import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RolesPage } from './RolesPage'
import { adminUser, operatorUser, staffUser } from '../test/fixtures'
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
    expect(put?.body).toEqual({ role: 'readonly' })
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
})
