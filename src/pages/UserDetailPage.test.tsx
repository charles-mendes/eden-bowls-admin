import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UserDetailPage } from './UserDetailPage'
import { adminUser, checkoutDetail, customerSubscription, jsonResponse, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// Saving the account's address copy asks for a reason in a dialog before anything is sent.
async function confirmDelivery(user: ReturnType<typeof userEvent.setup>, reason = 'Cliente pediu por telefone') {
  const dialog = await screen.findByRole('dialog', { name: 'Salvar a cópia do endereço?' })
  await user.type(within(dialog).getByLabelText('Motivo'), reason)
  await user.click(within(dialog).getByRole('button', { name: 'Salvar endereço' }))
}

// A subscription as a role that does not read some screen gets it: those keys are absent from the payload.
function without(item: Record<string, unknown>, ...keys: string[]) {
  return Object.fromEntries(Object.entries(item).filter(([key]) => !keys.includes(key)))
}

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
    expect(screen.getAllByText('E-mails de marketing')[0].closest('div')).toHaveTextContent('Não autorizado')
    expect(screen.getAllByText('Cookies analíticos')[0].closest('div')).toHaveTextContent('Autorizado')
    expect(screen.queryByText(/Opt-|granted|denied|otp_verify|marketing_email/)).not.toBeInTheDocument()
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
    await confirmDelivery(user)

    await waitFor(() => {
      expect(screen.getByText('Endereço salvo.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/delivery') && !call.path.endsWith('/delivery-instructions'))
    expect(patch?.body).toMatchObject({ address: 'Rua Oscar Freire 200', city: 'São Paulo', zipCode: '01310-100' })
    // The fixture address has no recipient, so the field stays out and the API keeps it.
    expect(patch?.body).not.toHaveProperty('recipientName')
    expect(patch?.body).toMatchObject({ reason: 'Cliente pediu por telefone' })
  })

  it('says the box follows the subscription address and sends nothing when the confirmation is cancelled', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UserDetailPage />, '/users/u-ana', '/users/:userId')

    await screen.findByDisplayValue('Rua Augusta 100')
    expect(screen.getByText(/a entrega usa o endereço da assinatura, que o cliente edita em Meu Plano/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))
    const dialog = await screen.findByRole('dialog', { name: 'Salvar a cópia do endereço?' })
    expect(within(dialog).getByRole('button', { name: 'Salvar endereço' })).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Motivo'), 'x')
    expect(within(dialog).getByRole('button', { name: 'Salvar endereço' })).toBeDisabled()
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }))

    expect(calls.some((call) => call.method === 'PATCH' && call.path.endsWith('/delivery'))).toBe(false)
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

    it('shows the contract, payment and checkout freight of each subscription', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const card = await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(within(card).getByText('6 meses · 2 entregas cobradas · renova automaticamente')).toBeInTheDocument()
      expect(within(card).getByText('Visa •••• 4242')).toBeInTheDocument()
      expect(within(card).getByText(/R\$\s25,00 · Entrega local/)).toBeInTheDocument()
      expect(within(card).getByText(/Adult 1m · Brasil/)).toBeInTheDocument()
    })

    it('hides payment and freight when the payload has no billing data', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { customerSubscriptions: [without(customerSubscription, 'paymentMethod', 'checkoutShipping')] })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const card = await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(within(card).queryByText('Pagamento')).not.toBeInTheDocument()
      expect(within(card).queryByText('Frete do checkout')).not.toBeInTheDocument()
    })

    it('shows the latest cycle with production, courier delivery and NF-e linked to their screens', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      expect(within(cycle).getByText('08/08/2026')).toBeInTheDocument()
      expect(within(cycle).getByText('10/08/2026')).toBeInTheDocument()
      expect(within(cycle).getByText('Pronto').closest('a')).toHaveAttribute('href', '/operations/production?busca=sub_123&mercado=br')
      expect(within(cycle).getByText('sem frango')).toBeInTheDocument()
      expect(within(cycle).getByText('Entregue').closest('a')).toHaveAttribute('href', '/operations/courier?aba=entregues')
      expect(within(cycle).getByRole('link', { name: 'NF-e 123' })).toHaveAttribute('href', '/operations/nfe/31')
      expect(within(cycle).getByText('Autorizada')).toBeInTheDocument()
      expect(within(cycle).getByText(/E-mail: Enviado/)).toBeInTheDocument()
    })

    it('shows a rejected note with its error and a UPS label with its tracking', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [{
          ...customerSubscription,
          latestCycle: {
            ...customerSubscription.latestCycle,
            delivery: { kind: 'ups', id: 2, status: 'created', trackingNumber: '1Z999' },
            nfe: { id: 32, number: null, series: null, status: 'rejected', lastError: 'CPF inválido', emailStatus: null },
          },
        }],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      expect(within(cycle).getByText('Rejeitada')).toBeInTheDocument()
      expect(within(cycle).getByText('CPF inválido')).toBeInTheDocument()
      expect(within(cycle).getByRole('link', { name: 'Nota 32' })).toHaveAttribute('href', '/operations/nfe/32')
      expect(within(cycle).getByText('UPS · Etiqueta criada').closest('a')).toHaveAttribute('href', '/billing/subscriptions/sub-row-1#envio-ups')
      expect(within(cycle).getByText('1Z999')).toBeInTheDocument()
    })

    it('links the paid invoice to the subscription and opens its Stripe PDF', async () => {
      const user = userEvent.setup()
      seedAuth()
      const open = vi.fn()
      vi.stubGlobal('open', open)
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        routes: ({ path, method }) => (/\/admin\/billing\/invoices\/[^/]+\/pdf$/.test(path) && method === 'GET'
          ? jsonResponse({ url: 'https://pay.stripe.com/invoice/pdf' })
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      expect(within(cycle).getByRole('link', { name: 'in_123' })).toHaveAttribute('href', '/billing/subscriptions/sub-row-1#faturas-stripe')
      await user.click(within(cycle).getByRole('button', { name: 'PDF Stripe' }))

      await waitFor(() => expect(open).toHaveBeenCalledWith('https://pay.stripe.com/invoice/pdf', '_blank', 'noopener,noreferrer'))
      const pdf = calls.find((call) => call.path === '/api/v1/admin/billing/invoices/in_123/pdf')
      expect(pdf?.search).toBe('?account=br')
    })

    it('says when the Stripe PDF cannot be opened', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.stubGlobal('open', vi.fn())
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path, method }) => (/\/admin\/billing\/invoices\/[^/]+\/pdf$/.test(path) && method === 'GET'
          ? jsonResponse({ message: 'Stripe indisponível' }, 502)
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      await user.click(within(cycle).getByRole('button', { name: 'PDF Stripe' }))
      expect(await within(cycle).findByText('Não foi possível abrir o PDF agora.')).toBeInTheDocument()
    })

    it('hides the Stripe PDF button without billing access', async () => {
      seedAuth()
      installAdminFetchMock({ ...operatorWriteUser, permissions: operatorWriteUser.permissions.filter((item) => item !== 'billing.subscribers.read') })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      expect(within(cycle).getByRole('link', { name: 'in_123' })).toBeInTheDocument()
      expect(within(cycle).queryByRole('button', { name: 'PDF Stripe' })).not.toBeInTheDocument()
    })

    it('says when there is no delivery and no NF-e yet', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [{ ...customerSubscription, latestCycle: { ...customerSubscription.latestCycle, delivery: null, nfe: null } }],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      expect(within(cycle).getByText('Não despachado')).toBeInTheDocument()
      expect(within(cycle).getByText('Sem NF-e')).toBeInTheDocument()
    })

    it('says when the subscription has no paid cycle', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { customerSubscriptions: [{ ...customerSubscription, latestCycle: null }] })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const cycle = await screen.findByRole('region', { name: 'Último ciclo' })
      expect(within(cycle).getByText('Nenhum ciclo pago.')).toBeInTheDocument()
    })

    it('warns when the latest cycle could not be loaded and keeps the contract', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { customerSubscriptions: [{ ...without(customerSubscription, 'latestCycle'), latestCycleUnavailable: true }] })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const card = await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(within(card).getByText(/Não foi possível carregar o último ciclo/)).toBeInTheDocument()
      expect(within(card).queryByRole('region', { name: 'Último ciclo' })).not.toBeInTheDocument()
      expect(within(card).getByText('6 meses · 2 entregas cobradas · renova automaticamente')).toBeInTheDocument()
    })

    it('shows no latest cycle block when the payload has none', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { customerSubscriptions: [without(customerSubscription, 'latestCycle')] })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(screen.queryByRole('region', { name: 'Último ciclo' })).not.toBeInTheDocument()
    })

    it('shows a rejected NF-e alert linking to the note, with the error in its title', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [{ ...customerSubscription, alerts: [{ code: 'nfe_problem', nfeId: 32, status: 'rejected', lastError: 'CPF inválido' }] }],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const alerts = await screen.findByRole('list', { name: 'Alertas' })
      const badge = within(alerts).getByRole('link', { name: 'NF-e rejeitada' })
      expect(badge).toHaveAttribute('href', '/operations/nfe/32')
      expect(badge).toHaveAttribute('title', 'CPF inválido')
    })

    it('links a Brazil ready-not-dispatched alert to the Entrega Brasil section', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [{ ...customerSubscription, alerts: [{ code: 'ready_not_dispatched', deliveryDate: '2026-08-10' }] }],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const alerts = await screen.findByRole('list', { name: 'Alertas' })
      expect(within(alerts).getByRole('link', { name: 'Pronto sem despacho' })).toHaveAttribute('href', '/billing/subscriptions/sub-row-1#entrega-brasil')
    })

    it('shows no alert badge for a subscription without alerts', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(screen.queryByRole('list', { name: 'Alertas' })).not.toBeInTheDocument()
      expect(screen.queryByText(/com alerta/)).not.toBeInTheDocument()
    })

    it('shows an unknown alert code as a neutral badge', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { customerSubscriptions: [{ ...customerSubscription, alerts: [{ code: 'something_new' }] }] })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const alerts = await screen.findByRole('list', { name: 'Alertas' })
      expect(within(alerts).getByText('something_new')).toHaveClass('badge-neutral')
    })

    it('counts the subscriptions with alerts on the tab', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [
          { ...customerSubscription, alerts: [{ code: 'pending_change', kinds: ['edit'] }, { code: 'delivery_failed', courierDeliveryId: 8, failedAt: null }] },
          { ...customerSubscription, id: 'sub-row-2', stripeSubscriptionId: 'sub_456', alerts: [] },
        ],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      await screen.findByRole('listitem', { name: 'Assinatura sub_456' })
      const tab = screen.getByRole('tab', { name: /Assinaturas/ })
      expect(tab).toHaveTextContent('2')
      expect(within(tab).getByText('1 com alerta')).toBeInTheDocument()
    })

    it('lists the pets of each subscription card', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [{ ...customerSubscription, pets: [{ id: 'rex', name: 'Rex' }, { id: 'luna', name: 'Luna' }] }],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const card = await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(within(card).getByText('Pets')).toBeInTheDocument()
      expect(within(card).getByText('Rex, Luna')).toBeInTheDocument()
    })

    it('names a pet without a name and shows "-" for no pet', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        customerSubscriptions: [
          { ...customerSubscription, pets: [{ id: 'rex', name: '' }] },
          { ...customerSubscription, id: 'sub-row-2', stripeSubscriptionId: 'sub_456', status: 'canceled', pets: [] },
        ],
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const named = await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(within(named).getByText('Pet sem nome')).toBeInTheDocument()
      const empty = screen.getByRole('listitem', { name: 'Assinatura sub_456' })
      expect(within(within(empty).getByText('Pets').closest('div') as HTMLElement).getByText('-')).toBeInTheDocument()
    })

    it('hides the Pets item when the API sends no pets key', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { customerSubscriptions: [without(customerSubscription, 'pets')] })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=assinaturas', '/users/:userId')

      const card = await screen.findByRole('listitem', { name: 'Assinatura sub_123' })
      expect(within(card).queryByText('Pets')).not.toBeInTheDocument()
    })

    it('shows the subscription that owns each pet, linked to its detail', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=pets', '/users/:userId')

      const list = await screen.findByRole('list', { name: 'Assinaturas do pet' })
      expect(within(list).getByRole('link', { name: 'sub_123' })).toHaveAttribute('href', '/billing/subscriptions/sub-row-1')
      expect(within(list).getByText('Ativo')).toHaveClass('badge-success')
    })

    it('lists every owning subscription of a pet in the API order', async () => {
      seedAuth()
      const pet = {
        ...checkoutDetail.pets[0],
        subscriptions: [
          { id: 'sub-row-2', stripeSubscriptionId: 'sub_new', status: 'active', planLabel: null },
          { id: 'sub-row-1', stripeSubscriptionId: 'sub_old', status: 'paused', planLabel: null },
        ],
      }
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path }) => (path === '/api/v1/admin/onboarding/checkouts/u-ana' ? jsonResponse({ ...checkoutDetail, pets: [pet] }) : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=pets', '/users/:userId')

      const list = await screen.findByRole('list', { name: 'Assinaturas do pet' })
      const rows = within(list).getAllByRole('listitem')
      expect(rows.map((row) => row.textContent)).toEqual(['sub_newAtivo', 'sub_oldPausado'])
    })

    it('says when a pet has no subscription', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path }) => (path === '/api/v1/admin/onboarding/checkouts/u-ana'
          ? jsonResponse({ ...checkoutDetail, pets: [{ ...checkoutDetail.pets[0], subscriptions: [] }] })
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=pets', '/users/:userId')

      expect(await screen.findByText('Sem assinatura')).toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Assinaturas do pet' })).not.toBeInTheDocument()
    })

    it('shows no subscription line on a pet when the API sends no subscriptions key', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path }) => (path === '/api/v1/admin/onboarding/checkouts/u-ana'
          ? jsonResponse({ ...checkoutDetail, pets: [without(checkoutDetail.pets[0], 'subscriptions')] })
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=pets', '/users/:userId')

      expect(await screen.findByText('Luna')).toBeInTheDocument()
      expect(screen.queryByText('Sem assinatura')).not.toBeInTheDocument()
      expect(screen.queryByRole('list', { name: 'Assinaturas do pet' })).not.toBeInTheDocument()
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

    it('lists one checkout per subscription, newest first, complete or partial', async () => {
      seedAuth()
      const complete = {
        subscriptionId: 'sub-row-2', stripeSubscriptionId: 'sub_new', status: 'active', planLabel: 'Plan #2',
        createdAt: '2026-11-01T12:00:00.000Z', completeness: 'complete', source: 'checkout', capturedAt: '2026-11-01T12:00:00.000Z',
        planSelection: checkoutDetail.planSelection, petsSnapshot: { pet_ids: ['pet-1'] }, address: checkoutDetail.address,
        shipping: checkoutDetail.shipping, recurrence: checkoutDetail.recurrence, subscriptionTermMonths: 1,
        lineItems: checkoutDetail.lineItems, discount: checkoutDetail.discount, checkoutReference: checkoutDetail.checkoutReference,
      }
      const partial = {
        ...complete, subscriptionId: 'sub-row-1', stripeSubscriptionId: 'sub_123', planLabel: 'Plan #1', status: 'canceled',
        createdAt: '2026-08-01T12:00:00.000Z', completeness: 'partial', source: 'ledger', capturedAt: null,
        address: { ...checkoutDetail.address, street: 'Rua Antiga' }, recurrence: null, discount: null, checkoutReference: null,
      }
      installAdminFetchMock(operatorWriteUser, {
        routes: ({ path }) => (path === '/api/v1/admin/onboarding/checkouts/u-ana'
          ? jsonResponse({ ...checkoutDetail, checkouts: [complete, partial] })
          : undefined),
      })
      renderAuthedPage(<UserDetailPage />, '/users/u-ana?aba=checkout', '/users/:userId')

      expect(await screen.findByText(/2 checkouts, um por assinatura/)).toBeInTheDocument()
      const items = document.querySelectorAll('details.checkout-history-item')
      expect(items).toHaveLength(2)
      expect(within(items[0] as HTMLElement).getByText('Plan #2')).toBeInTheDocument()
      expect(within(items[0] as HTMLElement).getByText('Completo')).toBeInTheDocument()
      expect(within(items[0] as HTMLElement).getByRole('link', { name: 'sub_new' })).toHaveAttribute('href', '/billing/subscriptions/sub-row-2')
      expect(within(items[0] as HTMLElement).getByText('Desconto 1ª compra')).toBeInTheDocument()
      expect(within(items[1] as HTMLElement).getByText('Parcial')).toBeInTheDocument()
      expect(within(items[1] as HTMLElement).getByText(/Registro parcial/)).toBeInTheDocument()
      expect(within(items[1] as HTMLElement).queryByText('Desconto 1ª compra')).toBeNull()
      expect((items[0] as HTMLDetailsElement).open).toBe(true)
      expect((items[1] as HTMLDetailsElement).open).toBe(false)
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
    expect(screen.getByText(/Uma nota autorizada não muda/)).toBeInTheDocument()
    expect(screen.getByLabelText('Número')).toHaveValue('100')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Consolação')
    expect(screen.getByLabelText('Estado').tagName).toBe('SELECT')

    await user.clear(name)
    await user.type(name, 'Ana Maria da Costa')
    await user.click(screen.getByRole('button', { name: 'Salvar dados fiscais' }))
    await screen.findByText('Dados fiscais salvos.')
    expect(calls.find((call) => call.path.endsWith('/fiscal'))?.body).toEqual({ fullName: 'Ana Maria da Costa', cpf: '529.982.247-25' })

    await user.click(screen.getByRole('button', { name: 'Salvar endereço' }))
    await confirmDelivery(user)
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
