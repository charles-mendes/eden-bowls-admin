import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OnboardingSessionPage } from './OnboardingSessionPage'
import { operatorUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('OnboardingSessionPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads the 360 checkout detail by user id', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<OnboardingSessionPage />, '/onboarding/sessions/u-ana', '/onboarding/sessions/:id')

    await waitFor(() => {
      expect(screen.getByText('Cliente já possui compra anterior')).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Ver cliente' })).toHaveAttribute('href', '/users/u-ana')
    expect(screen.getByText('Não elegível')).toBeInTheDocument()
    expect(screen.getByText('Rua Aristeu de Castro Fernandes, 941')).toBeInTheDocument()
    expect(screen.getByText('Entrega Eden Bowl')).toBeInTheDocument()
    expect(screen.getByText('Bovino × 5, Peixe × 5')).toBeInTheDocument()
    expect(screen.getByText('Pago')).toBeInTheDocument()
    expect(screen.queryByText('HAS_PREVIOUS_PURCHASE')).not.toBeInTheDocument()
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(true)
  })
})
