import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserDetailPage } from './UserDetailPage'
import { checkoutDetail, jsonResponse, operatorWriteUser, readonlyUser } from '../test/fixtures'
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
})
