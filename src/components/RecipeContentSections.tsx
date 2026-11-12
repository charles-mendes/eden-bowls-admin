import { useMemo, type ReactNode } from 'react'
import { RecipeImageSection } from './RecipeImageSection'
import { RecipeLabelSection } from './RecipeLabelSection'
import { RecipeLifeStageSection } from './RecipeLifeStageSection'
import { RecipePlanImageSection } from './RecipePlanImageSection'
import { RecipePresentationSection } from './RecipePresentationSection'
import type { RecipeContent } from '../lib/recipeContent'

type DirtySection = 'presentation' | 'image' | 'planImage' | 'label'

// The editable sections of a recipe, in page order, shared by the recipe page and the product side panel.
export function RecipeContentSections({
  token,
  market,
  recipeKey,
  content,
  canWrite,
  onSaved,
  onLifeStageSaved,
  onDirtyChange,
  afterLifeStage,
}: {
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
  onLifeStageSaved?: (content: RecipeContent) => void
  onDirtyChange?: (dirty: boolean) => void
  afterLifeStage?: ReactNode
}) {
  // Each section reports its own unsaved state; the parent hears whether any section still has one. The
  // parent passes a stable callback, so the state lives as long as these sections.
  const handlers = useMemo(() => {
    const dirty: Record<DirtySection, boolean> = { presentation: false, image: false, planImage: false, label: false }
    const report = (section: DirtySection) => (value: boolean) => {
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

  const shared = { token, market, recipeKey, content, canWrite, onSaved }

  return (
    <>
      <RecipeLifeStageSection {...shared} onSaved={onLifeStageSaved ?? onSaved} />
      {afterLifeStage}
      <RecipePresentationSection {...shared} onDirtyChange={handlers.presentation} />
      <RecipeImageSection {...shared} onDirtyChange={handlers.image} />
      <RecipePlanImageSection {...shared} onDirtyChange={handlers.planImage} />
      <RecipeLabelSection {...shared} onDirtyChange={handlers.label} />
    </>
  )
}
