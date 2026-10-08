import { screen, waitFor } from '@testing-library/react'
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

  it('loads subscriptions and leaves catalog sync to the products page', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<BillingPage />, '/billing')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'sub_123' })).toBeInTheDocument()
    expect(screen.queryByText('Webhooks Stripe')).not.toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/billing/webhooks')).toBe(false)
    expect(document.querySelector('.badge-info')?.textContent).toBe('US')

    expect(screen.queryByRole('button', { name: 'Sincronizar catálogo' })).not.toBeInTheDocument()
    expect(screen.getByText('Manutenção da Stripe')).toBeInTheDocument()
  })

  it('locks the account filter to the operator market', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<BillingPage />, '/billing')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
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
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Sincronizar catálogo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Vincular ao usuário' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizar agora' })).not.toBeInTheDocument()
  })
})
