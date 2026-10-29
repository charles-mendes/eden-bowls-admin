import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeContentPage } from './RecipeContentPage'
import { jsonResponse, operatorWriteUser, readonlyUser, recipeContent, recipeLabel, recipePresentation } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// jsdom does not decode images, so each test file name maps to a pixel size.
const imageSizes = new Map<string, { width: number; height: number }>()

function testImageSize(file: File) {
  const size = imageSizes.get(file.name)
  if (!size) throw new Error('unknown test image')
  return size
}

vi.mock('../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/imageUpload')>()
  return {
    ...actual,
    checkRecipeImage: (file: File) => actual.checkRecipeImage(file, async () => testImageSize(file)),
    checkRecipePlanImage: (file: File) => actual.checkRecipePlanImage(file, async () => testImageSize(file)),
  }
})

const route = '/catalog/recipes/BR/turkey'
const usRoute = '/catalog/recipes/US/turkey'
const pattern = '/catalog/recipes/:market/:recipeKey'

function png(name: string, width: number, height: number) {
  imageSizes.set(name, { width, height })
  return new File(['png-bytes'], name, { type: 'image/png' })
}

describe('RecipeContentPage', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
  })

  afterEach(() => {
    localStorage.clear()
    imageSizes.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('names the market and every variation that shares the content', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    const shared = await screen.findByRole('heading', { name: 'Variações que usam este conteúdo' })
    const section = shared.closest('section')!
    expect(within(section).getByText('Frango 1kg')).toBeInTheDocument()
    expect(within(section).getByText('Frango 500g')).toBeInTheDocument()
    expect(screen.getByText(/Receita turkey · mercado BR/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Frango' })).toBeInTheDocument()
    expect(within(section).getAllByRole('link', { name: 'Bowl Adulto' })[0]).toHaveAttribute('href', '/catalog/products/prod-1')
    expect(within(section).getByRole('link', { name: 'Abrir variação Frango 500g' })).toHaveAttribute('href', '/catalog/products/prod-1?variation=var-2')
    expect(calls.some((call) => call.path === '/api/v1/admin/catalog/recipe-content/turkey' && call.search === '?market=BR')).toBe(true)
    expect(screen.getByRole('link', { name: 'Voltar às receitas' })).toHaveAttribute('href', '/catalog/recipes?market=BR')
  })

  it('lists variations of other products that use the same recipe', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      recipeContent: {
        ...recipeContent,
        flavorSlug: 'beef',
        variations: [
          { id: '1001', name: 'Beef 300g', sku: '1001', active: false, productId: 'prod-1', productName: 'Flavors BR' },
          { id: '3000', name: 'Bovino', sku: '3000', active: true, productId: 'prod-9', productName: 'Plano antigo' },
        ],
      },
    })
    renderAuthedPage(<RecipeContentPage />, '/catalog/recipes/BR/beef', pattern)

    const section = (await screen.findByRole('heading', { name: 'Variações que usam este conteúdo' })).closest('section')!
    expect(within(section).getByText('Bovino')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'Plano antigo' })).toHaveAttribute('href', '/catalog/products/prod-9')
    expect(within(section).getByText(/2 variações com Receita \(conteúdo\) beef/)).toBeInTheDocument()
  })

  it('renames the recipe and keeps its key', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    await user.click(await screen.findByRole('button', { name: 'Renomear' }))
    await user.clear(screen.getByLabelText('Nome da receita'))
    await user.type(screen.getByLabelText('Nome da receita'), 'Frango adulto')
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }))

    expect(await screen.findByRole('heading', { name: 'Frango adulto' })).toBeInTheDocument()
    expect(screen.getByText('Receita renomeada.')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({
      path: '/api/v1/admin/catalog/recipe-content/turkey',
      search: '?market=BR',
      body: { name: 'Frango adulto' },
    })
  })

  it('changes the life stage of the recipe', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    const select = await screen.findByLabelText('Fase da vida')
    expect(select).toHaveValue('adult')
    expect(screen.getByRole('button', { name: 'Salvar fase' })).toBeDisabled()
    await user.selectOptions(select, 'senior')
    await user.click(screen.getByRole('button', { name: 'Salvar fase' }))

    expect(await screen.findByText('Fase salva: Sênior.')).toBeInTheDocument()
    expect(screen.getByText(/A receita é sênior/)).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({
      path: '/api/v1/admin/catalog/recipe-content/turkey',
      search: '?market=BR',
      body: { lifeStage: 'senior' },
    })
  })

  it('offers no delete for a recipe in use', async () => {
    seedAuth()
    installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    expect(await screen.findByRole('button', { name: 'Renomear' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excluir receita' })).not.toBeInTheDocument()
  })

  it('explains how to link an unused recipe and deletes it back to the list', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, '/catalog/recipes/BR/senior-lamb', pattern)

    expect(await screen.findByText(/Nenhuma variação usa esta receita/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Excluir receita' }))

    await waitFor(() => expect(calls.some((call) => call.method === 'DELETE' && call.path === '/api/v1/admin/catalog/recipe-content/senior-lamb')).toBe(true))
  })

  it('shows readonly no rename or delete', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser)
    renderAuthedPage(<RecipeContentPage />, '/catalog/recipes/BR/senior-lamb', pattern)

    expect(await screen.findByRole('heading', { name: 'Sênior Cordeiro' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Renomear|Excluir receita/ })).not.toBeInTheDocument()
  })

  describe('store presentation', () => {
    const presentationSection = async () => (await screen.findByRole('heading', { name: 'Apresentação na loja' })).closest('section')!

    it('shows the stored presentation and saves it whole', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, { recipeContent: { ...recipeContent, presentation: recipePresentation } })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      const section = await presentationSection()
      expect(within(section).getByText('Cadastrada')).toBeInTheDocument()
      expect(within(section).getByLabelText('Título')).toHaveValue('Receita de Frango')
      expect(within(section).getByLabelText(/^Nome curto/)).toHaveValue('Frango')
      expect(within(section).getByLabelText('Destaque 2')).toHaveValue('Arroz integral')
      expect(within(section).getByLabelText('Fundo da etiqueta')).toHaveValue('#F6E3DF')

      await user.clear(within(section).getByLabelText('Chamada'))
      await user.type(within(section).getByLabelText('Chamada'), 'Nova chamada')
      await user.click(within(section).getByRole('button', { name: 'Adicionar destaque' }))
      await user.click(within(section).getByRole('button', { name: 'Salvar apresentação' }))

      expect(await within(section).findByRole('status')).toHaveTextContent('Apresentação salva.')
      const put = calls.find((call) => call.method === 'PUT' && call.path === '/api/v1/admin/catalog/recipe-content/turkey/presentation')
      expect(put?.search).toBe('?market=BR')
      // The blank highlight added last is dropped before sending.
      expect(put?.body).toEqual({ presentation: { ...recipePresentation, tagline: 'Nova chamada' } })
    })

    it('marks the fields the API refuses and keeps what was typed', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...recipeContent, presentation: recipePresentation },
        routes: (call) => (
          call.method === 'PUT' && call.path.endsWith('/presentation')
            ? jsonResponse({ message: 'Invalid presentation fields: colors.pillBg.', details: { code: 'recipe_presentation_invalid', fields: ['colors.pillBg', 'highlights[1]'] } }, 422)
            : undefined
        ),
      })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      const section = await presentationSection()
      await user.clear(within(section).getByLabelText('Fundo da etiqueta'))
      await user.type(within(section).getByLabelText('Fundo da etiqueta'), 'red')
      await user.click(within(section).getByRole('button', { name: 'Salvar apresentação' }))

      expect(await within(section).findByRole('alert')).toHaveTextContent('Apresentação inválida. Confira: fundo da etiqueta, destaque 2.')
      expect(within(section).getByLabelText('Fundo da etiqueta')).toHaveValue('red')
      expect(within(section).getByLabelText('Fundo da etiqueta')).toHaveAttribute('aria-invalid', 'true')
      expect(within(section).getByLabelText('Destaque 2')).toHaveAttribute('aria-invalid', 'true')
      expect(within(section).getByLabelText('Título')).not.toHaveAttribute('aria-invalid')
    })

    it('says activation waits for a recipe without presentation', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      const section = await presentationSection()
      expect(within(section).getByText('Sem apresentação')).toBeInTheDocument()
      expect(within(section).getByText(/as variações desta receita não podem ser ativadas/)).toBeInTheDocument()
      expect(within(section).getByLabelText('Título')).toHaveValue('')
      expect(within(section).getByLabelText('Destaque 1')).toHaveValue('')
    })

    it('shows readonly the presentation without saving', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, { recipeContent: { ...recipeContent, presentation: recipePresentation } })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      const section = await presentationSection()
      expect(within(section).getByLabelText('Título')).toBeDisabled()
      expect(within(section).getByLabelText('Cor principal')).toBeDisabled()
      expect(within(section).queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('plan thumbnail', () => {
    it('says the plan uses the home image while no thumbnail is stored', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      expect(await screen.findByRole('heading', { name: 'Miniatura do plano' })).toBeInTheDocument()
      expect(screen.getByText('Sem miniatura. O plano usa a imagem da tela inicial.')).toBeInTheDocument()
    })

    it('stops the banner and the 200 px sizes, saves a 400 px square into the library, then unlinks it', async () => {
      const user = userEvent.setup()
      seedAuth()
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = installAdminFetchMock(operatorWriteUser, { mediaAssets: [] })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      const input = await screen.findByLabelText('Enviar nova')
      await user.upload(input, png('banner.png', 1024, 636))
      expect(await screen.findByText('A imagem tem 1024 × 636 px e precisa ter 400 × 400 px.')).toBeInTheDocument()
      await user.upload(input, png('pequena.png', 200, 200))
      expect(await screen.findByText('A imagem tem 200 × 200 px e precisa ter 400 × 400 px.')).toBeInTheDocument()
      expect(calls.some((call) => call.path.endsWith('/plan-image'))).toBe(false)

      await user.upload(input, png('pacote.png', 400, 400))
      expect(await screen.findByText('Nova miniatura: pacote.png · 400 × 400 px. Ainda não foi salva.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Salvar miniatura' }))
      expect(await screen.findByText('Miniatura salva e guardada na Biblioteca de imagens. A tela Plano passa a usar esta imagem.')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Miniatura cadastrada do plano' })).toHaveAttribute('src', '/recipe-images/plan-br-101.webp')
      expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/plan-image'))).toMatchObject({
        path: '/api/v1/admin/catalog/recipe-content/turkey/plan-image',
        search: '?market=BR',
        body: { mimeType: 'image/png', originalFilename: 'pacote.png' },
      })
      expect(screen.queryByRole('button', { name: 'Remover miniatura' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Desvincular miniatura' }))
      expect(confirm).toHaveBeenCalledWith('Desvincular a miniatura? A imagem sai do card do plano e continua na Biblioteca de imagens.')
      expect(await screen.findByText('Miniatura desvinculada. A tela Plano volta a usar a imagem da tela inicial, e a imagem continua na Biblioteca de imagens.')).toBeInTheDocument()
      expect(calls.some((call) => call.method === 'DELETE' && call.path.endsWith('/plan-image'))).toBe(true)
    })

    it('links a thumbnail chosen from the library of the market', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      await user.click(await screen.findByRole('button', { name: 'Escolher da biblioteca' }))
      const dialog = await screen.findByRole('dialog', { name: 'Escolher da biblioteca' })
      expect(within(dialog).queryByRole('img', { name: 'adulto-frango-antiga_400.png' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('img', { name: 'adult-chicken_400.png' })).not.toBeInTheDocument()
      await user.click(await within(dialog).findByRole('button', { name: 'Usar adulto-frango_400.png' }))

      expect(await screen.findByText('Miniatura adulto-frango_400.png vinculada. A tela Plano passa a usar esta imagem.')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Miniatura cadastrada do plano' })).toHaveAttribute('src', '/recipe-images/plan-br-21.webp')
      expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/plan-image'))?.body).toEqual({ assetId: 21 })
      expect(screen.getByRole('link', { name: 'Biblioteca de imagens' })).toHaveAttribute('href', '/catalog/media?market=BR&kind=plan')
      expect(calls.some((call) => call.path === '/api/v1/admin/media' && call.search === '?market=BR&kind=plan')).toBe(true)
    })

    it('readonly sees the thumbnail without the library actions', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, { recipeContent: { ...recipeContent, planImageAssetId: 21, planImageUrl: '/recipe-images/plan-br-21.webp' } })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      expect(await screen.findByRole('img', { name: 'Miniatura cadastrada do plano' })).toHaveAttribute('src', '/recipe-images/plan-br-21.webp')
      expect(screen.queryByRole('button', { name: 'Escolher da biblioteca' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Desvincular miniatura' })).not.toBeInTheDocument()
    })
  })

  describe('home banner', () => {
    const linked = { ...recipeContent, imageUrl: '/recipe-images/banner-br-41.webp', imageAssetId: 41 }

    it('stops an image of the wrong size in the panel without sending it', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      await screen.findByText('Enviar nova imagem')
      await user.upload(screen.getByLabelText('Enviar nova imagem'), png('grande.png', 2048, 1272))

      expect(await screen.findByText('A imagem tem 2048 × 1272 px e precisa ter 1024 × 636 px.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Salvar imagem' })).not.toBeInTheDocument()
      expect(calls.some((call) => call.method === 'PUT')).toBe(false)
    })

    it('uploads a valid image into the library and links it as the banner', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      await screen.findByText('Enviar nova imagem')
      await user.upload(screen.getByLabelText('Enviar nova imagem'), png('receita-frango-pt.png', 1024, 636))

      expect(await screen.findByRole('img', { name: 'Prévia da nova imagem' })).toHaveAttribute('src', 'blob:preview')
      expect(screen.getByText('Nova imagem: receita-frango-pt.png · 1024 × 636 px. Ainda não foi salva.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Salvar imagem' }))

      expect(await screen.findByText('Imagem salva e guardada na Biblioteca de imagens. A loja passa a usar esta imagem.')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Imagem cadastrada da receita' })).toHaveAttribute('src', expect.stringMatching(/^\/recipe-images\/banner-br-\d+\.webp$/))
      const put = calls.find((call) => call.method === 'PUT')
      expect(put?.path).toBe('/api/v1/admin/catalog/recipe-content/turkey/image')
      expect(put?.search).toBe('?market=BR')
      expect(put?.body).toEqual({ mimeType: 'image/png', imageBase64: btoa('png-bytes'), originalFilename: 'receita-frango-pt.png' })
    })

    it('links a banner chosen from the banner library of the market', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser)
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      await user.click(await screen.findByRole('button', { name: 'Escolher imagem da biblioteca' }))
      const dialog = await screen.findByRole('dialog', { name: 'Escolher imagem da biblioteca' })
      expect(within(dialog).queryByRole('img', { name: 'adulto-frango_400.png' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('img', { name: 'receita-frango-antiga.png' })).not.toBeInTheDocument()
      expect(within(dialog).queryByRole('img', { name: 'recipe-chicken.png' })).not.toBeInTheDocument()
      await user.click(await within(dialog).findByRole('button', { name: 'Usar receita-frango-pt.png' }))

      expect(await screen.findByText('Destaque receita-frango-pt.png vinculado. A loja passa a usar esta imagem.')).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Imagem cadastrada da receita' })).toHaveAttribute('src', '/recipe-images/banner-br-41.webp')
      expect(calls.find((call) => call.method === 'PUT' && call.path.endsWith('/turkey/image'))?.body).toEqual({ assetId: 41 })
      expect(calls.some((call) => call.path === '/api/v1/admin/media' && call.search === '?market=BR&kind=banner')).toBe(true)
    })

    it('shows the API size refusal in the image card', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, { recipeImage: 'invalid' })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      await screen.findByText('Enviar nova imagem')
      await user.upload(screen.getByLabelText('Enviar nova imagem'), png('banner.png', 1024, 636))
      await user.click(await screen.findByRole('button', { name: 'Salvar imagem' }))

      const alert = await screen.findByText('A imagem tem 1200 × 800 px e precisa ter 1024 × 636 px.')
      expect(alert.closest('section')).toContainElement(screen.getByRole('heading', { name: 'Imagem da tela inicial' }))
    })

    it('keeps the banner when the API refuses to unlink it for an active variation', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      installAdminFetchMock(operatorWriteUser, { recipeContent: linked })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      await user.click(await screen.findByRole('button', { name: 'Desvincular imagem' }))

      expect(window.confirm).toHaveBeenCalledWith('Desvincular a imagem? Ela sai do destaque da tela inicial e continua na Biblioteca de imagens.')
      expect(await screen.findByText(/não pode ser removida enquanto houver variação ativa/)).toBeInTheDocument()
      expect(screen.getByRole('img', { name: 'Imagem cadastrada da receita' })).toHaveAttribute('src', '/recipe-images/banner-br-41.webp')
    })

    it('unlinks the banner when every variation is inactive, and the image stays in the library', async () => {
      const user = userEvent.setup()
      seedAuth()
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...linked, variations: recipeContent.variations.map((item) => ({ ...item, active: false })) },
      })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      expect(await screen.findByRole('link', { name: 'Biblioteca de imagens' })).toHaveAttribute('href', '/catalog/media?market=BR')
      await user.click(screen.getByRole('button', { name: 'Desvincular imagem' }))

      expect(await screen.findByText('Imagem desvinculada. A loja volta a usar a imagem do código, e a imagem continua na Biblioteca de imagens.')).toBeInTheDocument()
      expect(screen.getByText('Sem imagem cadastrada. A loja usa a imagem que está no código.')).toBeInTheDocument()
      expect(calls.find((call) => call.method === 'DELETE')?.path).toBe('/api/v1/admin/catalog/recipe-content/turkey/image')
    })

    it('shows readonly the banner without the library actions', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, { recipeContent: linked })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      expect(await screen.findByRole('img', { name: 'Imagem cadastrada da receita' })).toBeInTheDocument()
      expect(screen.queryByText('Enviar nova imagem')).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Escolher imagem da biblioteca' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Desvincular imagem' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    })
  })

  describe('label', () => {
    const usContent = { ...recipeContent, market: 'US' }

    it('saves a US label without notices as incomplete and names what is missing', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...usContent, variations: usContent.variations.map((item) => ({ ...item, active: false })) },
      })
      renderAuthedPage(<RecipeContentPage />, usRoute, pattern)

      await user.click(await screen.findByRole('button', { name: 'Adicionar ingrediente' }))
      await user.type(screen.getByLabelText('Ingrediente 1'), 'Beef')
      await user.click(screen.getByRole('button', { name: 'Adicionar ingrediente' }))
      await user.click(screen.getByRole('button', { name: 'Adicionar nível de garantia' }))
      await user.type(screen.getByLabelText('Nutriente 1'), 'Crude Protein (min)')
      await user.type(screen.getByLabelText('Valor 1'), '9.0%')
      await user.type(screen.getByLabelText('kcal/kg'), '1,200 kcal/kg')
      await user.type(screen.getByLabelText('kcal por embalagem'), '360 kcal per package')
      await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))

      expect(await screen.findByText('Rótulo salvo como rascunho.')).toBeInTheDocument()
      expect(screen.getByText('Rótulo incompleto')).toBeInTheDocument()
      expect(screen.getByText('Falta: avisos.')).toBeInTheDocument()
      const put = calls.find((call) => call.method === 'PUT' && call.path.endsWith('/label'))
      expect(put?.body).toMatchObject({
        label: {
          ingredients: ['Beef'],
          analysis: [{ nutrient: 'Crude Protein (min)', value: '9.0%' }],
          energyKg: '1,200 kcal/kg',
          energyPackage: '360 kcal per package',
          notices: [],
        },
      })
    })

    it('pastes the ingredients of a label as separate items', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...usContent, variations: usContent.variations.map((item) => ({ ...item, active: false })) },
      })
      renderAuthedPage(<RecipeContentPage />, usRoute, pattern)

      await user.click(await screen.findByRole('button', { name: 'Colar lista' }))
      await user.click(screen.getByLabelText('Colar lista de ingredientes'))
      await user.paste('Chicken thigh (skinless, boneless), Sweet potato, White rice.')
      expect(screen.getByText(/3 itens a adicionar/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Adicionar à lista' }))

      expect(screen.getByLabelText('Ingrediente 1')).toHaveValue('Chicken thigh (skinless, boneless)')
      expect(screen.getByLabelText('Ingrediente 3')).toHaveValue('White rice')
      expect(screen.queryByLabelText('Colar lista de ingredientes')).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))
      await waitFor(() => expect(calls.some((call) => call.method === 'PUT' && call.path.endsWith('/label'))).toBe(true))
      const put = calls.find((call) => call.method === 'PUT' && call.path.endsWith('/label'))
      expect((put?.body as { label: { ingredients: string[] } }).label.ingredients).toEqual(['Chicken thigh (skinless, boneless)', 'Sweet potato', 'White rice'])
    })

    it('becomes complete once at least one notice is added', async () => {
      const user = userEvent.setup()
      seedAuth()
      const { calls } = installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...usContent, label: recipeLabel, labelStatus: 'incomplete', labelMissing: ['notices'] },
      })
      renderAuthedPage(<RecipeContentPage />, usRoute, pattern)

      expect(await screen.findByText('Falta: avisos.')).toBeInTheDocument()
      await user.type(
        screen.getByRole('textbox', { name: 'Avisos' }),
        'This product is intended for intermittent\nor supplemental feeding only.\n\nNot formulated to meet AAFCO nutrient profiles.\n\n',
      )
      expect(screen.getByText(/2 itens\./)).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))

      expect(await screen.findByText('Rótulo salvo e completo.')).toBeInTheDocument()
      expect(screen.getByText('Rótulo completo')).toBeInTheDocument()
      expect(screen.getByText(/Rótulo em inglês · US/)).toBeInTheDocument()
      const put = calls.find((call) => call.method === 'PUT' && call.path.endsWith('/label'))
      expect((put?.body as { label: { notices: string[] } }).label.notices).toEqual([
        'This product is intended for intermittent or supplemental feeding only.',
        'Not formulated to meet AAFCO nutrient profiles.',
      ])
    })

    it('shows a saved list of sentences as paragraphs of one textarea', async () => {
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...usContent, label: { ...recipeLabel, storage: ['Keep frozen.', 'Do not refreeze.'] } },
      })
      renderAuthedPage(<RecipeContentPage />, usRoute, pattern)

      expect(await screen.findByRole('textbox', { name: 'Armazenamento' })).toHaveValue('Keep frozen.\n\nDo not refreeze.')
    })

    it('shows the 409 in the label card and keeps what was typed', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...usContent, label: { ...recipeLabel, notices: ['Aviso'] }, labelStatus: 'complete' },
      })
      renderAuthedPage(<RecipeContentPage />, usRoute, pattern)

      await user.click(await screen.findByRole('button', { name: 'Remover nível de garantia 1' }))
      await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))

      const alert = await screen.findByText(/precisa continuar completo. Falta: níveis de garantia/)
      expect(alert.closest('section')).toContainElement(screen.getByRole('heading', { name: 'Rótulo' }))
      expect(screen.queryByLabelText('Nutriente 1')).not.toBeInTheDocument()
      expect(screen.getByLabelText('Ingrediente 1')).toHaveValue('Frango')
    })

    it('shows readonly the label without editing controls', async () => {
      seedAuth()
      installAdminFetchMock(readonlyUser, { recipeContent: { ...recipeContent, label: recipeLabel, labelStatus: 'complete' } })
      renderAuthedPage(<RecipeContentPage />, route, pattern)

      expect(await screen.findByLabelText('Ingrediente 1')).toBeDisabled()
      expect(screen.getByLabelText('Nome do produto')).toHaveValue(recipeLabel.productName)
      expect(screen.queryByRole('button', { name: 'Salvar rótulo' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Adicionar|Remover/ })).not.toBeInTheDocument()
    })
  })
})
