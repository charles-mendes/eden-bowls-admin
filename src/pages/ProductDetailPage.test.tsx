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
      expect(screen.getByDisplayValue('BOWL-1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('Produto atualizado.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({
      planCountry: 'BR',
      planDays: 28,
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9 }],
    })
    expect(patch?.authorization).toBe('Bearer access-token')
  })

  it('creates a variation from draft and includes it in the save payload', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByDisplayValue('BOWL-1')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Adicionar variação' }))
    const skuInputs = screen.getAllByPlaceholderText('SKU')
    await user.type(skuInputs[skuInputs.length - 1], 'NOVO-1')
    const nameInputs = screen.getAllByPlaceholderText('Nome')
    await user.type(nameInputs[nameInputs.length - 1], 'Cordeiro 300g')

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('Produto atualizado.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({
      planCountry: 'BR',
      planDays: 28,
      variants: [
        { id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9 },
        { sku: 'NOVO-1', name: 'Cordeiro 300g', regularPrice: null },
      ],
    })
  })

  it('unlocks editing after returning to draft', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => {
      expect(screen.getByText('Publicado.')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Adicionar variação' })).not.toBeInTheDocument()
    expect(screen.getByText(/Volte para rascunho para editar/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Voltar para rascunho' }))

    await waitFor(() => {
      expect(screen.getByText('Voltou para rascunho.')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()
  })

  it('publishes the in-progress variation prices instead of reverting them', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByDisplayValue('89.9')).toBeInTheDocument()
    })

    const priceInput = screen.getByLabelText('Preço')
    await user.clear(priceInput)
    await user.type(priceInput, '30')
    await user.click(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => {
      expect(screen.getByText('Publicado.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({
      planCountry: 'BR',
      planDays: 28,
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 30 }],
      active: true,
    })
    expect(screen.getByText(/30,00/)).toBeInTheDocument()
  })

  it('hides catalog mutations from readonly accounts', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByText('BOWL-1')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar variação' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizar Stripe' })).not.toBeInTheDocument()
  })
})
