import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductsPage } from './ProductsPage'
import { AuthProvider } from '../contexts/AuthContext'
import { operatorUser, operatorWriteUser, productItem, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

const beefProduct = {
  ...productItem,
  id: 'prod-beef',
  namePt: 'Carne',
  variants: [
    { id: '1001', sku: '1001', active: true, variantPrices: [], canDelete: false },
    { id: '1005', sku: '1005', active: true, variantPrices: [], canDelete: false },
  ],
  canDelete: false,
  content: { ...productItem.content!, code: 'beef', name: 'Carne', imageUrl: 'https://api.test/recipe-images/beef.webp', labelStatus: 'complete' as const, labelMissing: [] },
}

const seniorLamb = {
  ...productItem,
  id: 'prod-lamb',
  namePt: 'Sênior Cordeiro',
  active: false,
  variants: [],
  content: { ...productItem.content!, code: 'senior-lamb', name: 'Sênior Cordeiro', lifeStage: 'senior' as const, labelStatus: 'missing' as const },
}

describe('ProductsPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads the product list scoped to the operator market', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Bowl Adulto' })).toBeInTheDocument()
    })

    const listCall = findCall(calls, 'GET', '/admin/catalog/products')
    expect(listCall?.authorization).toBe('Bearer access-token')
    expect(listCall?.search).toContain('page=1')
    expect(listCall?.search).toContain('market=BR')
    expect(listCall?.search).not.toContain('search=')
    expect(screen.getByPlaceholderText('slug, nome pt ou en')).toHaveValue('')
    expect(screen.getByRole('link', { name: 'Detalhes' })).toHaveAttribute('href', '/catalog/products/prod-1')
    expect(screen.queryByRole('button', { name: 'Excluir produto Bowl Adulto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar produto Bowl Adulto' })).not.toBeInTheDocument()
    expect(screen.getByText('Publicado')).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Ativo' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Preços na Stripe' })).toBeInTheDocument()
    expect(screen.queryByText(/sem filtro/)).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Mercado' })).toHaveValue('BR')
    expect(screen.getByRole('combobox', { name: 'Mercado' })).toBeDisabled()
    expect(screen.queryByRole('option', { name: 'Estados Unidos' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Limpar busca' })).not.toBeInTheDocument()
  })

  it('clears search with the side X and keeps the locked market', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorUser)
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Bowl Adulto' })).toBeInTheDocument()
    })

    await user.type(screen.getByPlaceholderText('slug, nome pt ou en'), 'bowl')

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.search.includes('search=bowl') && call.search.includes('market=BR'))).toBe(true)
    })

    await user.click(screen.getByRole('button', { name: 'Limpar busca' }))

    await waitFor(() => {
      const lastList = [...calls].reverse().find((call) => call.method === 'GET' && call.path.includes('/admin/catalog/products'))
      expect(lastList?.search).not.toContain('search=')
      expect(lastList?.search).toContain('market=BR')
    })
    expect(screen.getByPlaceholderText('slug, nome pt ou en')).toHaveValue('')
    expect(screen.getByRole('combobox', { name: 'Mercado' })).toHaveValue('BR')
  })

  function renderWithDetailRoute() {
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
  }

  it('Create Receita de Cordeiro', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderWithDetailRoute()

    await user.click(await screen.findByRole('button', { name: 'Novo produto' }))
    expect(screen.getByText('Cada produto é uma receita. Código e mercado não mudam depois de criados.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Nome'), 'Receita de Cordeiro')
    expect(screen.getByLabelText('Código')).toHaveValue('receita-de-cordeiro')
    expect(screen.getByLabelText('Mercado do produto')).toHaveValue('BR')
    expect(screen.getByLabelText('Fase de vida')).toHaveValue('adult')
    await user.click(screen.getByRole('button', { name: 'Criar produto' }))

    await waitFor(() => {
      expect(screen.getByText('product-detail')).toBeInTheDocument()
    })
    expect(findCall(calls, 'POST', '/admin/catalog/products')?.body).toEqual({
      name: 'Receita de Cordeiro',
      planCountry: 'BR',
      code: 'receita-de-cordeiro',
      lifeStage: 'adult',
    })
  })

  it('keeps an edited code when the name changes', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderWithDetailRoute()

    await user.click(await screen.findByRole('button', { name: 'Novo produto' }))
    await user.type(screen.getByLabelText('Nome'), 'Sênior Cordeiro')
    expect(screen.getByLabelText('Código')).toHaveValue('senior-cordeiro')
    await user.clear(screen.getByLabelText('Código'))
    await user.type(screen.getByLabelText('Código'), 'senior-lamb')
    await user.type(screen.getByLabelText('Nome'), ' Light')
    expect(screen.getByLabelText('Código')).toHaveValue('senior-lamb')
  })

  it('Code taken', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderWithDetailRoute()

    await user.click(await screen.findByRole('button', { name: 'Novo produto' }))
    await user.type(screen.getByLabelText('Nome'), 'Peru')
    await user.clear(screen.getByLabelText('Código'))
    await user.type(screen.getByLabelText('Código'), 'turkey')
    await user.selectOptions(screen.getByLabelText('Fase de vida'), 'senior')
    await user.click(screen.getByRole('button', { name: 'Criar produto' }))

    expect(await screen.findByText('Este mercado já tem um produto com esse código. Escolha outro código.')).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Peru')
    expect(screen.getByLabelText('Código')).toHaveValue('turkey')
    expect(screen.getByLabelText('Fase de vida')).toHaveValue('senior')
    expect(screen.queryByText('product-detail')).not.toBeInTheDocument()
  })

  it('Products of BR', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser, { products: [beefProduct, seniorLamb] })
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    const beefRow = (await screen.findByRole('link', { name: 'Carne' })).closest('tr')!
    expect(within(beefRow).getByText('beef')).toBeInTheDocument()
    expect(within(beefRow).getByText('Adulto')).toBeInTheDocument()
    expect(within(beefRow).getByText('2/2')).toBeInTheDocument()
    expect(within(beefRow).getByText('Com imagem')).toBeInTheDocument()
    expect(within(beefRow).getByText('Rótulo completo')).toBeInTheDocument()

    const lambRow = screen.getByRole('link', { name: 'Sênior Cordeiro' }).closest('tr')!
    expect(within(lambRow).getByText('senior-lamb')).toBeInTheDocument()
    expect(within(lambRow).getByText('Sênior')).toBeInTheDocument()
    expect(within(lambRow).getByText('0/0')).toBeInTheDocument()
    expect(within(lambRow).getByText('Sem imagem')).toBeInTheDocument()
    expect(within(lambRow).getByText('Sem rótulo')).toBeInTheDocument()
    expect(within(lambRow).getByText('Rascunho')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo produto' })).not.toBeInTheDocument()
  })

  it('Quick filter', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(readonlyUser, { products: [beefProduct, seniorLamb, { ...beefProduct, id: 'prod-3', namePt: 'Peixe', content: { ...beefProduct.content!, code: 'fish', labelStatus: 'incomplete' } }] })
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await screen.findByRole('link', { name: 'Carne' })
    await user.click(screen.getByLabelText('Sem imagem'))
    expect(screen.getByRole('link', { name: 'Sênior Cordeiro' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Carne' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Peixe' })).not.toBeInTheDocument()

    await user.click(screen.getByLabelText('Sem imagem'))
    await user.click(screen.getByLabelText('Rótulo incompleto'))
    expect(screen.getByRole('link', { name: 'Sênior Cordeiro' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Peixe' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Carne' })).not.toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: 'Detalhes' })).toHaveAttribute('href', '/catalog/products/prod-1')

    await user.click(screen.getByRole('button', { name: 'Excluir produto Bowl Adulto' }))

    await waitFor(() => {
      expect(findCall(calls, 'DELETE', '/admin/catalog/products/prod-1')).toBeTruthy()
    })
    expect(screen.queryByRole('link', { name: 'Bowl Adulto' })).not.toBeInTheDocument()
    expect(screen.getByText('Produto "Bowl Adulto" excluído.')).toBeInTheDocument()
  })

  it('deactivates a published linked product without deleting it', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      products: [{ ...productItem, canDelete: false, active: true }],
    })
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Desativar produto Bowl Adulto' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Excluir produto Bowl Adulto' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Desativar produto Bowl Adulto' }))

    await waitFor(() => {
      expect(findCall(calls, 'PATCH', '/admin/catalog/products/prod-1')?.body).toEqual({ active: false })
    })
    expect(findCall(calls, 'DELETE', '/admin/catalog/products/prod-1')).toBeUndefined()
    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('mantém o cadastro e a cobrança atual')
  })

  it('hides destructive actions for a linked draft', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      products: [{ ...productItem, canDelete: false, active: false }],
    })
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByText('Produto vinculado a assinatura. Não pode ser excluído.')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Excluir produto Bowl Adulto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar produto Bowl Adulto' })).not.toBeInTheDocument()
  })

  it('reloads the list when delete reports the product is in use', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser, { catalogDelete: 'in_use' })
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Excluir produto Bowl Adulto' })).toBeInTheDocument()
    })
    const getsBefore = calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/products').length

    await user.click(screen.getByRole('button', { name: 'Excluir produto Bowl Adulto' }))

    await waitFor(() => {
      expect(screen.getByText('Este produto já está em assinaturas e não pode ser excluído.')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Bowl Adulto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desativar produto Bowl Adulto' })).toBeInTheDocument()
    const getsAfter = calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/products').length
    expect(getsAfter).toBeGreaterThan(getsBefore)
  })

  it('keeps the row when Stripe archive fails', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    installAdminFetchMock(operatorWriteUser, { catalogDelete: 'archive' })
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await user.click(await screen.findByRole('button', { name: 'Excluir produto Bowl Adulto' }))

    await waitFor(() => {
      expect(screen.getByText('Não foi possível arquivar o produto na Stripe. O cadastro foi mantido.')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Bowl Adulto' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir produto Bowl Adulto' })).toBeInTheDocument()
  })

  it('syncs Stripe prices from the products page', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductsPage />, '/catalog/products')

    await user.click(await screen.findByRole('button', { name: 'Sincronizar catálogo' }))

    await waitFor(() => {
      expect(screen.getByText('Sincronização: na fila')).toBeInTheDocument()
    })
    const sync = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/catalog/sync')
    expect(sync?.body).toEqual({ market: 'BR', currency: 'BRL' })
    expect(sync?.authorization).toBe('Bearer access-token')
  })
})
