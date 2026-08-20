import { screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UsersPage } from './UsersPage'
import { operatorUser, operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('UsersPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the customer list with Bearer and page/perPage', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    expect(screen.getByText('Ana Costa')).toBeInTheDocument()
    const listCall = findCall(calls, 'GET', '/admin/users')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('page=1')
    expect(listCall?.search).toContain('perPage=20')
  })

  it('sends the search query on the users list request', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'ana@edenbowls.com' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Busca'), { target: { value: 'ana' } })

    await waitFor(() => {
      expect(calls.some((call) => call.path.endsWith('/admin/users') && call.search.includes('q=ana'))).toBe(true)
    })
  })

  it('deactivates a customer from the list', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<UsersPage />, '/users')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() => {
      expect(screen.getByText(/Conta de ana@edenbowls.com desativada/)).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path.endsWith('/status'))
    expect(patch?.body).toEqual({ status: 'inactive' })
    expect(patch?.authorization).toBe('Bearer access-token')
  })
})
