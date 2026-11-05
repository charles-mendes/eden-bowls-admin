import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NfeDetailPage } from './NfeDetailPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock, nfeDetailState } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('NfeDetailPage', () => {
  afterEach(() => {
    nfeDetailState.override = {}
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows why the email failed and sends it again after confirmation', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    nfeDetailState.override = { status: 'authorized', imported: false, can_resend_email: true, email_status: 'failed', email_last_error: 'smtp down', customer_email: 'ana@example.com' }
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    expect(await screen.findByText('Falhou')).toBeInTheDocument()
    expect(screen.getByText('smtp down')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Enviar e-mail' }))

    expect(await screen.findByText('E-mail na fila de envio.')).toBeInTheDocument()
    expect(findCall(calls, 'POST', '/admin/nfe/5/email')).toBeTruthy()
  })

  it('asks before repeating an email already sent and hides the action from read-only accounts', async () => {
    const user = userEvent.setup()
    seedAuth()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    nfeDetailState.override = { status: 'authorized', imported: false, can_resend_email: true, email_status: 'sent', email_to: 'ana@example.com' }
    const { calls } = installAdminFetchMock(operatorWriteUser)
    const { unmount } = renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await user.click(await screen.findByRole('button', { name: 'Reenviar e-mail' }))
    expect(confirm).toHaveBeenCalled()
    expect(findCall(calls, 'POST', '/admin/nfe/5/email')).toBeUndefined()
    unmount()

    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')
    expect(await screen.findByText('Enviado')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reenviar e-mail' })).not.toBeInTheDocument()
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

  it('leads back to the list and leaves out fields with nothing in them', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await screen.findByText('in_nfe_1')
    expect(screen.getByRole('link', { name: 'Notas fiscais' })).toHaveAttribute('href', '/operations/nfe')
    expect(screen.queryByText('Protocolo')).not.toBeInTheDocument()
    expect(screen.queryByText('Autorizada em')).not.toBeInTheDocument()
  })

  it('copies the access key', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
    await user.click(await screen.findByRole('button', { name: 'Copiar chave de acesso' }))
    expect(writeText).toHaveBeenCalledWith('35251234')
    expect(await screen.findByText('Copiado')).toBeInTheDocument()
  })

  it('says why a note created in Bling cannot be sent from here', async () => {
    nfeDetailState.override = { imported: true, can_retry: false, access_key: null, stripe_invoice_id: 'bling:9003' }
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    expect(await screen.findByText(/criada direto no Bling/)).toBeInTheDocument()
    expect(screen.getByText(/aparecem depois que a SEFAZ autoriza/)).toBeInTheDocument()
    expect(screen.queryByText('bling:9003')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nova tentativa' })).not.toBeInTheDocument()
  })

  it('opens the note in Bling', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    const link = await screen.findByRole('link', { name: 'Abrir no Bling' })
    expect(link).toHaveAttribute('href', 'https://www.bling.com.br/notas.fiscais.php#edit/9003')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('has no Bling link before the note exists there', async () => {
    nfeDetailState.override = { bling_nfe_id: null }
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await screen.findByText('in_nfe_1')
    expect(screen.queryByRole('link', { name: 'Abrir no Bling' })).not.toBeInTheDocument()
  })

  it('says what can only be done in Bling', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    const notice = await screen.findByRole('region', { name: 'Ações feitas no Bling' })
    expect(notice).toHaveTextContent('Cancelar uma nota autorizada')
    expect(notice).toHaveTextContent('Emitir carta de correção')
    expect(notice).toHaveTextContent('Inutilizar numeração')
    expect(notice).toHaveTextContent('Alterar dados de uma nota autorizada')
  })

  it('offers no way to delete a note', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await screen.findByText('in_nfe_1')
    expect(screen.queryByRole('button', { name: /excluir|apagar|remover/i })).not.toBeInTheDocument()
  })

  it('lets an operator correct the customer and explains the next step', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await user.click(await screen.findByRole('button', { name: 'Corrigir dados' }))
    const name = screen.getByRole('textbox', { name: 'Nome' })
    expect(name).toHaveValue('Ana Souza')
    await user.clear(name)
    await user.type(name, 'Ana Correta')
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Muda só esta nota')
    const saveButton = within(dialog).getAllByRole('button', { name: 'Salvar' }).at(-1) as HTMLElement
    // Without a reason nothing is sent.
    expect(saveButton).toBeDisabled()
    await user.type(within(dialog).getByRole('textbox', { name: 'Motivo' }), 'Nome digitado errado no checkout')
    await user.click(saveButton)

    await waitFor(() => expect(findCall(calls, 'PATCH', '/admin/nfe/5/customer')).toBeTruthy())
    const call = findCall(calls, 'PATCH', '/admin/nfe/5/customer')
    expect(call?.body).toMatchObject({ name: 'Ana Correta', document: '52998224725', address: { street: 'Rua A', city: 'São Paulo' }, reason: 'Nome digitado errado no checkout' })
    expect(await screen.findByText(/Use Nova tentativa/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it.each([
    ['readonly', readonlyUser, {}],
    ['a note that can no longer change', operatorWriteUser, { can_edit: false }],
  ])('hides the correction from %s', async (_name, profile, override) => {
    nfeDetailState.override = override
    seedAuth()
    installAdminFetchMock(profile)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await screen.findByText('in_nfe_1')
    expect(screen.queryByRole('button', { name: 'Corrigir dados' })).not.toBeInTheDocument()
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

  it('links the note to its customer and its subscription', async () => {
    nfeDetailState.override = { user_id: 42, stripe_subscription_id: 'sub_123' }
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    expect(await screen.findByRole('link', { name: 'Abrir cliente' })).toHaveAttribute('href', '/users/42')
    expect(screen.getByRole('link', { name: 'Abrir assinatura' })).toHaveAttribute('href', '/billing?busca=sub_123&status=all')
  })

  it('shows neither link for an imported note without ids', async () => {
    nfeDetailState.override = { imported: true, can_retry: false, user_id: null, stripe_subscription_id: null }
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await screen.findByRole('heading', { name: /NF-e|Nota/ })
    await waitFor(() => expect(screen.queryByText('Carregando nota...')).not.toBeInTheDocument())
    expect(screen.queryByRole('link', { name: 'Abrir cliente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Abrir assinatura' })).not.toBeInTheDocument()
  })

  it('reloads every 5 seconds while the note is in flight and every minute otherwise', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval')
    nfeDetailState.override = { status: 'pending' }
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<NfeDetailPage />, '/operations/nfe/5', '/operations/nfe/:id')

    await waitFor(() => expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === 5000)).toBe(true))
    setIntervalSpy.mockClear()
    nfeDetailState.override = { status: 'authorized' }
    await waitFor(() => expect(setIntervalSpy.mock.calls.some(([, ms]) => ms === 60000)).toBe(true), { timeout: 7000 })
  }, 10000)
})
