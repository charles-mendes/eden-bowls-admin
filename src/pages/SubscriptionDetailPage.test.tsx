import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionDetailPage } from './SubscriptionDetailPage'
import { adminUser, checkoutDetail, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { customerInvoice, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const printLabel = vi.hoisted(() => vi.fn())
vi.mock('../lib/printLabel', () => ({ printLabel }))

describe('SubscriptionDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
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
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      subscriptionMarket: 'US',
      labelIssues: [{ code: 'address_incomplete' }, { code: 'ship_from_missing' }],
    })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    const warning = await screen.findByRole('alert', { name: 'Etiqueta bloqueada' })
    expect(warning).toHaveTextContent('Falta rua, cidade, estado ou ZIP')
    expect(within(warning).getByRole('link', { name: 'Abrir configuração de frete' })).toHaveAttribute('href', '/config/shipping')

    await user.click(screen.getByRole('button', { name: 'Sincronizar faturas' }))

    expect(await screen.findByRole('button', { name: 'Gerar etiqueta UPS' })).toBeDisabled()
    expect(calls.some((call) => call.method === 'POST' && call.path.endsWith('/shipments'))).toBe(false)
  })

  it('prints the label and links the tracking with its status', async () => {
    const user = userEvent.setup()
    seedAuth()
    printLabel.mockReset().mockResolvedValue(undefined)
    installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US' })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: 'Sincronizar faturas' }))
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

  it('creates a UPS label from a synced invoice', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { subscriptionMarket: 'US' })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Sincronizar faturas' }))

    await waitFor(() => {
      expect(screen.getAllByText('INV-1001').length).toBeGreaterThan(0)
    })
    expect(screen.getByText('Sem etiqueta')).toBeInTheDocument()

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
