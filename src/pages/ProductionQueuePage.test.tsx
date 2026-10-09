import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductionQueuePage } from './ProductionQueuePage'
import { adminUser, operatorWriteUser, productionQueueItem, readonlyUser, WRITE_PERMISSIONS } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

function renderQueue(route = '/operations/production') {
  renderAuthedPage(<ProductionQueuePage />, route, '/operations/production')
}

async function openRowMenu(name = 'Ana Ledger') {
  fireEvent.click(await screen.findByRole('button', { name: `Mais opções para ${name}` }))
  return screen.findByRole('menu')
}

describe('ProductionQueuePage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads the due counts and a row with what to prepare', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderQueue()

    expect(await screen.findByText('ana@edenbowls.com')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Fila de produção' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '← Voltar para Hoje' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: /^Hoje/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Ana Ledger')).toBeInTheDocument()
    expect(screen.queryByText('WordPress Name')).not.toBeInTheDocument()
    expect(screen.getByText('beef × 2, turkey × 1')).toBeInTheDocument()
    expect(screen.getByText('3 pacotes · 500 g')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Iniciar preparo' })).toBeInTheDocument()
    // A single-market operator has no market switch: the session market is forced.
    expect(screen.queryByRole('group', { name: 'Mercado' })).not.toBeInTheDocument()
    expect(screen.queryByText('Limpar filtros')).not.toBeInTheDocument()

    const listCall = findCall(calls, 'GET', '/admin/production/queue')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('includeOverdue=true')
    expect(listCall?.search).toContain('account=br')
    expect(listCall?.search).not.toMatch(/[?&]due=/)

    const menu = await openRowMenu()
    expect(within(menu).getByRole('menuitem', { name: 'Cliente' })).toHaveAttribute('href', '/users/7')
    expect(within(menu).getByRole('menuitem', { name: 'Assinatura' })).toHaveAttribute('href', '/billing/subscriptions/42')
    expect(within(menu).getByRole('menuitem', { name: 'Onboarding 360' })).toHaveAttribute('href', '/onboarding/sessions/7')
    expect(within(menu).getByRole('menuitem', { name: 'Bloquear' })).toBeInTheDocument()
  })

  it('opens filtered from the URL and sends the filters to the API', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderQueue('/operations/production?prazo=hoje&status=to_prepare&busca=ana%40')

    await screen.findByText('ana@edenbowls.com')
    expect(screen.getByRole('button', { name: /^Hoje/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Preparo')).toHaveValue('to_prepare')
    expect(screen.getByLabelText('Buscar')).toHaveValue('ana@')
    expect(screen.getByText('Prazo: Hoje')).toBeInTheDocument()
    expect(screen.getByText('Preparo: A preparar')).toBeInTheDocument()

    const listCall = findCall(calls, 'GET', '/admin/production/queue')
    expect(listCall?.search).toContain('due=today')
    expect(listCall?.search).toContain('productionStatus=to_prepare')
    expect(listCall?.search).toContain('q=ana%40')

    fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Prazo: Hoje' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Hoje/ })).toHaveAttribute('aria-pressed', 'false'))
    fireEvent.click(screen.getByRole('button', { name: 'Limpar filtros' }))
    await waitFor(() => expect(screen.getByLabelText('Preparo')).toHaveValue(''))
    expect(screen.getByLabelText('Buscar')).toHaveValue('')
  })

  it('filters by due bucket from the count cards, and a second click clears it', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderQueue()

    await screen.findByText('ana@edenbowls.com')
    fireEvent.click(screen.getByRole('button', { name: /^Atrasados/ }))
    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/production/queue' && call.search.includes('due=overdue'))).toBe(true)
    })
    expect(screen.getByRole('button', { name: /^Atrasados/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /^Atrasados/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Atrasados/ })).toHaveAttribute('aria-pressed', 'false'))
  })

  it('lets an admin pick the market', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderQueue()

    await screen.findByText('ana@edenbowls.com')
    const market = screen.getByRole('group', { name: 'Mercado' })
    fireEvent.click(within(market).getByRole('button', { name: 'EUA' }))
    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/production/queue' && call.search.includes('account=us'))).toBe(true)
    })
    expect(screen.getByText('Mercado: EUA')).toBeInTheDocument()
  })

  it('advances the status with the row action', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Iniciar preparo' }))
    await waitFor(() => {
      expect(findCall(calls, 'PATCH', '/admin/production/queue/42')?.body).toEqual({ status: 'in_production', periodEnd: productionQueueItem.currentPeriodEnd })
    })
  })

  it('blocks only with a note', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderQueue()

    const menu = await openRowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Bloquear' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bloquear pedido' })
    expect(within(dialog).getByRole('button', { name: 'Bloquear' })).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Nota'), { target: { value: 'Falta carne' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Bloquear' }))
    await waitFor(() => {
      expect(findCall(calls, 'PATCH', '/admin/production/queue/42')?.body).toEqual({ status: 'blocked', periodEnd: productionQueueItem.currentPeriodEnd, note: 'Falta carne' })
    })
  })

  it('hides status actions for readonly users', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderQueue()

    await screen.findByText('ana@edenbowls.com')
    expect(screen.queryByRole('button', { name: 'Iniciar preparo' })).not.toBeInTheDocument()
    const menu = await openRowMenu()
    expect(within(menu).queryByRole('menuitem', { name: 'Bloquear' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Assinatura' })).toBeInTheDocument()
  })

  it('shows empty copy with a way out when the filters match nothing', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderQueue()

    await screen.findByText('ana@edenbowls.com')
    fireEvent.change(screen.getByLabelText('Preparo'), { target: { value: 'ready' } })

    expect(await screen.findByText(/Nenhum pedido com estes filtros/)).toBeInTheDocument()
    expect(screen.getByText('0 pedidos')).toBeInTheDocument()
  })

  it('shows out-of-scope identity without profile links', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { productionInScope: false })
    renderQueue()

    await screen.findByText('ana@edenbowls.com')
    expect(screen.getByText('Ana Ledger')).toBeInTheDocument()
    expect(screen.queryByText('WordPress Name')).not.toBeInTheDocument()
    const menu = await openRowMenu()
    expect(within(menu).queryByRole('menuitem', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Perfil fora do seu mercado' })).toHaveAttribute('aria-disabled', 'true')
    expect(document.querySelector('a[href="/users/7"]')).toBeNull()
    expect(document.querySelector('a[href="/onboarding/sessions/7"]')).toBeNull()
  })

  it('shows a cycle awaiting payment without the start action (3.12)', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [
        { ...productionQueueItem, paymentState: 'awaiting_payment', paymentLabel: 'Aguardando pagamento' },
        { ...productionQueueItem, id: 2, email: 'bia@edenbowls.com', customerName: 'Bia', currentPeriodEnd: '2026-09-19T17:00:00.000Z', preparationDay: '2026-09-21', paymentState: 'paid', paymentLabel: null },
      ],
    })
    renderQueue()

    expect(await screen.findByText('Aguardando pagamento')).toBeInTheDocument()
    // Only the paid cycle offers "Iniciar preparo"; both can still be blocked from the row menu.
    expect(screen.getAllByRole('button', { name: 'Iniciar preparo' })).toHaveLength(1)
    expect(within(await openRowMenu('Ana Ledger')).getByRole('menuitem', { name: 'Bloquear' })).toBeInTheDocument()
  })

  it('mirrors production permissions on write fixtures', () => {
    expect(WRITE_PERMISSIONS).toContain('production.read')
    expect(WRITE_PERMISSIONS).toContain('production.write')
    expect(readonlyUser.permissions).toContain('production.read')
    expect(readonlyUser.permissions).not.toContain('production.write')
  })
})
