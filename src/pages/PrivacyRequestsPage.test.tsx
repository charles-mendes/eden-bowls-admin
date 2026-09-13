import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivacyRequestsPage } from './PrivacyRequestsPage'
import { operatorUser, operatorWriteUser, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('PrivacyRequestsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads DSAR queue with overdue badge and hides writes for readonly', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })

    const listCall = findCall(calls, 'GET', '/admin/privacy/requests')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(document.querySelector('.badge-warning')?.textContent).toBe('Atrasado')
    expect(screen.getByRole('link', { name: 'Ver solicitação 41' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir solicitação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Tratar solicitação 41' })).not.toBeInTheDocument()
  })

  it('filters overdue items and shows write actions for operators', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Atrasado' }), 'true')

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.path.includes('/admin/privacy/requests') && call.search.includes('overdue=true'))).toBe(true)
    })
    expect(screen.getByRole('button', { name: 'Abrir solicitação' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tratar solicitação 41' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir solicitação' })).toBeEnabled()
  })

  it('does not show the create form to read-only operators', async () => {
    seedAuth()
    installAdminFetchMock(operatorUser)
    renderAuthedPage(<PrivacyRequestsPage />, '/privacy/requests')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: '#41' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Abrir solicitação' })).not.toBeInTheDocument()
  })
})
