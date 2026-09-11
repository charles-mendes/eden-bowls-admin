import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ShippingPage } from './ShippingPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ShippingPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads settings and PUTs the shipping payload', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await waitFor(() => {
      expect(screen.getByDisplayValue('CD SP')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('Settings saved.')).toBeInTheDocument()
    })

    const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/shipping/settings')
    expect(put?.authorization).toBe('Bearer access-token')
    expect(put?.body).toMatchObject({ br: { center: { name: 'CD SP' } } })
  })

  it('hides the save mutation from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await waitFor(() => {
      expect(screen.getByDisplayValue('CD SP')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
  })

  it('shows US UPS settings and tests a ZIP', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ShippingPage />, '/config/shipping')

    await waitFor(() => {
      expect(screen.getByDisplayValue('CD SP')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'United States' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Eden Bowls Warehouse')).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('94105'), '94105')
    await user.click(screen.getByRole('button', { name: 'Testar' }))

    await waitFor(() => {
      expect(screen.getByText(/18\.45 USD/)).toBeInTheDocument()
    })

    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/shipping/test')).toBe(true)
  })
})
