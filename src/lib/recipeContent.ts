import { ApiRequestError } from './api'

export type RecipeLabelStatus = 'missing' | 'incomplete' | 'complete'

export type LifeStage = 'adult' | 'puppy' | 'senior'

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  adult: 'Adulto',
  puppy: 'Filhote',
  senior: 'Sênior',
}

export type RecipeLabel = {
  productName: string
  netWeight: string
  freshnessNote: string
  ingredients: string[]
  analysis: Array<{ nutrient: string; value: string }>
  energyKg: string
  energyPackage: string
  notices: string[]
  storage: string[]
  feeding: string[]
  manufacturer: string
  manufacturerLocation: string
}

export type PresentationColor = 'color' | 'accentColor' | 'pillBg' | 'pillText' | 'pillBorder'

// Store page of the recipe in the market language, saved whole (recipe-content).
export type RecipePresentation = {
  /** Short name of the store tabs and plan chips ("Carne", "Frango e Porco"). */
  tag: string
  title: string
  tagline: string
  resume: string
  highlights: string[]
  colors: Record<PresentationColor, string>
}

// Same limits as the API, in characters after trimming.
export const PRESENTATION_LIMITS = { tag: 40, title: 120, tagline: 80, resume: 300, highlight: 60, highlights: 8 }

export const PRESENTATION_COLOR_FIELDS: Array<{ field: PresentationColor; label: string }> = [
  { field: 'color', label: 'Cor principal' },
  { field: 'accentColor', label: 'Cor de destaque' },
  { field: 'pillBg', label: 'Fundo da etiqueta' },
  { field: 'pillText', label: 'Texto da etiqueta' },
  { field: 'pillBorder', label: 'Borda da etiqueta' },
]

export const PRESENTATION_FIELD_TEXT: Record<string, string> = {
  tag: 'nome curto',
  title: 'título',
  tagline: 'chamada',
  resume: 'resumo',
  highlights: 'destaques',
  ...Object.fromEntries(PRESENTATION_COLOR_FIELDS.map(({ field, label }) => [`colors.${field}`, label.toLowerCase()])),
}

// "highlights[2]" reads as "destaque 3".
export function presentationFieldText(field: string) {
  const highlight = /^highlights\[(\d+)\]$/.exec(field)
  if (highlight) return `destaque ${Number(highlight[1]) + 1}`
  return PRESENTATION_FIELD_TEXT[field] ?? field
}

export type RecipeContent = {
  market: string
  flavorSlug: string
  name: string
  lifeStage: LifeStage
  imageUrl: string | null
  imageUpdatedAt: string | null
  planImageUrl?: string | null
  planImageUpdatedAt?: string | null
  label: Partial<RecipeLabel> | null
  labelUpdatedAt: string | null
  labelStatus: RecipeLabelStatus
  labelMissing: string[]
  presentation?: RecipePresentation | null
  presentationUpdatedAt?: string | null
  variations: Array<{ id: string; name: string; sku: string; active: boolean; productId?: string | null; productName?: string }>
}

export type RecipeSummary = {
  key: string
  name: string
  lifeStage: LifeStage
  imageUrl: string | null
  labelStatus: RecipeLabelStatus
  variations: RecipeContent['variations']
}

// Items of a list pasted from a label ("Brown Rice, Beef, Lentils." or one per line): split on commas,
// semicolons and line breaks outside parentheses, without the closing period or blanks.
export function splitPastedList(text: string) {
  const items: string[] = []
  let depth = 0
  let current = ''
  for (const char of text) {
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && /[,;\n]/.test(char)) {
      items.push(current)
      current = ''
    } else {
      current += char
    }
  }
  items.push(current)
  return items.map((item) => item.trim().replace(/\.$/, '').trim()).filter(Boolean)
}

// A list of sentences edited as one text: one item per paragraph, paragraphs split by a blank line. Line
// breaks inside a paragraph become spaces, since the store shows each item on one line.
export function paragraphsToList(text: string) {
  return text.split(/\n\s*\n/).map((paragraph) => paragraph.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

export function listToParagraphs(items: string[]) {
  return items.join('\n\n')
}

export function recipePagePath(market: string, recipeKey: string) {
  return `/catalog/recipes/${encodeURIComponent(market)}/${encodeURIComponent(recipeKey)}`
}

// Suggested key for a new recipe: the name as a lowercase slug, accents removed.
export function recipeKeyFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

export function recipeContentPath(recipeKey: string, market: string, suffix = '') {
  return `/admin/catalog/recipe-content/${encodeURIComponent(recipeKey)}${suffix}?market=${encodeURIComponent(market)}`
}

export const LABEL_STATUS_TEXT: Record<RecipeLabelStatus, string> = {
  missing: 'Sem rótulo',
  incomplete: 'Rótulo incompleto',
  complete: 'Rótulo completo',
}

export const LABEL_MISSING_TEXT: Record<string, string> = {
  ingredients: 'ingredientes',
  analysis: 'níveis de garantia',
  energyKg: 'kcal/kg',
  energyPackage: 'kcal por embalagem',
  notices: 'avisos',
}

export function labelMissingText(missing: string[]) {
  return missing.map((item) => LABEL_MISSING_TEXT[item] ?? item).join(', ')
}

// Portuguese text for the content refusals; anything else keeps the API message.
export function recipeContentFailure(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    const details = (error.details ?? {}) as Record<string, unknown>
    if (error.code === 'recipe_image_invalid') {
      if (details.reason === 'dimensions') {
        return `A imagem tem ${details.width} × ${details.height} px e precisa ter ${details.expectedWidth} × ${details.expectedHeight} px.`
      }
      if (details.reason === 'bytes') return 'A imagem passa de 5 MB.'
      if (details.reason === 'type') return 'Use uma imagem PNG, JPEG ou WebP.'
      return 'Não foi possível ler a imagem. Escolha outro arquivo.'
    }
    if (error.code === 'recipe_content_in_use') {
      if (Array.isArray(details.missing)) {
        return `O rótulo de uma receita ativa nos EUA precisa continuar completo. Falta: ${labelMissingText(details.missing as string[])}.`
      }
      return 'A imagem não pode ser removida enquanto houver variação ativa deste sabor. Desative as variações antes.'
    }
    if (error.code === 'recipe_label_invalid') {
      return `Rótulo inválido no campo ${String(details.field ?? '')}: ${error.message}`
    }
    if (error.code === 'recipe_presentation_invalid') {
      const fields = Array.isArray(details.fields) ? details.fields as string[] : []
      return `Apresentação inválida. Confira: ${fields.map(presentationFieldText).join(', ') || 'os campos'}.`
    }
    if (error.code === 'recipe_not_found') {
      return 'Receita não cadastrada neste mercado.'
    }
    if (error.code === 'recipe_key_taken') {
      return 'Já existe uma receita com essa chave neste mercado.'
    }
    if (error.code === 'recipe_key_invalid') {
      return 'A chave usa só letras minúsculas, números e hífens, por exemplo senior-cordeiro.'
    }
    if (error.code === 'recipe_name_invalid') {
      return 'Informe um nome de até 120 caracteres.'
    }
    if (error.code === 'recipe_in_use') {
      const variations = Array.isArray(details.variations) ? details.variations as Array<{ sku?: string; name?: string }> : []
      const names = variations.map((item) => item.name || item.sku).filter(Boolean).join(', ')
      return `Esta receita é usada por variações e não pode ser excluída${names ? `: ${names}` : ''}.`
    }
  }
  return error instanceof Error ? error.message : fallback
}
