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
  })
})
