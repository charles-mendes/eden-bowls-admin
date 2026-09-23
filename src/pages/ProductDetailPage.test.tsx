import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductDetailPage } from './ProductDetailPage'
import { adminUser, jsonResponse, operatorWriteUser, productDetail, readonlyUser } from '../test/fixtures'
import { findCall, installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

function hangProductGet(calls: FetchCall[], fetchMock: ReturnType<typeof installAdminFetchMock>['fetchMock']) {
  const impl = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://admin.local')
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'GET' && url.pathname === '/api/v1/admin/catalog/products/prod-1') {
      calls.push({
        url: String(input),
        path: url.pathname,
        search: url.search,
        method,
        authorization: new Headers(init?.headers).get('Authorization') ?? '',
        body: null,
      })
      return new Promise(() => undefined)
    }
    return impl!(input, init)
  })
}

function rewriteProductGet(
  fetchMock: ReturnType<typeof installAdminFetchMock>['fetchMock'],
  patch: (product: Record<string, unknown>) => Record<string, unknown>,
) {
  const impl = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (input, init) => {
    const response = await impl!(input, init)
    const url = new URL(String(input), 'http://admin.local')
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'GET' && url.pathname === '/api/v1/admin/catalog/products/prod-1') {
      const product = await response.json() as Record<string, unknown>
      return jsonResponse(patch(product))
    }
    return response
  })
}

