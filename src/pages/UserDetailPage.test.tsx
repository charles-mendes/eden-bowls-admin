import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserDetailPage } from './UserDetailPage'
import { adminUser, checkoutDetail, jsonResponse, operatorWriteUser, readonlyUser } from '../test/fixtures'
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
    expect(screen.getByText('Opt-out')).toBeInTheDocument()
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

  describe('tabs', () => {
    const onboardingCalls = (calls: Array<{ method: string; path: string }>) => calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/onboarding/checkouts/u-ana')

    it('opens on Cadastro without loading onboarding data', async () => {
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

      expect(await screen.findByDisplayValue('Rua Augusta 100')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Cadastro' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.queryByRole('link', { name: 'Onboarding 360' })).not.toBeInTheDocument()
      expect(onboardingCalls(calls)).toHaveLength(0)
    })

    it('falls back to Cadastro on an unknown aba', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=nada', '/users/:userId')

      expect(await screen.findByDisplayValue('Rua Augusta 100')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Cadastro' })).toHaveAttribute('aria-selected', 'true')
    })

    it('lists subscriptions from the customer record, without the onboarding call', async () => {
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      expect(await screen.findByRole('link', { name: 'sub_123' })).toHaveAttribute('href', '/billing/subscriptions/sub-row-1')
      expect(onboardingCalls(calls)).toHaveLength(0)
    })

    it('loads pets once and reuses them in the Checkout tab', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=pets', '/users/:userId')

      expect(await screen.findByText('Luna')).toBeInTheDocument()
      expect(screen.getByText('Vira-lata')).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Checkout' }))

      expect(await screen.findByText('Rua Aristeu de Castro Fernandes, 941')).toBeInTheDocument()
      expect(screen.getByText('beef × 5, fish × 5')).toBeInTheDocument()
      expect(onboardingCalls(calls)).toHaveLength(1)
      expect(onboardingCalls(calls)[0]).toMatchObject({ authorization: 'Bearer access-token' })
    })

    it('says when the customer has pets but never reached checkout', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path }) => (path === '/api/v1/admin/onboarding/checkouts/u-ana'
          ? jsonResponse({ ...checkoutDetail, empty: true, checkoutReference: null, planSelection: null, address: null, shipping: null, lineItems: [] })
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=checkout', '/users/:userId')

      expect(await screen.findByText('Este cliente ainda não fez checkout.')).toBeInTheDocument()
    })

    it('shows a permission state on 403, not the empty checkout state', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path }) => (path === '/api/v1/admin/onboarding/checkouts/u-ana'
          ? jsonResponse({ code: 'forbidden', message: 'Forbidden' }, 403)
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=pets', '/users/:userId')

      expect(await screen.findByText('Seu papel não tem acesso aos dados de onboarding deste cliente.')).toBeInTheDocument()
      expect(screen.queryByText('Este cliente ainda não fez checkout.')).not.toBeInTheDocument()
      expect(screen.queryByText('Nenhum pet cadastrado.')).not.toBeInTheDocument()
    })

    it('lets readonly read the Checkout tab', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=checkout', '/users/:userId')

      expect(await screen.findByText('Rua Aristeu de Castro Fernandes, 941')).toBeInTheDocument()
    })
  })

  it('shows the fiscal data and the Brazilian address fields of a Brazilian customer and saves them', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    const name = await screen.findByLabelText('Nome completo')
    expect(name).toHaveValue('Ana Maria Costa')
    expect(screen.getByLabelText('CPF')).toHaveValue('529.982.247-25')
    expect(screen.getByLabelText('Número')).toHaveValue('100')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Consolação')
    expect(screen.getByLabelText('Estado').tagName).toBe('SELECT')

    await user.clear(name)
    await user.type(name, 'Ana Maria da Costa')
    await user.click(screen.getByRole('button', { name: 'Salvar dados fiscais' }))
    await screen.findByText('Dados fiscais salvos.')
    expect(calls.find((call) => call.path.endsWith('/fiscal'))?.body).toEqual({ fullName: 'Ana Maria da Costa', cpf: '529.982.247-25' })

    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))
    await screen.findByText('Endereço salvo.')
    expect(calls.find((call) => call.path.endsWith('/delivery'))?.body).toMatchObject({ number: '100', neighborhood: 'Consolação', state: 'SP' })
  })

  it('edits the account and the panel role on the customer page', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    const name = await screen.findByLabelText('Nome')
    await user.clear(name)
    await user.type(name, 'Ana C. Costa')
    await user.selectOptions(screen.getByLabelText('Papel'), 'operator')
    expect(screen.getByText('Ao salvar, ana@edenbowls.com passa a entrar no painel como Operador.')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Mercado'), 'BR')
    await user.click(screen.getByRole('button', { name: 'Salvar conta e acesso' }))
    await screen.findByText('Conta e acesso salvos.')

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/users/u-ana')
    expect(patch?.body).toMatchObject({ name: 'Ana C. Costa', role: 'operator', market: 'BR' })
  })

  it('saves a customer without a role and keeps the role out of the request', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await screen.findByLabelText('Nome')
    await user.click(screen.getByRole('button', { name: 'Salvar conta e acesso' }))
    await screen.findByText('Conta e acesso salvos.')

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/users/u-ana')
    expect(patch?.body).not.toHaveProperty('role')
    expect(patch?.body).not.toHaveProperty('market')
  })

  it('offers no account editing to an operator', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await screen.findByLabelText('Endereço')
    expect(screen.queryByRole('button', { name: 'Salvar conta e acesso' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir acesso' })).not.toBeInTheDocument()
  })

  it('deletes the access after confirmation and returns to the list', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await user.click(await screen.findByRole('button', { name: 'Excluir acesso' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.path === '/api/v1/admin/users/u-ana')).toBe(true))
    // The test router has only this route, so leaving the page empties the screen.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Excluir acesso' })).not.toBeInTheDocument())
  })
})
