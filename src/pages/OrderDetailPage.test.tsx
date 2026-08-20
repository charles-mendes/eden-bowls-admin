import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrderDetailPage } from './OrderDetailPage'
import { operatorUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('OrderDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads checkout detail without a status mutation', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<OrderDetailPage />, '/orders/u-ana', '/orders/:orderId')

    await waitFor(() => {
      expect(screen.getByText(/Ana Costa/)).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'sub_123' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /status/i })).not.toBeInTheDocument()
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/onboarding/checkouts/u-ana' && call.authorization === 'Bearer access-token')).toBe(true)
  })
})
