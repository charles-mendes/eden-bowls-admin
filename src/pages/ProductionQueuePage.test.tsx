import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { addDays, COURIER_TIMEZONE, todayIn } from '../lib/deliveryRange'
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
    expect(screen.getByText('Bovino × 2, Frango × 1')).toBeInTheDocument()
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
    expect(within(menu).getByRole('menuitem', { name: 'Checkout' })).toHaveAttribute('href', '/users/7?aba=checkout')
    expect(within(menu).getByRole('menuitem', { name: 'Bloquear' })).toBeInTheDocument()
  })

  it('shows the short recipe name the API sends for a senior plan', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [{
        ...productionQueueItem,
        flavorMix: 'Bovino · Sênior × 4, Frango · Sênior × 2',
        lineItems: [
          { flavor: 'Bovino · Sênior', flavorKey: 'senior-beef', quantity: 4, packSize: '300 g', petName: 'Thor' },
          { flavor: 'Frango · Sênior', flavorKey: 'senior-chicken', quantity: 2, packSize: '300 g', petName: 'Thor' },
        ],
      }],
    })
    renderQueue()

    expect(await screen.findByText('Bovino · Sênior × 4, Frango · Sênior × 2')).toBeInTheDocument()
    expect(screen.queryByText(/senior-beef/)).not.toBeInTheDocument()
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
    expect(document.querySelector('a[href="/users/7?aba=checkout"]')).toBeNull()
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

  it('Later delivery is short', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [{ ...productionQueueItem, stockCoverage: 'short' }],
    })
    renderQueue()

    expect(await screen.findByText('Falta estoque')).toBeInTheDocument()
    expect(screen.getByText('Falta estoque')).toHaveClass('badge-warning')
  })

  it('Ready cycle has no badge', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [{ ...productionQueueItem, productionStatus: 'ready', stockCoverage: null }],
    })
    renderQueue()

    expect(await screen.findByText('Pronto')).toBeInTheDocument()
    expect(screen.queryByText('Coberto')).not.toBeInTheDocument()
    expect(screen.queryByText('Falta estoque')).not.toBeInTheDocument()
    expect(screen.queryByText('Sem tamanho')).not.toBeInTheDocument()
  })

  it('Marked ready with too little stock', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [{ ...productionQueueItem, productionStatus: 'in_production' }],
      productionStock: { shortages: [{ flavorKey: 'frango', packSizeGrams: 300, onHand: -2 }], unsized: 0 },
    })
    renderQueue()

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como pronto' }))
    expect(await screen.findByText('Separado com estoque negativo: frango 300 g (-2).')).toBeInTheDocument()
    expect(await screen.findByText('Pronto', { selector: '.badge-success' })).toBeInTheDocument()
  })

  // admin-flow-fixes-5 (PM-09): the short badge leads to the stock screen, and ready asks first.
  it('links a short badge to the stock screen filtered by its recipe', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, {
      productionQueue: [{ ...productionQueueItem, stockCoverage: 'short', stockShortages: [{ flavorKey: 'beef', packSizeGrams: 500, recipeName: 'Bovino', missing: 2 }] }],
    })
    renderQueue()

    expect(await screen.findByRole('link', { name: 'Falta estoque' })).toHaveAttribute('href', '/operations/stock?mercado=BR&situacao=short&busca=Bovino')
  })

  it('asks before marking a short order ready and sends nothing on cancel', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      productionQueue: [{
        ...productionQueueItem,
        productionStatus: 'in_production',
        stockCoverage: 'short',
        stockShortages: [
          { flavorKey: 'beef', packSizeGrams: 500, recipeName: 'Bovino', missing: 2 },
          { flavorKey: 'turkey', packSizeGrams: 500, recipeName: 'Frango', missing: 1 },
        ],
      }],
    })
    renderQueue()

    expect(await screen.findByRole('link', { name: 'Falta estoque' })).toHaveAttribute('href', '/operations/stock?situacao=short')
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pronto' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Pela ordem da fila, falta estoque de Bovino 500 g, Frango 500 g para este pedido. Marcar como pronto pode deixar o saldo negativo.')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: 'Abrir estoque' })).toHaveAttribute('href', '/operations/stock?situacao=short')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }))
    expect(findCall(calls, 'PATCH', '/admin/production/queue/42')).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pronto' }))
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Marcar como pronto' }))
    await waitFor(() => {
      expect(findCall(calls, 'PATCH', '/admin/production/queue/42')?.body).toMatchObject({ status: 'ready' })
    })
  })

  // admin-flow-fixes-5 (PM-15): the block dialog says where the charge moves.
  it('shows the day the charge moves to when blocking an unpaid cycle', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [{ ...productionQueueItem, paymentState: 'awaiting_payment', paymentLabel: 'Aguardando pagamento' }],
      blockPreview: { charged: false, chargeMovesTo: '2026-10-04T02:00:00.000Z', preparationDay: '2026-10-03' },
    })
    renderQueue()

    fireEvent.click(within(await openRowMenu()).getByRole('menuitem', { name: 'Bloquear' }))
    // 02:00 UTC on the 4th is still the 3rd in São Paulo.
    expect(await screen.findByText('Este pedido ainda não foi cobrado. Bloquear adia a cobrança para 03/10, e reabrir pode cobrar o cliente na hora.')).toBeInTheDocument()
  })

  it('keeps the generic block text when the preview fails, and a paid cycle asks for none', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      productionQueue: [
        { ...productionQueueItem, paymentState: 'awaiting_payment', paymentLabel: 'Aguardando pagamento' },
        { ...productionQueueItem, id: 2, customerName: 'Bia', email: 'bia@edenbowls.com', paymentState: 'paid' },
      ],
      blockPreview: { status: 500, code: 'boom' },
    })
    renderQueue()

    fireEvent.click(within(await openRowMenu('Bia')).getByRole('menuitem', { name: 'Bloquear' }))
    await screen.findByRole('dialog')
    expect(calls.some((call) => call.path.includes('block-preview'))).toBe(false)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

    fireEvent.click(within(await openRowMenu('Ana Ledger')).getByRole('menuitem', { name: 'Bloquear' }))
    await waitFor(() => expect(calls.some((call) => call.path.includes('/queue/42/block-preview'))).toBe(true))
    expect(await screen.findByText('Este pedido ainda não foi cobrado. Bloquear adia a cobrança, e reabrir pode cobrar o cliente na hora.')).toBeInTheDocument()
  })

  // admin-flow-fixes-5 (PM-10): batch actions call the PATCH once per order, in order.
  it('starts the selected orders one by one and lists the one that failed', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      productionQueue: [
        { ...productionQueueItem },
        { ...productionQueueItem, id: 2, customerName: 'Bia', email: 'bia@edenbowls.com' },
        { ...productionQueueItem, id: 3, customerName: 'Caio', email: 'caio@edenbowls.com' },
        { ...productionQueueItem, id: 4, customerName: 'Duda', email: 'duda@edenbowls.com', paymentState: 'awaiting_payment', paymentLabel: 'Aguardando pagamento' },
      ],
      productionPatchFailures: { 2: 'Ciclo mudou' },
    })
    renderQueue()

    await screen.findByText('Ana Ledger')
    expect(screen.queryByRole('checkbox', { name: 'Selecionar Duda' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar todos da página' }))
    expect(screen.getByRole('button', { name: 'Marcar como pronto (0)' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar preparo (3)' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(within(dialog).getByTestId('batch-items')).getAllByRole('listitem')).toHaveLength(3)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar preparo' }))

    const result = await screen.findByTestId('batch-result')
    expect(within(result).getByText('2 pedidos atualizados.')).toBeInTheDocument()
    expect(within(result).getByText('Bia: Ciclo mudou')).toBeInTheDocument()
    const patched = calls.filter((call) => call.method === 'PATCH').map((call) => call.path.split('/').pop())
    expect(patched).toEqual(['42', '2', '3'])
  })

  it('warns about short orders before marking a batch ready', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      productionQueue: [
        { ...productionQueueItem, productionStatus: 'in_production', stockCoverage: 'short', stockShortages: [{ flavorKey: 'beef', packSizeGrams: 500, recipeName: 'Bovino', missing: 1 }] },
        { ...productionQueueItem, id: 2, customerName: 'Bia', email: 'bia@edenbowls.com', productionStatus: 'in_production', stockCoverage: 'covered' },
      ],
      productionStock: { shortages: [{ flavorKey: 'beef', packSizeGrams: 500, onHand: -1 }], unsized: 0 },
    })
    renderQueue()

    fireEvent.click(await screen.findByRole('checkbox', { name: 'Selecionar Ana Ledger' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Selecionar Bia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pronto (2)' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Pela ordem da fila, falta estoque para estes pedidos. Marcar como pronto pode deixar o saldo negativo.')).toBeInTheDocument()
    expect(within(dialog).getByText(/Falta: Bovino 500 g/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Marcar como pronto' }))

    const result = await screen.findByTestId('batch-result')
    expect(within(result).getByText('2 pedidos atualizados.')).toBeInTheDocument()
    expect(within(result).getByText(/Separado com estoque negativo: beef 500 g \(-1\)/)).toBeInTheDocument()
  })

  it('shows no selection to read-only staff', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderQueue()

    await screen.findByText('Ana Ledger')
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  // simplify-brazil-dispatch: Expedir opens Entregas Brasil on the invoice, with a range when it ships later.
  it.each([
    ['delivered tomorrow, on the default range', { deliveryDate: addDays(todayIn(COURIER_TIMEZONE), 1) }, (id: number) => `/operations/courier?fatura=in_123&assinatura=${id}`],
    ['delivered in three days, with a range that holds it', { deliveryDate: addDays(todayIn(COURIER_TIMEZONE), 3) },
      (id: number) => `/operations/courier?fatura=in_123&assinatura=${id}&de=${todayIn(COURIER_TIMEZONE)}&ate=${addDays(todayIn(COURIER_TIMEZONE), 3)}`],
    ['with no delivery date', { deliveryDate: null }, (id: number) => `/operations/courier?fatura=in_123&assinatura=${id}`],
    ['delivered past the 31-day range', { deliveryDate: addDays(todayIn(COURIER_TIMEZONE), 40) }, (id: number) => `/operations/courier?fatura=in_123&assinatura=${id}`],
    ['with no paid invoice', { paidInvoiceId: null }, () => '/operations/courier'],
  ])('a ready Brazil order %s', async (_name, extra, href) => {
    seedAuth()
    const item = { ...productionQueueItem, stripeAccount: 'br', country: 'BR', productionStatus: 'ready', stockCoverage: null, paidInvoiceId: 'in_123', ...extra }
    installAdminFetchMock(adminUser, { productionQueue: [item] })
    renderQueue()

    const row = (await screen.findByText('Ana Ledger')).closest('tr') as HTMLElement
    expect(within(row).getByRole('link', { name: 'Expedir' })).toHaveAttribute('href', href(Number(item.id)))
  })

  it.each([
    ['BR order to Entregas Brasil', { stripeAccount: 'br', country: 'BR' }, '/operations/courier'],
    ['US order to Etiquetas UPS', { stripeAccount: 'us', country: 'US' }, '/operations/labels'],
  ])('a ready %s', async (_name, market, href) => {
    seedAuth()
    installAdminFetchMock(adminUser, { productionQueue: [{ ...productionQueueItem, ...market, productionStatus: 'ready', stockCoverage: null }] })
    renderQueue()

    const row = (await screen.findByText('Ana Ledger')).closest('tr') as HTMLElement
    expect(within(row).getByRole('link', { name: 'Expedir' })).toHaveAttribute('href', href)
    expect(within(row).queryByText('Concluído')).not.toBeInTheDocument()
  })

  // keep-ready-orders-dispatchable: the address lock shows on the ready row, before anyone clicks Expedir.
  it('a ready Brazil order held by the address says why instead of Expedir', async () => {
    seedAuth()
    const item = { ...productionQueueItem, productionStatus: 'ready', stockCoverage: null, paidInvoiceId: 'in_123', deliveryDate: null, courierIssues: ['recipient_name_missing'] }
    installAdminFetchMock(adminUser, { productionQueue: [item] })
    renderQueue()

    const row = (await screen.findByText('Ana Ledger')).closest('tr') as HTMLElement
    expect(within(row).getByText('Travado: Falta o nome de quem recebe')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: 'Ver na entrega' })).toHaveAttribute('href', '/operations/courier?fatura=in_123&assinatura=42')
    expect(within(row).queryByRole('link', { name: 'Expedir' })).not.toBeInTheDocument()
  })

  it.each([
    ['an empty list', []],
    ['no field, as an older API', undefined],
  ])('a ready Brazil order with %s of courier issues keeps Expedir', async (_name, courierIssues) => {
    seedAuth()
    const item = { ...productionQueueItem, productionStatus: 'ready', stockCoverage: null, paidInvoiceId: 'in_123', deliveryDate: null, courierIssues }
    installAdminFetchMock(adminUser, { productionQueue: [item] })
    renderQueue()

    const row = (await screen.findByText('Ana Ledger')).closest('tr') as HTMLElement
    expect(within(row).getByRole('link', { name: 'Expedir' })).toBeInTheDocument()
    expect(within(row).queryByText(/^Travado/)).not.toBeInTheDocument()
  })

  it('puts the ready orders past their day in their own group above Atrasados', async () => {
    seedAuth()
    const late = { ...productionQueueItem, dueBucket: 'overdue', daysUntil: -24, dueLabel: 'Atrasado 24 dias', stockCoverage: null }
    installAdminFetchMock(adminUser, {
      productionQueue: [
        { ...late, id: 41, customerName: 'Bia Cozinha', productionStatus: 'to_prepare' },
        { ...late, id: 42, productionStatus: 'ready', paidInvoiceId: 'in_123', deliveryDate: null },
      ],
      productionMetrics: { today: 0, tomorrow: 0, upcoming: 0, overdue: 1 },
    })
    renderQueue()

    await screen.findByText('Ana Ledger')
    const groups = screen.getAllByRole('row').filter((row) => row.classList.contains('queue-group-row')).map((row) => row.textContent)
    expect(groups).toEqual(['Prontos para expedir', 'Atrasados'])
    const rows = screen.getAllByRole('row').map((row) => row.textContent || '')
    expect(rows.findIndex((text) => text.includes('Ana Ledger'))).toBeLessThan(rows.findIndex((text) => text === 'Atrasados'))
    expect(rows.findIndex((text) => text.includes('Bia Cozinha'))).toBeGreaterThan(rows.findIndex((text) => text === 'Atrasados'))
    expect(screen.getByRole('button', { name: /^Atrasados/ })).toHaveTextContent('1')
  })

  it('a late order marked ready from the overdue filter moves to Prontos para expedir', async () => {
    seedAuth()
    const late = { ...productionQueueItem, dueBucket: 'overdue', daysUntil: -24, dueLabel: 'Atrasado 24 dias', stockCoverage: null, productionStatus: 'in_production', paidInvoiceId: 'in_123', deliveryDate: null, courierIssues: [] }
    installAdminFetchMock(operatorWriteUser, { productionQueue: [late] })
    renderQueue('/operations/production?prazo=atrasados')

    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como pronto' }))
    const confirm = await screen.findByRole('dialog').catch(() => null)
    if (confirm) fireEvent.click(within(confirm).getByRole('button', { name: 'Marcar como pronto' }))

    const row = (await screen.findByRole('link', { name: 'Expedir' })).closest('tr') as HTMLElement
    expect(within(row).getByText('Ana Ledger')).toBeInTheDocument()
    expect(screen.getByText('Prontos para expedir')).toBeInTheDocument()
  })

  it('flags a ready order whose account and address are in different countries', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, { productionQueue: [{ ...productionQueueItem, stripeAccount: 'us', country: 'BR', productionStatus: 'ready', stockCoverage: null }] })
    renderQueue()

    const row = (await screen.findByText('Ana Ledger')).closest('tr') as HTMLElement
    expect(within(row).getByText('Mercado divergente')).toBeInTheDocument()
    expect(within(row).queryByRole('link', { name: 'Expedir' })).not.toBeInTheDocument()
  })

  it('links the fulfillment screens of the session markets', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderQueue()

    await screen.findByText('ana@edenbowls.com')
    expect(screen.getByRole('link', { name: 'Entregas Brasil' })).toHaveAttribute('href', '/operations/courier')
    expect(screen.queryByRole('link', { name: 'Etiquetas UPS' })).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Buscar' })).toHaveAttribute('placeholder', 'Nome ou e-mail')
  })

  it.each([
    ['awaiting payment', 'awaiting_payment', true],
    ['refused payment', 'past_due', true],
    ['paid', 'paid', false],
  ])('warns about the charge when blocking a cycle with %s', async (_name, paymentState, warns) => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { productionQueue: [{ ...productionQueueItem, paymentState }] })
    renderQueue()

    const menu = await openRowMenu()
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Bloquear' }))
    const dialog = await screen.findByRole('dialog', { name: 'Bloquear pedido' })
    if (warns) {
      expect(within(dialog).getByRole('note')).toHaveTextContent('Bloquear adia a cobrança')
    } else {
      expect(within(dialog).queryByRole('note')).not.toBeInTheDocument()
    }
  })
})
