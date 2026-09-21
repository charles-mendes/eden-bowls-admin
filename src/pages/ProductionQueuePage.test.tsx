import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductionQueuePage } from './ProductionQueuePage'
import { operatorWriteUser, readonlyUser, WRITE_PERMISSIONS } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ProductionQueuePage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads KPIs and a due row', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductionQueuePage />, '/operations/production')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Vence hoje').length).toBeGreaterThan(0)
    expect(screen.getByText('Ana Ledger')).toBeInTheDocument()
    expect(screen.queryByText('WordPress Name')).not.toBeInTheDocument()
    expect(screen.getByText('beef × 2, turkey × 1')).toBeInTheDocument()
    expect(screen.getByText('1 mês')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Em produção' })).toBeInTheDocument()
    const listCall = findCall(calls, 'GET', '/admin/production/queue')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('includeOverdue=true')
    expect(listCall?.search).toContain('account=br')
    expect(listCall?.search).not.toContain('account=us')
    const account = screen.getByLabelText('Conta')
    expect(account).toHaveValue('br')
    expect(account).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'todas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'US' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cliente' })).toHaveAttribute('href', '/users/7')
    expect(screen.getByRole('link', { name: 'Onboarding 360' })).toHaveAttribute('href', '/onboarding/sessions/7')
  })

  it('hides status buttons for readonly users', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<ProductionQueuePage />, '/operations/production')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Em produção' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bloquear' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Assinante' })).toBeInTheDocument()
  })

  it('shows empty copy when the window has no rows', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductionQueuePage />, '/operations/production')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Status de produção' }), { target: { value: 'ready' } })

    await waitFor(() => {
      expect(screen.getByText('Nenhuma renovação nesta janela.')).toBeInTheDocument()
    })
  })

  it('shows out-of-scope identity without profile links', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { productionInScope: false })
    renderAuthedPage(<ProductionQueuePage />, '/operations/production')

    await waitFor(() => {
      expect(screen.getByText('ana@edenbowls.com')).toBeInTheDocument()
    })

    expect(screen.getByText('Ana Ledger')).toBeInTheDocument()
    expect(screen.queryByText('WordPress Name')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Onboarding 360' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Assinante' })).not.toBeInTheDocument()
    expect(document.querySelector('a[href="/users/7"]')).toBeNull()
    expect(document.querySelector('a[href="/onboarding/sessions/7"]')).toBeNull()
  })
  it('mirrors production permissions on write fixtures', () => {
    expect(WRITE_PERMISSIONS).toContain('production.read')
    expect(WRITE_PERMISSIONS).toContain('production.write')
    expect(readonlyUser.permissions).toContain('production.read')
    expect(readonlyUser.permissions).not.toContain('production.write')
  })
})
