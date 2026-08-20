import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserDetailPage } from './UserDetailPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('UserDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads customer detail and PATCHes delivery instructions', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await waitFor(() => {
      expect(screen.getByText(/Ana Costa/)).toBeInTheDocument()
    })

    expect(screen.getByDisplayValue('Rua Augusta 100')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/users/u-ana' && call.authorization === 'Bearer access-token')).toBe(true)

    await user.clear(screen.getByLabelText('Instruções'))
    await user.type(screen.getByLabelText('Instruções'), 'Portão 2')
    await user.click(screen.getByRole('button', { name: 'Salvar instruções' }))

    await waitFor(() => {
      expect(screen.getByText('Instruções salvas.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/delivery-instructions'))
    expect(patch?.body).toEqual({ deliveryInstructions: 'Portão 2' })
    expect(patch?.authorization).toBe('Bearer access-token')
  })

  it('saves the customer delivery address', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await waitFor(() => {
      expect(screen.getByDisplayValue('Rua Augusta 100')).toBeInTheDocument()
    })

    await user.clear(screen.getByLabelText('Endereço'))
    await user.type(screen.getByLabelText('Endereço'), 'Rua Oscar Freire 200')
    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))

    await waitFor(() => {
      expect(screen.getByText('Endereço salvo.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/delivery') && !call.path.endsWith('/delivery-instructions'))
    expect(patch?.body).toMatchObject({ address: 'Rua Oscar Freire 200', city: 'São Paulo', zipCode: '01310-100' })
  })

  it('deactivates a customer account after confirmation', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Desativar conta' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Desativar conta' }))

    await waitFor(() => {
      expect(screen.getByText('Conta desativada.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/status'))
    expect(patch?.body).toEqual({ status: 'inactive' })
  })

  it('hides the delivery mutation from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await waitFor(() => {
      expect(screen.getByText(/Ana Costa/)).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Salvar instruções' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar endereço' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar conta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Alterar papéis' })).not.toBeInTheDocument()
  })
})
