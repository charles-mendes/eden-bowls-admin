import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeContentPage } from './RecipeContentPage'
import { operatorWriteUser, readonlyUser, recipeContent, recipeImageUrl, recipeLabel } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// jsdom does not decode images, so each test file name maps to a pixel size.
const imageSizes = new Map<string, { width: number; height: number }>()

vi.mock('../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/imageUpload')>()
  return {
    ...actual,
    checkRecipeImage: (file: File) => actual.checkRecipeImage(file, async () => {
      const size = imageSizes.get(file.name)
      if (!size) throw new Error('unknown test image')
      return size
    }),
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

  it('stops an image of the wrong size in the panel without sending it', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    await screen.findByText('Escolher imagem')
    await user.upload(screen.getByLabelText('Escolher imagem'), png('grande.png', 2048, 1272))

    expect(await screen.findByText('A imagem tem 2048 × 1272 px e precisa ter 1024 × 636 px.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar imagem' })).not.toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PUT')).toBe(false)
  })

  it('previews a valid image and uploads it as base64', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser)
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    await screen.findByText('Escolher imagem')
    await user.upload(screen.getByLabelText('Escolher imagem'), png('banner.png', 1024, 636))

    expect(await screen.findByRole('img', { name: 'Prévia da nova imagem' })).toHaveAttribute('src', 'blob:preview')
    await user.click(screen.getByRole('button', { name: 'Salvar imagem' }))

    expect(await screen.findByText('Imagem salva. A loja passa a usar esta imagem.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Imagem cadastrada da receita' })).toHaveAttribute('src', recipeImageUrl)
    const put = calls.find((call) => call.method === 'PUT')
    expect(put?.path).toBe('/api/v1/admin/catalog/recipe-content/turkey/image')
    expect(put?.search).toBe('?market=BR')
    expect(put?.body).toEqual({ mimeType: 'image/png', imageBase64: btoa('png-bytes') })
  })

  it('shows the API size refusal in the image card', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { recipeImage: 'invalid' })
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    await screen.findByText('Escolher imagem')
    await user.upload(screen.getByLabelText('Escolher imagem'), png('banner.png', 1024, 636))
    await user.click(await screen.findByRole('button', { name: 'Salvar imagem' }))

    const alert = await screen.findByText('A imagem tem 1200 × 800 px e precisa ter 1024 × 636 px.')
    expect(alert.closest('section')).toContainElement(screen.getByRole('heading', { name: 'Imagem' }))
  })

  it('keeps the image when the API refuses removal for an active variation', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    installAdminFetchMock(operatorWriteUser, { recipeContent: { ...recipeContent, imageUrl: recipeImageUrl } })
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    await user.click(await screen.findByRole('button', { name: 'Remover imagem' }))

    expect(await screen.findByText(/não pode ser removida enquanto houver variação ativa/)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Imagem cadastrada da receita' })).toHaveAttribute('src', recipeImageUrl)
  })

  it('removes the image when every variation is inactive', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    installAdminFetchMock(operatorWriteUser, {
      recipeContent: { ...recipeContent, imageUrl: recipeImageUrl, variations: recipeContent.variations.map((item) => ({ ...item, active: false })) },
    })
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    await user.click(await screen.findByRole('button', { name: 'Remover imagem' }))

    expect(await screen.findByText('Imagem removida. A loja volta a usar a imagem do código.')).toBeInTheDocument()
    expect(screen.getByText('Sem imagem cadastrada. A loja usa a imagem que está no código.')).toBeInTheDocument()
  })

  it('shows readonly the image without upload or remove controls', async () => {
    seedAuth()
    installAdminFetchMock(readonlyUser, { recipeContent: { ...recipeContent, imageUrl: recipeImageUrl } })
    renderAuthedPage(<RecipeContentPage />, route, pattern)

    expect(await screen.findByRole('img', { name: 'Imagem cadastrada da receita' })).toBeInTheDocument()
    expect(screen.queryByText('Escolher imagem')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remover imagem' })).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvar imagem' })).not.toBeInTheDocument())
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

    it('becomes complete once at least one notice is added', async () => {
      const user = userEvent.setup()
      seedAuth()
      installAdminFetchMock(operatorWriteUser, {
        recipeContent: { ...usContent, label: recipeLabel, labelStatus: 'incomplete', labelMissing: ['notices'] },
      })
      renderAuthedPage(<RecipeContentPage />, usRoute, pattern)

      expect(await screen.findByText('Falta: avisos.')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Adicionar aviso' }))
      await user.type(screen.getByLabelText('Aviso 1'), 'This product is intended for intermittent or supplemental feeding only.')
      await user.click(screen.getByRole('button', { name: 'Adicionar aviso' }))
      await user.type(screen.getByLabelText('Aviso 2'), 'Not formulated to meet AAFCO nutrient profiles.')
      await user.click(screen.getByRole('button', { name: 'Salvar rótulo' }))

      expect(await screen.findByText('Rótulo salvo e completo.')).toBeInTheDocument()
      expect(screen.getByText('Rótulo completo')).toBeInTheDocument()
      expect(screen.getByText(/Rótulo em inglês · US/)).toBeInTheDocument()
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
