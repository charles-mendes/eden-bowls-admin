import { ApiRequestError } from './api'
import { recipeContentFailure } from './recipeContent'

export type MediaKind = 'plan'

export type MediaUser = { key: string; name: string; market: string }

// Image of the admin library (plan-image-library). The API never deletes one: archiving only hides it.
export type MediaAsset = {
  id: number
  kind: MediaKind
  market: string
  url: string
  originalFilename: string
  mimeType: string
  width: number | null
  height: number | null
  bytes: number | null
  createdAt: string | null
  archivedAt: string | null
  archived: boolean
  usedBy: MediaUser[]
}

export type MediaUpload = MediaAsset & { duplicate: boolean }

export const MEDIA_UPLOAD_PATH = '/admin/media'

export function mediaListPath(market: string, { archived = false, kind = 'plan' }: { archived?: boolean; kind?: MediaKind } = {}) {
  const query = new URLSearchParams({ market, kind })
  if (archived) query.set('archived', 'true')
  return `/admin/media?${query.toString()}`
}

export function mediaActionPath(id: number, action: 'archive' | 'restore') {
  return `/admin/media/${encodeURIComponent(String(id))}/${action}`
}

// "Adulto Carne (BR), Sênior Carne (BR)"
export function usedByText(usedBy: MediaUser[]) {
  return usedBy.map((user) => `${user.name} (${user.market})`).join(', ')
}

// Words of the designer's file names, by language. `senior` is both, so the flavors decide the market.
const LINES: Record<string, { line: 'adult' | 'puppy' | 'senior'; market: 'BR' | 'US' | null }> = {
  adulto: { line: 'adult', market: 'BR' },
  filhote: { line: 'puppy', market: 'BR' },
  filhotes: { line: 'puppy', market: 'BR' },
  adult: { line: 'adult', market: 'US' },
  puppy: { line: 'puppy', market: 'US' },
  puppies: { line: 'puppy', market: 'US' },
  senior: { line: 'senior', market: null },
}

const FLAVORS: Record<string, { flavor: string; market: 'BR' | 'US' }> = {
  carne: { flavor: 'beef', market: 'BR' },
  frango: { flavor: 'chicken', market: 'BR' },
  peixe: { flavor: 'fish', market: 'BR' },
  porco: { flavor: 'pork', market: 'BR' },
  beef: { flavor: 'beef', market: 'US' },
  chicken: { flavor: 'chicken', market: 'US' },
  fish: { flavor: 'fish', market: 'US' },
  pork: { flavor: 'pork', market: 'US' },
}

// Adult recipe keys that are not the flavor word: the adult chicken recipe is `turkey`.
const ADULT_KEY_BY_FLAVOR: Record<string, string> = { chicken: 'turkey' }

export type PlanLinkSuggestion = { market: string | null; recipeKey: string | null }

/**
 * Market and recipe suggested by a file name ("adulto-carne_400.png" → BR `beef`). The market comes from the
 * language of the words; the recipe only when its key is registered in that market. Never saved without the
 * operator confirming the list.
 */
export function suggestPlanLink(fileName: string, recipeKeysByMarket: Record<string, string[]>): PlanLinkSuggestion {
  const stem = fileName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/[_-](200|400)$/, '')
  const words = stem.split(/[^a-z0-9]+/).filter(Boolean)
  const lines = words.map((word) => LINES[word]).filter(Boolean)
  const flavors = words.map((word) => FLAVORS[word]).filter(Boolean)
  const markets = new Set([...lines.map((item) => item.market), ...flavors.map((item) => item.market)].filter(Boolean))
  const market = markets.size === 1 ? [...markets][0] as string : null
  if (!market || lines.length !== 1 || flavors.length === 0 || words.length !== lines.length + flavors.length) {
    return { market, recipeKey: null }
  }

  const { line } = lines[0]
  const flavorWords = flavors.map((item) => item.flavor)
  const recipeKey = line === 'adult'
    ? (flavorWords.length === 1 ? ADULT_KEY_BY_FLAVOR[flavorWords[0]] ?? flavorWords[0] : null)
    : `${line}-${flavorWords.join('-')}`
  return { market, recipeKey: recipeKey && (recipeKeysByMarket[market] ?? []).includes(recipeKey) ? recipeKey : null }
}

// Portuguese text for the library refusals; image checks and anything else follow the recipe content texts.
export function mediaFailure(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    const details = (error.details ?? {}) as Record<string, unknown>
    if (error.code === 'media_asset_in_use') {
      const usedBy = Array.isArray(details.usedBy) ? details.usedBy as MediaUser[] : []
      return `Esta imagem está em uso${usedBy.length ? ` por ${usedByText(usedBy)}` : ''} e não pode ser arquivada. Desvincule antes.`
    }
    if (error.code === 'media_asset_archived') {
      return 'Esta imagem está arquivada. Restaure na Biblioteca de imagens antes de usar.'
    }
    if (error.code === 'media_asset_invalid') {
      if (details.reason === 'market') return 'A imagem precisa ser uma miniatura do mesmo mercado da receita.'
      return 'Envie uma imagem nova ou escolha uma da biblioteca.'
    }
    if (error.status === 404 && !error.code) {
      return 'Imagem não encontrada na biblioteca deste mercado.'
    }
  }
  return recipeContentFailure(error, fallback)
}
