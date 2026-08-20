import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from './DashboardPage'
import { operatorUser } from '../test/fixtures'
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

    expect(calls.some((call) => call.path === '/api/v1/admin/onboarding/metrics' && call.authorization === 'Bearer access-token')).toBe(true)
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/sync/health' && call.search.includes('market=BR'))).toBe(true)
  })
})
