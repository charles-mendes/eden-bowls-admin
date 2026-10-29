import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaLibraryPage } from './MediaLibraryPage'
import { adminUser, operatorWriteUser, readonlyUser, recipeContent, type RecipeListItem } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// jsdom does not decode images, so each test file name maps to a pixel size (400 × 400 for a thumbnail and
// 1024 × 636 for a banner unless set).
const imageSizes = new Map<string, { width: number; height: number }>()

vi.mock('../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/imageUpload')>()
  return {
    ...actual,
    checkRecipePlanImage: (file: File) => actual.checkRecipePlanImage(file, async () => imageSizes.get(file.name) ?? { width: 400, height: 400 }),
    checkRecipeImage: (file: File) => actual.checkRecipeImage(file, async () => imageSizes.get(file.name) ?? { width: 1024, height: 636 }),
  }
})

function png(name: string, side = 400) {
  imageSizes.set(name, { width: side, height: side })
  return new File([`bytes-of-${name}`], name, { type: 'image/png' })
}

const KEYS: Array<[string, string, RecipeListItem['lifeStage']]> = [
  ['beef', 'Adulto Carne', 'adult'], ['turkey', 'Adulto Frango', 'adult'], ['fish', 'Adulto Peixe', 'adult'], ['pork', 'Adulto Porco', 'adult'],
  ['puppy-beef-chicken', 'Filhote Carne e Frango', 'puppy'], ['puppy-chicken-pork', 'Filhote Frango e Porco', 'puppy'],
  ['senior-beef', 'Sênior Carne', 'senior'], ['senior-chicken', 'Sênior Frango', 'senior'],
]
const EIGHT_RECIPES: RecipeListItem[] = KEYS.map(([key, name, lifeStage]) => ({ key, name, lifeStage, imageUrl: null, labelStatus: 'missing', variations: [] }))

const DESIGNER_FILES: Array<[string, string, string]> = [
  ['adulto-carne_400.png', 'BR', 'beef'], ['adulto-frango_400.png', 'BR', 'turkey'], ['adulto-peixe_400.png', 'BR', 'fish'],
  ['adulto-porco_400.png', 'BR', 'pork'], ['filhote-carne-frango_400.png', 'BR', 'puppy-beef-chicken'],
  ['filhote-frango-porco_400.png', 'BR', 'puppy-chicken-pork'], ['senior-carne_400.png', 'BR', 'senior-beef'],
  ['senior-frango_400.png', 'BR', 'senior-chicken'], ['adult-beef_400.png', 'US', 'beef'], ['adult-chicken_400.png', 'US', 'turkey'],
  ['adult-fish_400.png', 'US', 'fish'], ['adult-pork_400.png', 'US', 'pork'], ['puppy-beef-chicken_400.png', 'US', 'puppy-beef-chicken'],
  ['puppy-chicken-pork_400.png', 'US', 'puppy-chicken-pork'], ['senior-beef_400.png', 'US', 'senior-beef'],
  ['senior-chicken_400.png', 'US', 'senior-chicken'],
]

// The 16 home banners (docs-new/FEATURE_ADICIONANDO_IMAGENS_DESTAQUE_TELA_INICIAL/{pt,en}/<line>/).
const BANNER_FILES: Array<[string, string, string]> = [
  ['receita-carne-pt.png', 'BR', 'beef'], ['receita-frango-pt.png', 'BR', 'turkey'], ['receita-peixe-pt.png', 'BR', 'fish'],
  ['receita-porco-pt.png', 'BR', 'pork'], ['filhote-carne-frango.png', 'BR', 'puppy-beef-chicken'],
  ['filhote-frango-porco.png', 'BR', 'puppy-chicken-pork'], ['senior-carne.png', 'BR', 'senior-beef'],
  ['senior-frango.png', 'BR', 'senior-chicken'], ['recipe-beef.png', 'US', 'beef'], ['recipe-chicken.png', 'US', 'turkey'],
  ['recipe-fish.png', 'US', 'fish'], ['recipe-pork.png', 'US', 'pork'], ['puppy-beef-chicken.png', 'US', 'puppy-beef-chicken'],
  ['puppy-chicken-pork.png', 'US', 'puppy-chicken-pork'], ['senior-beef.png', 'US', 'senior-beef'],
  ['senior-chicken.png', 'US', 'senior-chicken'],
]

function bannerPng(name: string, size = { width: 1024, height: 636 }) {
  imageSizes.set(name, size)
  return new File([`bytes-of-${name}`], name, { type: 'image/png' })
}

