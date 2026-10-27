import { describe, expect, it } from 'vitest'
import { listToParagraphs, paragraphsToList, splitPastedList } from './recipeContent'

describe('splitPastedList', () => {
  it('splits a label line on commas and drops the closing period', () => {
    expect(splitPastedList('Brown Rice, Beef, Lentils, Vitamin and Mineral Supplement, Salt.')).toEqual([
      'Brown Rice', 'Beef', 'Lentils', 'Vitamin and Mineral Supplement', 'Salt',
    ])
  })

  it('keeps commas inside parentheses and splits lines and semicolons', () => {
    expect(splitPastedList('Chicken thigh (skinless, boneless);\nSweet potato\n\n White rice ,')).toEqual([
      'Chicken thigh (skinless, boneless)', 'Sweet potato', 'White rice',
    ])
  })

  it('has no items for blank text', () => {
    expect(splitPastedList(' , \n ')).toEqual([])
  })
})

describe('paragraphsToList', () => {
  it('makes one item per paragraph and joins the lines inside one', () => {
    expect(paragraphsToList('Keep frozen.\nThaw under refrigeration.\n\n\n  Do not refreeze.  \n\n')).toEqual([
      'Keep frozen. Thaw under refrigeration.',
      'Do not refreeze.',
    ])
  })

  it('round-trips a saved list', () => {
    const items = ['Feed as part of a balanced diet.', 'Divide into multiple meals for puppies.']
    expect(paragraphsToList(listToParagraphs(items))).toEqual(items)
  })
})
