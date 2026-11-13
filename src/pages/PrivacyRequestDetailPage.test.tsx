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

  it('explains a request outside the staff markets and shows no summary or actions', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests/41' && method === 'GET'
        ? new Response(JSON.stringify({ success: false, message: 'Not found.' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    expect(await screen.findByText('Solicitação não encontrada ou fora dos mercados do seu acesso.')).toBeInTheDocument()
    expect(screen.queryByText('Not found.')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Resumo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Recusar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Em andamento' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' })).toBeInTheDocument()
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
