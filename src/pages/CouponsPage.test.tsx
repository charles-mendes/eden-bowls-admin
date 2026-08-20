import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CouponsPage } from './CouponsPage'
import { operatorWriteUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('CouponsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads mapped slots from the database and syncs with Stripe', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    await waitFor(() => {
      expect(screen.getByDisplayValue('promo_1m')).toBeInTheDocument()
    })

    expect(screen.getByText('FIRST_1M')).toBeInTheDocument()
    expect(screen.getByText('coupon_1')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('once')).toBeInTheDocument()
    expect(screen.getByText('Não expira')).toBeInTheDocument()
    expect(screen.queryByText(/Slots também definidos via env/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sincronizar com Stripe' }))

    await waitFor(() => {
      expect(screen.getByText('Slots sincronizados com a Stripe.')).toBeInTheDocument()
    })

    const sync = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/stripe/first-purchase-promos/sync')
    expect(sync?.authorization).toBe('Bearer access-token')
  })

  it('saves the promo map with PUT', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<CouponsPage />, '/billing/coupons')

    await waitFor(() => {
      expect(screen.getByDisplayValue('promo_1m')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Salvar mapa' }))

    await waitFor(() => {
      expect(screen.getByText('Mapa salvo no banco.')).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/stripe/first-purchase-promos')
    expect(put?.body).toMatchObject({ 1: 'promo_1m', 3: 'promo_3m', 6: 'promo_6m' })
  })
})
