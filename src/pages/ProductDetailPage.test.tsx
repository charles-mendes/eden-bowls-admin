import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProductDetailPage } from './ProductDetailPage'
import { jsonResponse, operatorWriteUser, productDetail, readonlyUser, recipeContent, recipeLabel } from '../test/fixtures'
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

const PRODUCT_PATH = '/api/v1/admin/catalog/products/prod-1'

function hangProductGet(calls: FetchCall[], fetchMock: ReturnType<typeof installAdminFetchMock>['fetchMock']) {
  const impl = fetchMock.getMockImplementation()
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input), 'http://admin.local')
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method === 'GET' && url.pathname === PRODUCT_PATH) {
      calls.push({ url: String(input), path: url.pathname, search: url.search, method, authorization: '', body: null })
      return new Promise(() => undefined)
    }
    return impl!(input, init)
  })
}

const inactive = { ...productDetail, variants: [{ ...productDetail.variants[0], active: false }] }

function renderDetail(route = '/catalog/products/prod-1') {
  return renderAuthedPage(<ProductDetailPage />, route, '/catalog/products/:productId')
}

function patches(calls: FetchCall[]) {
  return calls.filter((call) => call.method === 'PATCH' && call.path === PRODUCT_PATH)
}

async function openTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('tab', { name }))
}

