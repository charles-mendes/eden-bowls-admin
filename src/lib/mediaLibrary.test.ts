import { describe, expect, it } from 'vitest'
import { ApiRequestError } from './api'
import { mediaFailure, mediaListPath, suggestPlanLink, usedByText } from './mediaLibrary'

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

describe('suggestPlanLink', () => {
  it.each(DESIGNER_FILES)('%s → %s %s', (fileName, market, recipeKey) => {
    expect(suggestPlanLink(fileName, RECIPES)).toEqual({ market, recipeKey })
  })

  it('reads accents and capitals', () => {
    expect(suggestPlanLink('Sênior-Carne_400.PNG', RECIPES)).toEqual({ market: 'BR', recipeKey: 'senior-beef' })
  })

  it('keeps the market but no recipe when the key is not registered there', () => {
    expect(suggestPlanLink('senior-frango_400.png', { BR: ['senior-beef'], US: KEYS })).toEqual({ market: 'BR', recipeKey: null })
  })

  it('suggests nothing for an unknown or mixed name', () => {
    expect(suggestPlanLink('foto-final.png', RECIPES)).toEqual({ market: null, recipeKey: null })
    expect(suggestPlanLink('adulto-beef_400.png', RECIPES)).toEqual({ market: null, recipeKey: null })
    expect(suggestPlanLink('senior_400.png', RECIPES)).toEqual({ market: null, recipeKey: null })
    expect(suggestPlanLink('adulto-carne-nova_400.png', RECIPES)).toEqual({ market: 'BR', recipeKey: null })
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

  it('lists archived images only when asked', () => {
    expect(mediaListPath('BR')).toBe('/admin/media?market=BR&kind=plan')
    expect(mediaListPath('US', { archived: true })).toBe('/admin/media?market=US&kind=plan&archived=true')
  })
})
