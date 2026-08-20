import { screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { AuthProvider, TOKEN_KEY } from '../contexts/AuthContext'
import { RequireAuth } from './RequireAuth'
import { jsonResponse, nutritionistUser, operatorUser } from '../test/fixtures'

function renderGuard(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login-page</div>} />
          <Route
            path="/nutrition/simulate"
            element={(
              <RequireAuth>
                <div>simulate-page</div>
              </RequireAuth>
            )}
          />
          <Route
            path="/dashboard"
            element={(
              <RequireAuth>
                <div>dashboard-page</div>
              </RequireAuth>
            )}
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('sends anonymous users to login', async () => {
    vi.stubGlobal('fetch', vi.fn())
    renderGuard('/dashboard')

    await waitFor(() => {
      expect(screen.getByText('login-page')).toBeInTheDocument()
    })
  })

  it('keeps operators on the requested route', async () => {
    localStorage.setItem(TOKEN_KEY, 'operator-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(operatorUser)))

    renderGuard('/dashboard')

    await waitFor(() => {
      expect(screen.getByText('dashboard-page')).toBeInTheDocument()
    })
  })

  it('keeps nutritionist-only accounts on the simulator', async () => {
    localStorage.setItem(TOKEN_KEY, 'nutri-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(nutritionistUser)))

    renderGuard('/dashboard')

    await waitFor(() => {
      expect(screen.getByText('simulate-page')).toBeInTheDocument()
    })
  })
})
