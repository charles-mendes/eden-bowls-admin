import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MediaLibraryPage } from './MediaLibraryPage'
import { adminUser, operatorWriteUser, readonlyUser, recipeContent, type RecipeListItem } from '../test/fixtures'
import { installAdminFetchMock } from '../test/mockAdminFetch'
import { renderAuthedPage, seedAuth } from '../test/renderPage'

// jsdom does not decode images, so each test file name maps to a pixel size (400 × 400 unless set).
const imageSizes = new Map<string, { width: number; height: number }>()

vi.mock('../lib/imageUpload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/imageUpload')>()
  return {
    ...actual,
    checkRecipePlanImage: (file: File) => actual.checkRecipePlanImage(file, async () => imageSizes.get(file.name) ?? { width: 400, height: 400 }),
  }
})

function png(name: string, side = 400) {
  imageSizes.set(name, { width: side, height: side })
  return new File([`bytes-of-${name}`], name, { type: 'image/png' })
}

const KEYS: Array<[string, string]> = [
  ['beef', 'Adulto Carne'], ['turkey', 'Adulto Frango'], ['fish', 'Adulto Peixe'], ['pork', 'Adulto Porco'],
  ['puppy-beef-chicken', 'Filhote Carne e Frango'], ['puppy-chicken-pork', 'Filhote Frango e Porco'],
  ['senior-beef', 'Sênior Carne'], ['senior-chicken', 'Sênior Frango'],
]
const EIGHT_RECIPES: RecipeListItem[] = KEYS.map(([key, name]) => ({ key, name, lifeStage: 'adult', imageUrl: null, labelStatus: 'missing', variations: [] }))

const DESIGNER_FILES: Array<[string, string, string]> = [
  ['adulto-carne_400.png', 'BR', 'beef'], ['adulto-frango_400.png', 'BR', 'turkey'], ['adulto-peixe_400.png', 'BR', 'fish'],
  ['adulto-porco_400.png', 'BR', 'pork'], ['filhote-carne-frango_400.png', 'BR', 'puppy-beef-chicken'],
  ['filhote-frango-porco_400.png', 'BR', 'puppy-chicken-pork'], ['senior-carne_400.png', 'BR', 'senior-beef'],
  ['senior-frango_400.png', 'BR', 'senior-chicken'], ['adult-beef_400.png', 'US', 'beef'], ['adult-chicken_400.png', 'US', 'turkey'],
  ['adult-fish_400.png', 'US', 'fish'], ['adult-pork_400.png', 'US', 'pork'], ['puppy-beef-chicken_400.png', 'US', 'puppy-beef-chicken'],
  ['puppy-chicken-pork_400.png', 'US', 'puppy-chicken-pork'], ['senior-beef_400.png', 'US', 'senior-beef'],
  ['senior-chicken_400.png', 'US', 'senior-chicken'],
]

const route = '/catalog/media'

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
    renderAuthedPage(<MediaLibraryPage />, route)

    expect(await screen.findByRole('img', { name: 'adulto-frango_400.png' })).toHaveAttribute('src', '/recipe-images/plan-br-21.webp')
    expect(within(card('adulto-frango_400.png')).getByText('Em uso por Frango (BR)')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'adulto-frango-antiga_400.png' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Arquivar' })).not.toBeInTheDocument()
    expect(screen.queryByText('Enviar miniaturas')).not.toBeInTheDocument()
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
    renderAuthedPage(<MediaLibraryPage />, route)

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
    renderAuthedPage(<MediaLibraryPage />, route)
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
    renderAuthedPage(<MediaLibraryPage />, route)
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

  it('a file whose name points to a market outside the session is blocked', async () => {
    const user = userEvent.setup()
    seedAuth()
    installAdminFetchMock(operatorWriteUser, { recipes: EIGHT_RECIPES, mediaAssets: [] })
    renderAuthedPage(<MediaLibraryPage />, route)
    await screen.findByText('Nenhuma miniatura neste mercado.')

    await user.upload(screen.getByLabelText('Enviar miniaturas'), [png('adult-beef_400.png')])

    expect(await within(row('adult-beef_400.png')).findByText('O mercado US está fora da sua sessão.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar e enviar 1 imagem' })).toBeDisabled()
  })
})
