import { useMemo } from 'react'
import { RecipeImageSection } from './RecipeImageSection'
import { RecipeLabelSection } from './RecipeLabelSection'
import { RecipePlanImageSection } from './RecipePlanImageSection'
import { RecipePresentationSection } from './RecipePresentationSection'
import type { RecipeContent } from '../lib/recipeContent'

export type ContentSection = 'presentation' | 'image' | 'planImage' | 'label'

const ALL_SECTIONS: ContentSection[] = ['presentation', 'image', 'planImage', 'label']

// The editable content sections of a product, in page order; each product tab renders the ones it holds.
export function RecipeContentSections({
  token,
  productId,
  market,
  content,
  canWrite,
  onSaved,
  onDirtyChange,
  sections = ALL_SECTIONS,
}: {
  token: string | null
  productId: string
  market: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
  onDirtyChange?: (dirty: boolean) => void
  sections?: ContentSection[]
}) {
  // Each section reports its own unsaved state; the parent hears whether any section still has one. The
  // parent passes a stable callback, so the state lives as long as these sections.
  const handlers = useMemo(() => {
    const dirty: Record<ContentSection, boolean> = { presentation: false, image: false, planImage: false, label: false }
    const report = (section: ContentSection) => (value: boolean) => {
      if (dirty[section] === value) return
      dirty[section] = value
      onDirtyChange?.(Object.values(dirty).some(Boolean))
    }
    return {
      presentation: report('presentation'),
      image: report('image'),
      planImage: report('planImage'),
      label: report('label'),
    }
  }, [onDirtyChange])

  const shared = { token, productId, market, content, canWrite, onSaved }
  const shows = (section: ContentSection) => sections.includes(section)

  return (
    <>
      {shows('presentation') ? <RecipePresentationSection {...shared} onDirtyChange={handlers.presentation} /> : null}
      {shows('image') ? <RecipeImageSection {...shared} onDirtyChange={handlers.image} /> : null}
      {shows('planImage') ? <RecipePlanImageSection {...shared} onDirtyChange={handlers.planImage} /> : null}
      {shows('label') ? <RecipeLabelSection {...shared} onDirtyChange={handlers.label} /> : null}
    </>
  )
}
