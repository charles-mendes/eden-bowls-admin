import { screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductsPage } from './ProductsPage'
import { operatorUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ProductsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
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
})
