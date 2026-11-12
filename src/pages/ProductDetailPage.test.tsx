import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductDetailPage } from './ProductDetailPage'
import { adminUser, jsonResponse, operatorWriteUser, productDetail, readonlyUser, recipeContent, recipeImageUrl, recipeList } from '../test/fixtures'
import { findCall, installAdminFetchMock, type FetchCall } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// jsdom does not decode images, so each test file name maps to a pixel size.
const imageSizes = new Map<string, { width: number; height: number }>()

vi.mock('../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/imageUpload')>()
  const size = (file: File) => {
    const found = imageSizes.get(file.name)
    if (!found) throw new Error('unknown test image')
    return found
  }
  return {
    ...actual,
    checkRecipeImage: (file: File) => actual.checkRecipeImage(file, async () => size(file)),
    checkRecipePlanImage: (file: File) => actual.checkRecipePlanImage(file, async () => size(file)),
  }
})

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

  it('Product save omits variations', async () => {
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
    })
    expect(patch?.body).not.toHaveProperty('variants')
    expect(patch?.body).not.toHaveProperty('planDays')
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
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', flavor: 'Lamb', lifeStage: 'adult', shortLabel: '', ncm: '', origin: 0, finalImageReady: false, labelDataReady: false, regularPrice: 89.9, recipeKey: 'turkey' }],
    })
  })

  it('opens the variation named in the link from a recipe page', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], active: false }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1?variation=var-1', '/catalog/products/:productId')

    expect(await screen.findByRole('heading', { name: 'Editar variação' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nome')).toHaveValue('Frango 1kg')
    expect(document.getElementById('variation-var-1')).toHaveClass('row-focused')
  })

  it('locks the line of a variation linked to a recipe on the recipe life stage', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    await screen.findByRole('option', { name: 'Frango · turkey' })
    expect(screen.getByLabelText('Linha')).toBeDisabled()
    expect(screen.getByLabelText('Linha')).toHaveValue('adult')
    expect(screen.getByText(/Vem da receita Frango/)).toBeInTheDocument()
  })

  it('saves the life stage line of a variation without a recipe and shows it in the table', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], recipeKey: null }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Linha')).toHaveValue('adult')
    })
    await user.selectOptions(screen.getByLabelText('Linha'), 'senior')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      expect(screen.getByText('Variação atualizada.')).toBeInTheDocument()
    })
    const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
    expect((patch?.body as { variants: Array<{ lifeStage: string }> }).variants[0].lifeStage).toBe('senior')
  })

  it('adds an inactive variation and edits it while the product is published, with active ones locked', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls, fetchMock } = installAdminFetchMock(operatorWriteUser)
    rewriteProductGet(fetchMock, (product) => ({
      ...product,
      active: true,
      variants: [
        ...(product.variants as Array<Record<string, unknown>>),
        { id: 'var-2', sku: 'SENIOR-BEEF-300', name: 'Sênior Carne 300g', flavor: 'Receita de Carne para Cães Sênior', active: false, regularPrice: 40, stripeProductId: null, stripePriceId: null, syncStatus: 'not_synced', requiresSync: true, canDelete: true },
      ],
    }))
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByRole('button', { name: 'Editar variação Sênior Carne 300g' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar variação Frango 1kg' })).toBeDisabled()
    expect(screen.getByText('Ativa e publicada: desative para editar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Editar variação Sênior Carne 300g' }))
    await user.click(screen.getByLabelText('Foto definitiva já está na loja'))
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
      expect((patch?.body as { variants: Array<Record<string, unknown>> }).variants[0]).toMatchObject({ id: 'var-2', finalImageReady: true, labelDataReady: false })
    })
  })

  it('activates and deactivates a variation through the activation route', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByRole('cell', { name: 'Ativa' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desativar variação Frango 1kg' }))

    const notice = await screen.findByText('Variação "Frango 1kg" desativada.')
    expect(notice.closest('section')).toContainElement(screen.getByRole('heading', { name: 'Variações' }))
    expect(screen.getByText('Inativa')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST' && call.path === '/api/v1/admin/catalog/products/prod-1/variations/var-1/activation')
    expect(post?.body).toEqual({ active: false })

    await user.click(screen.getByRole('button', { name: 'Ativar variação Frango 1kg' }))
    expect(await screen.findByText('Variação "Frango 1kg" ativada.')).toBeInTheDocument()
  })

  it('names the missing items when activation is refused', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      catalogActivation: 'refused',
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], active: false }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Ativar variação Frango 1kg' }))

    expect(await screen.findByText('Ativação recusada. Falta: preço no Stripe, foto definitiva na loja, dados de rótulo no conteúdo da receita.')).toBeInTheDocument()
  })

  it('names the missing store presentation when activation is refused', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], active: false, recipePresentationReady: false }] },
      routes: (call) => (
        call.method === 'POST' && call.path.endsWith('/activation')
          ? jsonResponse({ message: 'Variation cannot be activated: missing presentation.', details: { code: 'recipe_publish_refused', missing: ['presentation'] } }, 422)
          : undefined
      ),
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByRole('button', { name: 'Abrir apresentação de Frango 1kg' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ativar variação Frango 1kg' }))

    expect(await screen.findByText('Ativação recusada. Falta: apresentação na loja no conteúdo da receita.')).toBeInTheDocument()
    expect(screen.queryByText(/na página da receita/)).not.toBeInTheDocument()
  })

  it('sends plan days and the large-pack limit to the Plano screen', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { product: { ...productDetail, active: true } })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByRole('link', { name: 'Loja › Plano' })).toHaveAttribute('href', '/catalog/plan?market=BR')
    expect(screen.queryByLabelText('Duração (dias)')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^Limite do pacote pequeno/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('País do plano')).toBeDisabled()
  })

  it('names the active subscriptions when deactivation is refused', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { catalogActivation: 'in_use' })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Desativar variação Frango 1kg' }))

    expect(await screen.findByText('Esta variação está em 3 assinaturas ativas e não pode ser desativada.')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Ativa' })).toBeInTheDocument()
  })

  it('explains the lock when an active variation edit is refused', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { catalogPatch: 'locked' })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    expect(await screen.findByText('Variação ativa não pode ser editada com o produto publicado. Desative a variação antes.')).toBeInTheDocument()
  })

  it('saves the short name of a variation', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    await user.type(screen.getByLabelText('Nome curto'), 'Bovino · Sênior')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
      expect((patch?.body as { variants: Array<Record<string, unknown>> }).variants[0].shortLabel).toBe('Bovino · Sênior')
    })
  })

  it('saves the NCM and the origin of a Brazilian variation', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
    await user.type(screen.getByLabelText('NCM'), '2309.10.00')
    await user.selectOptions(screen.getByLabelText('Origem da mercadoria'), '1')
    await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

    await waitFor(() => {
      const patch = calls.find((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')
      expect((patch?.body as { variants: Array<Record<string, unknown>> }).variants[0]).toMatchObject({ ncm: '2309.10.00', origin: 1 })
    })
  })

  it('shows the stored line of each variation', async () => {
    seedAuth()
    const { fetchMock } = installAdminFetchMock(operatorWriteUser)
    rewriteProductGet(fetchMock, (product) => ({
      ...product,
      variants: (product.variants as Array<Record<string, unknown>>).map((variant) => ({ ...variant, lifeStage: 'puppy' })),
    }))
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByRole('cell', { name: 'Filhote' })).toBeInTheDocument()
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
      variants: [{ sku: 'NOVO-1', name: 'Cordeiro 300g', flavor: '', lifeStage: 'adult', shortLabel: '', ncm: '', origin: 0, finalImageReady: false, labelDataReady: false, regularPrice: null, recipeKey: null }],
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
    expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Editar variação Frango 1kg' })).toBeDisabled()
    expect(screen.getByText(/Variações inativas podem ser adicionadas e editadas/)).toBeInTheDocument()
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
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', flavor: 'Frango', lifeStage: 'adult', shortLabel: '', ncm: '', origin: 0, finalImageReady: false, labelDataReady: false, regularPrice: 30, recipeKey: 'turkey' }],
    })
    expect(patches[1]?.body).toEqual({
      planCountry: 'BR',
      active: true,
    })
    expect(patches[1]?.body).not.toHaveProperty('planDays')
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

  it('Changed field warns before leaving', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(adminUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.selectOptions(await screen.findByLabelText('País do plano'), 'US')

    expect(screen.getByText('País alterado. Salve antes de sair.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => {
      expect(screen.queryByText('País alterado. Salve antes de sair.')).not.toBeInTheDocument()
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

  it('locks active variations of a published product and still offers adding one', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, active: true },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await screen.findByRole('button', { name: 'Desativar' })
    expect(screen.getByRole('button', { name: 'Editar variação Frango 1kg' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()
  })

  it('shows the stored image state and opens the recipe content of each variation', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(readonlyUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], recipeImageUrl }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByText('Imagem cadastrada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Conteúdo da receita de Frango 1kg' }))
    const panel = await screen.findByRole('dialog', { name: 'Conteúdo da receita Frango' })
    expect(within(panel).getByRole('link', { name: 'Abrir página da receita' })).toHaveAttribute('href', '/catalog/recipes/BR/turkey')
  })

  it('hides the image confirmation when the flavor has a stored image', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], recipeImageUrl }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))

    expect(screen.queryByLabelText('Foto definitiva já está na loja')).not.toBeInTheDocument()
    expect(screen.getByText('Imagem cadastrada em Conteúdo da receita. Não precisa de confirmação.')).toBeInTheDocument()
  })

  it('keeps the image confirmation for a flavor without a stored image', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByText('Sem imagem')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar variação Frango 1kg' }))

    expect(screen.getByLabelText('Foto definitiva já está na loja')).toBeInTheDocument()
  })

  it('shows the label state and asks for the label confirmation only while the stored label is not complete', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], recipeImageUrl, recipeLabelStatus: 'incomplete' }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByText('Imagem cadastrada')).toBeInTheDocument()
    expect(screen.getByText('Rótulo incompleto')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar variação Frango 1kg' }))

    expect(screen.queryByLabelText('Foto definitiva já está na loja')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Dados de rótulo já estão na página da receita')).toBeInTheDocument()
  })

  it('hides the label confirmation when the stored label is complete', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      product: { ...productDetail, variants: [{ ...productDetail.variants[0], recipeLabelStatus: 'complete' }] },
    })
    renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

    expect(await screen.findByText('Rótulo completo')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Editar variação Frango 1kg' }))

    expect(screen.queryByLabelText('Dados de rótulo já estão na página da receita')).not.toBeInTheDocument()
    expect(screen.getByText('Rótulo completo cadastrado em Conteúdo da receita. Não precisa de confirmação.')).toBeInTheDocument()
  })

  describe('recipe link', () => {
    async function openDialog(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      // The registered recipes arrive after the product.
      await screen.findByRole('option', { name: 'Carne · beef' })
    }

    it('unlinks a variation by choosing Sem receita', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

      await openDialog(user)
      expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('turkey')
      await user.selectOptions(screen.getByLabelText('Receita (conteúdo)'), 'Sem receita')
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      expect(await screen.findByText('Sem receita vinculada')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Conteúdo da receita/ })).not.toBeInTheDocument()
      const patch = calls.find((call) => call.method === 'PATCH')
      expect((patch?.body as { variants: Array<Record<string, unknown>> }).variants[0].recipeKey).toBeNull()
    })

    it('offers only the recipes registered in the market, without a link that leaves the dialog', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

      await openDialog(user)

      const select = screen.getByLabelText('Receita (conteúdo)')
      expect(select.tagName).toBe('SELECT')
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Sem receita',
        'Carne · beef',
        'Sênior Cordeiro · senior-lamb',
        'Frango · turkey',
      ])
      expect(screen.queryByRole('link', { name: 'Cadastre em Receitas' })).not.toBeInTheDocument()
      expect(within(screen.getByRole('dialog')).queryByRole('link')).not.toBeInTheDocument()
      expect(calls.some((call) => call.path === '/api/v1/admin/catalog/recipe-content' && call.search === '?market=BR')).toBe(true)
    })

    it('explains a recipe that is no longer registered and keeps the other fields', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        recipes: [{ key: 'beef', name: 'Carne', lifeStage: 'adult', imageUrl: null, labelStatus: 'missing', variations: [] }],
      })
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

      await openDialog(user)
      await user.clear(screen.getByLabelText('Nome'))
      await user.type(screen.getByLabelText('Nome'), 'Frango 1,2kg')
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      expect(await screen.findByText('Esta receita não está mais cadastrada no mercado. Escolha outra ou cadastre em Receitas.')).toBeInTheDocument()
      expect(screen.getByLabelText('Nome')).toHaveValue('Frango 1,2kg')
    })

    it('starts a new variation on the registered recipe of its flavor slug, or on no recipe', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

      await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
      await screen.findByRole('option', { name: 'Carne · beef' })
      await user.type(screen.getByLabelText('SKU'), 'SL-300')
      await user.type(screen.getByLabelText('Sabor'), 'Pato')
      expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('')
      await user.clear(screen.getByLabelText('Sabor'))
      await user.type(screen.getByLabelText('Sabor'), 'Senior Lamb')
      expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('senior-lamb')
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      await screen.findByText('Variação adicionada.')
      const patch = calls.find((call) => call.method === 'PATCH')
      expect((patch?.body as { variants: Array<Record<string, unknown>> }).variants[0]).toMatchObject({ recipeKey: 'senior-lamb', lifeStage: 'senior' })
    })

    it('shows a variation without a recipe without a content link', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, {
        product: { ...productDetail, variants: [{ ...productDetail.variants[0], recipeKey: null }] },
      })
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

      expect(await screen.findByText('Sem receita vinculada')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Conteúdo da receita/ })).not.toBeInTheDocument()
    })
  })

  describe('recipe created from the dialog', () => {
    const variant = productDetail.variants[0]
    // The fixture type has no flavor slug; spreading a patch keeps it out of the excess-property check.
    const productWith = (patch: Record<string, unknown>) => ({ ...productDetail, variants: [{ ...variant, ...patch }] })

    function renderDetail(options: Parameters<typeof installAdminFetchMock>[1] = {}, user = operatorWriteUser) {
      seedAuth()
      const mock = installAdminFetchMock(user, options)
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')
      return mock
    }

    async function addVariation(user: ReturnType<typeof userEvent.setup>, flavor: string) {
      await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
      await screen.findByRole('option', { name: 'Carne · beef' })
      await user.type(screen.getByLabelText('SKU'), 'PT-300')
      await user.type(screen.getByLabelText('Sabor'), flavor)
    }

    const recipePosts = (calls: FetchCall[]) => calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/admin/catalog/recipe-content')
    const productPatches = (calls: FetchCall[]) => calls.filter((call) => call.method === 'PATCH' && call.path === '/api/v1/admin/catalog/products/prod-1')

    it('offers to create the recipe of a new flavor, and not of a registered one', async () => {
      const user = userEvent.setup()
      renderDetail()

      await addVariation(user, 'Pato')
      expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('')
      expect(screen.getByRole('button', { name: 'Criar receita pato' })).toBeInTheDocument()

      await user.clear(screen.getByLabelText('Sabor'))
      await user.type(screen.getByLabelText('Sabor'), 'Beef')
      expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('beef')
      expect(screen.queryByRole('button', { name: /^Criar receita/ })).not.toBeInTheDocument()
    })

    it('offers no recipe while a registered recipe is selected', async () => {
      const user = userEvent.setup()
      renderDetail({ product: productWith({ flavorSlug: 'pato', recipeKey: null }) })

      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      await screen.findByRole('option', { name: 'Carne · beef' })
      expect(screen.getByRole('button', { name: 'Criar receita pato' })).toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText('Receita (conteúdo)'), 'beef')
      expect(screen.queryByRole('button', { name: /^Criar receita/ })).not.toBeInTheDocument()
    })

    it('offers the flavor slug of a saved variation without a recipe', async () => {
      const user = userEvent.setup()
      renderDetail({ product: productWith({ flavorSlug: 'lamb', recipeKey: null }) })

      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      expect(await screen.findByRole('button', { name: 'Criar receita lamb' })).toBeInTheDocument()
    })

    it('offers the recorded key that the market no longer has, not the flavor slug', async () => {
      const user = userEvent.setup()
      renderDetail({ product: productWith({ flavorSlug: 'lamb', recipeKey: 'lamb-classic' }) })

      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      expect(await screen.findByRole('button', { name: 'Criar receita lamb-classic' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Criar receita lamb' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Criar receita lamb-classic' }))
      expect(screen.getByLabelText('Chave da receita')).toHaveValue('lamb-classic')
    })

    it('registers the recipe in the market, selects it and links it only when the variation is saved', async () => {
      const user = userEvent.setup()
      const { calls } = renderDetail()

      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      expect(screen.getByLabelText('Nome da receita')).toHaveValue('Pato')
      expect(screen.getByLabelText('Chave da receita')).toHaveValue('pato')
      expect(screen.getByLabelText('Fase da receita')).toHaveValue('adult')
      expect(screen.getByText(/continua em Receitas mesmo que você não salve a variação/)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Cadastrar e vincular' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('pato')
      })
      expect(screen.getByRole('option', { name: 'Pato · pato' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Receita cadastrada. Salve a variação para vincular.')
      expect(recipePosts(calls)).toHaveLength(1)
      expect(recipePosts(calls)[0].search).toBe('?market=BR')
      expect(recipePosts(calls)[0].body).toEqual({ key: 'pato', name: 'Pato', lifeStage: 'adult' })
      expect(productPatches(calls)).toHaveLength(0)
      expect(screen.queryByRole('button', { name: /^Criar receita/ })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))
      await screen.findByText('Variação adicionada.')
      const patch = productPatches(calls)[0]
      expect((patch.body as { variants: Array<Record<string, unknown>> }).variants[0]).toMatchObject({ recipeKey: 'pato' })
    })

    it('registers the recipe on Enter without saving the variation', async () => {
      const user = userEvent.setup()
      const { calls } = renderDetail()

      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      await user.type(screen.getByLabelText('Nome da receita'), '{Enter}')

      await waitFor(() => {
        expect(recipePosts(calls)).toHaveLength(1)
      })
      expect(productPatches(calls)).toHaveLength(0)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('locks the line of the variation on the stage of the created recipe', async () => {
      const user = userEvent.setup()
      renderDetail()

      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      await user.selectOptions(screen.getByLabelText('Fase da receita'), 'puppy')
      await user.click(screen.getByRole('button', { name: 'Cadastrar e vincular' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Linha')).toHaveValue('puppy')
      })
      expect(screen.getByLabelText('Linha')).toBeDisabled()
    })

    it('registers the recipe in the saved market while the plan country is changed and not saved', async () => {
      const user = userEvent.setup()
      const { calls } = renderDetail({}, adminUser)

      await screen.findByText('BOWL-1')
      await user.selectOptions(screen.getByLabelText('País do plano'), 'US')
      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      expect(screen.getByText(/cadastrada agora no mercado BR/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Cadastrar e vincular' }))

      await waitFor(() => {
        expect(recipePosts(calls)).toHaveLength(1)
      })
      expect(recipePosts(calls)[0].search).toBe('?market=BR')
    })

    it('keeps the created recipe when the variation dialog is cancelled', async () => {
      const user = userEvent.setup()
      const { calls } = renderDetail()

      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      await user.click(screen.getByRole('button', { name: 'Cadastrar e vincular' }))
      await screen.findByRole('option', { name: 'Pato · pato' })
      await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(productPatches(calls)).toHaveLength(0)
      expect(calls.some((call) => call.method === 'DELETE' && call.path.includes('/recipe-content'))).toBe(false)
    })

    it('shows a refused key inside the dialog and keeps the variation fields', async () => {
      const user = userEvent.setup()
      renderDetail()

      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      await user.clear(screen.getByLabelText('Chave da receita'))
      await user.type(screen.getByLabelText('Chave da receita'), 'Pato X')
      await user.click(screen.getByRole('button', { name: 'Cadastrar e vincular' }))

      expect(await screen.findByText('A chave usa só letras minúsculas, números e hífens, por exemplo senior-cordeiro.')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText('SKU')).toHaveValue('PT-300')
      expect(screen.getByLabelText('Sabor')).toHaveValue('Pato')
    })

    it('selects the recipe registered meanwhile when the key is taken', async () => {
      const user = userEvent.setup()
      let registered = false
      const { calls } = renderDetail({
        routes: (call) => {
          if (call.path !== '/api/v1/admin/catalog/recipe-content') return undefined
          if (call.method === 'POST') {
            registered = true
            return jsonResponse({ message: 'A recipe with this key already exists in the market.', details: { code: 'recipe_key_taken' } }, 409)
          }
          if (call.method === 'GET' && registered) {
            return jsonResponse({
              market: 'BR',
              items: [...recipeList.items, { key: 'pato', name: 'Pato', lifeStage: 'senior', imageUrl: null, labelStatus: 'missing', variations: [] }],
            })
          }
          return undefined
        },
      })

      await addVariation(user, 'Pato')
      await user.click(screen.getByRole('button', { name: 'Criar receita pato' }))
      await user.click(screen.getByRole('button', { name: 'Cadastrar e vincular' }))

      await waitFor(() => {
        expect(screen.getByLabelText('Receita (conteúdo)')).toHaveValue('pato')
      })
      expect(screen.getByRole('status')).toHaveTextContent('A receita já existia e foi selecionada.')
      expect(screen.getByLabelText('Linha')).toHaveValue('senior')
      expect(productPatches(calls)).toHaveLength(0)
    })
  })

  describe('recipe content side panel', () => {
    const variant = productDetail.variants[0]
    const inactive = { ...productDetail, variants: [{ ...variant, active: false }] }

    // jsdom has no scrollIntoView; each test records the ids it scrolls to.
    function captureScrolls() {
      const scrolled: string[] = []
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        configurable: true,
        writable: true,
        value(this: Element) {
          scrolled.push(this.id)
        },
      })
      return scrolled
    }

    beforeEach(() => {
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
    })

    afterEach(() => {
      imageSizes.clear()
      delete (Element.prototype as Partial<Element>).scrollIntoView
    })

    function renderDetail(options: Parameters<typeof installAdminFetchMock>[1] = {}, user = operatorWriteUser) {
      seedAuth()
      const mock = installAdminFetchMock(user, options)
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')
      return mock
    }

    async function openPanel(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Conteúdo da receita de Frango 1kg' }))
      const panel = await screen.findByRole('dialog', { name: 'Conteúdo da receita Frango' })
      await within(panel).findByRole('heading', { name: 'Rótulo' })
      return panel
    }

    it('shows the five content sections of the recipe, without rename or delete', async () => {
      const user = userEvent.setup()
      const { calls } = renderDetail()

      const panel = await openPanel(user)
      for (const heading of ['Fase da vida', 'Apresentação na loja', 'Imagem da tela inicial', 'Miniatura do plano', 'Rótulo']) {
        expect(within(panel).getByRole('heading', { name: heading })).toBeInTheDocument()
      }
      expect(within(panel).getByRole('button', { name: 'Salvar rótulo' })).toBeInTheDocument()
      expect(within(panel).queryByRole('button', { name: 'Renomear' })).not.toBeInTheDocument()
      expect(within(panel).queryByRole('button', { name: 'Excluir receita' })).not.toBeInTheDocument()
      expect(within(panel).getByRole('link', { name: 'Abrir página da receita' })).toHaveAttribute('href', '/catalog/recipes/BR/turkey')
      expect(within(panel).getByRole('note')).not.toHaveTextContent('inclusive de outros produtos')
      expect(calls.some((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/recipe-content/turkey' && call.search === '?market=BR')).toBe(true)
    })

    it('shows the content read-only to a reader', async () => {
      const user = userEvent.setup()
      renderDetail({}, readonlyUser)

      const panel = await openPanel(user)
      expect(within(panel).queryByRole('button', { name: 'Salvar rótulo' })).not.toBeInTheDocument()
      expect(within(panel).queryByRole('button', { name: 'Salvar apresentação' })).not.toBeInTheDocument()
      expect(within(panel).queryByText('Escolher imagem')).not.toBeInTheDocument()
      expect(within(panel).getByLabelText('Fabricante')).toBeDisabled()
    })

    it('loads the recipe of the saved market while the plan country is changed and not saved', async () => {
      const user = userEvent.setup()
      const { calls } = renderDetail({}, adminUser)

      await screen.findByText('BOWL-1')
      await user.selectOptions(screen.getByLabelText('País do plano'), 'US')
      const panel = await openPanel(user)

      const get = calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/recipe-content/turkey')
      expect(get.map((call) => call.search)).toEqual(['?market=BR'])
      expect(within(panel).getByText('Receita turkey · mercado BR')).toBeInTheDocument()
    })

    it('says the content is shared with the variations of other products', async () => {
      const user = userEvent.setup()
      renderDetail({
        recipeContent: {
          ...recipeContent,
          variations: [
            { id: 'var-1', name: 'Frango 1kg', sku: 'BOWL-1', active: true, productId: 'prod-1', productName: 'Bowl Adulto' },
            { id: 'var-9', name: 'Frango 600g', sku: 'BOWL-9', active: true, productId: 'prod-2', productName: 'Bowl Filhote' },
          ],
        },
      })

      const panel = await openPanel(user)
      const note = within(panel).getByRole('note')
      expect(note).toHaveTextContent('Este conteúdo vale para 2 variações do mercado BR com a receita turkey')
      expect(note).toHaveTextContent('Mudar a fase muda a linha de todas.')
      expect(note).toHaveTextContent('Frango 1kg · Bowl Adulto (este produto)')
      expect(note).toHaveTextContent('Frango 600g · Bowl Filhote')
      expect(note).toHaveTextContent('inclusive de outros produtos')
    })

    it('reloads the product after an image is saved, so foto is no longer pending', async () => {
      const user = userEvent.setup()
      let imageSaved = false
      const { fetchMock } = renderDetail({
        product: inactive,
        routes: (call) => {
          if (call.method === 'PUT' && call.path.endsWith('/image')) imageSaved = true
          return undefined
        },
      })
      rewriteProductGet(fetchMock, (product) => (imageSaved
        ? { ...product, variants: (product.variants as Array<Record<string, unknown>>).map((item) => ({ ...item, recipeImageUrl })) }
        : product))

      expect(await screen.findByRole('button', { name: 'Abrir foto de Frango 1kg' })).toBeInTheDocument()
      const panel = await openPanel(user)
      imageSizes.set('banner.png', { width: 1024, height: 636 })
      await user.upload(within(panel).getByLabelText('Escolher imagem'), new File(['png-bytes'], 'banner.png', { type: 'image/png' }))
      await user.click(await within(panel).findByRole('button', { name: 'Salvar imagem' }))

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Abrir foto de Frango 1kg' })).not.toBeInTheDocument()
      })
      expect(screen.getAllByText('Imagem cadastrada').length).toBeGreaterThan(0)
    })

    it('shows the new line of linked variations after the life stage is saved', async () => {
      const user = userEvent.setup()
      let stageSaved = false
      const { calls, fetchMock } = renderDetail({
        routes: (call) => {
          if (call.method === 'PATCH' && call.path.endsWith('/recipe-content/turkey')) stageSaved = true
          return undefined
        },
      })
      rewriteProductGet(fetchMock, (product) => (stageSaved
        ? { ...product, variants: (product.variants as Array<Record<string, unknown>>).map((item) => ({ ...item, lifeStage: 'puppy' })) }
        : product))

      const panel = await openPanel(user)
      const listsBefore = calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/recipe-content').length
      await user.selectOptions(within(panel).getByLabelText('Fase da vida'), 'puppy')
      await user.click(within(panel).getByRole('button', { name: 'Salvar fase' }))

      expect(await within(panel).findByText('Fase salva: Filhote.')).toBeInTheDocument()
      await waitFor(() => {
        expect(within(screen.getByRole('table')).getByText('Filhote')).toBeInTheDocument()
      })
      expect(calls.filter((call) => call.method === 'GET' && call.path === '/api/v1/admin/catalog/recipe-content').length).toBeGreaterThan(listsBefore)
    })

    it('keeps a typed and unsaved country when the panel saves', async () => {
      const user = userEvent.setup()
      renderDetail({}, adminUser)

      await user.selectOptions(await screen.findByLabelText('País do plano'), 'US')
      const panel = await openPanel(user)
      await user.type(within(panel).getByLabelText('Fabricante'), ' Ltda')
      await user.click(within(panel).getByRole('button', { name: 'Salvar rótulo' }))
      await within(panel).findByText(/Rótulo salvo/)
      await user.click(within(panel).getByRole('button', { name: 'Fechar' }))

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(screen.getByLabelText('País do plano')).toHaveValue('US')
      expect(screen.getByText('País alterado. Salve antes de sair.')).toBeInTheDocument()
    })

    it('asks before discarding an unsaved label, and keeps it when declined', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      renderDetail()

      const panel = await openPanel(user)
      await user.type(within(panel).getByLabelText('Fabricante'), ' Ltda')
      await user.keyboard('{Escape}')

      expect(confirm).toHaveBeenCalledWith('Descartar as alterações não salvas do conteúdo da receita?')
      expect(screen.getByRole('dialog', { name: 'Conteúdo da receita Frango' })).toBeInTheDocument()
      expect(within(panel).getByLabelText('Fabricante')).toHaveValue(`${recipeContent.label?.manufacturer ?? ''} Ltda`)

      confirm.mockReturnValue(true)
      await user.click(within(panel).getByRole('button', { name: 'Fechar' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('closes without asking when nothing changed or only the life stage was picked', async () => {
      const user = userEvent.setup()
      const confirm = vi.spyOn(window, 'confirm')
      renderDetail()

      let panel = await openPanel(user)
      await user.click(within(panel).getByRole('button', { name: 'Fechar' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      panel = await openPanel(user)
      await user.selectOptions(within(panel).getByLabelText('Fase da vida'), 'puppy')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(confirm).not.toHaveBeenCalled()
    })

    it('opens the panel on the missing section from a pending item', async () => {
      const user = userEvent.setup()
      const scrolled = captureScrolls()
      renderDetail({ product: { ...productDetail, variants: [{ ...variant, active: false, recipePresentationReady: false }] } })

      await user.click(await screen.findByRole('button', { name: 'Abrir apresentação de Frango 1kg' }))
      const panel = await screen.findByRole('dialog', { name: 'Conteúdo da receita Frango' })
      await within(panel).findByRole('heading', { name: 'Apresentação na loja' })
      await waitFor(() => {
        expect(scrolled).toContain('apresentacao')
      })
    })

    it('keeps price and the recipe items of a variation without a recipe as text', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        product: {
          ...productDetail,
          variants: [
            { ...variant, active: false, regularPrice: null as unknown as number, recipePresentationReady: false },
            { ...variant, id: 'var-2', sku: 'BOWL-2', name: 'Pato 1kg', active: false, recipeKey: null, recipePresentationReady: false },
          ],
        },
      })
      renderAuthedPage(<ProductDetailPage />, '/catalog/products/prod-1', '/catalog/products/:productId')

      expect(await screen.findByRole('button', { name: 'Abrir apresentação de Frango 1kg' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^Abrir preço/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /de Pato 1kg$/ })).not.toBeInTheDocument()
    })

    it('opens the life stage of the linked recipe from the variation dialog', async () => {
      const user = userEvent.setup()
      const scrolled = captureScrolls()
      renderDetail()

      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      await screen.findByRole('option', { name: 'Carne · beef' })
      await user.click(screen.getByRole('button', { name: 'Editar fase' }))

      const panel = await screen.findByRole('dialog', { name: 'Conteúdo da receita Frango' })
      expect(screen.queryByRole('dialog', { name: 'Editar variação' })).not.toBeInTheDocument()
      await within(panel).findByRole('heading', { name: 'Fase da vida' })
      await waitFor(() => {
        expect(scrolled).toContain('fase')
      })
    })
  })
})
