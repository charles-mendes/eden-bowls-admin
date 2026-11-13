import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionDetailPage } from './SubscriptionDetailPage'
import { addressIssue, adminUser, checkoutDetail, customerContact, operatorUsWriteUser, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { customerInvoice, installAdminFetchMock, nfeSummary } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const printLabel = vi.hoisted(() => vi.fn())
vi.mock('../lib/printLabel', () => ({ printLabel }))

const cycle = (invoiceId: string, extra: Record<string, unknown> = {}) => ({
  invoice_id: invoiceId,
  preparation_day: '2026-11-03',
  production_status: 'ready',
  delivery_date: '2026-11-05',
  paid_at: '2026-11-01T12:00:00.000Z',
  ups_shipment: null,
  courier_delivery: null,
  ...extra,
})

const sectionOf = async (name: string) => (await screen.findByRole('heading', { name })).closest('section') as HTMLElement

describe('SubscriptionDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('warns when the subscription ships from no market', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { marketException: true })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    expect(await screen.findByText(/Conta e país do endereço não combinam/)).toBeInTheDocument()
  })

  it('shows an open address problem with the email state and Registrar contato, and no address field', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { addressIssue })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Problema de endereço' })).closest('section') as HTMLElement
    expect(within(section).getByText('Falta o bairro')).toBeInTheDocument()
    expect(within(section).getByText('E-mail enviado em 03/11')).toBeInTheDocument()
    expect(within(section).getByText('Origem: Despacho recusado')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Registrar contato' })).toBeInTheDocument()
    expect(within(section).queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByText(/Conta e país do endereço não combinam/)).not.toBeInTheDocument()
  })

  it('shows a problem the customer fixed', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { addressIssue: { ...addressIssue, open: false, resolved_by: 'customer', resolved_at: '2026-11-05T13:00:00.000Z' } })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    expect(await screen.findByText('Cliente corrigiu em 05/11')).toBeInTheDocument()
    expect(screen.queryByText('Falta o bairro')).not.toBeInTheDocument()
  })

  // close-address-issues-when-subscription-ends
  it('shows a problem closed because the subscription ended', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { addressIssue: { ...addressIssue, open: false, resolved_by: 'ended', resolved_at: '2026-11-05T13:00:00.000Z' } })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    expect(await screen.findByText('Assinatura encerrada em 05/11')).toBeInTheDocument()
    expect(screen.queryByText(/Substituído/)).not.toBeInTheDocument()
  })

  it('shows a problem an operator fixed', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { addressIssue: { ...addressIssue, open: false, resolved_by: 'operator', resolved_at: '2026-11-05T13:00:00.000Z' } })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    expect(await screen.findByText('Operador corrigiu em 05/11')).toBeInTheDocument()
    expect(screen.queryByText(/Substituído/)).not.toBeInTheDocument()
  })

  it('has no address problem section without a problem', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await screen.findByText('ana@edenbowls.com')
    expect(screen.queryByRole('heading', { name: 'Problema de endereço' })).not.toBeInTheDocument()
  })

  it('loads subscription detail and POSTs invoice sync', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Detalhes do produto' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Desconto 1ª compra' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pagamento' })).not.toBeInTheDocument()
    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver no Stripe' })).toHaveAttribute('href', 'https://dashboard.stripe.com/sub_123')

    await user.click(screen.getByRole('button', { name: 'Buscar na Stripe' }))

    const charges = await sectionOf('Cobranças')
    expect(await within(charges).findByText('Faturas da Stripe carregadas.')).toBeInTheDocument()
    // Stripe's amount comes in minor units.
    expect(within(charges).getByText('$89.50')).toBeInTheDocument()

    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/billing/subscriptions/sub-row-1')).toBe(true)
    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/billing/subscriptions/sub-row-1/sync-invoices' && call.authorization === 'Bearer access-token')).toBe(true)
  })

  it('hides invoice sync from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Buscar na Stripe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir cadastro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver checkout' })).not.toBeInTheDocument()
  })

  it('links the account and the checkout only when the profile is in scope', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionInScope: true })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Abrir cadastro' })).toHaveAttribute('href', '/users/u-ana')
    expect(screen.getByRole('link', { name: 'Ver checkout' })).toHaveAttribute('href', '/users/u-ana?aba=checkout&assinatura=sub-row-1')
  })

  it('keeps ledger identity as text when the profile is out of scope', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.queryByRole('link', { name: 'Abrir cadastro' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver checkout' })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/users/u-ana"]')).toBeNull()
    expect(document.querySelector('a[href="/users/u-ana?aba=checkout&assinatura=sub-row-1"]')).toBeNull()
    expect(screen.getByText('Cadastro e checkout fora do seu mercado')).toBeInTheDocument()
  })

  it('warns about what blocks the label and disables the button before the click', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'US',
      labelIssues: [{ code: 'address_incomplete' }, { code: 'ship_from_missing' }],
      paidCycles: [cycle('in_test_1')],
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const warning = await screen.findByRole('alert', { name: 'Etiqueta bloqueada' })
    expect(warning).toHaveTextContent('Falta rua, cidade, estado ou ZIP')
    expect(within(warning).getByRole('link', { name: 'Abrir configuração de frete' })).toHaveAttribute('href', '/config/shipping?aba=sede&mercado=us')

    expect(await within(await sectionOf('Envio UPS')).findByRole('button', { name: 'Gerar etiqueta UPS' })).toBeDisabled()
    expect(within(await sectionOf('Ciclo atual')).getByRole('button', { name: 'Gerar etiqueta UPS' })).toBeDisabled()
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/shipments'))).toBe(false)
  })

  it('a single purchase refused as a market exception says so and lists no label', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'US',
      paidCycles: [cycle('in_test_1')],
      routes: ({ path, method }) => (/\/shipments$/.test(path) && method === 'POST'
        ? new Response(JSON.stringify({ message: 'Crossed', code: 'shipment_market_exception', details: { code: 'shipment_market_exception' } }), { status: 422, headers: { 'Content-Type': 'application/json' } })
        : undefined),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const ups = await sectionOf('Envio UPS')
    await user.click(await within(ups).findByRole('button', { name: 'Gerar etiqueta UPS' }))
    expect(await within(ups).findByText(/Conta e país do endereço não combinam: esta assinatura não sai por nenhum mercado/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '1Z999AA10123456784' })).not.toBeInTheDocument()
  })

  it('names a market exception among the label issues', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US', labelIssues: [{ code: 'shipment_market_exception' }], paidCycles: [cycle('in_test_1')] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const warning = await screen.findByRole('alert', { name: 'Etiqueta bloqueada' })
    expect(warning).toHaveTextContent('Conta e país do endereço não combinam')
  })

  it('prints the label and links the tracking with its status', async () => {
    const user = userEvent.setup()
    seedAuth()
    printLabel.mockReset().mockResolvedValue(undefined)
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US', paidCycles: [cycle('in_test_1')] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const ups = await sectionOf('Envio UPS')
    await user.click(await within(ups).findByRole('button', { name: 'Gerar etiqueta UPS' }))

    expect(await within(ups).findByRole('link', { name: '1Z999AA10123456784' })).toHaveAttribute(
      'href',
      'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    )
    expect(within(ups).getByText('Em trânsito')).toBeInTheDocument()

    await user.click(within(ups).getByRole('button', { name: 'Imprimir' }))

    await waitFor(() => expect(printLabel).toHaveBeenCalledTimes(1))
    expect(printLabel.mock.calls[0][0].size).toBeGreaterThan(0)
  })

  const shipmentRow = (extra: Record<string, unknown>) => ({
    id: 'ship_1', subscription_id: 'sub-row-1', stripe_invoice_id: 'in_test_1', ups_shipment_id: null, tracking_number: null,
    tracking_url: null, tracking_status: null, tracking_description: null, delivered_at: null, service_code: null, label_format: null,
    has_label: false, quoted_shipping_cost: 12.9, ups_monetary_value: null, status: 'unknown', shipped_at: null,
    created_at: '2026-08-02T12:00:00.000Z', updated_at: '2026-08-02T12:00:00.000Z', ...extra,
  })
  const withShipments = (items: unknown[]) => ({
    subscriptionMarket: 'US',
    routes: ({ path, method }: { path: string; method: string }) => (
      /\/admin\/billing\/subscriptions\/[^/]+\/shipments$/.test(path) && method === 'GET'
        ? new Response(JSON.stringify({ success: true, data: { items, label_issues: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : undefined
    ),
  })

  it('asks before voiding a created label, and voids nothing when the operator cancels', async () => {
    const user = userEvent.setup()
    seedAuth()
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    vi.stubGlobal('confirm', confirm)
    const { calls } = installAdminFetchMock(operatorWriteUser, withShipments([shipmentRow({ status: 'created', ups_shipment_id: '1Z9', tracking_number: '1Z9', has_label: true })]))
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await user.click(await screen.findByRole('button', { name: 'Anular' }))
    expect(calls.some((call) => call.path.endsWith('/void'))).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Anular' }))
    await waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/shipments/ship_1/void')).toBe(true))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(calls.find((call) => call.path.endsWith('/void'))?.body).toBeFalsy()
  })

  it('Closing an unresolved row: shows it and closes only after the operator confirms UPS has no label', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    const { calls } = installAdminFetchMock(operatorWriteUser, withShipments([shipmentRow({ status: 'unknown' })]))
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const ups = await sectionOf('Envio UPS')
    expect(await within(ups).findByText('Verificar na UPS')).toBeInTheDocument()
    expect(within(ups).queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
    await user.click(within(ups).getByRole('button', { name: 'Fechar após conferir na UPS' }))

    await waitFor(() => {
      const call = calls.find((item) => item.method === 'POST' && item.path === '/api/v1/admin/shipments/ship_1/void')
      expect(call?.body).toEqual({ confirm_not_created: true })
    })
  })

  it('shows no UPS option on a Brazilian delivery', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'BR' })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Buscar na Stripe' }))
    await screen.findByText('Faturas da Stripe carregadas.')

    expect(screen.queryByRole('heading', { name: 'Envio UPS' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Gerar etiqueta UPS' })).toBeNull()
  })

  it('lists a ready paid cycle as waiting for a label before any sync, and buys it', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US', paidCycles: [cycle('in_test_1')] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Envio UPS' })).closest('section') as HTMLElement
    expect(await within(section).findByText('Sem etiqueta')).toBeInTheDocument()
    expect(within(section).getByText('Preparo 03/11/2026 · Pronto · entrega 05/11/2026')).toBeInTheDocument()
    expect(calls.some((call) => call.path.endsWith('/sync-invoices'))).toBe(false)

    await user.click(within(section).getByRole('button', { name: 'Gerar etiqueta UPS' }))

    // The result shows in the section where the label was bought.
    expect(await within(section).findByText('Etiqueta UPS gerada.')).toBeInTheDocument()

    expect(calls.some((call) => (
      call.method === 'POST'
      && call.path === '/api/v1/admin/billing/subscriptions/sub-row-1/shipments'
      && (call.body as { invoice_id?: string } | null)?.invoice_id === 'in_test_1'
    ))).toBe(true)
  })

  it('does not list a paid invoice with no cycle as waiting for a label', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US', paidCycles: [] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await user.click(await screen.findByRole('button', { name: 'Buscar na Stripe' }))
    await screen.findByText('Faturas da Stripe carregadas.')
    const section = screen.getByRole('heading', { name: 'Envio UPS' }).closest('section') as HTMLElement
    expect(within(section).queryByText('Sem etiqueta')).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Gerar etiqueta UPS' })).toBeNull()
  })

  // The first purchase answers 409 (order not ready); the next one goes to the default mock and buys.
  const notReadyOnce = (reasons: unknown[] = [{ code: 'production_not_ready', production_status: 'in_production' }]) => {
    let answered = false
    return ({ path, method }: { path: string; method: string }) => {
      if (answered || path !== '/api/v1/admin/billing/subscriptions/sub-row-1/shipments' || method !== 'POST') return undefined
      answered = true
      return new Response(JSON.stringify({
        message: 'Not ready',
        code: 'ups_label_needs_confirmation',
        details: { code: 'ups_label_needs_confirmation', reasons },
      }), { status: 409, headers: { 'Content-Type': 'application/json' } })
    }
  }
  const labelPosts = (calls: Array<{ method: string; path: string; body?: unknown }>) => calls.filter((call) => call.method === 'POST' && call.path.endsWith('/shipments'))

  it('asks before buying a label for an order not ready, and buys only after the confirmation', async () => {
    const user = userEvent.setup()
    seedAuth()
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'US',
      paidCycles: [cycle('in_test_1', { production_status: 'in_production' })],
      routes: notReadyOnce(),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await user.click(await within(await sectionOf('Envio UPS')).findByRole('button', { name: 'Gerar etiqueta UPS' }))

    expect(await screen.findByText('Etiqueta UPS gerada.')).toBeInTheDocument()
    const question = confirm.mock.calls[0][0] as string
    expect(question.startsWith('Pedido ainda não está pronto.')).toBe(true)
    expect(question).toContain('- Preparo: Em preparo')
    expect(question.endsWith('Comprar mesmo assim?')).toBe(true)
    expect(labelPosts(calls).map((call) => call.body)).toEqual([{ invoice_id: 'in_test_1' }, { invoice_id: 'in_test_1', confirm_not_ready: true }])
  })

  // explain-hold-reason-and-overdue: the question opens with the reason, or the label's generic title.
  it.each([
    ['a canceled subscription', [{ code: 'subscription_not_active', subscription_status: 'canceled' }], 'Assinatura cancelada.', ['- Assinatura: Cancelada']],
    ['two reasons', [{ code: 'production_not_ready', production_status: 'in_production' }, { code: 'subscription_not_active', subscription_status: 'canceled' }], 'Confirme antes de comprar a etiqueta.', ['- Preparo: Em preparo', '- Assinatura: Cancelada']],
  ])('opens the label question with its reason: %s', async (_case, reasons, title, lines) => {
    const user = userEvent.setup()
    seedAuth()
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'US',
      paidCycles: [cycle('in_test_1', { production_status: 'in_production' })],
      routes: notReadyOnce(reasons),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await user.click(await within(await sectionOf('Envio UPS')).findByRole('button', { name: 'Gerar etiqueta UPS' }))

    await waitFor(() => expect(confirm).toHaveBeenCalled())
    const question = confirm.mock.calls[0][0] as string
    expect(question.startsWith(title)).toBe(true)
    expect(question).not.toContain('Pedido ainda não está pronto')
    lines.forEach((line) => expect(question).toContain(line))
    expect(question.endsWith('Comprar mesmo assim?')).toBe(true)
  })

  it('buys nothing when the operator does not confirm an order not ready', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false))
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'US',
      paidCycles: [cycle('in_test_1', { production_status: 'in_production' })],
      routes: notReadyOnce(),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await user.click(await within(await sectionOf('Envio UPS')).findByRole('button', { name: 'Gerar etiqueta UPS' }))

    await waitFor(() => expect(labelPosts(calls)).toHaveLength(1))
    expect(screen.queryByText('Etiqueta UPS gerada.')).toBeNull()
  })

  it('shows the contact history newest first and records a contact with the phone', async () => {
    const user = userEvent.setup()
    seedAuth()
    const older = { ...customerContact, id: 1, reason: 'late', outcome: 'resolved', note: null, created_at: '2026-10-01T12:00:00.000Z' }
    const newer = { ...customerContact, id: 2, created_at: '2026-10-06T17:05:00.000Z' }
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      contacts: [newer, older],
      subscriptionSnapshot: { address: { phone: '(41) 99890-5819' } },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Contatos com o cliente' })).closest('section') as HTMLElement
    const rows = await within(section).findAllByRole('listitem')
    expect(rows.map((row) => row.querySelector('strong')?.textContent)).toEqual(['Pagamento recusado · Sem resposta', 'Atraso · Resolvido'])
    expect(within(rows[0]).getByText('Mandei o link do cartão')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/por ops@edenbowls.com/)).toBeInTheDocument()

    await user.click(within(section).getByRole('button', { name: 'Registrar contato' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Registrar contato' }))
    expect(dialog.getByText('(41) 99890-5819')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Copiar telefone' })).toBeInTheDocument()
    await user.selectOptions(dialog.getByLabelText('Motivo'), 'address')
    await user.click(dialog.getByLabelText('Resolvido'))
    await user.click(dialog.getByRole('button', { name: 'Salvar contato' }))

    await waitFor(() => expect(within(section).getAllByRole('listitem')).toHaveLength(3))
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent('Endereço · Resolvido')
    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/billing/subscriptions/sub-row-1/contacts')).toBe(true)
  })

  it('shows the contact history to a readonly user without Registrar contato', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser, { contacts: [customerContact] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Contatos com o cliente' })).closest('section') as HTMLElement
    expect(await within(section).findByText('Pagamento recusado · Sem resposta')).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Registrar contato' })).toBeNull()
  })

  it('lists each charge with its Eden Bowls invoice, when and to whom it was sent', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      customerInvoices: [
        { ...customerInvoice },
        {
          ...customerInvoice,
          id: 13,
          invoice_number: 'EB-2026-000419',
          stripe_invoice_id: 'in_test_2',
          email_status: 'failed',
          email_sent_at: null,
          email_attempts: 2,
          email_last_error: 'connection refused',
          email_next_attempt_at: '2026-09-01T16:00:00.000Z',
        },
      ],
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('EB-2026-000418')).toBeInTheDocument()
    })

    const charges = await sectionOf('Cobranças')
    expect(within(charges).getByText('Enviada')).toHaveClass('badge-success')
    expect(within(charges).getByText(/para ana@edenbowls\.com/)).toBeInTheDocument()
    expect(within(charges).getByText('Falhou')).toHaveClass('badge-error')
    expect(within(charges).getByText(/connection refused · 2 tentativa\(s\), nova tentativa/)).toBeInTheDocument()
    expect(within(charges).getAllByText('$144.50', { selector: 'td' })).toHaveLength(2)
    // One row per Stripe invoice, with the Stripe id as secondary text and the Stripe PDF.
    expect(within(charges).getByText('in_test_0')).toHaveClass('muted')
    expect(within(charges).getAllByRole('button', { name: 'PDF Stripe' }).length).toBeGreaterThanOrEqual(2)
  })

  it('resends an invoice after the confirmation, reports it in the charges, and downloads its PDF', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    const createObjectURL = vi.fn(() => 'blob:invoice')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('EB-2026-000418')).toBeInTheDocument()
    })

    const charges = await sectionOf('Cobranças')
    await user.click(within(charges).getByRole('button', { name: 'Reenviar' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Reenviar invoice ao cliente?' }))
    expect(dialog.getByText('EB-2026-000418')).toBeInTheDocument()
    expect(dialog.getByText('ana@edenbowls.com')).toBeInTheDocument()
    await user.click(dialog.getByRole('button', { name: 'Reenviar' }))

    expect(await within(charges).findByText('Invoice EB-2026-000418 enviada para ana@edenbowls.com.')).toBeInTheDocument()
    await user.click(within(charges).getByRole('button', { name: 'Baixar PDF' }))
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled()
    })

    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/billing/customer-invoices/12/send')).toBe(true)
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/billing/customer-invoices/12/pdf')).toBe(true)
  })

  it('cancelling the confirmation sends nothing', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const charges = await sectionOf('Cobranças')
    await user.click(await within(charges).findByRole('button', { name: 'Reenviar' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Reenviar invoice ao cliente?' })).getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(calls.some((call) => call.path.endsWith('/send'))).toBe(false)
    expect(within(charges).getByText('Enviada')).toBeInTheDocument()
  })

  it('generates the invoice of a paid cycle without fetching from Stripe first', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { customerInvoices: [], paidCycles: [cycle('in_test_1')] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const charges = await sectionOf('Cobranças')
    const row = (await within(charges).findByText('in_test_1')).closest('tr') as HTMLElement
    expect(within(row).getByText('Sem invoice')).toBeInTheDocument()
    await user.click(within(row).getByRole('button', { name: 'Gerar invoice' }))

    expect(await within(charges).findByText('Invoice gerada. Use "Enviar ao cliente" para mandar por e-mail.')).toBeInTheDocument()
    expect(calls.some((call) => call.path.endsWith('/sync-invoices'))).toBe(false)
    expect(calls.some((call) => (
      call.method === 'POST'
      && call.path === '/api/v1/admin/billing/subscriptions/sub-row-1/customer-invoices'
      && (call.body as { stripe_invoice_id?: string } | null)?.stripe_invoice_id === 'in_test_1'
    ))).toBe(true)
  })

  it('readonly accounts can download but not send or generate invoices', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('EB-2026-000418')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Baixar PDF' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reenviar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar ao cliente' })).not.toBeInTheDocument()
  })

  // The raw JSON is for the admin: Brazil and US operators see only the readable sections.
  it.each([
    ['Brazil', 'BR', operatorWriteUser],
    ['US', 'US', operatorUsWriteUser],
  ])('a %s operator sees the readable snapshot without the technical JSON', async (_market, subscriptionMarket, profile) => {
    seedAuth()
    installAdminFetchMock(profile, {
      subscriptionMarket,
      subscriptionSnapshot: {
        petsSnapshot: { pets: [{ id: 'pet-1', name: 'Luna' }] },
        planSelection: checkoutDetail.planSelection,
        address: checkoutDetail.address,
        shipping: checkoutDetail.shipping,
      },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    expect(await screen.findByRole('heading', { name: 'Detalhes do produto' })).toBeInTheDocument()
    expect(screen.getByText('Entrega Eden Bowl')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'JSON técnico' })).not.toBeInTheDocument()
    expect(screen.queryByText('JSON de recorrência')).not.toBeInTheDocument()
    expect(document.querySelector('.json-details')).toBeNull()
  })

  it('shows catalog line items and keeps raw JSON collapsed', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, {
      subscriptionSnapshot: {
        petsSnapshot: { pets: [{ id: 'pet-1', name: 'Luna' }] },
        planSelection: checkoutDetail.planSelection,
        address: checkoutDetail.address,
        shipping: checkoutDetail.shipping,
      },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Detalhes do produto' })).toBeInTheDocument()
    })

    expect(screen.getByRole('columnheader', { name: 'Unitário' })).toBeInTheDocument()
    expect(screen.getAllByText('500 g').length).toBeGreaterThan(0)
    expect(screen.getByText(/45,00/)).toBeInTheDocument()
    expect(screen.getByText('Rua Aristeu de Castro Fernandes, 941')).toBeInTheDocument()
    expect(screen.getByText('Entrega Eden Bowl')).toBeInTheDocument()
    // The end of the page adds the products and the freight saved at checkout.
    const total = screen.getByRole('heading', { name: 'Total' }).closest('section') as HTMLElement
    expect(within(total).getByText('Produtos').nextElementSibling).toHaveTextContent(/R\$\s550,00/)
    expect(within(total).getByText('Frete').nextElementSibling).toHaveTextContent(/R\$\s7,00/)
    expect(within(total).getByText('Total (produtos + frete)').nextElementSibling).toHaveTextContent(/R\$\s557,00/)
    expect(screen.queryByRole('heading', { name: 'Desconto 1ª compra' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pagamento' })).not.toBeInTheDocument()
    expect(screen.queryByText(/selected_flavors/)).not.toBeInTheDocument()

    await user.click(screen.getByText('Plano'))

    await waitFor(() => {
      expect(screen.getByText(/selected_flavors/)).toBeInTheDocument()
    })
  })

  it('shows the flavor mix without a line-item table', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, {
      subscriptionSnapshot: {
        petsSnapshot: {
          pets: [{ id: 'pet-1', name: 'luna' }],
          pet_ids: ['pet-1'],
          pets_names: ['luna'],
        },
        planSelection: {
          pets: [{
            pet_id: 'pet-1',
            pet_name: 'luna',
            enabled: true,
            flavor_weights: [5, 5],
            selected_flavors: ['beef', 'fish'],
          }],
        },
        address: { city: 'Pinhais' },
        shipping: { label: 'Entrega Eden Bowl', cost: 0.57 },
      },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('beef × 5, fish × 5')).toBeInTheDocument()
    })

    expect(screen.getByText('luna')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Unitário' })).not.toBeInTheDocument()
    expect(screen.queryByText(/selected_flavors/)).not.toBeInTheDocument()

    await user.click(screen.getByText('Plano'))

    await waitFor(() => {
      expect(screen.getByText(/selected_flavors/)).toBeInTheDocument()
    })
  })

  it('stays readable when the address has no lines and freight is absent', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser, {
      subscriptionSnapshot: {
        petsSnapshot: { pets: [{ id: 'pet-1', name: 'luna' }] },
        planSelection: {
          pets: [{ pet_id: 'pet-1', pet_name: 'luna', selected_flavors: ['beef'], flavor_weights: [5] }],
        },
        address: { phone: '' },
        shipping: null,
      },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('Sem endereço na cópia gravada.')).toBeInTheDocument()
    })

    expect(screen.getByText('beef × 5')).toBeInTheDocument()
    expect(screen.queryByText('Custo')).not.toBeInTheDocument()
    expect(screen.queryByText(/flavor_weights/)).not.toBeInTheDocument()

    await user.click(screen.getByText('Plano'))

    await waitFor(() => {
      expect(screen.getByText(/flavor_weights/)).toBeInTheDocument()
    })
  })

  it('puts the NF-e on the row of its Stripe invoice, next to the Eden Bowls invoice', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser, {
      routes: ({ path, method }) => (/\/subscriptions\/[^/]+\/nfe$/.test(path) && method === 'GET'
        ? new Response(JSON.stringify({ success: true, data: { items: [{ ...nfeSummary, stripe_invoice_id: 'in_test_0' }] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : undefined),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const charges = await sectionOf('Cobranças')
    const link = await within(charges).findByRole('link', { name: 'Nota 158 / 1' })
    expect(link).toHaveAttribute('href', '/operations/nfe/5')
    expect(link.closest('tr')).toHaveTextContent('EB-2026-000418')
  })

  it('an NF-e from an older API, without its invoice, still gets a row', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const charges = await sectionOf('Cobranças')
    expect(await within(charges).findByRole('link', { name: 'Nota 158 / 1' })).toHaveAttribute('href', '/operations/nfe/5')
  })

  it('names the second Eden Bowls invoice of the same Stripe invoice in the same row', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      customerInvoices: [
        { ...customerInvoice },
        { ...customerInvoice, id: 13, invoice_number: 'EB-2026-000419', stripe_account: 'br', locale: 'pt-BR' },
      ],
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const charges = await sectionOf('Cobranças')
    const other = await within(charges).findByText(/Também emitida como EB-2026-000419 \(conta BR\)/)
    expect(other.closest('tr')).toHaveTextContent('EB-2026-000418')
    expect(within(charges).getByRole('button', { name: 'Baixar EB-2026-000419' })).toBeInTheDocument()
  })
})

