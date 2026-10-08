import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionDetailPage } from './SubscriptionDetailPage'
import { checkoutDetail, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { customerInvoice, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

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
    expect(screen.queryByRole('link', { name: '360' })).not.toBeInTheDocument()
  })

  it('links Cliente and 360 only when the profile is in scope', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { subscriptionInScope: true })
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Cliente' })).toHaveAttribute('href', '/users/u-ana')
    expect(screen.getByRole('link', { name: '360' })).toHaveAttribute('href', '/onboarding/sessions/u-ana')
  })

  it('keeps ledger identity as text when the profile is out of scope', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<SubscriptionDetailPage />, '/billing/subscriptions/sub-row-1', '/billing/subscriptions/:id')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.queryByRole('link', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '360' })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/users/u-ana"]')).toBeNull()
    expect(document.querySelector('a[href="/onboarding/sessions/u-ana"]')).toBeNull()
    expect(screen.getAllByText('Cliente').length).toBeGreaterThan(0)
  })

  it('creates a UPS label from a synced invoice', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
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
      && call.body?.invoice_id === 'in_test_1'
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
})
