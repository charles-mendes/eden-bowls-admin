import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductDetailPage } from './ProductDetailPage'
import { operatorWriteUser, readonlyUser } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

describe('ProductDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('loads product detail and PATCHes plan fields', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByText('BOWL-1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('Produto atualizado.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({ planCountry: 'BR', planDays: 28 })
    expect(patch?.authorization).toBe('Bearer access-token')
  })

  it('hides catalog mutations from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByText('BOWL-1')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizar Stripe' })).not.toBeInTheDocument()
  })
})
