import { ApiRequestError } from './api'

export const STOCK_WINDOWS = [7, 14, 30] as const
export type StockWindow = (typeof STOCK_WINDOWS)[number]

export type StockMovementType = 'production' | 'separation' | 'separation_reversal' | 'adjustment'
export type StockAdjustmentReason = 'loss' | 'expired' | 'count' | 'sample' | 'other'

export type StockItem = {
  flavorKey: string
  packSizeGrams: number
  onHand: number
  minLevel: number | null
  committed: number
  committedAwaitingPayment: number
  available: number
  toProduce: number
  belowMinimum: boolean
}

export type UnsizedLine = {
  subscriptionId: number
  flavorKey: string | null
  label: string
  quantity: number
}

export type StockCatalogEntry = {
  flavorKey: string
  packSizeGrams: number
  label: string
  published: boolean
}

export type StockOverview = {
  market: string
  windowDays: number
  items: StockItem[]
  unsizedLines: UnsizedLine[]
  /** Names and sizes of the market catalog. Empty when the catalog is unavailable. */
  catalog?: StockCatalogEntry[]
}

export type StockStatus = 'short' | 'below' | 'ok'

export type StockMovement = {
  id: number
  market: string
  flavorKey: string
  packSizeGrams: number
  type: StockMovementType
  quantity: number
  reason: string | null
  note: string | null
  productionCycleId: number | null
  subscriptionId: number | null
  actorName: string | null
  createdAt: string | null
}

export type StockMovementsResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: StockMovement[]
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  production: 'Entrada',
  separation: 'Separação',
  separation_reversal: 'Estorno',
  adjustment: 'Ajuste',
}

export const ADJUSTMENT_REASON_LABELS: Record<StockAdjustmentReason, string> = {
  loss: 'Perda',
  expired: 'Vencimento',
  count: 'Contagem',
  sample: 'Amostra',
  other: 'Outro',
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  short: 'Em falta',
  below: 'Abaixo do mínimo',
  ok: 'OK',
}

export const STOCK_STATUS_BADGES: Record<StockStatus, string> = {
  short: 'badge-error',
  below: 'badge-warning',
  ok: 'badge-success',
}

// Contagem has its own action, which sends the counted total instead of a difference.
export const MANUAL_ADJUSTMENT_REASONS: StockAdjustmentReason[] = ['loss', 'expired', 'sample', 'other']

export function isStockWindow(value: number): value is StockWindow {
  return STOCK_WINDOWS.includes(value as StockWindow)
}

const GRAMS_TO_OZ = 0.035274

// Same reading as the reports: ounces with the grams beside them in the US, grams in Brazil.
export function stockPackSize(packSizeGrams: number, market: string) {
  if (market !== 'US') return `${packSizeGrams} g`
  return `${(packSizeGrams * GRAMS_TO_OZ).toFixed(1)} oz (${packSizeGrams} g)`
}

export function stockItemLabel(flavorKey: string, packSizeGrams: number, market = 'BR') {
  return `${flavorKey} ${stockPackSize(packSizeGrams, market)}`
}

export function stockErrorMessage(error: unknown) {
  const code = error instanceof ApiRequestError ? error.code : ''
  if (code === 'stock_item_unknown') {
    return 'Essa receita e tamanho não existem no catálogo deste mercado.'
  }
  if (code === 'market_forbidden') {
    return 'Este mercado está fora do seu escopo.'
  }
  if (code === 'invalid_window_days') {
    return 'A janela deve ser de 7, 14 ou 30 dias.'
  }
  return error instanceof Error ? error.message : 'Falha ao salvar o estoque'
}

export function sortStockItems(items: StockItem[]) {
  return items.toSorted((left, right) => (
    right.toProduce - left.toProduce
    || left.flavorKey.localeCompare(right.flavorKey)
    || left.packSizeGrams - right.packSizeGrams
  ))
}

export function stockStatus(item: StockItem): StockStatus {
  if (item.available < 0) return 'short'
  return item.belowMinimum ? 'below' : 'ok'
}

export function stockItemKey(item: { flavorKey: string; packSizeGrams: number }) {
  return `${item.flavorKey}|${item.packSizeGrams}`
}

export function stockRecipeNames(catalog: StockCatalogEntry[]) {
  return new Map(catalog.map((entry) => [entry.flavorKey, entry.label]))
}

// Recipes and sizes the operator can pick: the published catalog plus whatever is already in stock or demanded.
export function stockRecipeOptions(catalog: StockCatalogEntry[], items: StockItem[]) {
  const sizes = new Map<string, Set<number>>()
  for (const entry of [...catalog.filter((item) => item.published), ...items]) {
    const current = sizes.get(entry.flavorKey) ?? new Set<number>()
    current.add(entry.packSizeGrams)
    sizes.set(entry.flavorKey, current)
  }
  const names = stockRecipeNames(catalog)
  return [...sizes.entries()]
    .map(([flavorKey, grams]) => ({
      flavorKey,
      label: names.get(flavorKey) ?? flavorKey,
      sizes: [...grams].toSorted((left, right) => left - right),
    }))
    .toSorted((left, right) => left.label.localeCompare(right.label))
}

function searchable(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function filterStockItems(
  items: StockItem[],
  { search, status, names }: { search: string; status: StockStatus | ''; names: Map<string, string> },
) {
  const term = searchable(search.trim())
  return items.filter((item) => (
    (!status || stockStatus(item) === status)
    && (!term || searchable(`${names.get(item.flavorKey) ?? ''} ${item.flavorKey} ${item.packSizeGrams}`).includes(term))
  ))
}

export function formatSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : String(quantity)
}
