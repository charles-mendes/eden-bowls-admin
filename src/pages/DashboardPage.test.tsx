import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { adminUser, operatorUsUser, operatorUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('DashboardPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads onboarding metrics and catalog sync health with Bearer', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('10 / 10')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Preços Stripe no catálogo' })).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
    expect(screen.getByText(/As 10 variações do catálogo BR já têm um Price ID em BRL/)).toBeInTheDocument()
    expect(screen.getByText('Com Price Stripe')).toBeInTheDocument()
    expect(screen.getByText('Sem vínculo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver produtos' })).toHaveAttribute('href', '/catalog/products')
    expect(screen.queryByRole('heading', { name: 'Conflitos de mercado' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Mercado' })).not.toBeInTheDocument()

    expect(calls.some((call) => call.path === '/api/v1/admin/onboarding/metrics' && call.authorization === 'Bearer access-token')).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=BR') && call.search.includes('currency=BRL'))).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
  })

  it('requests US catalog health for a US operator', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUsUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('10 / 10')).toBeInTheDocument()
    })

    expect(screen.getByText(/As 10 variações do catálogo US já têm um Price ID em USD/)).toBeInTheDocument()
    expect(screen.queryByText(/Brasil/)).not.toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=US') && call.search.includes('currency=USD'))).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(false)
  })

  it('lets an admin switch catalog market and shows conflicts', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Conflitos de mercado' })).toBeInTheDocument()
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
    expect(screen.getByText('BR')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/markets/conflicts')).toBe(true)

    await user.selectOptions(screen.getByRole('combobox', { name: 'Mercado' }), 'US')

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=US') && call.search.includes('currency=USD'))).toBe(true)
    })
  })

  it('shows empty conflicts copy when the list is empty', async () => {
    seedAuth()
    installAdminFetchMock(adminUser, { marketConflicts: [] })
    renderAuthedPage(<DashboardPage />, '/dashboard')

    await waitFor(() => {
      expect(screen.getByText('Nenhum conflito perfil vs Stripe.')).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: 'Conflitos de mercado' })).toBeInTheDocument()
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
  })
})
