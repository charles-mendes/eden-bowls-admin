import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedbacksPage } from './FeedbacksPage'
import { operatorUser, operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('FeedbacksPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads feedbacks without country or status filters', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<FeedbacksPage />, '/feedbacks')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'João Silva' })).toBeInTheDocument()
    })

    const listCall = findCall(calls, 'GET', '/admin/feedbacks')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('page=1')
    expect(listCall?.search).not.toContain('country=')
    expect(listCall?.search).not.toContain('active=')
    expect(screen.getByRole('combobox', { name: 'País' })).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Novo feedback' })).not.toBeInTheDocument()
  })

  it('filters by Brazil and shows write actions for operators', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<FeedbacksPage />, '/feedbacks')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'João Silva' })).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'País' }), 'BR')

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.path.includes('/admin/feedbacks') && call.search.includes('country=BR'))).toBe(true)
    })
    expect(screen.getByRole('link', { name: 'Novo feedback' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Editar feedback João Silva' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir feedback João Silva' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
  })
})
