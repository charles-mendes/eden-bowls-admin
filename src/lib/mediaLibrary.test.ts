import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './api'
import { mediaFailure, mediaListPath, suggestRecipeLink, usedByText } from './mediaLibrary'

const KEYS = ['beef', 'turkey', 'fish', 'pork', 'puppy-beef-chicken', 'puppy-chicken-pork', 'senior-beef', 'senior-chicken']
const RECIPES = { BR: KEYS, US: KEYS }

// The 16 thumbnails the designer delivered (pt/ and en/, _400 versions).
const DESIGNER_FILES: Array<[string, string, string]> = [
  ['adulto-carne_400.png', 'BR', 'beef'],
  ['adulto-frango_400.png', 'BR', 'turkey'],
  ['adulto-peixe_400.png', 'BR', 'fish'],
  ['adulto-porco_400.png', 'BR', 'pork'],
  ['filhote-carne-frango_400.png', 'BR', 'puppy-beef-chicken'],
  ['filhote-frango-porco_400.png', 'BR', 'puppy-chicken-pork'],
  ['senior-carne_400.png', 'BR', 'senior-beef'],
  ['senior-frango_400.png', 'BR', 'senior-chicken'],
  ['adult-beef_400.png', 'US', 'beef'],
  ['adult-chicken_400.png', 'US', 'turkey'],
  ['adult-fish_400.png', 'US', 'fish'],
  ['adult-pork_400.png', 'US', 'pork'],
  ['puppy-beef-chicken_400.png', 'US', 'puppy-beef-chicken'],
  ['puppy-chicken-pork_400.png', 'US', 'puppy-chicken-pork'],
  ['senior-beef_400.png', 'US', 'senior-beef'],
  ['senior-chicken_400.png', 'US', 'senior-chicken'],
]

describe('suggestRecipeLink', () => {
  it.each(DESIGNER_FILES)('%s → %s %s', (fileName, market, recipeKey) => {
    expect(suggestRecipeLink(fileName, RECIPES)).toMatchObject({ market, recipeKey })
  })

  it('reads accents and capitals', () => {
    expect(suggestRecipeLink('Sênior-Carne_400.PNG', RECIPES)).toMatchObject({ market: 'BR', recipeKey: 'senior-beef' })
  })

  it('keeps the market but no recipe when the key is not registered there', () => {
    expect(suggestRecipeLink('senior-frango_400.png', { BR: ['senior-beef'], US: KEYS })).toMatchObject({ market: 'BR', recipeKey: null })
  })

  it('suggests nothing for an unknown or mixed name', () => {
    expect(suggestRecipeLink('foto-final.png', RECIPES)).toMatchObject({ market: null, recipeKey: null })
    expect(suggestRecipeLink('adulto-beef_400.png', RECIPES)).toMatchObject({ market: null, recipeKey: null })
    expect(suggestRecipeLink('senior_400.png', RECIPES)).toMatchObject({ market: null, recipeKey: null })
    expect(suggestRecipeLink('adulto-carne-nova_400.png', RECIPES)).toMatchObject({ market: 'BR', recipeKey: null })
  })
})

// The 16 home banners (docs-new/FEATURE_ADICIONANDO_IMAGENS_DESTAQUE_TELA_INICIAL/{pt,en}/<line>/).
const BANNER_FILES: Array<[string, string, string]> = [
  ['receita-carne-pt.png', 'BR', 'beef'],
  ['receita-frango-pt.png', 'BR', 'turkey'],
  ['receita-peixe-pt.png', 'BR', 'fish'],
  ['receita-porco-pt.png', 'BR', 'pork'],
  ['filhote-carne-frango.png', 'BR', 'puppy-beef-chicken'],
  ['filhote-frango-porco.png', 'BR', 'puppy-chicken-pork'],
  ['senior-carne.png', 'BR', 'senior-beef'],
  ['senior-frango.png', 'BR', 'senior-chicken'],
  ['recipe-beef.png', 'US', 'beef'],
  ['recipe-chicken.png', 'US', 'turkey'],
  ['recipe-fish.png', 'US', 'fish'],
  ['recipe-pork.png', 'US', 'pork'],
  ['puppy-beef-chicken.png', 'US', 'puppy-beef-chicken'],
  ['puppy-chicken-pork.png', 'US', 'puppy-chicken-pork'],
  ['senior-beef.png', 'US', 'senior-beef'],
  ['senior-chicken.png', 'US', 'senior-chicken'],
]