describe('SubscriptionDetailPage courier section', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const courier = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
    id, subscription_id: 'sub-row-1', stripe_invoice_id: 'in_br_1', method: 'motoboy', courier_name: 'Carlos', tracking_url: null,
    cost_minor: 1200, currency: 'brl', note: null, status, out_for_delivery_at: '2026-11-03T12:00:00.000Z',
    delivered_at: null, failed_at: null, failure_reason: null, canceled_at: null, ...extra,
  })

  it('Brazil subscription with a failed attempt: both deliveries, the reason, the recipient and no UPS', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      routes: ({ path, method }) => (path === '/api/v1/admin/billing/subscriptions/sub-row-1/courier-deliveries' && method === 'GET'
        ? json({
          success: true,
          data: {
            recipient_name: 'João Lima',
            items: [
              courier(2, 'delivered', { delivered_at: '2026-11-04T15:00:00.000Z' }),
              courier(1, 'failed', { failed_at: '2026-11-03T16:00:00.000Z', failure_reason: 'Ninguém em casa' }),
            ],
          },
        })
        : undefined),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    expect(await within(section).findByText('João Lima')).toBeInTheDocument()
    expect(within(section).getByText('Entregue')).toBeInTheDocument()
    expect(within(section).getByText('Falhou')).toBeInTheDocument()
    expect(within(section).getByText('Motivo: Ninguém em casa')).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Entregue' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Envio UPS' })).toBeNull()
  })

  it('lists a paid cycle waiting for the courier before any sync, and not one already on the road', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      paidCycles: [
        cycle('in_br_2'),
        cycle('in_br_1', { courier_delivery: { id: 1, status: 'out_for_delivery', out_for_delivery_at: '2026-11-03T12:00:00.000Z', delivered_at: null, failed_at: null } }),
      ],
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    expect(await within(section).findByText('in_br_2')).toBeInTheDocument()
    expect(within(section).getAllByText('A despachar')).toHaveLength(1)
    expect(within(section).queryByText('in_br_1')).toBeNull()
    expect(within(section).getByRole('button', { name: 'Despachar' })).toBeInTheDocument()
  })

  it('dispatching from the subscription shows the checkout freight and leaves the courier cost empty', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      paidCycles: [cycle('in_br_2')],
      subscriptionSnapshot: { shipping: { label: 'Entrega Eden Bowl', cost: 18.5, distance: 12.4, quote_token: 'tok' } },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    await user.click(await within(section).findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    const summary = dialog.getByRole('region', { name: 'Frete cobrado do cliente' })
    expect(summary).toHaveTextContent(/R\$\s18,50/)
    expect(summary).toHaveTextContent('12,4 km')
    expect(summary).toHaveTextContent('Despachar não altera o que o cliente paga.')
    expect(dialog.getByLabelText('Custo do entregador (R$) (Opcional)')).toHaveValue('')
  })

  // simplify-brazil-dispatch: the subscription opens the same dialog, so a new Uber dispatch is the short form.
  it('dispatches from the subscription with the short Uber form, sending only the method', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      paidCycles: [cycle('in_br_2')],
      routes: ({ path, method }) => (path === '/api/v1/admin/billing/subscriptions/sub-row-1/courier-deliveries' && method === 'POST'
        ? json({ success: true, data: { delivery: courier(3, 'out_for_delivery', { stripe_invoice_id: 'in_br_2', method: 'uber' }) } })
        : undefined),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    await user.click(await within(section).findByRole('button', { name: 'Despachar' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Despachar entrega' }))
    expect((dialog.getByText('Detalhes').closest('details') as HTMLDetailsElement).open).toBe(false)
    expect(dialog.getByLabelText('Custo do entregador (R$) (Opcional)')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Registrar saída' }))

    await waitFor(() => expect(calls.find((call) => call.method === 'POST' && call.path.endsWith('/sub-row-1/courier-deliveries'))?.body).toEqual({ invoice_id: 'in_br_2', method: 'uber' }))
  })

  // keep-ready-orders-dispatchable: the address lock shows before the dialog, as on Entregas Brasil.
  it('greys out Despachar and says what the address lacks when the dispatch would be refused', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      paidCycles: [cycle('in_br_2')],
      subscriptionSnapshot: { courier_issues: ['recipient_name_missing'] },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    const button = await within(section).findByRole('button', { name: 'Despachar' })
    expect(button).toBeDisabled()
    expect(within(section).getByText('Travado: Falta o nome de quem recebe')).toBeInTheDocument()
    expect(button).toHaveAccessibleDescription('Travado: Falta o nome de quem recebe')
    await user.click(button)
    expect(screen.queryByRole('dialog', { name: 'Despachar entrega' })).toBeNull()
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/courier-deliveries'))).toBe(false)
  })

  // operator-fills-recipient-name: the recipient is filled here and the subscription reloads.
  it('fills the missing recipient and Despachar comes back', async () => {
    const user = userEvent.setup()
    seedAuth()
    const snapshot: { courier_issues: string[]; account_name: string | null } = { courier_issues: ['recipient_name_missing'], account_name: 'Ana Costa' }
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      paidCycles: [cycle('in_br_2')],
      subscriptionSnapshot: snapshot,
      routes: ({ path, method }: { path: string; method: string }) => {
        if (path === '/api/v1/admin/billing/subscriptions/sub-row-1/recipient-name' && method === 'PATCH') {
          snapshot.courier_issues = []
          return new Response(JSON.stringify({ success: true, data: { subscription_id: 'sub-row-1', recipient_name: 'Ana Costa', courier_issues: [] } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        }
        return undefined
      },
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    expect(await within(section).findByRole('button', { name: 'Despachar' })).toBeDisabled()
    await user.click(within(section).getByRole('button', { name: 'Informar quem recebe' }))
    const dialog = screen.getByRole('dialog', { name: 'Informar quem recebe' })
    await user.click(within(dialog).getByRole('button', { name: 'Usar nome da conta (Ana Costa)' }))
    await user.click(within(dialog).getByRole('button', { name: 'Salvar nome' }))
    expect(await screen.findByText('Nome de quem recebe salvo: Ana Costa.')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/recipient-name'))?.body).toEqual({ recipient_name: 'Ana Costa' })
    await waitFor(() => expect(within(section).getByRole('button', { name: 'Despachar' })).toBeEnabled())
    expect(within(section).queryByRole('button', { name: 'Informar quem recebe' })).not.toBeInTheDocument()
  })

  it.each([['an empty lock', { courier_issues: [] }], ['an older API without the field', {}]])('keeps Despachar with %s', async (_name, snapshot) => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'BR', paidCycles: [cycle('in_br_2')], subscriptionSnapshot: snapshot })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Entrega Brasil' })).closest('section') as HTMLElement
    await user.click(await within(section).findByRole('button', { name: 'Despachar' }))
    expect(await screen.findByRole('dialog', { name: 'Despachar entrega' })).toBeInTheDocument()
    expect(within(section).queryByText(/^Travado/)).toBeNull()
  })

  it('a US subscription shows no courier section', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US' })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await screen.findByText('ana@edenbowls.com')
    expect(screen.queryByRole('heading', { name: 'Entrega Brasil' })).toBeNull()
    expect(calls.some((call) => call.path.endsWith('/courier-deliveries'))).toBe(false)
  })

  it('sends the customer to the store for a missing recipient, without the customer link', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US', subscriptionInScope: true, labelIssues: [{ code: 'recipient_name_missing' }] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const warning = await screen.findByRole('alert', { name: 'Etiqueta bloqueada' })
    expect(warning).toHaveTextContent('Falta o nome de quem recebe na assinatura')
    expect(warning).toHaveTextContent('Meu Plano')
    expect(warning).toHaveTextContent('WhatsApp')
    expect(warning).not.toHaveTextContent('você preenche o nome da conta')
    expect(within(warning).queryByRole('link', { name: 'Abrir cliente' })).not.toBeInTheDocument()
  })

  it('asks the Stripe PDF with the subscription account', async () => {
    const user = userEvent.setup()
    seedAuth()
    const open = vi.fn()
    vi.stubGlobal('open', open)
    const { calls } = installAdminFetchMock(adminUser, {
      routes: ({ path, method }) => (/\/admin\/billing\/invoices\/[^/]+\/pdf$/.test(path) && method === 'GET'
        ? new Response(JSON.stringify({ url: 'https://pay.stripe.com/invoice/pdf' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : undefined),
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await user.click(await screen.findByRole('button', { name: 'Buscar na Stripe' }))
    const row = (await screen.findByText(/INV-1001/)).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'PDF Stripe' }))

    await waitFor(() => expect(open).toHaveBeenCalledWith('https://pay.stripe.com/invoice/pdf', '_blank', 'noopener,noreferrer'))
    const pdf = calls.find((call) => call.path === '/api/v1/admin/billing/invoices/in_test_1/pdf')
    expect(pdf?.search).toMatch(/^\?account=(br|us)$/)
  })

  it('scrolls to the section named in the link hash once the subscription loads', async () => {
    seedAuth()
    const scrolled: string[] = []
    // jsdom has no scrollIntoView: define it for this test only.
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      value: function (this: Element) { scrolled.push(this.id) },
    })
    try {
      installAdminFetchMock(adminUser)
      renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1#faturas-stripe', '/billing/subscriptions/:id')

      await waitFor(() => expect(scrolled).toContain('faturas-stripe'))
      expect(document.getElementById('faturas-stripe')).toHaveTextContent('Cobranças')
    } finally {
      delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
    }
  })
  // delivery-instructions: the subscription shows its own text or the profile text at the same place.
  describe('delivery instructions', () => {
    it('shows the profile text with its source and writes the subscription text', async () => {
      const user = userEvent.setup()
      seedAuth()
      const snapshot: Record<string, unknown> = { delivery_instructions: 'Interfone 12', delivery_instructions_source: 'profile' }
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        subscriptionMarket: 'BR',
        subscriptionSnapshot: snapshot,
        routes: ({ path, method }: { path: string; method: string }) => {
          if (path.endsWith('/delivery-instructions') && method === 'PATCH') {
            snapshot.delivery_instructions = 'Portão lateral'
            snapshot.delivery_instructions_source = 'subscription'
            return undefined
          }
          return undefined
        },
      })
      renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

      const section = (await screen.findByRole('heading', { name: 'Instruções de entrega' })).closest('section') as HTMLElement
      expect(within(section).getByText('Interfone 12')).toBeInTheDocument()
      expect(within(section).getByText('(do perfil, mesmo endereço)')).toBeInTheDocument()
      await user.click(within(section).getByRole('button', { name: 'Escrever instruções' }))
      const input = within(section).getByLabelText('Instruções desta assinatura')
      expect(input).toHaveValue('')
      await user.type(input, '  Portão   lateral ')
      expect(within(section).getByTestId('subscription-instructions-counter')).toHaveTextContent('14/200')
      await user.click(within(section).getByRole('button', { name: 'Salvar instruções' }))
      expect(await screen.findByText('Instruções da assinatura salvas.')).toBeInTheDocument()
      expect(calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/delivery-instructions'))?.body).toEqual({ delivery_instructions: 'Portão lateral' })
      expect(await within(section).findByText('(da assinatura)')).toBeInTheDocument()
    })

    it('blocks more than 200 characters, counting an emoji as one', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        subscriptionSnapshot: { delivery_instructions: null, delivery_instructions_source: null },
      })
      renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

      const section = (await screen.findByRole('heading', { name: 'Instruções de entrega' })).closest('section') as HTMLElement
      expect(within(section).getByText('Sem instruções.')).toBeInTheDocument()
      await user.click(within(section).getByRole('button', { name: 'Escrever instruções' }))
      const input = within(section).getByLabelText('Instruções desta assinatura')
      await user.click(input)
      await user.paste(`${'a'.repeat(199)}🐶`)
      expect(within(section).getByTestId('subscription-instructions-counter')).toHaveTextContent('200/200')
      await user.paste('b')
      await user.click(within(section).getByRole('button', { name: 'Salvar instruções' }))
      expect(within(section).getByRole('alert')).toHaveTextContent('Use no máximo 200 caracteres, em uma linha.')
      expect(calls.some((call) => call.method === 'PATCH' && call.path.endsWith('/delivery-instructions'))).toBe(false)
    })

    it('shows the text without the form to a user without users.delivery.write', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, {
        subscriptionSnapshot: { delivery_instructions: 'Leave at back door', delivery_instructions_source: 'subscription' },
      })
      renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

      const section = (await screen.findByRole('heading', { name: 'Instruções de entrega' })).closest('section') as HTMLElement
      expect(within(section).getByText('Leave at back door')).toBeInTheDocument()
      expect(within(section).queryByRole('button', { name: /instruções/ })).toBeNull()
    })

    it('hides the section on an older API or a profile outside the market', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

      expect(await screen.findByRole('heading', { name: 'Cobranças' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Instruções de entrega' })).toBeNull()
    })
  })
})

