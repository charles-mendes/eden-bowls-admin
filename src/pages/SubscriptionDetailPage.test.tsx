import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SubscriptionDetailPage } from './SubscriptionDetailPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
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

    expect(screen.getByText('US')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver no Stripe' })).toHaveAttribute('href', 'https://dashboard.stripe.com/sub_123')

    await user.click(screen.getByRole('button', { name: 'Sincronizar invoices' }))

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

    expect(screen.queryByRole('button', { name: 'Sincronizar invoices' })).not.toBeInTheDocument()
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

    await user.click(screen.getByRole('button', { name: 'Sincronizar invoices' }))

    await waitFor(() => {
      expect(screen.getByText('INV-1001')).toBeInTheDocument()
    })

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
})
