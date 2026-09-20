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
    expect(document.querySelector('.badge-info')?.textContent).toBe('US')

    await user.click(screen.getByRole('button', { name: 'Sync catálogo' }))

    await waitFor(() => {
      expect(screen.getByText('Sync: queued')).toBeInTheDocument()
    })

    const sync = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/catalog/sync')
    expect(sync?.body).toEqual({ market: 'BR', currency: 'BRL' })
    expect(sync?.authorization).toBe('Bearer access-token')
  })

  it('locks the account filter to the operator market', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<BillingPage />, '/billing')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'sub_123' })).toBeInTheDocument()
    })

    const account = screen.getByLabelText('Conta')
    expect(account).toHaveValue('br')
    expect(account).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'todas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'US' })).not.toBeInTheDocument()
    expect(calls.some((call) => (
      call.method === 'GET'
      && call.path === '/api/v1/admin/billing/subscriptions'
      && call.search.includes('account=us')
    ))).toBe(false)
    expect(calls.some((call) => (
      call.method === 'GET'
      && call.path === '/api/v1/admin/billing/subscriptions'
      && call.search.includes('account=br')
    ))).toBe(true)
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
