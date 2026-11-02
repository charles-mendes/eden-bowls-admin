import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NfeListPage } from './NfeListPage'
import { adminUser, readonlyUser } from '../test/fixtures'
import { blingConnectionState, findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const navigateMock = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => navigateMock,
}))

describe('NfeListPage', () => {
  afterEach(() => {
    blingConnectionState.connected = true
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists the notes with status, customer, document, value, number, date and error', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')

    expect(await screen.findByRole('link', { name: 'Ana Souza' })).toBeInTheDocument()
    const row = screen.getByRole('link', { name: 'Ana Souza' }).closest('tr') as HTMLElement
    expect(row).toHaveTextContent('Erro')
    expect(row).toHaveTextContent('529.982.247-25')
    expect(row).toHaveTextContent('R$')
    expect(row).toHaveTextContent('158 / 1')
    expect(row).toHaveTextContent('Escopo ausente')
  })

  it('shows the Bling status next to ours and marks a note created in Bling', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')

    const row = (await screen.findByRole('link', { name: 'Ana Souza' })).closest('tr') as HTMLElement
    expect(within(row).getByText('Rejeitada')).toHaveClass('badge-error')
    expect(within(row).queryByText('Criada no Bling')).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Bling' })).toBeInTheDocument()
  })

  it('opens the note from a visible action and from anywhere on the row', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')

    const action = await screen.findByRole('link', { name: 'Ver detalhes da nota de Ana Souza' })
    expect(action).toHaveAttribute('href', '/operations/nfe/5')

    await user.click(within(action.closest('tr') as HTMLElement).getByText(/150,00/))
    expect(navigateMock).toHaveBeenCalledWith('/operations/nfe/5')
  })

  it('offers the canceled status in the filter', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')
    await screen.findByRole('link', { name: 'Ana Souza' })

    expect(screen.getByRole('option', { name: 'Cancelada' })).toBeInTheDocument()
  })

  it('sends the filters to the API', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')
    await screen.findByRole('link', { name: 'Ana Souza' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'rejected')
    await user.type(screen.getByRole('textbox', { name: 'Busca' }), '52998224725')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    await waitFor(() => {
      expect(calls.some((call) => call.path === '/api/v1/admin/nfe' && call.search.includes('status=rejected') && call.search.includes('search=52998224725'))).toBe(true)
    })
  })

  it('offers the Bling authorization to an admin only, through the API', async () => {
    blingConnectionState.connected = false
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')
    expect(await screen.findByRole('button', { name: 'Autorizar Bling' })).toBeInTheDocument()
    expect(findCall(calls, 'GET', '/admin/bling/connection')).toBeTruthy()
  })

  it('hides the Bling authorization from readonly', async () => {
    blingConnectionState.connected = false
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<NfeListPage />, '/operations/nfe')
    expect(await screen.findByText('Sem conexão')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Autorizar Bling' })).not.toBeInTheDocument()
  })
})