describe('ProductDetailPage', () => {
  afterEach(() => {
    localStorage.clear()
    imageSizes.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('Dados gerais', () => {
    it('Product save omits variations', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      const name = await screen.findByLabelText('Nome do produto')
      await waitFor(() => expect(name).toHaveValue('Frango'))
      await user.clear(name)
      await user.type(name, 'Peru e Arroz')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(await screen.findByText('Dados gerais salvos.')).toBeInTheDocument()
      const [patch] = patches(calls)
      expect(patch.body).toEqual({ name: 'Peru e Arroz', flavorAliases: 'peru', shortLabel: 'Peru', lifeStage: 'adult' })
      expect(patch.body).not.toHaveProperty('variants')
      expect(patch.body).not.toHaveProperty('planCountry')
      expect(patch.body).not.toHaveProperty('code')
      expect(patch.authorization).toBe('Bearer access-token')
    })

    it('Changed field warns before leaving', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await user.type(await screen.findByLabelText('Nome na fila de produção'), ' Light')
      expect(screen.getByText('Dados gerais alterados. Salve antes de sair.')).toBeInTheDocument()

      // The typed field survives a tab switch: it lives on the page, not in the tab.
      await openTab(user, 'Variações')
      await openTab(user, 'Dados gerais')
      expect(screen.getByLabelText('Nome na fila de produção')).toHaveValue('Peru Light')

      await user.click(screen.getByRole('button', { name: 'Salvar' }))
      await waitFor(() => {
        expect(screen.queryByText('Dados gerais alterados. Salve antes de sair.')).not.toBeInTheDocument()
      })
    })

    it('stays available on a published product and says the life stage applies to every variation', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, { product: { ...productDetail, active: true } })
      renderDetail()

      expect(await screen.findByText('Mudar a fase muda a linha de todas as variações deste produto.')).toBeInTheDocument()
      await user.selectOptions(screen.getByLabelText('Fase de vida'), 'senior')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      await waitFor(() => expect(patches(calls)[0]?.body).toMatchObject({ lifeStage: 'senior' }))
    })

    it('Writer opens a draft: code and market are text', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderDetail()

      // Code and market are shown once, in the page header.
      expect(await screen.findByText('Código turkey · mercado BR · BRL')).toBeInTheDocument()
      expect(screen.queryByLabelText('Código')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('País do plano')).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: /mercado/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Loja › Plano' })).toHaveAttribute('href', '/catalog/plan?market=BR')
    })

    it('shows the API refusal of a field in Portuguese and keeps the typed value', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: (call) => (call.method === 'PATCH' && call.path === PRODUCT_PATH
          ? jsonResponse({ message: 'Short name must be at most 64 characters.', details: { code: 'product_short_label_invalid' } }, 422)
          : undefined),
      })
      renderDetail()

      await user.type(await screen.findByLabelText('Nome na fila de produção'), ' X')
      await user.click(screen.getByRole('button', { name: 'Salvar' }))

      expect(await screen.findByText('O nome na fila de produção tem no máximo 64 caracteres.')).toBeInTheDocument()
      expect(screen.getByLabelText('Nome na fila de produção')).toHaveValue('Peru X')
    })
  })

  describe('publication', () => {
    it('Publish uses the loaded product', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await user.click(await screen.findByRole('button', { name: 'Publicar' }))

      expect(await screen.findByText('Publicado.')).toBeInTheDocument()
      expect(patches(calls)[0].body).toEqual({ active: true })
    })

    it('Publish is absent while the product is loading', async () => {
      seedAuth()
      const { fetchMock, calls } = installAdminFetchMock(operatorWriteUser)
      hangProductGet(calls, fetchMock)
      renderDetail()

      await waitFor(() => expect(calls.some((call) => call.method === 'GET' && call.path === PRODUCT_PATH)).toBe(true))
      for (const name of ['Publicar', 'Desativar', 'Salvar', 'Sincronizar Stripe', 'Excluir produto']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      expect(calls.some((call) => call.method === 'PATCH')).toBe(false)
    })

    it('Readonly detail has no mutations', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(readonlyUser)
      renderDetail()

      expect(await screen.findByLabelText('Nome do produto')).toHaveAttribute('readonly')
      for (const name of ['Salvar', 'Publicar', 'Desativar', 'Sincronizar Stripe', 'Excluir produto']) {
        expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
      }
      await openTab(user, 'Variações')
      expect(await screen.findByText('BOWL-1')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Adicionar variação' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Editar variação/ })).not.toBeInTheDocument()
    })

    it('Readonly tabs show the content without save, upload or remove', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(readonlyUser, { recipeContent: { ...recipeContent, imageUrl: 'https://api.test/recipe-images/x.webp', label: recipeLabel } })
      renderDetail()

      await openTab(user, 'Rótulo')
      expect(await screen.findByRole('heading', { name: 'Rótulo' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Salvar rótulo' })).not.toBeInTheDocument()
      await openTab(user, 'Imagens')
      expect(await screen.findByRole('heading', { name: 'Imagem da tela inicial' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Remover imagem' })).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Escolher imagem')).not.toBeInTheDocument()
      await openTab(user, 'Apresentação')
      expect(screen.queryByRole('button', { name: 'Salvar apresentação' })).not.toBeInTheDocument()
    })

    it('Published linked product deactivates instead of deleting', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        product: { ...productDetail, active: true, canDelete: false, variants: productDetail.variants.map((item) => ({ ...item, canDelete: false })) },
      })
      renderDetail()

      await user.click(await screen.findByRole('button', { name: 'Desativar' }))

      await waitFor(() => expect(findCall(calls, 'PATCH', '/admin/catalog/products/prod-1')?.body).toEqual({ active: false }))
      expect(screen.queryByRole('button', { name: 'Excluir produto' })).not.toBeInTheDocument()
      expect(vi.mocked(window.confirm).mock.calls[0][0]).toContain('mantém o cadastro e a cobrança atual')
    })

    it('names the variation when publish is blocked', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { product: { ...productDetail, gaps: [{ variationId: 'var-1', currencies: ['BRL'] }] } })
      renderDetail()

      expect(await screen.findByText(/faltam preços Stripe para Frango 1kg \(BRL\)/)).toBeInTheDocument()
    })

    it('reloads the detail when delete reports the product is in use', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = installAdminFetchMock(operatorWriteUser, { catalogDelete: 'in_use' })
      renderDetail()

      await user.click(await screen.findByRole('button', { name: 'Excluir produto' }))

      expect(await screen.findByText('Este produto já está em assinaturas e não pode ser excluído.')).toBeInTheDocument()
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Excluir produto' })).not.toBeInTheDocument())
      expect(calls.filter((call) => call.method === 'GET' && call.path === PRODUCT_PATH).length).toBeGreaterThan(1)
    })

    it('keeps the product on screen when Stripe archive fails', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      installAdminFetchMock(operatorWriteUser, { catalogDelete: 'archive' })
      renderDetail()

      await user.click(await screen.findByRole('button', { name: 'Excluir produto' }))

      expect(await screen.findByText('Não foi possível arquivar o produto na Stripe. O cadastro foi mantido.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Excluir produto' })).toBeInTheDocument()
    })
  })

  describe('content tabs', () => {
    it('Open the label tab', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { recipeContent: { ...recipeContent, label: recipeLabel, labelStatus: 'incomplete', labelMissing: ['notices'] } })
      renderDetail()

      await openTab(user, 'Rótulo')

      const panel = await screen.findByRole('tabpanel')
      expect(within(panel).getByRole('heading', { name: 'Rótulo' })).toBeInTheDocument()
      expect(within(panel).getByText('Rótulo incompleto')).toBeInTheDocument()
      expect(within(panel).getByLabelText('Fabricante')).toHaveValue('Pawl & Bowl LLC')
    })

    it('saves the label to the content route of the product', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Rótulo')
      await user.type(await screen.findByLabelText('Fabricante'), 'Eden')
      await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))

      await waitFor(() => expect(findCall(calls, 'PUT', '/admin/catalog/products/prod-1/content/label')).toBeTruthy())
      expect(calls.some((call) => call.path.includes('recipe-content'))).toBe(false)
    })

    it('Unsaved label asks before switching, and declining keeps it', async () => {
      const user = userEvent.setup()
      seedAuth()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Rótulo')
      await user.type(await screen.findByLabelText('Fabricante'), 'Eden')
      await openTab(user, 'Variações')

      expect(confirm).toHaveBeenCalledWith('Descartar as alterações não salvas do conteúdo?')
      expect(screen.getByRole('tab', { name: 'Rótulo' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByLabelText('Fabricante')).toHaveValue('Eden')

      confirm.mockReturnValue(true)
      await openTab(user, 'Variações')
      expect(await screen.findByText('BOWL-1')).toBeInTheDocument()
    })

    it('Nothing changed: the tab changes without asking', async () => {
      const user = userEvent.setup()
      seedAuth()
      const confirm = vi.spyOn(window, 'confirm')
      installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Rótulo')
      await screen.findByLabelText('Fabricante')
      await openTab(user, 'Variações')

      expect(confirm).not.toHaveBeenCalled()
      expect(await screen.findByText('BOWL-1')).toBeInTheDocument()
    })

    it('Link to the label opens the Rótulo tab', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderDetail('/catalog/products/prod-1#rotulo')

      expect(await screen.findByLabelText('Fabricante')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Rótulo' })).toHaveAttribute('aria-selected', 'true')
    })

    it('Unknown anchor opens Dados gerais', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderDetail('/catalog/products/prod-1#outra-coisa')

      expect(await screen.findByLabelText('Nome do produto')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Dados gerais' })).toHaveAttribute('aria-selected', 'true')
    })

    it('Recipe without presentation starts empty and can be saved', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Apresentação')
      expect(await screen.findByRole('heading', { name: 'Apresentação na loja' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Salvar apresentação' })).toBeInTheDocument()
    })

    it('Removing the image of an active recipe stays in the Imagens tab', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      installAdminFetchMock(operatorWriteUser, { recipeContent: { ...recipeContent, imageUrl: 'https://api.test/recipe-images/x.webp' } })
      renderDetail()

      await openTab(user, 'Imagens')
      await user.click(await screen.findByRole('button', { name: 'Remover imagem' }))

      expect(await screen.findByText('A imagem não pode ser removida enquanto houver variação ativa deste produto. Desative as variações antes.')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Imagens' })).toHaveAttribute('aria-selected', 'true')
    })

    it('reloads the product after an image is saved', async () => {
      const user = userEvent.setup()
      vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
      seedAuth()
      imageSizes.set('banner.png', { width: 1024, height: 636 })
      const { calls } = installAdminFetchMock(operatorWriteUser, { product: inactive })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Abrir foto de Frango 1kg' }))
      expect(screen.getByRole('tab', { name: 'Imagens' })).toHaveAttribute('aria-selected', 'true')

      await user.upload(await screen.findByLabelText('Escolher imagem'), new File(['png'], 'banner.png', { type: 'image/png' }))
      await user.click(await screen.findByRole('button', { name: 'Salvar imagem' }))
      await waitFor(() => expect(findCall(calls, 'PUT', '/admin/catalog/products/prod-1/content/image')).toBeTruthy())
      await waitFor(() => expect(calls.filter((call) => call.method === 'GET' && call.path === PRODUCT_PATH).length).toBeGreaterThan(1))
    })
  })

  describe('Variações', () => {
    it('Missing presentation: the pending item opens the Apresentação tab', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        product: { ...productDetail, variants: [{ ...productDetail.variants[0], active: false, recipePresentationReady: false }] },
      })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Abrir apresentação de Frango 1kg' }))

      expect(screen.getByRole('tab', { name: 'Apresentação' })).toHaveAttribute('aria-selected', 'true')
      expect(await screen.findByRole('heading', { name: 'Apresentação na loja' })).toBeInTheDocument()
    })

    it('Missing price is plain text', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        product: { ...productDetail, variants: [{ ...productDetail.variants[0], active: false, regularPrice: null as unknown as number }] },
      })
      renderDetail()

      await openTab(user, 'Variações')
      expect(await screen.findByText(/Pendente:/)).toHaveTextContent('preço')
      expect(screen.queryByRole('button', { name: 'Abrir preço de Frango 1kg' })).not.toBeInTheDocument()
    })

    it('Edit sends one existing variation with pack fields only', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, { product: inactive })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('turkey')).toBeInTheDocument()
      expect(within(dialog).getByText('Adulto')).toBeInTheDocument()
      expect(within(dialog).queryByLabelText('Sabor')).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('combobox', { name: /Receita/ })).not.toBeInTheDocument()
      expect(within(dialog).queryByLabelText('Slug do sabor')).not.toBeInTheDocument()
      await user.clear(within(dialog).getByLabelText('Preço'))
      await user.type(within(dialog).getByLabelText('Preço'), '99.9')
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      expect(await screen.findByText('Variação atualizada.')).toBeInTheDocument()
      expect(patches(calls)[0].body).toEqual({
        variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', weight: '1kg', ncm: '', origin: 0, finalImageReady: false, labelDataReady: false, regularPrice: 99.9 }],
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('adds a 300 g variation and shows it in the table', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
      await user.type(screen.getByLabelText('SKU'), 'TURKEY-300')
      await user.type(screen.getByLabelText('Nome'), 'Peru 300g')
      await user.type(screen.getByLabelText('Peso'), '300g')
      await user.type(screen.getByLabelText('Preço'), '39.9')
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      expect(await screen.findByText('Variação adicionada.')).toBeInTheDocument()
      expect(patches(calls)[0].body).toMatchObject({ variants: [{ sku: 'TURKEY-300', name: 'Peru 300g', weight: '300g', regularPrice: 39.9 }] })
      expect((patches(calls)[0].body as { variants: Array<Record<string, unknown>> }).variants[0]).not.toHaveProperty('id')
      expect(screen.getByText('300 g')).toBeInTheDocument()
    })

    it('Weight already on the product', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        routes: (call) => (call.method === 'PATCH' && call.path === PRODUCT_PATH
          ? jsonResponse({ message: 'Another variation of this product already has this weight.', details: { code: 'variation_weight_taken', weight: '300g' } }, 422)
          : undefined),
      })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
      await user.type(screen.getByLabelText('SKU'), 'TURKEY-300')
      await user.type(screen.getByLabelText('Peso'), '300g')
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      expect(await screen.findByText('Este produto já tem uma variação de 300 g. Use outro peso.')).toBeInTheDocument()
      expect(screen.getByLabelText('SKU')).toHaveValue('TURKEY-300')
      expect(screen.getByLabelText('Peso')).toHaveValue('300g')
    })

    it('Cancel discards the dialog', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, { product: inactive })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' }))
      await user.clear(screen.getByLabelText('Nome'))
      await user.type(screen.getByLabelText('Nome'), 'Outro nome')
      await user.click(screen.getByRole('button', { name: 'Cancelar' }))

      expect(patches(calls)).toHaveLength(0)
      expect(screen.getByText('Frango 1kg')).toBeInTheDocument()
    })

    it('rejects a new variation without name and SKU without a request', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Adicionar variação' }))
      await user.click(screen.getByRole('button', { name: 'Salvar variação' }))

      expect(screen.getByText('Nova variação precisa de nome ou SKU.')).toBeInTheDocument()
      expect(patches(calls)).toHaveLength(0)
    })

    it('locks active variations of a published product and still offers adding one', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { product: { ...productDetail, active: true } })
      renderDetail()

      await openTab(user, 'Variações')
      expect(await screen.findByRole('button', { name: 'Editar variação Frango 1kg' })).toBeDisabled()
      expect(screen.getByText('Ativa e publicada: desative para editar.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Adicionar variação' })).toBeInTheDocument()
    })

    it('activates and deactivates a variation through the activation route', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Desativar variação Frango 1kg' }))
      expect(await screen.findByText('Variação "Frango 1kg" desativada.')).toBeInTheDocument()
      expect(findCall(calls, 'POST', '/variations/var-1/activation')?.body).toEqual({ active: false })

      await user.click(screen.getByRole('button', { name: 'Ativar variação Frango 1kg' }))
      expect(await screen.findByText('Variação "Frango 1kg" ativada.')).toBeInTheDocument()
    })

    it('Activation refused without presentation names it and opens the Apresentação tab', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        product: inactive,
        routes: (call) => (call.method === 'POST' && call.path.endsWith('/activation')
          ? jsonResponse({ message: 'Variation cannot be activated: missing presentation.', details: { code: 'recipe_publish_refused', missing: ['presentation'] } }, 422)
          : undefined),
      })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Ativar variação Frango 1kg' }))

      expect(await screen.findByText(/Ativação recusada\. Falta: apresentação da receita na loja/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Abrir Apresentação' }))
      expect(screen.getByRole('tab', { name: 'Apresentação' })).toHaveAttribute('aria-selected', 'true')
    })

    it('the checklist shows what keeps the product out of the store and opens the tab that solves it', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        product: { ...inactive, active: false, content: { ...inactive.content!, imageUrl: null, presentationReady: false } },
      })
      renderDetail()

      expect(await screen.findByRole('heading', { name: 'O que falta para aparecer na loja' })).toBeInTheDocument()
      expect(screen.getByText('Próximo passo').closest('.readiness-next-step')).toHaveTextContent('Foto da receita na loja')

      await user.click(screen.getByRole('button', { name: 'Abrir Imagens (Foto da receita na loja)' }))
      expect(screen.getByRole('tab', { name: 'Imagens' })).toHaveAttribute('aria-selected', 'true')
    })

    it('names the active subscriptions when deactivation is refused', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { catalogActivation: 'in_use' })
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Desativar variação Frango 1kg' }))

      expect(await screen.findByText('Esta variação está em 3 assinaturas ativas e não pode ser desativada.')).toBeInTheDocument()
    })

    it('deletes an existing variation after confirmation', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderDetail()

      await openTab(user, 'Variações')
      await user.click(await screen.findByRole('button', { name: 'Excluir variação Frango 1kg' }))

      expect(await screen.findByText('Variação "Frango 1kg" excluída.')).toBeInTheDocument()
      expect(findCall(calls, 'DELETE', '/admin/catalog/products/prod-1/variations/var-1')).toBeTruthy()
    })

    it('opens the variation named in the link on the Variações tab', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { product: inactive })
      renderDetail('/catalog/products/prod-1?variation=var-1')

      expect(await screen.findByRole('heading', { name: 'Editar variação' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Variações' })).toHaveAttribute('aria-selected', 'true')
      expect(document.getElementById('variation-var-1')).toHaveClass('row-focused')
    })
  })
})
