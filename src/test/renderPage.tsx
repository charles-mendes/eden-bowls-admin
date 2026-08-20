import { render } from '@testing-library/react'
import { type ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, TOKEN_KEY } from '../contexts/AuthContext'

export function seedAuth(token = 'access-token') {
  localStorage.setItem(TOKEN_KEY, token)
}

export function renderAuthedPage(ui: ReactNode, route: string, path = route) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}
