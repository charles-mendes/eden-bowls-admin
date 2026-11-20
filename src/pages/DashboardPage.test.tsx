import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { SystemHealth } from '../components/SystemHealth'
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

  it('opens on the blockers worst first, closed days and the orders that need action', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByRole('heading', { name: 'Pendências' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Quarta-feira, 7 de outubro/)).toBeInTheDocument()
    })

    // The day's numbers live on the production queue; this page only lists what is stuck.
    expect(screen.queryByRole('region', { name: 'Números do dia' })).not.toBeInTheDocument()
    for (const card of [/^Atrasados/, /^Hoje/, /^Amanhã/, /^Sem etiqueta UPS/]) {
      expect(screen.queryByRole('link', { name: card })).not.toBeInTheDocument()
    }

    expect(screen.getByText(/Amanhã \(Brasil\): Folga da cozinha/)).toBeInTheDocument()

    const pending = within(screen.getByRole('region', { name: 'Produção' })).getAllByRole('listitem')
    expect(pending.map((item) => within(item).getByText(/^(Alta|Média|Baixa)$/).textContent)).toEqual(['Alta', 'Média'])
    expect(within(pending[0]).getByText('1 pagamento recusado')).toBeInTheDocument()
    expect(within(pending[0]).getByText('Davi Rocha: falar com o cliente antes de preparar.')).toBeInTheDocument()
    expect(within(pending[0]).getByRole('link', { name: 'Abrir pedido' })).toHaveAttribute('href', '/billing/subscriptions/34')
    expect(within(pending[1]).getByText('1 pedido de hoje com preparo não iniciado')).toBeInTheDocument()
    expect(within(pending[1]).getByRole('link', { name: 'Ver na fila' })).toHaveAttribute('href', '/operations/production?prazo=hoje&status=to_prepare')
    // The ready order without a UPS label has its own section, one line per order, not a blocker line.
    expect(screen.queryByText('1 pedido pronto sem etiqueta UPS')).not.toBeInTheDocument()
    const ups = within(screen.getByRole('region', { name: 'Sem etiqueta UPS' }))
    expect(ups.getByText('1 pedido pronto esperando etiqueta')).toBeInTheDocument()
    expect(ups.getByRole('link', { name: 'Abrir Etiquetas UPS' })).toHaveAttribute('href', '/operations/labels')
    const upsRows = ups.getAllByRole('listitem')
    expect(upsRows).toHaveLength(1)
    expect(within(upsRows[0]).getByText('Ana Costa')).toBeInTheDocument()
    expect(within(upsRows[0]).getByText('Miami · Atrasado 1 dia · 3 pacotes de 500 g')).toBeInTheDocument()
    expect(within(upsRows[0]).getByRole('link', { name: 'Abrir pedido' })).toHaveAttribute('href', '/billing/subscriptions/31')

    expect(screen.getByText('Saúde do sistema')).toBeInTheDocument()

    const today = calls.find((call) => call.path === '/api/v1/admin/today')
    expect(today?.search).toContain('timezone=')
    expect(today?.authorization).toBe('Bearer access-token')
  })

  // A paid box stuck over a month gets its own blocker, counted by the API; the day's overdue one leaves it out.
  it('asks for a decision on paid orders stuck over 30 days, apart from the overdue ones', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, {
      routes: withToday({
        stalePaid: 2,
        items: [
          { ...todayOverview.items[1], id: 40, dueBucket: 'overdue', dueLabel: 'Atrasado 40 dias', productionStatus: 'to_prepare', stale: true },
          { ...todayOverview.items[1], id: 41, dueBucket: 'overdue', dueLabel: 'Atrasado 2 dias', productionStatus: 'to_prepare' },
        ],
      }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const stale = (await screen.findByText('2 pedidos pagos parados há mais de 30 dias')).closest('li') as HTMLElement
    const region = within(screen.getByRole('region', { name: 'Produção' }))
    expect(within(stale).getByText('Alta')).toBeInTheDocument()
    expect(within(stale).getByRole('link', { name: 'Ver na fila' })).toHaveAttribute('href', '/operations/production?prazo=atrasados')
    expect(region.getByText('1 pedido atrasado')).toBeInTheDocument()
  })

  // queue-overdue-filter-matches-metric: a ready Brazil box past its day is late for the customer, not "tudo em dia".
  it('lists ready Brazil orders past their day whose box has not left as a pending item', async () => {
    seedAuth()
    const ready = { ...todayOverview.items[1], dueBucket: 'overdue', dueLabel: 'Atrasado 8 dias', productionStatus: 'ready', paymentState: 'paid' }
    installAdminFetchMock(adminUser, {
      routes: withToday({
        totals: { overdue: 0, today: 0, tomorrow: 0 },
        items: [
          { ...ready, id: 50, displayName: 'Charles Mendes', courierDelivery: 'none' },
          { ...ready, id: 51, displayName: 'Na rua', courierDelivery: 'out_for_delivery' },
          { ...todayOverview.items[0], id: 52 },
        ],
      }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const item = (await screen.findByText('1 pedido pronto esperando saída')).closest('li') as HTMLElement
    expect(within(item).getByText('Média')).toBeInTheDocument()
    expect(within(item).getByText('Charles Mendes: o dia de preparo já passou e a caixa ainda não saiu.')).toBeInTheDocument()
    expect(within(item).getByRole('link', { name: 'Abrir entregas' })).toHaveAttribute('href', '/operations/courier')
    expect(screen.queryByText('Nada travado. Tudo em dia.')).not.toBeInTheDocument()
  })

  it('keeps system health for admins only', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText(/Quarta-feira, 7 de outubro/)
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
      expect(screen.getByRole('link', { name: 'Ver na fila' })).toHaveAttribute('href', '/operations/production?prazo=hoje&status=to_prepare&mercado=br')
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

  it('hides the market switch for a Brazil-only operator', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText(/Quarta-feira, 7 de outubro/)
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Sem etiqueta UPS' })).not.toBeInTheDocument()
  })

  it('says every ready order has its UPS label when none is missing', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, {
      routes: withToday({ items: todayOverview.items.map((item) => ({ ...item, upsLabel: item.upsLabel === 'missing' ? 'created' : item.upsLabel })) }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const ups = within(await screen.findByRole('region', { name: 'Sem etiqueta UPS' }))
    expect(await ups.findByText('Todos os pedidos prontos têm etiqueta.')).toBeInTheDocument()
    expect(ups.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('shows the market switch from the effective markets when no market is stored', async () => {
    seedAuth()
    installAdminFetchMock({ ...adminUser, markets: [], effectiveMarkets: ['BR', 'US'] })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByRole('group', { name: 'Mercado' })).toBeInTheDocument()
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

  // admin-flow-fixes-4 (PM-25), simplify-brazil-dispatch: part of "a despachar", on its line.
  it('says on the dispatch line how many of those orders wait for the NF-e', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 3, courierAwaitingNfe: 2, nfeRejected: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    const line = work.getByText('3 pedidos a despachar · 2 aguardando NF-e').closest('li') as HTMLElement
    expect(within(line).getByRole('link')).toHaveAttribute('href', '/operations/courier')
    expect(work.getAllByText(/aguardando NF-e/)).toHaveLength(1)
    expect(work.getByText('1 NF-e rejeitada')).toBeInTheDocument()
  })

  // keep-ready-orders-dispatchable: the orders the address keeps from leaving, on the same line, linked to the filter.
  it('says on the dispatch line how many of those orders the address holds', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 4, courierAddressLocked: 4 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    const line = work.getByText((_, element) => element?.tagName === 'STRONG' && element.textContent === '4 pedidos a despachar · 4 travados por endereço').closest('li') as HTMLElement
    expect(within(line).getByRole('link', { name: '4 travados por endereço' })).toHaveAttribute('href', '/operations/courier?problema=endereco')
    expect(within(line).getByRole('link', { name: 'Abrir entregas' })).toHaveAttribute('href', '/operations/courier')
  })

  it('puts the address and the NF-e parts on one line, in the singular when one', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 5, courierAddressLocked: 1, courierAwaitingNfe: 2 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText((_, element) => element?.tagName === 'STRONG' && element.textContent === '5 pedidos a despachar · 1 travado por endereço · 2 aguardando NF-e')).toBeInTheDocument()
  })

  it.each([['0', 0], ['null', null], ['absent', undefined]])('adds no address part when the lock count is %s', async (_name, locked) => {
    seedAuth()
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 3, courierAddressLocked: locked } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText('3 pedidos a despachar')).toBeInTheDocument()
    expect(work.queryByText(/travad/)).not.toBeInTheDocument()
  })

  it.each([['null', null], ['0', 0]])('shows the dispatch line alone when the NF-e wait is %s', async (_name, awaiting) => {
    seedAuth()
    installAdminFetchMock(operatorUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 3, courierAwaitingNfe: awaiting } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText('3 pedidos a despachar')).toBeInTheDocument()
    expect(work.queryByText(/aguardando NF-e/)).not.toBeInTheDocument()
  })

  it('shows no NF-e wait when the screen is on the US', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, { routes: withToday({ fulfillment: { ...zero, courierToDispatch: 1, courierAwaitingNfe: 1, upsUnresolved: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByText('1 pedido a despachar · 1 aguardando NF-e')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'EUA' }))
    await waitFor(() => expect(screen.queryByText(/aguardando NF-e/)).not.toBeInTheDocument())
  })

  it('shows nothing for shipping and invoices when every count is zero', async () => {
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText(/Quarta-feira, 7 de outubro/)
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

  // admin-flow-fixes-6 (ups-pickup): created labels with no pickup asked of UPS.
  it('says how many US labels have no pickup, linking to the pickup section', async () => {
    seedAuth()
    installAdminFetchMock(operatorUsUser, { routes: withToday({ fulfillment: { ...zero, upsLabelsWithoutPickup: 3 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(within(work.getByText('3 etiquetas sem coleta pedida').closest('li') as HTMLElement).getByRole('link')).toHaveAttribute('href', '/operations/labels#coleta')
  })

  it('uses the singular for one label without a pickup', async () => {
    seedAuth()
    installAdminFetchMock(operatorUsUser, { routes: withToday({ fulfillment: { ...zero, upsLabelsWithoutPickup: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByText('1 etiqueta sem coleta pedida')).toBeInTheDocument()
  })

  it('shows no pickup item at zero, when absent, or with Brazil on screen', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, { routes: withToday({ fulfillment: { ...zero, upsLabelsWithoutPickup: 3, courierToDispatch: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByText('3 etiquetas sem coleta pedida')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Brasil' }))
    await waitFor(() => expect(screen.queryByText(/sem coleta pedida/)).not.toBeInTheDocument())
  })

  it('shows no pickup item when the count is zero or the API has none', async () => {
    seedAuth()
    const older: Record<string, unknown> = { ...zero }
    delete older.upsLabelsWithoutPickup
    installAdminFetchMock(operatorUsUser, { routes: withToday({ fulfillment: { ...older, upsUnresolved: 1 } }) })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByText('1 compra UPS sem confirmação')).toBeInTheDocument()
    expect(screen.queryByText(/sem coleta pedida/)).not.toBeInTheDocument()
  })

  // admin-flow-fixes-5 (PM-26): address problems and market exceptions per market.
  it('counts the open address problems and the market exceptions of the market on screen', async () => {
    seedAuth()
    installAdminFetchMock({ ...operatorUser, roles: ['admin'] }, {
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

  it('hides the market exceptions count from non-admins', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, {
      routes: withToday({ fulfillment: { ...zero, addressIssues: { BR: { open: 3, stale: 0 }, US: { open: 0, stale: 0 } }, marketExceptions: { BR: 1, US: 0 } } }),
    })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    const work = within(await screen.findByRole('region', { name: 'Expedição e notas' }))
    expect(work.getByText('3 problemas de endereço abertos')).toBeInTheDocument()
    expect(work.queryByText(/exceção de mercado/)).not.toBeInTheDocument()
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

    const pending = within(await screen.findByRole('region', { name: 'Produção' }))
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

  it('opens the refused subscribers and lists each order waiting for a UPS label', async () => {
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

    const pending = within(await screen.findByRole('region', { name: 'Produção' }))
    const refused = (await pending.findByText('2 pagamentos recusados')).closest('li') as HTMLElement
    expect(within(refused).getByRole('link', { name: 'Ver assinantes' })).toHaveAttribute('href', '/billing?status=past_due')
    const ups = within(screen.getByRole('region', { name: 'Sem etiqueta UPS' }))
    expect(ups.getByText('2 pedidos prontos esperando etiqueta')).toBeInTheDocument()
    expect(ups.getAllByRole('link', { name: 'Abrir pedido' }).map((link) => link.getAttribute('href'))).toEqual(['/billing/subscriptions/41', '/billing/subscriptions/42'])
    expect(ups.getByRole('link', { name: 'Abrir Etiquetas UPS' })).toHaveAttribute('href', '/operations/labels')
  })

  describe('checkout readiness line (admin-checkout-readiness)', () => {
    const warning = (key: string, market: 'BR' | 'US') => ({ key, code: 'catalog_never_synced', market, severity: 'high' as const, action: 'products' as const, details: {} })
    const readiness = (warnings: ReturnType<typeof warning>[]) => ({
      checked_at: '2026-11-18T12:00:00.000Z',
      config: { stripe_br_enabled: true, stripe_secret_key_present: { BR: true, US: true }, ups_configured: true },
      warnings,
      notes: [{ key: 'ups:US', code: 'ups_unverified', market: 'US' as const }],
    })

    it('shows an admin one line with the Todos count, linked to the screen, and nothing in Pendências', async () => {
      seedAuth()
      installAdminFetchMock(adminUser, { checkoutReadiness: readiness([warning('catalog:BR', 'BR'), warning('catalog:US', 'US'), warning('coupon:US', 'US')]) })
      renderAuthedPage(<DashboardPage />, '/dashboard')

      const link = await screen.findByRole('link', { name: 'Checkout da loja tem 3 avisos' })
      expect(link).toHaveAttribute('href', '/operations/checkout-readiness')
      expect(document.querySelector('ul.day-pending')?.textContent ?? '').not.toMatch(/Checkout da loja|catálogo/)
    })

    it('says 1 aviso in the singular', async () => {
      seedAuth()
      installAdminFetchMock(adminUser, { checkoutReadiness: readiness([warning('catalog:BR', 'BR')]) })
      renderAuthedPage(<DashboardPage />, '/dashboard')

      expect(await screen.findByRole('link', { name: 'Checkout da loja tem 1 aviso' })).toBeInTheDocument()
    })

    it('shows no line to an admin when there is no warning, notes aside', async () => {
      seedAuth()
      const { calls } = installAdminFetchMock(adminUser, { checkoutReadiness: readiness([]) })
      renderAuthedPage(<DashboardPage />, '/dashboard')

      await waitFor(() => expect(calls.some((call) => call.path === '/api/v1/admin/checkout/readiness')).toBe(true))
      expect(screen.queryByText(/Checkout da loja tem/)).not.toBeInTheDocument()
    })

    it('hides the line when the readiness request fails', async () => {
      seedAuth()
      const { calls } = installAdminFetchMock(adminUser, { checkoutReadiness: { status: 500, message: 'boom' } })
      renderAuthedPage(<DashboardPage />, '/dashboard')

      await waitFor(() => expect(calls.some((call) => call.path === '/api/v1/admin/checkout/readiness')).toBe(true))
      expect(screen.queryByText(/Checkout da loja tem/)).not.toBeInTheDocument()
    })

    it('an operator gets no line and no readiness request', async () => {
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, { checkoutReadiness: readiness([warning('catalog:BR', 'BR')]) })
      renderAuthedPage(<DashboardPage />, '/dashboard')

      expect(await screen.findByRole('heading', { name: 'Pendências' })).toBeInTheDocument()
      expect(screen.queryByText(/Checkout da loja tem/)).not.toBeInTheDocument()
      expect(calls.some((call) => call.path === '/api/v1/admin/checkout/readiness')).toBe(false)
    })
  })
})
