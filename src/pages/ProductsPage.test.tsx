import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductsPage } from './ProductsPage'
import { AuthProvider } from '../contexts/AuthContext'
import { operatorUser, operatorWriteUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ProductsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the product list with market and pagination query', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Bowl Adulto' })).toBeInTheDocument()
    })

    const listCall = findCall(calls, 'GET', '/admin/catalog/products')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('market=BR')
    expect(listCall?.search).toContain('page=1')
  })

  it('creates a product and opens the detail to add variations', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    render(
      <MemoryRouter initialEntries={['/catalog/products']}>
        <AuthProvider>
          <Routes>
            <Route path="/catalog/products" element={<ProductsPage />} />
            <Route path="/catalog/products/:productId" element={<div>product-detail</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Criar produto' })).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('Ex.: Plano Adulto BR'), 'Plano novo')
    await user.click(screen.getByRole('button', { name: 'Criar produto' }))

    await waitFor(() => {
      expect(screen.getByText('product-detail')).toBeInTheDocument()
    })

    const create = findCall(calls, 'POST', '/admin/catalog/products')
    expect(create?.body).toEqual({
      name: 'Plano novo',
      planCountry: 'BR',
      planDays: 30,
    })
  })

  it('deletes a product from the catalog list', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Excluir produto Bowl Adulto' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Excluir produto Bowl Adulto' }))

    await waitFor(() => {
      expect(findCall(calls, 'DELETE', '/admin/catalog/products/prod-1')).toBeTruthy()
    })
    expect(screen.queryByRole('link', { name: 'Bowl Adulto' })).not.toBeInTheDocument()
    expect(screen.getByText('Produto "Bowl Adulto" excluído.')).toBeInTheDocument()
  })
})
