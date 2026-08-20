import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'
import { operatorUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('OnboardingPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads the onboarding checkout list and metrics', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<OnboardingPage />, '/onboarding/sessions')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.getByText('sub_123')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.getByText('A cada 4 semanas')).toBeInTheDocument()
    expect(findCall(calls, 'GET', '/admin/onboarding/checkouts')?.authorization).toBe('Bearer access-token')
    expect(calls.some((call) => call.path === '/api/v1/admin/onboarding/metrics')).toBe(true)
  })

  it('exports CSV with the browser timezone', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)

    renderAuthedPage(<OnboardingPage />, '/onboarding/sessions')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

    await waitFor(() => {
      const csvCall = calls.find((call) => call.path === '/api/v1/admin/onboarding/checkouts.csv')
      expect(csvCall?.search).toContain('timezone=')
    })
  })
})
