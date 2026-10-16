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
    await user.selectOptions(screen.getByLabelText('Mercado'), 'US')
    await user.click(screen.getByRole('button', { name: 'Criar acesso' }))

    await waitFor(() => {
      expect(screen.getByText(/Acesso criado para nova.lia@edenbowls.com/)).toBeInTheDocument()
    })

    const create = findCall(calls, 'POST', '/admin/users')
    expect(create?.body).toEqual({
      name: 'Lia',
      email: 'nova.lia@edenbowls.com',
      role: 'nutritionist',
      market: 'US',
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

  it('edits a customer without giving them a panel role', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UsersPage />, '/users')

    await screen.findByRole('link', { name: 'ana@edenbowls.com' })
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[0])

    const dialog = screen.getByRole('dialog', { name: 'Editar acesso' })
    expect(within(dialog).getByLabelText('Papel')).toHaveValue('')
    expect(within(dialog).queryByRole('option', { name: 'Nutricionista', selected: true })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Sem papel, a conta continua só com acesso à loja.')).toBeInTheDocument()
    expect(within(dialog).queryByLabelText('Mercado')).not.toBeInTheDocument()

    await user.clear(within(dialog).getByLabelText('Nome'))
    await user.type(within(dialog).getByLabelText('Nome'), 'Ana C. Costa')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('Acesso de ana@edenbowls.com atualizado.')).toBeInTheDocument()
    })
    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/users/u-ana')
    expect(patch?.body).toMatchObject({ name: 'Ana C. Costa', phone: '11999999999' })
    expect(patch?.body).not.toHaveProperty('role')
    expect(patch?.body).not.toHaveProperty('market')
  })

  it('warns before turning a customer into staff and sends the role and market', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UsersPage />, '/users')

    await screen.findByRole('link', { name: 'ana@edenbowls.com' })
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Editar acesso' })

    await user.selectOptions(within(dialog).getByLabelText('Papel'), 'operator')
    expect(within(dialog).getByText('Ao salvar, ana@edenbowls.com passa a entrar no painel como Operador.')).toBeInTheDocument()
    await user.selectOptions(within(dialog).getByLabelText('Mercado'), 'BR')
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/users/u-ana')).toBe(true)
    })
    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/users/u-ana')
    expect(patch?.body).toMatchObject({ role: 'operator', market: 'BR' })
  })

  it('opens a staff account on its current role without the empty option', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<UsersPage />, '/users')

    await screen.findByRole('link', { name: 'lia@edenbowls.com' })
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[1])
    const dialog = screen.getByRole('dialog', { name: 'Editar acesso' })

    expect(within(dialog).getByLabelText('Papel')).toHaveValue('nutritionist')
    expect(within(dialog).queryByRole('option', { name: 'Selecione um papel' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Acessa só o simulador nutricional.')).toBeInTheDocument()
  })
})
