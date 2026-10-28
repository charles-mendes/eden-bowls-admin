import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, type AdminUser } from '../contexts/AuthContext'
import { adminUser, jsonResponse, operatorUser } from '../test/fixtures'
import { installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { seedAuth } from '../test/renderPage'
import { InsightsRoute } from './BusinessOverviewPage'

const kpi = (value: number | null, previous: number | null = null) => ({ value, previous })
const nbsp = (text: string | null | undefined) => String(text ?? '').replace(/\u00a0/g, ' ')

function envelope(market: 'BR' | 'US', from = '2026-09-28', to = '2026-10-27') {
  return {
    market,
    currency: market === 'US' ? 'USD' : 'BRL',
    period: { from, to, timezone: 'America/Sao_Paulo', granularity: 'week', partialToday: false, previous: { from: '2026-08-29', to: '2026-09-27' } },
    generatedAt: '2026-10-28T18:00:00Z',
  }
}

function report(path: string, market: 'BR' | 'US') {
  if (path.endsWith('/revenue')) {
    return {
      ...envelope(market),
      kpis: {
        grossRevenue: kpi(market === 'US' ? 250000 : 1000000, 800000),
        paidInvoices: kpi(12, 10),
        averageTicket: kpi(83333, 80000),
        firstPurchaseRevenue: kpi(300000, 200000),
        renewalRevenue: kpi(700000, 600000),
      },
      estimatedMrr: { value: 450000, previous: null, estimated: true, trialingSubscriptions: 0, unpricedSubscriptions: 1 },
      excludedInvoices: 0,
      series: [],
    }
  }
  if (path.endsWith('/subscriptions')) {
    return {
      ...envelope(market),
      current: { active: kpi(40), trialing: kpi(0), canceling: kpi(2), pastDue: kpi(1), renewing7d: kpi(9) },
      kpis: { new: kpi(7, 5), canceled: kpi(3, 4), activeAtStart: kpi(36, 30), churn: kpi(0.05, 0.1) },
      approximateNewCount: 0,
      approximateCanceledCount: 0,
      series: [
        { key: '2026-09-28', from: '2026-09-28', to: '2026-10-04', partial: false, newCount: 4, canceled: 1 },
        { key: '2026-10-05', from: '2026-10-05', to: '2026-10-11', partial: false, newCount: 3, canceled: 2 },
      ],
    }
  }
  if (path.endsWith('/acquisition')) {
    return {
      ...envelope(market),
      stages: { started: kpi(50), linked: kpi(20), activated: kpi(7) },
      conversions: { startedToLinked: kpi(0.4), linkedToActivated: kpi(0.35), startedToActivated: kpi(0.14) },
      series: [],
    }
  }
  if (path.endsWith('/mix')) {
    return {
      ...envelope(market),
      period: null,
      recipes: [{ key: 'chicken', name: market === 'US' ? 'Chicken' : 'Frango', nameMissing: false, packs: 30, subscriptions: 12 }],
      packSizes: [{ grams: 500, label: '500 g', packs: 30, subscriptions: 12, share: 1 }],
    }
  }
  if (path.endsWith('/operations')) {
    return {
      ...envelope(market, '2026-10-28', '2026-10-28'),
      cycles: { to_prepare: kpi(4), in_production: kpi(1), ready: kpi(2), blocked: kpi(1) },
      late: kpi(3),
      awaitingPayment: kpi(2),
      shipments: null,
    }
  }
  return undefined
}

function renderInsights(user: AdminUser = operatorUser) {
  seedAuth()
  const mock = installAdminFetchMock(user, {
    routes: (call) => {
      if (!call.path.startsWith('/api/v1/admin/reports/')) return undefined
      const market = new URLSearchParams(call.search).get('market') === 'US' ? 'US' : 'BR'
      const body = report(call.path, market)
      return body ? jsonResponse(body) : undefined
    },
  })
  render(
    <MemoryRouter initialEntries={['/insights']}>
      <AuthProvider>
        <Routes>
          <Route path="/insights" element={<InsightsRoute />} />
          <Route path="/dashboard" element={<div>hoje-page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  return mock
}

const reportCalls = (calls: FetchCall[]) => calls.filter((call) => call.path.startsWith('/api/v1/admin/reports/')).map((call) => call.path + call.search)

describe('BusinessOverviewPage', () => {
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

  it('shows the reports API figures for the market and the last 30 days', async () => {
    const { calls } = renderInsights()

    expect(await screen.findByText('Faturamento bruto')).toBeInTheDocument()
    expect(screen.queryByText('Dados de demonstração')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(screen.getByText(/de Brasil · 28\/09\/2026 a 27\/10\/2026/)).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
    expect(headings).toEqual(['Receita', 'Assinaturas', 'Tendência semanal', 'Funil de aquisição', 'Mix das assinaturas ativas'])

    const gross = screen.getByText('Faturamento bruto').closest('.day-card') as HTMLElement
    expect(nbsp(within(gross).getByText(/R\$/).textContent)).toBe('R$ 10.000,00')
    expect(within(gross).getByText(/\+25,0%/)).toBeInTheDocument()
    expect(screen.getByText('3 atrasados')).toBeInTheDocument()
    expect(screen.getByText('2 aguardando pagamento')).toBeInTheDocument()
    expect(screen.getByTitle('Semana de 28/09: 4 novas, 1 cancelamentos')).toBeInTheDocument()
    expect(screen.getByText('Frango')).toBeInTheDocument()
    expect(screen.getByText(/1 sem preço registrado ficaram de fora/)).toBeInTheDocument()

    expect(reportCalls(calls).sort()).toEqual([
      '/api/v1/admin/reports/acquisition?market=BR&from=2026-09-28&to=2026-10-27',
      '/api/v1/admin/reports/mix?market=BR',
      '/api/v1/admin/reports/operations?market=BR&from=2026-10-28&to=2026-10-28',
      '/api/v1/admin/reports/revenue?market=BR&from=2026-09-28&to=2026-10-27',
      '/api/v1/admin/reports/subscriptions?market=BR&from=2026-09-28&to=2026-10-27&granularity=week',
    ])
  })

  it('reloads for another period and market', async () => {
    const user = userEvent.setup()
    const { calls } = renderInsights(adminUser)

    expect(await screen.findByText('Frango')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '7 dias' }))
    expect(await screen.findByText(/21\/10\/2026 a 27\/10\/2026/)).toBeInTheDocument()
    expect(reportCalls(calls)).toContain('/api/v1/admin/reports/revenue?market=BR&from=2026-10-21&to=2026-10-27')

    await user.click(screen.getByRole('button', { name: 'Estados Unidos' }))
    expect(await screen.findByText('Chicken')).toBeInTheDocument()
    expect(reportCalls(calls).some((path) => path.startsWith('/api/v1/admin/reports/revenue?market=US'))).toBe(true)
  })

  it('shows the API error instead of numbers', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser, {
      routes: (call) => (call.path.startsWith('/api/v1/admin/reports/') ? jsonResponse({ error: { code: 'boom', message: 'Relatório indisponível.' } }, 500) : undefined),
    })
    render(
      <MemoryRouter initialEntries={['/insights']}>
        <AuthProvider>
          <Routes><Route path="/insights" element={<InsightsRoute />} /></Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Faturamento bruto')).not.toBeInTheDocument()
  })
})
