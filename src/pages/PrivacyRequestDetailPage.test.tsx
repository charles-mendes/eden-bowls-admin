import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PrivacyRequestDetailPage } from './PrivacyRequestDetailPage'
import { jsonResponse, operatorWriteUser, privacyRequestItem, readonlyUser } from '../test/fixtures'
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

  it('shows no read-only notice and no package on a closed correction request', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests/41' && method === 'GET'
        ? jsonResponse({ ...privacyRequestItem, type: 'correction', status: 'completed', overdue: false })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Solicitação #41' })).toBeInTheDocument()
    })
    expect(screen.queryByText(/Somente leitura/)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Pacote de dados do cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument()
  })

  it('explains the package of an e-mail access request and waits for identity before the download', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    expect(await screen.findByRole('heading', { name: 'Pacote de dados do cliente' })).toBeInTheDocument()
    expect(screen.getByText(/Baixe o PDF e envie ao cliente pelo e-mail da conta/)).toBeInTheDocument()
    expect(screen.getByText(/disponíveis depois que a identidade do cliente for confirmada/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Baixar PDF' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Baixar JSON' })).not.toBeInTheDocument()
  })

  it('tells the operator to send both files of a verified e-mail portability request', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests/41' && method === 'GET'
        ? jsonResponse({ ...privacyRequestItem, type: 'portability', identityStatus: 'verified_account_email' })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    expect(await screen.findByText(/Baixe o PDF, para o cliente ler, e o JSON, para ele levar a outra empresa/)).toBeInTheDocument()
  })

  it('offers the PDF before the JSON on a completed in-app portability request', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests/41' && method === 'GET'
        ? jsonResponse({ ...privacyRequestItem, type: 'portability', status: 'completed', channel: 'in_app', identityStatus: 'verified_session', overdue: false })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    const pdf = await screen.findByRole('button', { name: 'Baixar PDF' })
    const json = screen.getByRole('button', { name: 'Baixar JSON' })
    expect(pdf.compareDocumentPosition(json) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText(/o cliente já recebeu o PDF e o JSON por lá/)).toBeInTheDocument()
    expect(screen.getByText(/dados como estavam na conclusão/)).toBeInTheDocument()
  })

  it('downloads the PDF from the panel route', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => {
        if (path === '/api/v1/admin/privacy/requests/41' && method === 'GET') {
          return jsonResponse({ ...privacyRequestItem, status: 'completed', channel: 'in_app', identityStatus: 'verified_session', overdue: false })
        }
        if (path === '/api/v1/admin/privacy/requests/41/export/pdf' && method === 'GET') {
          return new Response('%PDF-1.3', {
            status: 200,
            headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="eden-bowls-dados-41.pdf"' },
          })
        }
        return undefined
      },
    })
    // jsdom has no object URLs; only these two are replaced, so `new URL()` keeps working.
    Object.assign(URL, { createObjectURL: vi.fn().mockReturnValue('blob:pdf'), revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    await user.click(await screen.findByRole('button', { name: 'Baixar PDF' }))

    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/privacy/requests/41/export/pdf')).toBe(true)
    expect((click.mock.instances[0] as unknown as HTMLAnchorElement).download).toBe('eden-bowls-dados-41.pdf')
  })

  it('shows the opening note written by the customer', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests/41' && method === 'GET'
        ? jsonResponse({ ...privacyRequestItem, channel: 'in_app', payload: { note: 'corrigir o sobrenome', hasPackage: false } })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    expect(await screen.findByText('Nota da abertura (cliente): corrigir o sobrenome')).toBeInTheDocument()
  })

  it('says when an operator wrote the opening note', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      routes: ({ path, method }) => (path === '/api/v1/admin/privacy/requests/41' && method === 'GET'
        ? jsonResponse({ ...privacyRequestItem, payload: { note: 'recebido por e-mail', openedBy: 7, hasPackage: false } })
        : undefined),
    })
    renderAuthedPage(<PrivacyRequestDetailPage />, '/privacy/requests/41', '/privacy/requests/:id')

    expect(await screen.findByText('Nota da abertura (operador): recebido por e-mail')).toBeInTheDocument()
  })
})
