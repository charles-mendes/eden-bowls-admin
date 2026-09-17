import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'
import { adminUser, operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('UsersPage access CRUD', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('hides access actions from operators', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Novo acesso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reenviar convite' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument()
  })

  it('creates a pending access with role and does not display a password', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Novo acesso' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Novo acesso' }))
    await user.type(screen.getByLabelText('Nome'), 'Lia')
    await user.type(screen.getByLabelText('E-mail'), 'nova.lia@edenbowls.com')
    await user.selectOptions(screen.getByLabelText('Papel'), 'nutritionist')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))

    await waitFor(() => {
      expect(screen.getByText(/Acesso criado para nova.lia@edenbowls.com/)).toBeInTheDocument()
    })

    const create = findCall(calls, 'POST', '/admin/users')
    expect(create?.body).toEqual({
      name: 'Lia',
      email: 'nova.lia@edenbowls.com',
      role: 'nutritionist',
    })
    expect(JSON.stringify(create?.body)).not.toMatch(/password/i)
    expect(screen.queryByText(/TempPassword/i)).not.toBeInTheDocument()
  })

  it('resends an invitation for a pending staff account', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reenviar convite' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Reenviar convite' }))

    await waitFor(() => {
      expect(screen.getByText(/Convite reenviado para lia@edenbowls.com/)).toBeInTheDocument()
    })

    const invite = calls.find((call) => call.method === 'POST' && call.path.endsWith('/invite'))
    expect(invite?.authorization).toBe('Bearer access-token')
  })
})