describe('ProductDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
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
    expect(patch?.body).toEqual({
      planCountry: 'BR',
      planDays: 28,
    })
    expect(patch?.body).not.toHaveProperty('variants')
    expect(patch?.authorization).toBe('Bearer access-token')
  })

  it('saves the variation flavor in the product payload', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Sabor')).toHaveValue('Frango')
    })

    await user.clear(screen.getByLabelText('Sabor'))
    await user.type(screen.getByLabelText('Sabor'), 'Lamb')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      expect(screen.getByText('Variação atualizada.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', flavor: 'Lamb', regularPrice: 89.9 }],
    })
  })

  it('creates a variation from draft and includes it in the save payload', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
    await user.type(screen.getByLabelText('SKU'), 'NOVO-1')
    await user.type(screen.getByLabelText('Nome'), 'Cordeiro 300g')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      expect(screen.getByText('Variação adicionada.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({
      variants: [{ sku: 'NOVO-1', name: 'Cordeiro 300g', flavor: '', regularPrice: null }],
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
    expect(screen.queryByRole('button', { name: /Editar variação/ })).not.toBeInTheDocument()
    expect(screen.getByText(/Volte para rascunho para editar/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar' })).toHaveAttribute('href', '/catalog/products')
    expect(screen.getByText('Sincronizado')).toBeInTheDocument()
    const publishHeading = screen.getByRole('heading', { name: 'Publicação e sincronização' })
    const variationsHeading = screen.getByRole('heading', { name: 'Variações' })
    expect(publishHeading.compareDocumentPosition(variationsHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() => {
      expect(screen.getByText('Voltou para rascunho.')).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar variação Frango 1kg' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Excluir variação Frango 1kg' })).toBeInTheDocument()
  })

  it('publishes the in-progress variation prices instead of reverting them', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    const priceInput = screen.getByLabelText('Preço')
    await user.clear(priceInput)
    await user.type(priceInput, '30')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      expect(screen.getByText(/30,00/)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Publicar' }))

    await waitFor(() => {
      expect(screen.getByText('Publicado.')).toBeInTheDocument()
    })

    const patches = calls.filter((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patches[0]?.body).toEqual({
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', flavor: 'Frango', regularPrice: 30 }],
    })
    expect(patches[1]?.body).toEqual({
      planCountry: 'BR',
      planDays: 28,
      active: true,
    })
    expect(patches[1]?.body).not.toHaveProperty('variants')
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
    expect(screen.queryByRole('button', { name: 'Excluir produto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Excluir variação/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar variação/ })).not.toBeInTheDocument()
  })

  it('deletes an existing variation after confirmation', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Excluir variação Frango 1kg' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Excluir variação Frango 1kg' }))

    await waitFor(() => {
      expect(screen.getByText('Variação "Frango 1kg" excluída.')).toBeInTheDocument()
    })
    expect(findCall(calls, 'DELETE', '/admin/catalog/products/prod-1/variations/var-1')).toBeTruthy()
    expect(screen.queryByText('BOWL-1')).not.toBeInTheDocument()
  })

  it('does not offer publish while the product request is still pending', async () => {
    seedAuth()
    const { fetchMock, calls } = installAdminFetchMock(operatorWriteUser)
    hangProductGet(calls, fetchMock)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/products/prod-1')).toBe(true)
    })

    expect(screen.queryByRole('button', { name: 'Publicar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sincronizar Stripe' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir produto' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  })

  it('keeps an empty duration when plan days are missing', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { fetchMock, calls } = installAdminFetchMock(operatorWriteUser)
    rewriteProductGet(fetchMock, (product) => ({ ...product, planDays: null }))
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByLabelText('Duração (dias)')).toHaveValue(null)
    })

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.getByText('Produto atualizado.')).toBeInTheDocument()
    })

    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect(patch?.body).toEqual({
      planCountry: 'BR',
    })
    expect(patch?.body).not.toHaveProperty('variants')
    expect(patch?.body).not.toHaveProperty('planDays')
  })

  it('limits plan country to the session markets', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'BR / BRL' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('option', { name: 'US / USD' })).not.toBeInTheDocument()
  })

  it('lets an admin pick either plan country', async () => {
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'US / USD' })).toBeInTheDocument()
    })
    expect(screen.getByRole('option', { name: 'BR / BRL' })).toBeInTheDocument()
  })

  it('names the variation when publish is blocked', async () => {
    seedAuth()
    const { fetchMock } = installAdminFetchMock(operatorWriteUser)
    rewriteProductGet(fetchMock, (product) => ({
      ...product,
      gaps: [{ variationId: 'var-1', currencies: ['BRL'] }],
    }))
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByText(/faltam preços Stripe para Frango 1kg \(BRL\)/)).toBeInTheDocument()
    })
    expect(screen.queryByText(/var-1/)).not.toBeInTheDocument()
  })

  it('deactivates a published linked product instead of deleting it', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      product: {
        ...productDetail,
        active: true,
        canDelete: false,
        variants: productDetail.variants.map((item) => ({ ...item, canDelete: false })),
      },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Desativar' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Excluir produto' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Desativar' }))

    await waitFor(() => {
      expect(findCall(calls, 'PATCH', '/admin/catalog/products/prod-1')?.body).toEqual({ active: false })
    })
    expect(findCall(calls, 'DELETE', '/admin/catalog/products/prod-1')).toBeUndefined()
    expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('mantém o cadastro e a cobrança atual')
  })

  it('lets an unlinked variation be deleted beside a linked one', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: {
        ...productDetail,
        variants: [
          { ...productDetail.variants[0], canDelete: false },
          {
            ...productDetail.variants[0],
            id: 'var-2',
            sku: 'BOWL-2',
            name: 'Carne 1kg',
            canDelete: true,
          },
        ],
      },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Excluir variação Carne 1kg' })).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Excluir variação Frango 1kg' })).not.toBeInTheDocument()
    expect(screen.getByText('Variação em uso numa assinatura.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Desativar' })).not.toBeInTheDocument()
  })

  it('reloads the detail when delete reports the product is in use', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser, { catalogDelete: 'in_use' })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Excluir produto' }))

    await waitFor(() => {
      expect(screen.getByText('Este produto já está em assinaturas e não pode ser excluído.')).toBeInTheDocument()
    })
    expect(screen.getByText('Bowl Adulto')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir produto' })).not.toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/products/prod-1').length).toBeGreaterThan(1)
  })

  it('keeps the product on screen when Stripe archive fails', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    installAdminFetchMock(operatorWriteUser, { catalogDelete: 'archive' })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Excluir produto' }))

    await waitFor(() => {
      expect(screen.getByText('Não foi possível arquivar o produto na Stripe. O cadastro foi mantido.')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Excluir produto' })).toBeInTheDocument()
  })

  it('warns when plan duration differs from the loaded product', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    const duration = await screen.findByLabelText('Duração (dias)')
    await user.clear(duration)
    await user.type(duration, '14')

    expect(screen.getByText('País e duração alterados. Salve antes de sair.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.queryByText('País e duração alterados. Salve antes de sair.')).not.toBeInTheDocument()
    })
  })

  it('does not send a patch for an empty new variation and keeps the dialog open', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    expect(screen.getByRole('heading', { name: 'Nova variação' })).toBeInTheDocument()
    expect(screen.getByText('Nova variação precisa de nome ou SKU.')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  })

  it('discards a variation edit when the dialog is cancelled', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    await user.clear(screen.getByLabelText('Nome'))
    await user.type(screen.getByLabelText('Nome'), 'Outro nome')
    await user.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.queryByRole('heading', { name: 'Editar variação' })).not.toBeInTheDocument()
    expect(screen.getByText('Frango 1kg')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
  })

  it('keeps the variation dialog open when the patch is rejected', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { fetchMock } = installAdminFetchMock(operatorWriteUser)
    const impl = fetchMock.getMockImplementation()
    fetchMock.mockImplementation(async (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method === 'PATCH') {
        return jsonResponse({ message: 'Variation price must be a non-negative number.' }, 422)
      }
      return impl!(input, init)
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    const price = screen.getByLabelText('Preço')
    await user.clear(price)
    await user.type(price, '30')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      expect(screen.getByText('Variation price must be a non-negative number.')).toBeInTheDocument()
    })
    expect(screen.getByRole('heading', { name: 'Editar variação' })).toBeInTheDocument()
    expect(screen.getByLabelText('Preço')).toHaveValue(30)
  })

  it('locks the flavor slug after it has been saved', async () => {
    seedAuth()
    const { fetchMock } = installAdminFetchMock(operatorWriteUser)
    rewriteProductGet(fetchMock, (product) => ({
      ...product,
      variants: (product.variants as Array<Record<string, unknown>>).map((item) => ({ ...item, flavorSlug: 'turkey' })),
    }))
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    expect(screen.getByLabelText('Slug do sabor')).toBeDisabled()
  })

  it('hides Editar on a published product', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, active: true },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await screen.findByRole('button', { name: 'Desativar' })
    expect(screen.queryByRole('button', { name: /Editar variação/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar variação' })).not.toBeInTheDocument()
  })
})
