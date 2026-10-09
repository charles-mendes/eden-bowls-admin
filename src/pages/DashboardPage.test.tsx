import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { SystemHealth } from '../components/SystemHealth'
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
    renderAuthedPage(<SystemHealth />, '/dashboard')

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
    expect(ups).toHaveAttribute('href', '/operations/production?status=ready&mercado=us')

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
    installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await screen.findByText('Bruno Lima')
    expect(screen.queryByText('Saúde do sistema')).not.toBeInTheDocument()
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
