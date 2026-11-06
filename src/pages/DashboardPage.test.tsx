import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { SystemHealth } from '../components/SystemHealth'
import { nextStep } from '../lib/today'
import { adminUser, customerContact, jsonResponse, operatorUsUser, operatorUser, operatorWriteUser, syncStatus, todayOverview, webhookHealth } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('DashboardPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads catalog sync health with Bearer and keeps admin-only parts away from an operator', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser, {
      syncStatus: { ...syncStatus.byMarket.BR, byMarket: { BR: syncStatus.byMarket.BR } },
    })
    renderAuthedPage(<SystemHealth />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('10 / 10')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Preços Stripe no catálogo' })).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
    expect(screen.getByText(/As 10 variações do catálogo BR já têm um Price ID em BRL/)).toBeInTheDocument()
    expect(screen.getByText('Com Price Stripe')).toBeInTheDocument()
    expect(screen.getByText('Sem vínculo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', '/catalog/products')
    expect(await screen.findByText(/Última sincronização Brasil: falhou em .* · No such product: prod_x/)).toBeInTheDocument()
    expect(screen.queryByText(/Última sincronização Estados Unidos/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sincronizar e assinantes' })).toHaveAttribute('href', '/billing')
    expect(screen.queryByRole('heading', { name: 'Conflitos de mercado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Webhooks Stripe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mercado' })).not.toBeInTheDocument()

    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.authorization === 'Bearer access-token')).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=BR') && call.search.includes('currency=BRL'))).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
    expect(calls.some((call) => call.path === '/api/v1/admin/billing/webhooks/health')).toBe(false)
    expect(calls.some((call) => call.path === '/api/v1/admin/onboarding/metrics')).toBe(false)
  })

  it('requests US catalog health for a US operator', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUsUser)
    renderAuthedPage(<SystemHealth />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('10 / 10')).toBeInTheDocument()
    })

    expect(screen.getByText(/As 10 variações do catálogo US já têm um Price ID em USD/)).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=US') && call.search.includes('currency=USD'))).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
  })

  it('shows an admin webhooks per account, conflict rows and the last sync of each market, without checkout cards', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    const webhooks = within(screen.getByRole('heading', { name: 'Webhooks Stripe' }).closest('section') as HTMLElement)
    const brasil = webhooks.getByRole('row', { name: /Brasil/ })
    expect(within(brasil).getByText('Atenção')).toHaveClass('badge-warning')
    expect(within(brasil).getByText(/invoice\.payment_failed/)).toBeInTheDocument()
    expect(within(brasil).getAllByRole('cell')[3]).toHaveTextContent('2')
    expect(within(webhooks.getByRole('row', { name: /EUA/ })).getByText('OK')).toHaveClass('badge-success')

    const conflictsSection = within(screen.getByRole('heading', { name: 'Conflitos de mercado' }).closest('section') as HTMLElement)
    expect(conflictsSection.getByText('1 conflito')).toBeInTheDocument()
    const row = conflictsSection.getByRole('row', { name: /ana@edenbowls\.com/ })
    expect(within(row).getByText('BR')).toBeInTheDocument()
    expect(within(row).getByText('US')).toBeInTheDocument()

    expect(screen.getByText(/Última sincronização Brasil: falhou em .* · No such product: prod_x/)).toBeInTheDocument()
    expect(screen.getByText(/Última sincronização Estados Unidos: concluído em/)).toBeInTheDocument()

    for (const label of ['Checkouts', 'Vinculados Stripe', 'Stripe ativos', 'Com simplificado']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument()
    }
    expect(calls.some((call) => call.path === '/api/v1/admin/onboarding/metrics')).toBe(false)
    expect(calls.some((call) => call.path === '/api/v1/admin/billing/webhooks/health' && call.authorization === 'Bearer access-token')).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts' && call.search.includes('page=1'))).toBe(true)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mercado' }), 'US')

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=US') && call.search.includes('currency=USD'))).toBe(true)
    })
  })

  it('pages through conflicts', async () => {
    const user = userEvent.setup()
    seedAuth()
    const many = Array.from({ length: 25 }, (_, index) => ({
      userId: `u-${index}`,
      email: `cliente${String(index).padStart(2, '0')}@example.com`,
      profileMarket: 'BR',
      stripeAccount: 'us',
    }))
    const { calls } = installAdminFetchMock(adminUser, { marketConflicts: many })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByText('25 conflitos')).toBeInTheDocument()
    expect(screen.getByText('cliente00@example.com')).toBeInTheDocument()
    expect(screen.queryByText('cliente20@example.com')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Próxima' }))

    expect(await screen.findByText('cliente20@example.com')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts' && call.search.includes('page=2'))).toBe(true)
  })

  it('shows empty conflicts copy when the list is empty', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, { marketConflicts: [] })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('Nenhum conflito perfil vs Stripe.')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Conflitos de mercado' })).toBeInTheDocument()
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
  })

  it('shows accounts without events and says when no sync was recorded', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, {
      webhookHealth: {
        ...webhookHealth,
        accounts: webhookHealth.accounts.map((account) => ({ ...account, status: 'no_events', lastEventAt: null, lastEventType: null, failedLast24h: 0 })),
      },
      syncStatus: { status: null, byMarket: {} },
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findAllByText('Sem eventos')).toHaveLength(2)
    expect(screen.getAllByText('Nenhum evento recebido')).toHaveLength(2)
    expect(screen.getByText('Última sincronização: nenhuma sincronização registrada.')).toBeInTheDocument()
    expect(screen.queryByText(/sessão do servidor/)).not.toBeInTheDocument()
  })

  it('shows a webhook load failure as an alert and no account as OK', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, { webhookHealth: { status: 500, message: 'Falha nos webhooks' } })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const alert = await screen.findByText('Falha nos webhooks')
    expect(alert).toHaveClass('alert')
    expect(screen.queryByText('OK')).not.toBeInTheDocument()
  })

  it('opens on today: numbers, blockers worst first, closed days and the orders that need action', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Quarta-feira, 7 de outubro/)).toBeInTheDocument()
    })

    const forToday = screen.getByRole('link', { name: /^Hoje/ })
    expect(within(forToday).getByText('2')).toBeInTheDocument()
    expect(within(forToday).getByText('Brasil 1 · EUA 1')).toBeInTheDocument()
    expect(forToday).toHaveAttribute('href', '/operations/production?prazo=hoje')
    expect(screen.getByRole('link', { name: /^Atrasados/ })).toHaveAttribute('href', '/operations/production?prazo=atrasados')
    expect(screen.getByRole('link', { name: /^Amanhã/ })).toHaveAttribute('href', '/operations/production?prazo=amanha')
    const ups = screen.getByRole('link', { name: /^Sem etiqueta UPS/ })
    // Only ready orders wait for a label, the same rule the blocker uses.
    expect(within(ups).getByText('1')).toBeInTheDocument()
    expect(ups).toHaveAttribute('href', '/operations/labels')
    expect(within(ups).getByText('Prontos hoje sem etiqueta')).toBeInTheDocument()

    expect(screen.getByText(/Amanhã \(Brasil\): Folga da cozinha/)).toBeInTheDocument()

    const pending = within(screen.getByRole('region', { name: 'Pendências' })).getAllByRole('listitem')
    expect(pending.map((item) => within(item).getByText(/^(Alta|Média|Baixa)$/).textContent)).toEqual(['Alta', 'Média', 'Baixa'])
    expect(within(pending[0]).getByText('1 pagamento recusado')).toBeInTheDocument()
    expect(within(pending[0]).getByText('Davi Rocha: falar com o cliente antes de preparar.')).toBeInTheDocument()
    expect(within(pending[0]).getByRole('link', { name: 'Abrir pedido' })).toHaveAttribute('href', '/billing/subscriptions/34')
    expect(within(pending[1]).getByText('1 pedido de hoje com preparo não iniciado')).toBeInTheDocument()
    expect(within(pending[1]).getByRole('link', { name: 'Ver na fila' })).toHaveAttribute('href', '/operations/production?prazo=hoje&status=to_prepare')
    expect(within(pending[2]).getByText('1 pedido pronto sem etiqueta UPS')).toBeInTheDocument()

    const needsYou = within(screen.getByRole('region', { name: 'Precisa de você' }))
    expect(needsYou.getAllByRole('listitem')).toHaveLength(4)
    expect(needsYou.getByRole('link', { name: 'Abrir pedido: Ana Costa' })).toHaveAttribute('href', '/billing/subscriptions/31')
    expect(needsYou.getByRole('link', { name: 'Abrir na fila: Bruno Lima' }).getAttribute('href')).toMatch(/^\/operations\/production\?busca=.+&mercado=br$/)
    expect(screen.getByText('Saúde do sistema')).toBeInTheDocument()

    const today = calls.find((call) => call.path === '/api/v1/admin/today')
    expect(today?.search).toContain('timezone=')
    expect(today?.authorization).toBe('Bearer access-token')
  })

  it('keeps system health for admins only', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText('Bruno Lima')
    expect(screen.queryByText('Saúde do sistema')).not.toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/billing/webhooks/health')).toBe(false)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
  })

  it('keeps the picked market in the links to the queue', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await user.click(await screen.findByRole('button', { name: 'Brasil' }))
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /^Atrasados/ })).toHaveAttribute('href', '/operations/production?prazo=atrasados&mercado=br')
    })
  })

  it('filters the day by market', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await user.click(await screen.findByRole('button', { name: 'EUA' }))

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/today' && call.search.includes('account=us'))).toBe(true)
    })
  })

  it('hides the UPS label card for a Brazil-only operator', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText('Bruno Lima')
    expect(screen.queryByRole('link', { name: /^Sem etiqueta UPS/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
  })

  it('shows the UPS card from the effective markets when no market is stored', async () => {
    seedAuth()
    installAdminFetchMock({ ...adminUser, markets: [], effectiveMarkets: ['BR', 'US'] })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByRole('link', { name: /^Sem etiqueta UPS/ })).toBeInTheDocument()
  })

  it('orders the next step by what blocks the delivery first', () => {
    const base = {
      id: 7, market: 'US' as const, dueBucket: 'today' as const, dueLabel: '', displayName: '', email: '', city: '',
      flavorMix: '', packCount: 1, packSizeLabel: '', note: null,
    }
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'past_due', upsLabel: null }).text).toMatch(/Pagamento recusado/)
    expect(nextStep({ ...base, productionStatus: 'blocked', paymentState: 'paid', upsLabel: 'missing' }).text).toBe('Resolver o bloqueio')
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'paid', upsLabel: 'missing' }).text).toBe('Gerar etiqueta UPS')
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'paid', upsLabel: 'created' }).text).toBe('Aguardando coleta UPS')
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'paid', upsLabel: 'unresolved' })).toEqual({ text: 'Verificar na UPS', tone: 'error', to: '/operations/labels#verificar-ups' })
    const br = { ...base, market: 'BR' as const, productionStatus: 'ready' as const, paymentState: 'paid' as const, upsLabel: null }
    expect(nextStep({ ...br, courierDelivery: 'none' })).toEqual({ text: 'Despachar', tone: 'warning', to: '/operations/courier' })
    expect(nextStep({ ...br, courierDelivery: 'out_for_delivery' })).toMatchObject({ text: 'Em rota', to: '/operations/courier?aba=em_rota' })
    expect(nextStep({ ...br, courierDelivery: 'delivered' }).text).toBe('Entregue')
    expect(nextStep({ ...br, courierDelivery: 'failed' })).toEqual({ text: 'Despachar de novo', tone: 'warning', to: '/operations/courier?aba=falhas' })
    expect(nextStep({ ...br, courierDelivery: 'none' }).text).not.toBe('Pronto para entregar')
  })

  const withToday = (data: Record<string, unknown>) => ({ path, method }: { path: string; method: string }) => (
    path === '/api/v1/admin/today' && method === 'GET' ? jsonResponse({ success: true, data: { ...todayOverview, ...data } }) : undefined
  )
  const zero = todayOverview.fulfillment

  it('lists shipping and invoice work with filtered links for Brazil', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, {
      routes: withToday({ fulfillment: { ...zero, courierToDispatch: 3, courierOnTheRoadLong: 2, courierFailed: 1, nfeMissingDocument: 1, nfeRejected: 1, nfeError: 2, upsUnresolved: 4 } }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    const link = (text: string) => within(work.getByText(text).closest('li') as HTMLElement).getByRole('link')
    expect(link('3 pedidos a despachar')).toHaveAttribute('href', '/operations/courier')
    expect(link('2 entregas em rota há mais de 24 h')).toHaveAttribute('href', '/operations/courier?aba=em_rota')
    expect(link('1 entrega com falha sem novo despacho')).toHaveAttribute('href', '/operations/courier?aba=falhas')
    expect(link('1 NF-e sem CPF')).toHaveAttribute('href', '/operations/nfe?status=blocked_missing_document')
    expect(link('1 NF-e rejeitada')).toHaveAttribute('href', '/operations/nfe?status=rejected')
    expect(link('2 NF-e com erro')).toHaveAttribute('href', '/operations/nfe?status=error')
    // A Brazil-only operator does not see the US work.
    expect(work.queryByText(/compras? UPS sem confirmação/)).not.toBeInTheDocument()
  })

  // admin-flow-fixes-4 (PM-25): part of "a despachar", waiting for the NF-e.
  it('says how many orders to dispatch wait for the NF-e, and nothing while the lock is off', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 3, courierAwaitingNfe: 2 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText('3 pedidos a despachar')).toBeInTheDocument()
    expect(within(work.getByText('2 pedidos a despachar aguardando NF-e').closest('li') as HTMLElement).getByRole('link')).toHaveAttribute('href', '/operations/courier')
  })

  it('shows no NF-e wait when the count is null or the screen is on the US', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 1, courierAwaitingNfe: 1, upsUnresolved: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByText('1 pedido a despachar aguardando NF-e')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'EUA' }))
    await waitFor(() => expect(screen.queryByText(/aguardando NF-e/)).not.toBeInTheDocument())
  })

  it('shows nothing for shipping and invoices when every count is zero', async () => {
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText('Bruno Lima')
    expect(screen.queryByRole('region', { name: 'Expedição e notas' })).not.toBeInTheDocument()
  })

  it('says Bling is disconnected to an admin, and not with the US on screen', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, { routes: withToday({ fulfillment: { ...zero, blingConnected: false, upsUnresolved: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(within(work.getByText('Bling desconectado').closest('li') as HTMLElement).getByRole('link')).toHaveAttribute('href', '/operations/nfe')
    expect(within(work.getByText('1 compra UPS sem confirmação').closest('li') as HTMLElement).getByRole('link')).toHaveAttribute('href', '/operations/labels#verificar-ups')

    await user.click(screen.getByRole('button', { name: 'EUA' }))
    await waitFor(() => expect(screen.queryByText('Bling desconectado')).not.toBeInTheDocument())
    expect(screen.getByText('1 compra UPS sem confirmação')).toBeInTheDocument()
  })

  it('hides the Brazil work from a US operator', async () => {
    seedAuth()
    installAdminFetchMock(operatorUsUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 3, nfeRejected: 1, blingConnected: false, upsUnresolved: 2 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText('2 compras UPS sem confirmação')).toBeInTheDocument()
    expect(work.queryByText('3 pedidos a despachar')).not.toBeInTheDocument()
    expect(work.queryByText('1 NF-e rejeitada')).not.toBeInTheDocument()
    expect(work.queryByText('Bling desconectado')).not.toBeInTheDocument()
  })

  // admin-flow-fixes-5 (PM-26): address problems and market exceptions per market.
  it('counts the open address problems and the market exceptions of the market on screen', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, {
      routes: withToday({ fulfillment: { ...zero, addressIssues: { BR: { open: 3, stale: 1 }, US: { open: 5, stale: 0 } }, marketExceptions: { BR: 1, US: 2 } } }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    const link = (text: string) => within(work.getByText(text).closest('li') as HTMLElement).getByRole('link')
    expect(link('3 problemas de endereço abertos · 1 sem correção há mais de 2 dias')).toHaveAttribute('href', '/operations/courier?problema=endereco')
    expect(link('1 exceção de mercado')).toHaveAttribute('href', '/operations/market-exceptions')
    expect(work.queryByText(/5 problemas de endereço/)).not.toBeInTheDocument()
    expect(work.queryByText('2 exceções de mercado')).not.toBeInTheDocument()
  })

  it('links the US address problems to the label queue and hides zero counts', async () => {
    seedAuth()
    installAdminFetchMock(operatorUsUser, {
      routes: withToday({ fulfillment: { ...zero, addressIssues: { BR: { open: 3, stale: 0 }, US: { open: 1, stale: 0 } }, marketExceptions: { BR: 4, US: 0 } } }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(within(work.getByText('1 problema de endereço aberto').closest('li') as HTMLElement).getByRole('link')).toHaveAttribute('href', '/operations/labels?problema=endereco')
    expect(work.queryByText(/exceç/)).not.toBeInTheDocument()
  })

  it('shows no address or exception line when the API sends neither field', async () => {
    seedAuth()
    const older: Record<string, unknown> = { ...zero }
    delete older.addressIssues
    delete older.marketExceptions
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...older, courierToDispatch: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText('1 pedido a despachar')).toBeInTheDocument()
    expect(work.queryByText(/problema de endereço|exceç/)).not.toBeInTheDocument()
  })

  it('shows the last contact of a refused payment and records a new one with the phone', async () => {
    const user = userEvent.setup()
    seedAuth()
    const refused = todayOverview.items[3]
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      routes: withToday({ items: [{ ...refused, lastContact: { ...customerContact, subscription_id: '34' } }] }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const pending = within(await screen.findByRole('region', { name: 'Pendências' }))
    expect(await pending.findByText(/^Contatado .*sem resposta, por ops@edenbowls.com$/)).toBeInTheDocument()
    await user.click(pending.getByRole('button', { name: 'Registrar contato' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('+55 41 99999-0000')).toBeInTheDocument()
    expect(dialog.getByLabelText('Motivo')).toHaveValue('payment_failed')
    await user.click(dialog.getByLabelText('Cliente vai resolver'))
    await user.click(dialog.getByRole('button', { name: 'Salvar contato' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/billing/subscriptions/34/contacts')).toBe(true))
    expect(await pending.findByText(/^Contatado hoje, .*cliente vai resolver/)).toBeInTheDocument()
  })

  it('records a contact for a refused payment without a phone', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { routes: withToday({ items: [{ ...todayOverview.items[3], phone: null }] }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await user.click(await screen.findByRole('button', { name: 'Registrar contato' }))
    expect(within(screen.getByRole('dialog')).getByText('Sem telefone')).toBeInTheDocument()
  })

  it('opens the refused subscribers and the label queue when several orders wait', async () => {
    seedAuth()
    const base = todayOverview.items[0]
    installAdminFetchMock(adminUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/today' && method === 'GET' ? jsonResponse({ success: true, data: {
        ...todayOverview,
        items: [
          { ...base, id: 41, market: 'US', productionStatus: 'ready', paymentState: 'paid', upsLabel: 'missing' },
          { ...base, id: 42, market: 'US', productionStatus: 'ready', paymentState: 'paid', upsLabel: 'missing' },
          { ...base, id: 43, market: 'BR', productionStatus: 'to_prepare', paymentState: 'past_due', upsLabel: null },
          { ...base, id: 44, market: 'BR', productionStatus: 'to_prepare', paymentState: 'past_due', upsLabel: null },
        ],
      } }) : undefined),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const pending = within(await screen.findByRole('region', { name: 'Pendências' }))
    const refused = (await pending.findByText('2 pagamentos recusados')).closest('li') as HTMLElement
    expect(within(refused).getByRole('link', { name: 'Ver assinantes' })).toHaveAttribute('href', '/billing?status=past_due')
    const labels = pending.getByText('2 pedidos prontos sem etiqueta UPS').closest('li') as HTMLElement
    expect(within(labels).getByRole('link', { name: 'Ver etiquetas' })).toHaveAttribute('href', '/operations/labels')
  })
})
