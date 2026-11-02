import { screen, waitFor, within } from '@testing-library/react'
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

  it('hides new access from operators', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Novo acesso' })).not.toBeInTheDocument()
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
    await user.selectOptions(screen.getByLabelText('Papel'), 'veterinarian')
    await user.selectOptions(screen.getByLabelText('Mercado'), 'US')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))

    await waitFor(() => {
      expect(screen.getByText(/Acesso criado para nova.lia@edenbowls.com/)).toBeInTheDocument()
    })

    const create = findCall(calls, 'POST', '/admin/users')
    expect(create?.body).toEqual({
      name: 'Lia',
      email: 'nova.lia@edenbowls.com',
      role: 'veterinarian',
      market: 'US',
    })
    expect(JSON.stringify(create?.body)).not.toMatch(/password/i)
    expect(screen.queryByText(/TempPassword/i)).not.toBeInTheDocument()
  })

  it('does not create access when Mercado is empty', async () => {
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
    await user.selectOptions(screen.getByLabelText('Papel'), 'operator')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))

    await waitFor(() => {
      expect(screen.getByText('Informe o mercado.')).toBeInTheDocument()
    })
    expect(findCall(calls, 'POST', '/admin/users')).toBeUndefined()
  })

  it('opens a new access with no role picked and asks for one', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UsersPage />, '/users')

    await user.click(await screen.findByRole('button', { name: 'Novo acesso' }))
    expect(screen.getByLabelText('Papel')).toHaveValue('')
    expect(within(screen.getByLabelText('Papel')).getByRole('option', { name: 'Selecione um papel' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Mercado')).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Nome'), 'Lia')
    await user.type(screen.getByLabelText('E-mail'), 'nova.lia@edenbowls.com')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))

    expect(await screen.findByText('Selecione um papel.')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/users')).toBeUndefined()
  })
})
