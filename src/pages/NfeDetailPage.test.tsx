import { screen, waitFor } from '@testing-library/react'
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
    await user.click(screen.getAllByRole('button', { name: 'Salvar' }).at(-1) as HTMLElement)

    await waitFor(() => expect(findCall(calls, 'PATCH', '/admin/nfe/5/customer')).toBeTruthy())
    const call = findCall(calls, 'PATCH', '/admin/nfe/5/customer')
    expect(call?.body).toMatchObject({ name: 'Ana Correta', document: '52998224725', address: { street: 'Rua A', city: 'São Paulo' } })
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
})
