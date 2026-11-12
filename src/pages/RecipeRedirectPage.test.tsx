import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecipeRedirectPage } from './RecipeRedirectPage'
import { AuthProvider } from '../contexts/AuthContext'
import { operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { seedAuth } from '../test/renderPage'

function ProductProbe() {
  const location = useLocation()
  return <div>product {location.pathname}{location.hash}</div>
}

function renderAt(route: string) {
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route path="/catalog/recipes/:market/:recipeKey" element={<RecipeRedirectPage />} />
          <Route path="/catalog/products/:productId" element={<ProductProbe />} />
          <Route path="/catalog/products" element={<div>products list</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RecipeRedirectPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('Bookmark of a recipe page opens the product on the same anchor', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAt('/catalog/recipes/BR/turkey#rotulo')

    expect(await screen.findByText('product /catalog/products/prod-1#rotulo')).toBeInTheDocument()
    const lookup = findCall(calls, 'GET', '/admin/catalog/products')
    expect(lookup?.search).toContain('market=BR')
    expect(lookup?.search).toContain('code=turkey')
  })

  it('says an unknown recipe no longer exists and links to Produtos', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAt('/catalog/recipes/BR/pato')

    await waitFor(() => expect(screen.getByText(/Esta receita não existe mais/)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'abrir Produtos' })).toHaveAttribute('href', '/catalog/products')
  })
})
