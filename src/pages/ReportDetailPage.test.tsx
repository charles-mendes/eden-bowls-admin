import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminUser } from '../contexts/AuthContext'
import { adminUser, jsonResponse, operatorUsUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'
import { ReportDetailPage } from './ReportDetailPage'

const nbsp = (text: string | null | undefined) => String(text ?? '').replace(/\u00a0/g, ' ')

function detail(overrides: Record<string, unknown> = {}) {
  return {
    report: 'revenue',
    indicator: 'grossRevenue',
    source: { report: 'revenue', indicator: 'grossRevenue' },
    label: 'Faturamento bruto',
    title: 'Faturamento bruto',
    description: 'Soma do valor pago das faturas do período.',
    kind: 'money',
    contributionKind: 'money',
    market: 'US',
    currency: 'USD',
    pointInTime: false,
    hasPrevious: true,
    window: { from: '2026-10-20', to: '2026-11-18', timezone: 'America/New_York', previous: false, bucket: null },
    value: 229500,
    criteria: ['Mercado EUA (US): conta Stripe us, moeda USD.', 'Faturas de cliente com status pago (paid), da conta Stripe do mercado.'],
    formula: { expression: 'Soma do valor pago de 2 faturas', terms: [{ label: 'Faturas', value: 2, kind: 'count' }], result: 229500 },
    groups: [{ key: 'subscription_create', label: 'Primeira compra', count: 2, contribution: 229500 }],
    totals: { count: 2, contribution: 229500 },
    excluded: [{
      reason: 'Moeda diferente da moeda do mercado',
      count: 1,
      items: [{ id: 9, type: 'invoices', reference: 'EB-2026-000009', date: '2026-10-22T10:00:00Z', description: 'Renovação do ciclo · BRL', group: { key: 'subscription_cycle', label: 'Renovação do ciclo' }, link: null }],
    }],
    reconciliation: { reportValue: 229500, recordsValue: 229500, matches: true },
    records: {
      page: 1,
      perPage: 50,
      total: 2,
      items: [
        { id: 1, type: 'invoices', reference: 'EB-2026-000001', date: '2026-10-21T15:00:00Z', description: 'Primeira compra · emitida em 21/10/2026 · USD', group: { key: 'subscription_create', label: 'Primeira compra' }, link: '/billing/subscriptions/42', contribution: 114750, customer: { name: 'Ana Souza', link: '/users/7' } },
        { id: 2, type: 'invoices', reference: 'EB-2026-000002', date: '2026-11-05T15:00:00Z', description: 'Primeira compra · emitida em 05/11/2026 · USD', group: { key: 'subscription_create', label: 'Primeira compra' }, link: '/billing/subscriptions/43', contribution: 114750, customer: { name: 'Bia Lima', link: '/users/8' } },
      ],
    },
    generatedAt: '2026-11-19T12:00:00Z',
    ...overrides,
  }
}

const ROUTE = '/reports/detalhe?aba=receita&indicador=grossRevenue&mercado=US&de=2026-10-20&ate=2026-11-18'

function renderDetail(route = ROUTE, user: AdminUser = adminUser, body: Record<string, unknown> = detail()) {
  seedAuth()
  const mock = installAdminFetchMock(user, {
    routes: (call: FetchCall) => (call.path === '/api/v1/admin/reports/details' ? jsonResponse(body) : undefined),
  })
  renderAuthedPage(<ReportDetailPage />, route, '/reports/detalhe')
  return mock
}

const detailCalls = (calls: FetchCall[]) => calls.filter((call) => call.path === '/api/v1/admin/reports/details')

describe('ReportDetailPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-19T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the figure, its criteria, the formula, subtotals, records and the total that matches', async () => {
    const { calls } = renderDetail()

    expect(await screen.findByRole('heading', { name: 'Faturamento bruto' })).toBeInTheDocument()
    expect(detailCalls(calls)[0].search).toBe('?report=revenue&indicator=grossRevenue&market=US&from=2026-10-20&to=2026-11-18&page=1&perPage=50')
    expect(nbsp(screen.getByText('Valor no relatório').closest('.day-card')?.textContent)).toContain('US$ 2.295,00')
    expect(screen.getByText('Confere com o relatório')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('Faturas de cliente com status pago (paid), da conta Stripe do mercado.')).toBeInTheDocument()
    expect(screen.getByText('Soma do valor pago de 2 faturas')).toBeInTheDocument()

    const records = screen.getByRole('table', { name: 'Registros do indicador' })
    expect(within(records).getByRole('link', { name: 'EB-2026-000001' })).toHaveAttribute('href', '/billing/subscriptions/42')
    expect(within(records).getByRole('link', { name: 'Ana Souza' })).toHaveAttribute('href', '/users/7')
    expect(nbsp(within(records).getByText('Total').closest('tr')?.textContent)).toContain('US$ 2.295,00')

    const subtotals = screen.getByRole('table', { name: 'Subtotais' })
    expect(within(subtotals).getByText('Primeira compra')).toBeInTheDocument()
    const excluded = screen.getByRole('table', { name: 'Fora do cálculo: Moeda diferente da moeda do mercado' })
    expect(within(excluded).getByText('EB-2026-000009')).toBeInTheDocument()
    expect(within(excluded).queryByText('US$ 0,00')).not.toBeInTheDocument()
  })

  it('a gap between report and records is an alert with both values', async () => {
    renderDetail(ROUTE, adminUser, detail({ reconciliation: { reportValue: 229500, recordsValue: 200000, matches: false } }))

    const alert = await screen.findByRole('alert')
    expect(nbsp(alert.textContent)).toContain('US$ 2.000,00')
    expect(nbsp(alert.textContent)).toContain('US$ 2.295,00')
    expect(screen.getByText('Não confere com o relatório')).toBeInTheDocument()
  })

  it('without customers in the records there is no customer column', async () => {
    const plain = detail()
    const items = (plain.records as { items: Array<Record<string, unknown>> }).items.map((record) => {
      const copy = { ...record }
      delete copy.customer
      return copy
    })
    renderDetail(ROUTE, operatorUsUser, { ...plain, records: { ...(plain.records as object), items } })

    const records = await screen.findByRole('table', { name: 'Registros do indicador' })
    expect(within(records).queryByRole('columnheader', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(within(records).getByRole('link', { name: 'EB-2026-000001' })).toBeInTheDocument()
  })

  it('switching to the previous period reloads with anterior=1', async () => {
    const user = userEvent.setup()
    const { calls } = renderDetail()
    await user.click(await screen.findByRole('button', { name: 'Período anterior' }))

    const last = detailCalls(calls).at(-1)
    expect(last?.search).toContain('period=previous')
  })

  it('a point-in-time figure has no period switch', async () => {
    renderDetail('/reports/detalhe?aba=assinaturas&indicador=current.active&mercado=US', adminUser, detail({ hasPrevious: false, pointInTime: true, kind: 'count', contributionKind: 'count' }))
    await screen.findByText('Registros considerados')
    expect(screen.queryByRole('button', { name: 'Período anterior' })).not.toBeInTheDocument()
  })

  it('"Voltar para Relatórios" returns to the same tab and filters', async () => {
    renderDetail('/reports/detalhe?aba=operacao&indicador=cycles.ready&mercado=US&de=2026-10-20&ate=2026-11-18', adminUser, detail({ indicator: 'cycles.ready' }))
    expect(await screen.findByRole('link', { name: '← Voltar para Relatórios' })).toHaveAttribute('href', '/reports?aba=operacao&mercado=US&de=2026-10-20&ate=2026-11-18')
  })

  it('export is offered with reports.export and hidden for readonly', async () => {
    renderDetail()
    expect(await screen.findByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument()
  })

  it('readonly does not see the export', async () => {
    renderDetail(ROUTE, readonlyUser)
    await screen.findByRole('heading', { name: 'Faturamento bruto' })
    expect(screen.queryByRole('button', { name: 'Exportar CSV' })).not.toBeInTheDocument()
  })

  it('the export downloads the details CSV with the session token', async () => {
    const user = userEvent.setup()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser, {
      routes: (call: FetchCall) => {
        if (call.path === '/api/v1/admin/reports/details') return jsonResponse(detail())
        if (call.path === '/api/v1/admin/reports/details/export.csv') {
          return new Response('x', { status: 200, headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="eden-revenue-grossRevenue-US-2026-10-20-2026-11-18.csv"' } })
        }
        return undefined
      },
    })
    renderAuthedPage(<ReportDetailPage />, ROUTE, '/reports/detalhe')

    await user.click(await screen.findByRole('button', { name: 'Exportar CSV' }))
    const exportCall = calls.find((call) => call.path === '/api/v1/admin/reports/details/export.csv')
    expect(exportCall?.search).toBe('?report=revenue&indicator=grossRevenue&market=US&from=2026-10-20&to=2026-11-18&formato=excel')
    expect(exportCall?.authorization).toBe('Bearer access-token')
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })

  it('an API error is shown and the back link stays', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, {
      routes: (call: FetchCall) => (call.path === '/api/v1/admin/reports/details'
        ? jsonResponse({ message: 'Unknown indicator for this report.', details: { code: 'report_indicator_unknown' } }, 400)
        : undefined),
    })
    renderAuthedPage(<ReportDetailPage />, ROUTE, '/reports/detalhe')
    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown indicator for this report.')
    expect(screen.getByRole('link', { name: '← Voltar para Relatórios' })).toBeInTheDocument()
  })
})
