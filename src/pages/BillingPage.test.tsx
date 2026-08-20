import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BillingPage } from './BillingPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('BillingPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads subscriptions and POSTs catalog sync', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<BillingPage />, '/billing')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'sub_123' })).toBeInTheDocument()
    })

    expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    expect(screen.getByText('evt_1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sync catálogo' }))

    await waitFor(() => {
      expect(screen.getByText('Sync: queued')).toBeInTheDocument()
    })

    const sync = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/catalog/sync')
    expect(sync?.body).toEqual({ market: 'BR', currency: 'BRL' })
    expect(sync?.authorization).toBe('Bearer access-token')
  })

  it('hides billing mutations from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<BillingPage />, '/billing')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'sub_123' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Sync catálogo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular ao usuário' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).not.toBeInTheDocument()
  })
})
