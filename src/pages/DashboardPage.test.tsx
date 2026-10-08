import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { nextStep } from '../lib/today'
import { adminUser, operatorUsUser, operatorUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('DashboardPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads onboarding metrics and catalog sync health with Bearer', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('10 / 10')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Preços Stripe no catálogo' })).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
    expect(screen.getByText(/As 10 variações do catálogo BR já têm um Price ID em BRL/)).toBeInTheDocument()
    expect(screen.getByText('Com Price Stripe')).toBeInTheDocument()
    expect(screen.getByText('Sem vínculo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', '/catalog/products')
    expect(screen.getByText(/Última sincronização: nenhum job em andamento/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sincronizar e assinantes' })).toHaveAttribute('href', '/billing')
    expect(screen.queryByRole('heading', { name: 'Conflitos de mercado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mercado' })).not.toBeInTheDocument()

    expect(calls.some((call) => call.path === '/api/v1/admin/onboarding/metrics' && call.authorization === 'Bearer access-token')).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=BR') && call.search.includes('currency=BRL'))).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
  })

  it('requests US catalog health for a US operator', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUsUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('10 / 10')).toBeInTheDocument()
    })

    expect(screen.getByText(/As 10 variações do catálogo US já têm um Price ID em USD/)).toBeInTheDocument()
    expect(screen.queryByText(/Brasil/)).not.toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=US') && call.search.includes('currency=USD'))).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
  })

  it('lets an admin switch catalog market and shows conflicts', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Conflitos de mercado' })).toBeInTheDocument()
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
    expect(screen.getByText('BR')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(true)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mercado' }), 'US')

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=US') && call.search.includes('currency=USD'))).toBe(true)
    })
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

  it('opens on today: counts, blockers, closed days and the next step of each order', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    expect(await screen.findByRole('heading', { name: 'Hoje' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/Quarta-feira, 7 de outubro/)).toBeInTheDocument()
    })

    const forToday = screen.getByRole('link', { name: /Para hoje/ })
    expect(within(forToday).getByText('2')).toBeInTheDocument()
    expect(within(forToday).getByText('Brasil 1 · EUA 1')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Sem etiqueta UPS/ })).getByText('2')).toBeInTheDocument()

    expect(screen.getByText(/Amanhã \(Brasil\): Folga da cozinha · sem preparo, sem entrega/)).toBeInTheDocument()
    expect(screen.getByText('pedido(s) dos EUA pronto(s) sem etiqueta UPS')).toBeInTheDocument()
    expect(screen.getByText('pagamento(s) recusado(s) travando a produção')).toBeInTheDocument()
    expect(screen.getByText('pedido(s) pago(s) para hoje com preparo não iniciado')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Gerar etiqueta UPS/ })).toHaveAttribute('href', '/billing/subscriptions/31')
    expect(screen.getByRole('link', { name: /Iniciar o preparo/ })).toHaveAttribute('href', '/operations/production')
    expect(screen.getByText('Saúde do sistema')).toBeInTheDocument()

    const today = calls.find((call) => call.path === '/api/v1/admin/today')
    expect(today?.search).toContain('timezone=')
    expect(today?.authorization).toBe('Bearer access-token')
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
    expect(screen.queryByRole('link', { name: /Sem etiqueta UPS/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
  })

  it('orders the next step by what blocks the delivery first', () => {
    const base = {
      id: 7, market: 'US' as const, dueBucket: 'today' as const, dueLabel: '', displayName: '', email: '', city: '',
      flavorMix: '', packCount: 1, packSizeLabel: '', note: null,
    }
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'past_due', upsLabel: null }).text).toMatch(/Pagamento recusado/)
    expect(nextStep({ ...base, productionStatus: 'blocked', paymentState: 'paid', upsLabel: 'missing' }).text).toBe('Resolver o bloqueio')
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'paid', upsLabel: 'missing' }).text).toBe('Gerar etiqueta UPS')
    expect(nextStep({ ...base, productionStatus: 'ready', paymentState: 'paid', upsLabel: 'created' }).text).toBe('Etiqueta criada: despachar')
    expect(nextStep({ ...base, market: 'BR', productionStatus: 'ready', paymentState: 'paid', upsLabel: null }).text).toBe('Pronto para entregar')
  })
})
