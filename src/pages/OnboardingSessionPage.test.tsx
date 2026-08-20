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
      expect(screen.getByText(/Luna/)).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Ver cliente' })).toHaveAttribute('href', '/users/u-ana')
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/onboarding/checkouts/u-ana')).toBe(true)
  })
})
