import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '../contexts/AuthContext'
import { adminUser, jsonResponse, operatorUsUser, operatorUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'
import { ReportsPage } from './ReportsPage'

const kpi = (value: number | null, previous: number | null = null) => ({ value, previous })
const nbsp = (text: string | null | undefined) => String(text ?? '').replace(/\u00a0/g, ' ')

function period(from = '2026-09-28', to = '2026-10-27', granularity = 'day') {
  return { from, to, timezone: 'America/Sao_Paulo', granularity, partialToday: false, previous: { from: '2026-08-29', to: '2026-09-27' } }
}

function envelope(market: 'BR' | 'US') {
  return { market, currency: market === 'US' ? 'USD' : 'BRL', period: period(), generatedAt: '2026-10-28T18:00:00Z' }
}

function revenue(market: 'BR' | 'US' = 'BR', overrides: Record<string, unknown> = {}) {
  return {
    ...envelope(market),
    kpis: {
      grossRevenue: kpi(1000000, 800000),
      paidInvoices: kpi(12, 0),
      averageTicket: kpi(83333, null),
      firstPurchaseRevenue: kpi(300000, 200000),
      renewalRevenue: kpi(700000, 600000),
    },
    estimatedMrr: { value: 450000, previous: null, estimated: true, trialingSubscriptions: 2, unpricedSubscriptions: 0 },
    excludedInvoices: 1,
    series: [
      { key: '2026-03-01', from: '2026-03-15', to: '2026-03-31', partial: true, revenue: 200000, invoices: 2 },
      { key: '2026-04-01', from: '2026-04-01', to: '2026-04-30', partial: false, revenue: 800000, invoices: 10 },
    ],
    ...overrides,
  }
}

function summaryBlock(market: 'BR' | 'US') {
  return {
    market,
    currency: market === 'US' ? 'USD' : 'BRL',
    period: period(),
    kpis: {
      grossRevenue: kpi(market === 'US' ? 1234567 : 1000000, 0),
      paidInvoices: kpi(3, 2),
      averageTicket: kpi(5000, 4000),
      activeSubscriptions: kpi(40, null),
      new: kpi(5, 4),
      canceled: kpi(1, 2),
      churn: kpi(0.04, 0.05),
      checkoutsStarted: kpi(50, 40),
      checkoutToActivation: kpi(0.2, 0.25),
    },
  }
}

type Reply = (call: FetchCall) => Response | undefined

function renderReports(route: string, user: AdminUser = adminUser, reply: Reply = () => undefined) {
  seedAuth()
  const mock = installAdminFetchMock(user, {
    routes: (call) => {
      if (!call.path.startsWith('/api/v1/admin/reports/')) return undefined
      const custom = reply(call)
      if (custom) return custom
      const market = new URLSearchParams(call.search).get('market') === 'US' ? 'US' : 'BR'
      if (call.path.endsWith('/summary')) {
        return jsonResponse({ period: period(), generatedAt: '2026-10-28T18:00:00Z', markets: (user.markets ?? []).map((item) => summaryBlock(item as 'BR' | 'US')) })
      }
      if (call.path.endsWith('/revenue')) return jsonResponse(revenue(market))
      return undefined
    },
  })
  renderAuthedPage(<ReportsPage />, route, '/reports')
  return mock
}

const reportCalls = (calls: FetchCall[]) => calls.filter((call) => call.path.startsWith('/api/v1/admin/reports/'))

describe('ReportsPage', () => {
  beforeEach(() => {
    // 2026-10-28 15:00 in Sao Paulo.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T18:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('restores tab, market and period from a shared link', async () => {
    const { calls } = renderReports('/reports?aba=assinaturas&mercado=US&de=2026-07-01&ate=2026-09-30', adminUser, (call) => (
      call.path.endsWith('/subscriptions') ? jsonResponse({
        ...envelope('US'),
        current: { active: kpi(10), trialing: kpi(1), canceling: kpi(0), pastDue: kpi(0), renewing7d: kpi(2) },
        kpis: { new: kpi(4, 2), canceled: kpi(5, 1), activeAtStart: kpi(100, 90), churn: kpi(0.04, null) },
        approximateNewCount: 0,
        approximateCanceledCount: 3,
        series: [],
      }) : undefined
    ))

    expect(await screen.findByText('Ativas no início')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Assinaturas' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'Estados Unidos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/Estados Unidos · 01\/07\/2026 a 30\/09\/2026/)).toBeInTheDocument()
    expect(screen.getByLabelText('De')).toHaveValue('2026-07-01')
    expect(screen.getByText(/3 cancelamentos têm data aproximada/)).toBeInTheDocument()
    expect(reportCalls(calls).map((call) => call.path + call.search)).toEqual([
      '/api/v1/admin/reports/subscriptions?market=US&from=2026-07-01&to=2026-09-30',
    ])
  })

  it('a BR operator has no market control and every request sends market=BR, even with US in the URL', async () => {
    const { calls } = renderReports('/reports?aba=receita&mercado=US', operatorUser)

    expect(await screen.findByText('Faturamento bruto')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    const subtitle = screen.getByText(/Brasil · 28\/09\/2026 a 27\/10\/2026/)
    expect(subtitle.textContent).not.toMatch(/\d{1,2}:\d{2}/)
    expect(reportCalls(calls).length).toBeGreaterThan(0)
    for (const call of reportCalls(calls)) {
      expect(new URLSearchParams(call.search).get('market')).toBe('BR')
    }
  })

  it('an admin defaults to Brasil without Todos and sees revenue with the change, Estimado and the excluded invoice', async () => {
    const { calls } = renderReports('/reports?aba=receita')

    expect(await screen.findByText('Faturamento bruto')).toBeInTheDocument()
    const market = screen.getByRole('group', { name: 'Mercado' })
    expect(within(market).getByRole('button', { name: 'Brasil' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(market).queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument()

    const revenueCard = screen.getByText('Faturamento bruto').closest('.day-card') as HTMLElement
    expect(nbsp(revenueCard.textContent)).toContain('R$ 10.000,00')
    expect(revenueCard.textContent).toContain('+25,0%')
    const invoicesCard = screen.getByText('Faturas pagas').closest('.day-card') as HTMLElement
    expect(invoicesCard.textContent).not.toContain('%')
    expect(screen.getByText('Estimado')).toBeInTheDocument()
    expect(screen.getByText(/1 fatura em outra moeda ficou fora/)).toBeInTheDocument()
    expect(screen.queryByText('Dados de demonstração')).not.toBeInTheDocument()
    expect(reportCalls(calls)[0].search).toBe('?market=BR&from=2026-09-28&to=2026-10-27')
  })

  it('marks a partial bucket in the series tooltip', async () => {
    renderReports('/reports?aba=receita&granularidade=month')
    await screen.findByText('Faturamento bruto')
    const partial = document.querySelector('[data-partial]') as HTMLElement
    expect(partial).toHaveClass('report-partial')
    expect(partial.getAttribute('title')).toContain('período parcial')
    expect(screen.getByRole('img', { name: /Faturamento bruto: Faturamento R\$/ })).toBeInTheDocument()
  })

  it('blocks a custom range over 366 days without sending a request', async () => {
    const user = userEvent.setup()
    const { calls } = renderReports('/reports?aba=receita')
    await screen.findByText('Faturamento bruto')
    const before = reportCalls(calls).length

    await user.click(screen.getByRole('button', { name: 'Personalizado' }))
    const from = screen.getByLabelText('De')
    await user.clear(from)
    await user.type(from, '2025-01-01')

    expect(await screen.findByText(/no máximo 366 dias/)).toBeInTheDocument()
    expect(reportCalls(calls).length).toBe(before)
  })

  it('notes that today is compared up to the same time when Até is today', async () => {
    renderReports('/reports?aba=receita&de=2026-10-01&ate=2026-10-28')
    expect(await screen.findByText(/Hoje é comparado até o mesmo horário/)).toBeInTheDocument()
  })

  it('the admin summary has Brasil then Estados Unidos in their own currency and no Total', async () => {
    const { calls } = renderReports('/reports')

    const brasil = await screen.findByRole('region', { name: /Brasil/ })
    const us = screen.getByRole('region', { name: /Estados Unidos/ })
    expect(nbsp(brasil.textContent)).toContain('R$ 10.000,00')
    expect(nbsp(us.textContent)).toContain('US$ 12.345,67')
    expect(brasil.compareDocumentPosition(us) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText('Total')).not.toBeInTheDocument()
    expect(new URLSearchParams(reportCalls(calls)[0].search).has('market')).toBe(false)
  })

  it('a US operator summary shows only Estados Unidos', async () => {
    renderReports('/reports', operatorUsUser)
    expect(await screen.findByRole('region', { name: /Estados Unidos/ })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Brasil/ })).not.toBeInTheDocument()
  })

  it('readonly has no export; an operator exports the current tab as Excel CSV', async () => {
    renderReports('/reports?aba=estoque', readonlyUser, (call) => (call.path.endsWith('/stock') ? jsonResponse({ ...envelope('BR'), rows: [], totals: { produced: kpi(0), separated: kpi(0), adjusted: kpi(0), onHand: kpi(0) } }) : undefined))
    expect(await screen.findByText('Estoque por receita e pack')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
  })

  it('an operator on Estoque downloads export.csv with report=stock, market=BR and formato=excel', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:csv'), revokeObjectURL: vi.fn() }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { calls } = renderReports('/reports?aba=estoque', operatorUser, (call) => {
      if (call.path.endsWith('/stock')) {
        return jsonResponse({
          ...envelope('BR'),
          rows: [{ key: 'bovino', name: 'bovino', nameMissing: true, grams: 300, label: '300 g', produced: 5, separated: 2, adjusted: 0, onHand: 3, minLevel: null }],
          totals: { produced: kpi(5, 1), separated: kpi(2, 0), adjusted: kpi(0, 0), onHand: kpi(3) },
        })
      }
      if (call.path.endsWith('/export.csv')) {
        return new Response('secao;item', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="eden-stock-BR-2026-09-28-2026-10-27.csv"' } })
      }
      return undefined
    })

    expect(await screen.findByText('(sem nome no catálogo Brasil)')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    const exportCall = calls.find((call) => call.path === '/api/v1/admin/reports/export.csv')
    expect(exportCall?.search).toBe('?report=stock&market=BR&from=2026-09-28&to=2026-10-27&formato=excel')
    expect(exportCall?.authorization).toBe('Bearer access-token')
    click.mockRestore()
  })

  it('a timeout shows the API alert and no zeroed card', async () => {
    renderReports('/reports?aba=receita', adminUser, (call) => (
      call.path.endsWith('/revenue') ? jsonResponse({ message: 'The report took too long. Try a shorter period.', details: { code: 'report_timeout' } }, 503) : undefined
    ))

    expect(await screen.findByRole('alert')).toHaveTextContent('The report took too long')
    expect(screen.queryByText('Faturamento bruto')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('R$ 0,00')
  })

  it('Brazil operations hide UPS and keep unpaid renewals apart from late cycles', async () => {
    renderReports('/reports?aba=operacao', operatorUser, (call) => (
      call.path.endsWith('/operations') ? jsonResponse({
        ...envelope('BR'),
        cycles: { to_prepare: kpi(2, 1), in_production: kpi(3, 3), ready: kpi(4, 2), blocked: kpi(0, 0) },
        late: kpi(1, 0),
        awaitingPayment: kpi(7),
        shipments: null,
      }) : undefined
    ))

    const awaiting = (await screen.findByText('Aguardando pagamento')).closest('.day-card') as HTMLElement
    expect(awaiting.textContent).toContain('7')
    expect(awaiting.textContent).toContain('agora')
    expect((screen.getByText('Atrasados').closest('.day-card') as HTMLElement).textContent).toContain('1')
    expect(screen.queryByText('Envios UPS')).not.toBeInTheDocument()
  })

  it('an admin sees checkouts without a market apart from the funnel', async () => {
    renderReports('/reports?aba=aquisicao', adminUser, (call) => (
      call.path.endsWith('/acquisition') ? jsonResponse({
        ...envelope('BR'),
        unassignedCheckouts: 4,
        stages: { started: kpi(200, 100), linked: kpi(120, 60), activated: kpi(90, 40) },
        conversions: { startedToLinked: kpi(0.6, 0.6), linkedToActivated: kpi(0.75, 0.66), startedToActivated: kpi(0.45, 0.4) },
        series: [],
      }) : undefined
    ))

    expect(await screen.findByText(/4 checkouts do período estão sem mercado e ficam fora do funil/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Funil de aquisição: Checkouts iniciados 200, Vinculados ao Stripe 120, Chegaram a ativar 90/ })).toBeInTheDocument()
  })

  it('the US mix shows a recipe without a catalog name and the pack label with grams', async () => {
    renderReports('/reports?aba=mix&mercado=US', adminUser, (call) => (
      call.path.endsWith('/mix') ? jsonResponse({
        ...envelope('US'),
        period: null,
        recipes: [{ key: 'turkey', name: 'Turkey & Rice', nameMissing: false, packs: 12, subscriptions: 4 }, { key: 'bovino', name: 'bovino', nameMissing: true, packs: 5, subscriptions: 1 }],
        packSizes: [{ grams: 499, label: '17.6 oz (499 g)', packs: 10, subscriptions: 2, share: 0.5882 }, { grams: 500, label: '17.6 oz (500 g)', packs: 7, subscriptions: 3, share: 0.4118 }],
      }) : undefined
    ))

    expect(await screen.findByText('(sem nome no catálogo EUA)')).toBeInTheDocument()
    expect(screen.getByText('17.6 oz (499 g)')).toBeInTheDocument()
    expect(screen.getByText('17.6 oz (500 g)')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Período' })).not.toBeInTheDocument()
  })
})
