import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionDetailPage } from './SubscriptionDetailPage'
import { addressIssue, adminUser, checkoutDetail, customerContact, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { customerInvoice, installAdminFetchMock } from '../test/mockAdminFetch'
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

    await user.click(screen.getByRole('button', { name: 'Sincronizar faturas' }))

    await waitFor(() => {
      expect(screen.getByText('Faturas sincronizadas.')).toBeInTheDocument()
    })

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

    expect(screen.queryByRole('button', { name: 'Sincronizar faturas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Checkout' })).not.toBeInTheDocument()
  })

  it('links Cliente and Checkout only when the profile is in scope', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionInScope: true })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Cliente' })).toHaveAttribute('href', '/users/u-ana')
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/users/u-ana?aba=checkout')
  })

  it('keeps ledger identity as text when the profile is out of scope', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.queryByRole('link', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Checkout' })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/users/u-ana"]')).toBeNull()
    expect(document.querySelector('a[href="/users/u-ana?aba=checkout"]')).toBeNull()
    expect(screen.getAllByText('Cliente').length).toBeGreaterThan(0)
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

    expect(await screen.findByRole('button', { name: 'Gerar etiqueta UPS' })).toBeDisabled()
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

    await user.click(await screen.findByRole('button', { name: 'Gerar etiqueta UPS' }))
    expect(await screen.findByText(/Conta e país do endereço não combinam: esta assinatura não sai por nenhum mercado/)).toBeInTheDocument()
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

    await user.click(await screen.findByRole('button', { name: 'Gerar etiqueta UPS' }))

    expect(await screen.findByRole('link', { name: '1Z999AA10123456784' })).toHaveAttribute(
      'href',
      'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    )
    expect(screen.getByText('Em trânsito')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Imprimir' }))

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

    expect(await screen.findByText('Verificar na UPS')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Anular' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fechar após conferir na UPS' }))

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
    await user.click(screen.getByRole('button', { name: 'Sincronizar faturas' }))
    await screen.findByText('Faturas sincronizadas.')

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

    await user.click(screen.getByRole('button', { name: 'Gerar etiqueta UPS' }))

    await waitFor(() => {
      expect(screen.getByText('Etiqueta UPS gerada.')).toBeInTheDocument()
    })

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

    await user.click(await screen.findByRole('button', { name: 'Sincronizar faturas' }))
    await screen.findByText('Faturas sincronizadas.')
    const section = screen.getByRole('heading', { name: 'Envio UPS' }).closest('section') as HTMLElement
    expect(within(section).queryByText('Sem etiqueta')).toBeNull()
    expect(within(section).queryByRole('button', { name: 'Gerar etiqueta UPS' })).toBeNull()
  })

  // The first purchase answers 409 (order not ready); the next one goes to the default mock and buys.
  const notReadyOnce = () => {
    let answered = false
    return ({ path, method }: { path: string; method: string }) => {
      if (answered || path !== '/api/v1/admin/billing/subscriptions/sub-row-1/shipments' || method !== 'POST') return undefined
      answered = true
      return new Response(JSON.stringify({
        message: 'Not ready',
        code: 'ups_label_needs_confirmation',
        details: { code: 'ups_label_needs_confirmation', reasons: [{ code: 'production_not_ready', production_status: 'in_production' }] },
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

    await user.click(await screen.findByRole('button', { name: 'Gerar etiqueta UPS' }))

    expect(await screen.findByText('Etiqueta UPS gerada.')).toBeInTheDocument()
    expect(confirm.mock.calls[0][0]).toContain('Este pedido ainda não está pronto. Comprar mesmo assim?')
    expect(confirm.mock.calls[0][0]).toContain('Preparo: Em preparo')
    expect(labelPosts(calls).map((call) => call.body)).toEqual([{ invoice_id: 'in_test_1' }, { invoice_id: 'in_test_1', confirm_not_ready: true }])
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

    await user.click(await screen.findByRole('button', { name: 'Gerar etiqueta UPS' }))

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

  it('lists Eden Bowls invoices with when and to whom each was sent', async () => {
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

    expect(screen.getByRole('heading', { name: 'Invoices Eden Bowls' })).toBeInTheDocument()
    expect(screen.getByText('Enviada')).toHaveClass('badge-success')
    expect(screen.getByText(/para ana@edenbowls\.com/)).toBeInTheDocument()
    expect(screen.getByText('Falhou')).toHaveClass('badge-error')
    expect(screen.getByText(/connection refused · 2 tentativa\(s\), nova tentativa/)).toBeInTheDocument()
    expect(screen.getAllByText('$144.50', { selector: 'td' })).toHaveLength(2)
  })

  it('resends an invoice and downloads its PDF', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    const createObjectURL = vi.fn(() => 'blob:invoice')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('EB-2026-000418')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Reenviar' }))
    await waitFor(() => {
      expect(screen.getByText('Invoice EB-2026-000418 enviada para ana@edenbowls.com.')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Baixar PDF' }))
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled()
    })

    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/billing/customer-invoices/12/send')).toBe(true)
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/billing/customer-invoices/12/pdf')).toBe(true)
  })

  it('generates the invoice of a paid Stripe invoice that has none yet', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { customerInvoices: [] })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('Nenhuma invoice gerada ainda.')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Sincronizar faturas' }))
    await user.click(await screen.findByRole('button', { name: 'Gerar invoice' }))

    await waitFor(() => {
      expect(screen.getByText('Invoice gerada. Use "Enviar ao cliente" para mandar por e-mail.')).toBeInTheDocument()
    })
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

  it('shows catalog line items and keeps raw JSON collapsed', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
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
    installAdminFetchMock(operatorWriteUser, {
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
    installAdminFetchMock(operatorWriteUser, {
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

  it('lists the NF-e of the subscription apart from the EB invoices', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const section = (await screen.findByRole('heading', { name: 'Notas fiscais (NF-e)' })).closest('section') as HTMLElement
    await waitFor(() => expect(within(section).getByRole('link', { name: '158 / 1' })).toHaveAttribute('href', '/operations/nfe/5'))
    expect(section).not.toHaveTextContent('EB-')
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
    expect(dialog.getByLabelText('Custo (R$)')).toBeVisible()
    await user.click(dialog.getByRole('button', { name: 'Registrar saída' }))

    await waitFor(() => expect(calls.find((call) => call.method === 'POST' && call.path.endsWith('/sub-row-1/courier-deliveries'))?.body).toEqual({ invoice_id: 'in_br_2', method: 'uber' }))
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

    await user.click(await screen.findByRole('button', { name: 'Sincronizar faturas' }))
    await user.click(await screen.findByRole('button', { name: 'PDF Stripe' }))

    await waitFor(() => expect(open).toHaveBeenCalledWith('https://pay.stripe.com/invoice/pdf', '_blank', 'noopener,noreferrer'))
    const pdf = calls.find((call) => call.path === '/api/v1/admin/billing/invoices/in_test_1/pdf')
    expect(pdf?.search).toMatch(/^\?account=(br|us)$/)
  })
})
