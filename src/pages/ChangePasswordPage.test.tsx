import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordPage } from './ChangePasswordPage'
import { adminUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ChangePasswordPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('submits the first-login password change', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock({ ...adminUser, mustChangePassword: true })
    renderAuthedPage(<ChangePasswordPage />, '/account/password')

    await user.type(screen.getByLabelText('Senha temporária'), 'TempPassword#12345')
    await user.type(screen.getByLabelText('Nova senha'), 'new-password')
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'new-password')
    await user.click(screen.getByRole('button', { name: 'Salvar senha' }))

    await waitFor(() => {
      const call = findCall(calls, 'POST', '/admin/me/password')
      expect(call?.body).toEqual({
        currentPassword: 'TempPassword#12345',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      })
    })
  })
})
