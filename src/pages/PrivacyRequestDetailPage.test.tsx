import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivacyRequestDetailPage } from './PrivacyRequestDetailPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('PrivacyRequestDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('disables complete while identity is unverified', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Solicitação #41' })).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Concluir' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enviar verificação ao e-mail da conta' })).toBeInTheDocument()
    expect(screen.getByText(/sem verificar a identidade/i)).toBeInTheDocument()
  })

  it('hides write actions for readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Solicitação #41' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recusar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Enviar verificação ao e-mail da conta' })).not.toBeInTheDocument()
    expect(screen.getByText(/Somente leitura/)).toBeInTheDocument()
  })
})