// subscription-detail-workflow: the header, the current cycle, what needs attention and the Brazil delivery.
describe('SubscriptionDetailPage workflow', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const open = (path: string) => renderAuthedPage(<SubscriptionDetailPage />, path, '/billing/subscriptions/:id')
  const page = '/billing/subscriptions/sub-row-1'
  const courierRow = (id: number, status: string, extra: Record<string, unknown> = {}) => ({
    id, subscription_id: 'sub-row-1', stripe_invoice_id: 'in_br_1', method: 'uber', courier_name: null, tracking_url: null,
    cost_minor: 1000, currency: 'brl', note: null, status, out_for_delivery_at: '2026-11-03T12:00:00.000Z',
    delivered_at: null, failed_at: null, failure_reason: null, canceled_at: null, ...extra,
  })
  const ups = (extra: Record<string, unknown>) => ({
    id: 'ship_1', subscription_id: 'sub-row-1', stripe_invoice_id: 'in_test_1', ups_shipment_id: '1Z9', tracking_number: '1Z999',
    tracking_url: null, tracking_status: null, tracking_description: null, delivered_at: null, service_code: '03', label_format: 'GIF',
    has_label: true, quoted_shipping_cost: 12.9, ups_monetary_value: 14.2, status: 'created', shipped_at: null,
    created_at: '2026-08-02T12:00:00.000Z', updated_at: '2026-08-02T12:00:00.000Z', ...extra,
  })
  const courierRoute = (items: unknown[]) => ({ path, method }: { path: string; method: string }) => (
    path === '/api/v1/admin/billing/subscriptions/sub-row-1/courier-deliveries' && method === 'GET'
      ? json({ success: true, data: { recipient_name: 'Charles Mendes', items } })
      : undefined
  )

  describe('header', () => {
    it('titles the page with the account name, the email and the state below, and the renewal as a day', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { subscriptionSnapshot: { account_name: 'Ana Souza' }, subscriptionOverrides: { currentPeriodEnd: '2026-12-02T15:00:00.000Z' } })
      open(page)

      expect(await screen.findByRole('heading', { level: 2, name: 'Ana Souza' })).toBeInTheDocument()
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
      expect(screen.getByText('renova em 02/12/2026')).toBeInTheDocument()
      expect(document.querySelector('.subscription-header-line')?.textContent).not.toMatch(/\d{2}:\d{2}/)
      expect(screen.getByText('Pausa e cancelamento são feitos pelo cliente na loja.')).toBeInTheDocument()
    })

    it('titles the page with the email when the API gives no name', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      open(page)

      expect(await screen.findByRole('heading', { level: 2, name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    it('says when a subscription cancelling at period end ends', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { subscriptionOverrides: { cancelAtPeriodEnd: true, currentPeriodEnd: '2026-12-02T15:00:00.000Z' } })
      open(page)

      expect(await screen.findByText('termina em 02/12/2026')).toBeInTheDocument()
      expect(screen.queryByText(/renova em/)).toBeNull()
    })

    it('describes a fallback plan label from the checkout copy and keeps the Stripe ids as secondary text', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        subscriptionOverrides: { planLabel: 'Plan #6' },
        subscriptionSnapshot: {
          planSelection: {
            subscription_term_months: 1,
            pets: [{ pet_id: 'pet-1', pet_name: 'chocolate', selected_flavors: ['beef'], flavor_weights: [1] }],
            catalog_pricing: { currency: 'BRL', subtotal: 1327.5, discounted_first_month_total: 1327.5, line_items: [{ flavor: 'beef', pet_name: 'chocolate', quantity: 30, unit_price: 44.25, line_total: 1327.5, pack_size_label: '500 g' }] },
          },
        },
      })
      open(page)

      expect(await screen.findByText('Plano de 1 mês · 1 pet (chocolate) · 30 pacotes')).toBeInTheDocument()
      expect(screen.queryByText('Plan #6')).toBeNull()
      expect(screen.getByText(/price_1/)).toHaveClass('muted')
      // Equal totals: only the subtotal stays.
      expect(screen.getByText('Subtotal do plano')).toBeInTheDocument()
      expect(screen.queryByText('1ª fatura (plano)')).toBeNull()
    })
  })

  describe('current cycle', () => {
    it('a Brazil order out for delivery shows Em rota and the delivery actions', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        subscriptionMarket: 'BR',
        paidCycles: [cycle('in_br_1', { courier_delivery: { id: 1, status: 'out_for_delivery', out_for_delivery_at: '2026-11-03T12:00:00.000Z', delivered_at: null, failed_at: null } })],
        routes: courierRoute([courierRow(1, 'out_for_delivery')]),
      })
      open(page)

      const card = await sectionOf('Ciclo atual')
      expect(await within(card).findByText('Em rota')).toHaveClass('badge-info')
      expect(await within(card).findByRole('button', { name: 'Entregue' })).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Falhou' })).toBeInTheDocument()
    })

    it('the oldest cycle on the road wins over a newer paid one, and the card counts the other', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        subscriptionMarket: 'BR',
        paidCycles: [
          cycle('in_br_2', { production_status: 'to_prepare', delivery_date: '2026-12-05' }),
          cycle('in_br_1', { courier_delivery: { id: 1, status: 'out_for_delivery', out_for_delivery_at: '2026-11-03T12:00:00.000Z', delivered_at: null, failed_at: null } }),
        ],
        routes: courierRoute([courierRow(1, 'out_for_delivery')]),
      })
      open(page)

      const card = await sectionOf('Ciclo atual')
      expect(await within(card).findByText('Em rota')).toBeInTheDocument()
      expect(within(card).getByText('Mais 1 ciclo pago esperando.')).toBeInTheDocument()
    })

    it('a UPS box in transit shows the tracking and Atualizar rastreio', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        subscriptionMarket: 'US',
        paidCycles: [cycle('in_test_1', { ups_shipment: { id: 'ship_1', status: 'created', tracking_number: '1Z999' } })],
        routes: ({ path, method }) => (/\/subscriptions\/[^/]+\/shipments$/.test(path) && method === 'GET'
          ? json({ success: true, data: { items: [ups({ tracking_status: 'in_transit' })], label_issues: [] } })
          : undefined),
      })
      open(page)

      const card = await sectionOf('Ciclo atual')
      expect(await within(card).findByText('Em trânsito')).toBeInTheDocument()
      expect(within(card).getByText(/Rastreio 1Z999/)).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'Atualizar rastreio' })).toBeInTheDocument()
    })

    it('blocked production links to the production queue', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'BR', paidCycles: [cycle('in_br_1', { production_status: 'blocked' })] })
      open(page)

      const card = await sectionOf('Ciclo atual')
      expect(await within(card).findByText('Produção bloqueada')).toBeInTheDocument()
      expect(within(card).getByRole('link', { name: 'Abrir fila de produção' })).toHaveAttribute('href', '/operations/production')
    })

    it('a reader without shipping write sees the stage and no action', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, { subscriptionMarket: 'BR', paidCycles: [cycle('in_br_1')] })
      open(page)

      const card = await sectionOf('Ciclo atual')
      expect(await within(card).findByText('Pronto para sair')).toBeInTheDocument()
      expect(within(card).queryByRole('button')).toBeNull()
    })

    it('a reader without shipping access gets no card and the page still loads', async () => {
      seedAuth()
      installAdminFetchMock({ ...readonlyUser, permissions: readonlyUser.permissions.filter((permission: string) => !permission.startsWith('shipping.')) }, { paidCycles: [cycle('in_test_1')] })
      open(page)

      expect(await screen.findByRole('heading', { name: 'Cobranças' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Ciclo atual' })).toBeNull()
    })
  })

  describe('what needs attention', () => {
    const nfeRoute = (item: Record<string, unknown>) => ({ path, method }: { path: string; method: string }) => (
      /\/subscriptions\/[^/]+\/nfe$/.test(path) && method === 'GET' ? json({ success: true, data: { items: [{ ...nfeSummary, ...item }] } }) : undefined
    )

    it('a note blocked for a missing fiscal name says so and links to the note', async () => {
      seedAuth()
      installAdminFetchMock(adminUser, { routes: nfeRoute({ status: 'blocked_missing_document', missing_fields: ['fiscal_name'] }) })
      open(page)

      const block = await sectionOf('Precisa de atenção')
      expect(await within(block).findByText('Falta para emitir: Nome fiscal.')).toBeInTheDocument()
      expect(within(block).getByRole('link', { name: 'Abrir a nota' })).toHaveAttribute('href', '/operations/nfe/5')
    })

    it('a note Bling refused lists the fields Bling named', async () => {
      seedAuth()
      installAdminFetchMock(adminUser, { routes: nfeRoute({ status: 'error', bling_problems: [{ element: 'contato.telefone', message: 'Informe o telefone' }] }) })
      open(page)

      const block = await sectionOf('Precisa de atenção')
      expect(await within(block).findByText('Informe o telefone (Dados do cliente)')).toBeInTheDocument()
      expect(within(block).queryByText('Escopo ausente')).toBeNull()
    })

    it('an open address problem links to its section, which keeps the contact', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { addressIssue })
      open(page)

      const block = await sectionOf('Precisa de atenção')
      expect(within(block).getByRole('link', { name: 'Ver o problema de endereço' })).toHaveAttribute('href', '#problema-endereco')
      const section = document.getElementById('problema-endereco') as HTMLElement
      expect(within(section).getByRole('button', { name: 'Registrar contato' })).toBeInTheDocument()
    })

    it('a closed address problem is not listed', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { addressIssue: { ...addressIssue, open: false, resolved_by: 'customer', resolved_at: '2026-11-05T13:00:00.000Z' } })
      open(page)

      expect(await screen.findByText('Cliente corrigiu em 05/11')).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Precisa de atenção' })).toBeNull()
    })

    it('the account and country mismatch shows once, as an entry linking to market exceptions', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { marketException: true })
      open(page)

      const block = await sectionOf('Precisa de atenção')
      expect(screen.getAllByText(/Conta e país do endereço não combinam/)).toHaveLength(1)
      expect(within(block).getByRole('link', { name: 'Abrir Exceções de mercado' })).toHaveAttribute('href', '/operations/market-exceptions')
    })

    it('nothing open, no block', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      open(page)

      expect(await screen.findByRole('heading', { name: 'Cobranças' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Precisa de atenção' })).toBeNull()
    })
  })

  it('the Brazil delivery shows the charged freight next to the courier cost, and the phone next to the recipient', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'BR',
      subscriptionSnapshot: { shipping: { label: 'Entrega Eden Bowl', cost: 2.47 }, address: { phone: '(41) 99890-5819' } },
      routes: courierRoute([courierRow(1, 'delivered', { delivered_at: '2026-11-04T15:00:00.000Z' })]),
    })
    open(page)

    const section = await sectionOf('Entrega Brasil')
    expect(await within(section).findByText(/Frete cobrado no checkout: R\$\s2,47/)).toBeInTheDocument()
    expect(within(section).getByText(/R\$\s10,00/)).toBeInTheDocument()
    expect(within(section).getByText('Telefone (41) 99890-5819')).toBeInTheDocument()
  })
})
