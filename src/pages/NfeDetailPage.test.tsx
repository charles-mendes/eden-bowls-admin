import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NfeDetailPage } from './NfeDetailPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('NfeDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the ids, the saved payload and the DANFE link', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    expect(await screen.findByText('in_nfe_1')).toBeInTheDocument()
    expect(screen.getByText('9001')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir DANFE' })).toHaveAttribute('href', 'https://bling.example/danfe')
    expect(screen.getByText('Enviado ao Bling')).toBeInTheDocument()
  })

  it('hides the retry button from readonly', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await screen.findByText('in_nfe_1')
    expect(screen.queryByRole('button', { name: 'Nova tentativa' })).not.toBeInTheDocument()
  })

  it('lets an operator retry', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await user.click(await screen.findByRole('button', { name: 'Nova tentativa' }))
    await waitFor(() => expect(findCall(calls, 'POST', '/admin/nfe/5/retry')).toBeTruthy())
    expect(await screen.findByText('Nova tentativa na fila.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova tentativa' })).not.toBeInTheDocument()
  })
})
