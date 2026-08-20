import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrdersPage } from './OrdersPage'
import { operatorUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('OrdersPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads the checkout list with Bearer', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<OrdersPage />, '/orders')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.getByText('sub_123')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Mudar status/i })).not.toBeInTheDocument()
    const listCall = findCall(calls, 'GET', '/admin/onboarding/checkouts')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('page=1')
  })
})