// The page opens on the home banners; the plan thumbnails are ?kind=plan.
const route = '/catalog/media'
const planRoute = '/catalog/media?kind=plan'

function card(name: string) {
  return screen.getByRole('img', { name }).closest('li')!
}

function row(fileName: string) {
  return screen.getByRole('img', { name: `Prévia de ${fileName}` }).closest('tr')!
}

describe('MediaLibraryPage', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() }))
  })

  afterEach(() => {
    localStorage.clear()
    imageSizes.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('lists the plan thumbnails of the market with who uses each, without writing for readonly', async () => {
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser, { recipeContent: { ...recipeContent, planImageAssetId: 21, planImageUrl: '/recipe-images/plan-br-21.webp' } })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)

    expect(await screen.findByRole('img', { name: 'adulto-frango_400.png' })).toHaveAttribute('src', '/recipe-images/plan-br-21.webp')
    expect(within(card('adulto-frango_400.png')).getByText('Em uso por Frango (BR)')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'adulto-frango-antiga_400.png' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Enviar miniaturas')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Vincular a uma receita|Editar vínculo/ })).not.toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/media' && call.search === '?market=BR&kind=plan')).toBe(true)
  })

  it('hides Arquivar on an image in use and archives one without use, then restores it from Arquivadas', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, {
      mediaAssets: [
        { id: 21, kind: 'plan', market: 'BR', url: '/recipe-images/plan-br-21.webp', originalFilename: 'adulto-frango_400.png', mimeType: 'image/webp', width: 400, height: 400, bytes: 1, createdAt: '2026-10-28T10:00:00.000Z', archivedAt: null, archived: false, usedBy: [] },
        { id: 23, kind: 'plan', market: 'BR', url: '/recipe-images/plan-br-23.webp', originalFilename: 'teste_400.png', mimeType: 'image/webp', width: 400, height: 400, bytes: 1, createdAt: '2026-10-28T09:00:00.000Z', archivedAt: null, archived: false, usedBy: [] },
      ],
      recipeContent: { ...recipeContent, planImageAssetId: 21, planImageUrl: '/recipe-images/plan-br-21.webp' },
    })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)

    await screen.findByRole('img', { name: 'teste_400.png' })
    expect(within(card('adulto-frango_400.png')).queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()

    await user.click(within(card('teste_400.png')).getByRole('button', { name: 'Arquivar' }))
    expect(await screen.findByText('teste_400.png foi arquivada. O arquivo continua guardado e pode ser restaurado em Arquivadas.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('img', { name: 'teste_400.png' })).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Arquivadas' }))
    await user.click(within(card('teste_400.png')).getByRole('button', { name: 'Restaurar' }))
    expect(await screen.findByText('teste_400.png voltou para a biblioteca.')).toBeInTheDocument()
  })

  it('suggests the link of the 16 designer files, sends nothing before Confirmar, then uploads and links each', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(adminUser, { recipes: EIGHT_RECIPES, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)
    await screen.findByText('Nenhuma miniatura neste mercado.')

    await user.upload(screen.getByLabelText('Enviar miniaturas'), DESIGNER_FILES.map(([name]) => png(name)))

    await screen.findByRole('heading', { name: 'Confirmar envio' })
    for (const [fileName, market, key] of DESIGNER_FILES) {
      expect(within(row(fileName)).getByLabelText(`Mercado de ${fileName}`)).toHaveValue(market)
      expect(within(row(fileName)).getByLabelText(`Receita de ${fileName}`)).toHaveValue(key)
    }
    expect(calls.some((call) => call.method === 'POST' && call.path === '/api/v1/admin/media')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Confirmar e enviar 16 imagens' }))

    expect(await within(row('senior-chicken_400.png')).findByText('Guardada na biblioteca e vinculada a Sênior Frango (US).')).toBeInTheDocument()
    const uploads = calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/admin/media')
    const links = calls.filter((call) => call.method === 'PUT' && call.path.endsWith('/plan-image'))
    expect(uploads).toHaveLength(16)
    expect(uploads[0].body).toMatchObject({ kind: 'plan', market: 'BR', originalFilename: 'adulto-carne_400.png', mimeType: 'image/png' })
    expect(links.map((call) => `${call.search} ${call.path.split('/')[6]}`)).toEqual(DESIGNER_FILES.map(([, market, key]) => `?market=${market} ${key}`))
    expect(links[0].body).toEqual({ assetId: expect.any(Number) })
  })

  it('blocks two files for the same recipe and a refused size, and lets a file stay only in the library', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)
    await screen.findByText('Nenhuma miniatura neste mercado.')

    await user.upload(screen.getByLabelText('Enviar miniaturas'), [
      png('adulto-carne_400.png'),
      png('adulto-carne-v2_400.png'),
      png('adulto-carne_200.png', 200),
      png('foto-nova.png'),
    ])

    await screen.findByRole('heading', { name: 'Confirmar envio' })
    expect(within(row('adulto-carne_200.png')).getByText('A imagem tem 200 × 200 px e precisa ter 400 × 400 px.')).toBeInTheDocument()
    expect(within(row('foto-nova.png')).getByLabelText('Receita de foto-nova.png')).toHaveValue('')
    expect(within(row('foto-nova.png')).getByText('Sem sugestão pelo nome do arquivo.')).toBeInTheDocument()

    await user.selectOptions(within(row('adulto-carne-v2_400.png')).getByLabelText('Receita de adulto-carne-v2_400.png'), 'beef')
    expect(within(row('adulto-carne-v2_400.png')).getByText('Outra imagem da lista já vai para Adulto Carne (BR).')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar e enviar 3 imagens' })).toBeDisabled()

    await user.selectOptions(within(row('adulto-carne-v2_400.png')).getByLabelText('Receita de adulto-carne-v2_400.png'), '')
    await user.click(screen.getByRole('button', { name: 'Confirmar e enviar 3 imagens' }))

    expect(await within(row('foto-nova.png')).findByText('Guardada na biblioteca.')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/admin/media')).toHaveLength(3)
    expect(calls.filter((call) => call.method === 'PUT' && call.path.endsWith('/plan-image'))).toHaveLength(1)
  })

  it('opens on Destaques, before Miniaturas, and says on which store screen each kind appears', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(readonlyUser)
    renderAuthedPage(<MediaLibraryPage />, route)

    expect(await screen.findByRole('img', { name: 'receita-frango-pt.png' })).toBeInTheDocument()
    const tabs = within(screen.getByRole('tablist', { name: 'Tipo de imagem' })).getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Destaques', 'Miniaturas'])
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'media-tab-banner')
    expect(screen.getByText('Aparecem na tela inicial da loja, no carrossel "Nossas receitas para cães", e no topo da página de cada receita. 1024 × 636 px.')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/media' && call.search === '?market=BR&kind=banner')).toBe(true)

    await user.click(tabs[1])

    expect(await screen.findByRole('img', { name: 'adulto-frango_400.png' })).toBeInTheDocument()
    expect(screen.getByText('Aparecem na tela Plano da loja, no card de cada sabor ao montar o plano do pet. Quadradas, 400 × 400 px. Sem miniatura, o card usa o destaque da receita.')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'receita-frango-pt.png' })).not.toBeInTheDocument()
  })

  it('Destaques lists the home banners of the market with who uses each', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { recipeContent: { ...recipeContent, imageAssetId: 41, imageUrl: '/recipe-images/banner-br-41.webp' } })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)
    await screen.findByRole('img', { name: 'adulto-frango_400.png' })

    await user.click(screen.getByRole('tab', { name: 'Destaques' }))

    expect(await screen.findByRole('img', { name: 'receita-frango-pt.png' })).toHaveAttribute('src', '/recipe-images/banner-br-41.webp')
    expect(screen.getByRole('heading', { name: 'Destaques da tela inicial' })).toBeInTheDocument()
    expect(within(card('receita-frango-pt.png')).getByText('Em uso por Frango (BR)')).toBeInTheDocument()
    expect(within(card('receita-frango-pt.png')).queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'adulto-frango_400.png' })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'receita-frango-antiga.png' })).not.toBeInTheDocument()
    expect(screen.getByText('Enviar destaques')).toBeInTheDocument()
    expect(calls.some((call) => call.path === '/api/v1/admin/media' && call.search === '?market=BR&kind=banner')).toBe(true)
  })

  it('fixes a wrong link: unlinks the wrong recipe and links the right one, keeping the image', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { calls } = installAdminFetchMock(operatorWriteUser, {
      recipes: EIGHT_RECIPES,
      recipeContent: { ...recipeContent, imageAssetId: 41, imageUrl: '/recipe-images/banner-br-41.webp', variations: recipeContent.variations.map((item) => ({ ...item, active: false })) },
    })
    renderAuthedPage(<MediaLibraryPage />, route)

    await screen.findByRole('img', { name: 'receita-frango-pt.png' })
    await user.click(within(card('receita-frango-pt.png')).getByRole('button', { name: 'Editar vínculo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar vínculo' })
    expect(within(dialog).getByText('Frango')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Desvincular de Frango' }))
    expect(await within(dialog).findByText('Desvinculada de Frango (BR).')).toBeInTheDocument()
    expect(within(dialog).getByText('Nenhuma receita usa esta imagem.')).toBeInTheDocument()

    const select = within(dialog).getByLabelText('Receita de BR')
    expect(within(select).getAllByRole('group').map((group) => group.getAttribute('label'))).toEqual(['Adulto', 'Filhote', 'Sênior'])
    await user.selectOptions(select, 'senior-beef')
    expect(within(dialog).getByText(/Linha Sênior · Sênior Carne \(BR\)\. A receita ainda não tem destaque\./)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }))
    expect(await within(dialog).findByText('Vinculada a Sênior Carne (BR).')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Fechar' }))

    expect(await within(card('receita-frango-pt.png')).findByText('Em uso por Sênior Carne (BR)')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'DELETE')?.path).toBe('/api/v1/admin/catalog/recipe-content/turkey/image')
    const linked = calls.find((call) => call.method === 'PUT')
    expect([linked?.path, linked?.search, linked?.body]).toEqual(['/api/v1/admin/catalog/recipe-content/senior-beef/image', '?market=BR', { assetId: 41 }])
    expect(calls.some((call) => call.method === 'DELETE' && call.path.startsWith('/api/v1/admin/media'))).toBe(false)
  })

  it('a banner of a recipe with an active variation cannot be unlinked, and the dialog says why', async () => {
    const user = userEvent.setup()
    seedAuth()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES, recipeContent: { ...recipeContent, imageAssetId: 41, imageUrl: '/recipe-images/banner-br-41.webp' } })
    renderAuthedPage(<MediaLibraryPage />, route)

    await screen.findByRole('img', { name: 'receita-frango-pt.png' })
    await user.click(within(card('receita-frango-pt.png')).getByRole('button', { name: 'Editar vínculo' }))
    const dialog = await screen.findByRole('dialog', { name: 'Editar vínculo' })
    await user.click(within(dialog).getByRole('button', { name: 'Desvincular de Frango' }))

    expect(await within(dialog).findByText(/não pode ser removida enquanto houver variação ativa/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Desvincular de Frango' })).toBeInTheDocument()
  })

  it('links an image without use from its card, and readonly has no link action', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)

    await screen.findByRole('img', { name: 'adulto-frango_400.png' })
    await user.click(within(card('adulto-frango_400.png')).getByRole('button', { name: 'Vincular a uma receita' }))
    const dialog = await screen.findByRole('dialog', { name: 'Vincular a uma receita' })
    await user.selectOptions(within(dialog).getByLabelText('Receita de BR'), 'turkey')
    await user.click(within(dialog).getByRole('button', { name: 'Vincular' }))

    expect(await within(dialog).findByText('Vinculada a Adulto Frango (BR).')).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'PUT')?.path).toBe('/api/v1/admin/catalog/recipe-content/turkey/plan-image')
  })

  it('suggests the link of the 16 banners, then uploads each as a banner and links it to the recipe banner', async () => {
    const user = userEvent.setup()
    seedAuth()
    const recipes = EIGHT_RECIPES.map((item) => (item.key === 'turkey' ? { ...item, imageUrl: '/recipe-images/banner-br-41.webp' } : item))
    const { calls } = installAdminFetchMock(adminUser, { recipes, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, route)
    await screen.findByText('Nenhum destaque neste mercado.')

    await user.upload(screen.getByLabelText('Enviar destaques'), BANNER_FILES.map(([name]) => bannerPng(name)))

    await screen.findByRole('heading', { name: 'Confirmar envio' })
    expect(screen.getByText(/PNG, JPEG ou WebP de 1024 × 636 px\./)).toBeInTheDocument()
    for (const [fileName, market, key] of BANNER_FILES) {
      expect(within(row(fileName)).getByLabelText(`Mercado de ${fileName}`)).toHaveValue(market)
      expect(within(row(fileName)).getByLabelText(`Receita de ${fileName}`)).toHaveValue(key)
    }
    expect(within(row('receita-frango-pt.png')).getByText('Substitui o destaque atual. O atual continua na biblioteca.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirmar e enviar 16 imagens' }))

    expect(await within(row('senior-chicken.png')).findByText('Guardada na biblioteca e vinculada a Sênior Frango (US).')).toBeInTheDocument()
    const uploads = calls.filter((call) => call.method === 'POST' && call.path === '/api/v1/admin/media')
    const links = calls.filter((call) => call.method === 'PUT' && /\/recipe-content\/[^/]+\/image$/.test(call.path))
    expect(uploads).toHaveLength(16)
    expect(uploads[0].body).toMatchObject({ kind: 'banner', market: 'BR', originalFilename: 'receita-carne-pt.png', mimeType: 'image/png' })
    expect(calls.some((call) => call.path.endsWith('/plan-image'))).toBe(false)
    expect(links.map((call) => `${call.search} ${call.path.split('/')[6]}`)).toEqual(BANNER_FILES.map(([, market, key]) => `?market=${market} ${key}`))
    expect(links[0].body).toEqual({ assetId: expect.any(Number) })
  })

  it('groups the recipes by line, names the line of the chosen recipe and flags a file of another line', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, route)
    await screen.findByText('Nenhum destaque neste mercado.')

    await user.upload(screen.getByLabelText('Enviar destaques'), [bannerPng('filhote-frango-porco.png')])

    await screen.findByRole('heading', { name: 'Confirmar envio' })
    const select = within(row('filhote-frango-porco.png')).getByLabelText('Receita de filhote-frango-porco.png')
    const groups = within(select).getAllByRole('group')
    expect(groups.map((group) => group.getAttribute('label'))).toEqual(['Adulto', 'Filhote', 'Sênior'])
    expect(within(groups[1]).getAllByRole('option').map((option) => option.textContent)).toEqual(['Filhote Carne e Frango', 'Filhote Frango e Porco'])
    expect(within(row('filhote-frango-porco.png')).getByText('Linha Filhote · Filhote Frango e Porco (BR)')).toBeInTheDocument()
    expect(within(row('filhote-frango-porco.png')).queryByText(/O nome do arquivo indica/)).not.toBeInTheDocument()

    await user.selectOptions(select, 'senior-beef')

    expect(within(row('filhote-frango-porco.png')).getByText('Linha Sênior · Sênior Carne (BR)')).toBeInTheDocument()
    expect(within(row('filhote-frango-porco.png')).getByText('O nome do arquivo indica a linha Filhote, mas a receita escolhida é da linha Sênior.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar e enviar 1 imagem' })).toBeEnabled()
  })

  it('a thumbnail-sized file is refused as a banner, and a banner can stay only in the library', async () => {
    const user = userEvent.setup()
    seedAuth()
    const { calls } = installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, route)
    await screen.findByText('Nenhum destaque neste mercado.')

    await user.upload(screen.getByLabelText('Enviar destaques'), [
      bannerPng('senior-carne.png'),
      bannerPng('senior-carne-v2.png'),
      bannerPng('senior-carne_400.png', { width: 400, height: 400 }),
    ])

    await screen.findByRole('heading', { name: 'Confirmar envio' })
    expect(within(row('senior-carne_400.png')).getByText('A imagem tem 400 × 400 px e precisa ter 1024 × 636 px.')).toBeInTheDocument()
    await user.selectOptions(within(row('senior-carne-v2.png')).getByLabelText('Receita de senior-carne-v2.png'), 'senior-beef')
    expect(within(row('senior-carne-v2.png')).getByText('Outra imagem da lista já vai para Sênior Carne (BR).')).toBeInTheDocument()

    await user.selectOptions(within(row('senior-carne-v2.png')).getByLabelText('Receita de senior-carne-v2.png'), '')
    await user.click(screen.getByRole('button', { name: 'Confirmar e enviar 2 imagens' }))

    expect(await within(row('senior-carne-v2.png')).findByText('Guardada na biblioteca.')).toBeInTheDocument()
    expect(calls.filter((call) => call.method === 'PUT' && call.path.endsWith('/image'))).toHaveLength(1)
  })

  it('a file whose name points to a market outside the session is blocked', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, planRoute, route)
    await screen.findByText('Nenhuma miniatura neste mercado.')

    await user.upload(screen.getByLabelText('Enviar miniaturas'), [png('adult-beef_400.png')])

    await screen.findByRole('heading', { name: 'Confirmar envio' })
    expect(within(row('adult-beef_400.png')).getByText('O mercado US está fora da sua sessão.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar e enviar 1 imagem' })).toBeDisabled()
  })
})