describe('suggestRecipeLink for the home banners', () => {
  it.each(BANNER_FILES)('%s → %s %s', (fileName, market, recipeKey) => {
    expect(suggestRecipeLink(fileName, RECIPES)).toMatchObject({ market, recipeKey })
  })

  it('names the line of the file, for every banner', () => {
    expect(BANNER_FILES.map(([fileName]) => suggestRecipeLink(fileName, RECIPES).line)).toEqual([
      'adult', 'adult', 'adult', 'adult', 'puppy', 'puppy', 'senior', 'senior',
      'adult', 'adult', 'adult', 'adult', 'puppy', 'puppy', 'senior', 'senior',
    ])
  })

  it('keeps the line when the recipe is not registered, and has none for a name without a line', () => {
    expect(suggestRecipeLink('filhote-frango-porco.png', { BR: ['beef'], US: [] })).toEqual({ market: 'BR', recipeKey: null, line: 'puppy' })
    expect(suggestRecipeLink('foto-final.png', RECIPES)).toEqual({ market: null, recipeKey: null, line: null })
  })

  it('a language suffix that contradicts the words suggests nothing', () => {
    expect(suggestRecipeLink('receita-carne-en.png', RECIPES)).toMatchObject({ market: null, recipeKey: null })
    expect(suggestRecipeLink('recipe-beef-pt.png', RECIPES)).toMatchObject({ market: null, recipeKey: null })
  })

  it('the language suffix decides a senior name with no other hint', () => {
    expect(suggestRecipeLink('senior-en.png', RECIPES)).toMatchObject({ market: 'US', recipeKey: null })
  })
})

describe('library texts', () => {
  it('names the recipes using an image', () => {
    expect(usedByText([{ key: 'beef', name: 'Adulto Carne', market: 'BR' }, { key: 'senior-beef', name: 'Sênior Carne', market: 'BR' }]))
      .toBe('Adulto Carne (BR), Sênior Carne (BR)')
  })

  it('says who uses an image that cannot be archived', () => {
    const error = new ApiRequestError('in use', 409, 'media_asset_in_use', { code: 'media_asset_in_use', usedBy: [{ key: 'beef', name: 'Adulto Carne', market: 'BR' }] })
    expect(mediaFailure(error, 'x')).toBe('Esta imagem está em uso por Adulto Carne (BR) e não pode ser arquivada. Desvincule antes.')
  })

  it('keeps the image size text of the recipe content', () => {
    const error = new ApiRequestError('size', 422, 'recipe_image_invalid', { reason: 'dimensions', width: 200, height: 200, expectedWidth: 400, expectedHeight: 400 })
    expect(mediaFailure(error, 'x')).toBe('A imagem tem 200 × 200 px e precisa ter 400 × 400 px.')
  })

  it('names the kind a refused link expected', () => {
    const plan = new ApiRequestError('kind', 422, 'media_asset_invalid', { reason: 'kind', assetKind: 'plan' })
    const banner = new ApiRequestError('kind', 422, 'media_asset_invalid', { reason: 'kind', assetKind: 'banner' })
    expect(mediaFailure(plan, 'x')).toBe('Esta imagem é uma miniatura do plano. Escolha um destaque (1024 × 636 px).')
    expect(mediaFailure(banner, 'x')).toBe('Esta imagem é um destaque da tela inicial. Escolha uma miniatura (400 × 400 px).')
  })

  it('lists archived images only when asked', () => {
    expect(mediaListPath('BR')).toBe('/admin/media?market=BR&kind=plan')
    expect(mediaListPath('US', { archived: true })).toBe('/admin/media?market=US&kind=plan&archived=true')
    expect(mediaListPath('BR', { kind: 'banner' })).toBe('/admin/media?market=BR&kind=banner')
  })
})
