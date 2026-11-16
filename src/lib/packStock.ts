import { ApiRequestError } from './api'
import type { LifeStage } from './recipeContent'

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

// One variation of a product of the market: the product is the recipe and has one variation per weight.
export type StockCatalogEntry = {
  flavorKey: string
  packSizeGrams: number
  /** Product name. */
  label: string
  productId?: string | null
  variationId?: string | null
  sku?: string | null
  published: boolean
}

// A variation on sale with no weight: it has no pack size, so it stays out of the stock until the weight is filled.
export type VariationWithoutWeight = {
  productId: string
  productName: string
  lifeStage?: LifeStage | null
  variationId: string
  name: string | null
  sku: string | null
}

export type StockOverview = {
  market: string
  windowDays: number
  items: StockItem[]
  unsizedLines: UnsizedLine[]
  /** Products and sizes of the market catalog. Empty when the catalog is unavailable. */
  catalog?: StockCatalogEntry[]
  /** Variations on sale without weight, out of the stock. */
  variationsWithoutWeight?: VariationWithoutWeight[]
}

const LIFE_STAGE_ORDER: Record<LifeStage, number> = { adult: 0, puppy: 1, senior: 2 }

// Grouped by life stage (Adulto, Filhote, Sênior), then by product name and SKU, so the same recipe line reads together.
export function sortVariationsWithoutWeight(items: VariationWithoutWeight[]) {
  return items.toSorted((left, right) => (
    (left.lifeStage ? LIFE_STAGE_ORDER[left.lifeStage] : 3) - (right.lifeStage ? LIFE_STAGE_ORDER[right.lifeStage] : 3)
    || left.productName.localeCompare(right.productName)
    || (left.sku ?? '').localeCompare(right.sku ?? '')
  ))
}

// Product page with the variation's weight open to fill.
export function variationWeightHref(item: { productId: string; variationId: string }) {
  return `/catalog/products/${item.productId}?variation=${item.variationId}&campo=peso`
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
    return 'Esse produto não tem variação com esse tamanho neste mercado.'
  }
  if (code === 'stock_adjustment_must_decrease') {
    return 'Perda, vencimento e amostra só podem baixar o saldo. Para somar, use o motivo Outro.'
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

export type StockProduct = {
  flavorKey: string
  /** Product name, with the code beside it when another product of the market has the same name. */
  name: string
  productId: string | null
}

// The product of each code (flavorKey), read from the catalog. Without the catalog the code stands for the name.
export function stockProducts(catalog: StockCatalogEntry[]) {
  const products = new Map<string, StockProduct>()
  for (const entry of catalog) {
    const current = products.get(entry.flavorKey)
    products.set(entry.flavorKey, {
      flavorKey: entry.flavorKey,
      name: current?.name || entry.label || entry.flavorKey,
      productId: current?.productId || entry.productId || null,
    })
  }
  const counts = new Map<string, number>()
  for (const product of products.values()) counts.set(product.name, (counts.get(product.name) ?? 0) + 1)
  for (const product of products.values()) {
    if ((counts.get(product.name) ?? 0) > 1) product.name = `${product.name} (${product.flavorKey})`
  }
  return products
}

// SKU of each product and size, for the row subline.
export function stockVariationSkus(catalog: StockCatalogEntry[]) {
  return new Map(catalog.filter((entry) => entry.sku).map((entry) => [stockItemKey(entry), entry.sku as string]))
}

// Products and sizes the operator can pick: the published variations plus whatever is already in stock or demanded.
export function stockProductOptions(catalog: StockCatalogEntry[], items: StockItem[]) {
  const sizes = new Map<string, Set<number>>()
  for (const entry of [...catalog.filter((item) => item.published), ...items]) {
    const current = sizes.get(entry.flavorKey) ?? new Set<number>()
    current.add(entry.packSizeGrams)
    sizes.set(entry.flavorKey, current)
  }
  const products = stockProducts(catalog)
  return [...sizes.entries()]
    .map(([flavorKey, grams]) => ({
      flavorKey,
      label: products.get(flavorKey)?.name ?? flavorKey,
      sizes: [...grams].toSorted((left, right) => left - right),
    }))
    .toSorted((left, right) => left.label.localeCompare(right.label))
}

function searchable(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function filterStockItems(
  items: StockItem[],
  { search, status, products, skus }: {
    search: string
    status: StockStatus | ''
    products: Map<string, StockProduct>
    skus?: Map<string, string>
  },
) {
  const term = searchable(search.trim())
  return items.filter((item) => (
    (!status || stockStatus(item) === status)
    && (!term || searchable([
      products.get(item.flavorKey)?.name ?? '',
      item.flavorKey,
      skus?.get(stockItemKey(item)) ?? '',
      item.packSizeGrams,
    ].join(' ')).includes(term))
  ))
}

export function formatSignedQuantity(quantity: number) {
  return quantity > 0 ? `+${quantity}` : String(quantity)
}

// Estoque keeps its filters in the URL (window, admin market, status, search), so a link opens it filtered.
export type StockFilters = { janela?: number; mercado?: 'BR' | 'US'; situacao?: StockStatus | ''; busca?: string }

export function isStockStatus(value: string | null): value is StockStatus {
  return value === 'short' || value === 'below' || value === 'ok'
}

export function stockHref(filters: StockFilters = {}) {
  const params = new URLSearchParams()
  if (filters.mercado) params.set('mercado', filters.mercado)
  if (filters.janela && filters.janela !== 7) params.set('janela', String(filters.janela))
  if (filters.situacao) params.set('situacao', filters.situacao)
  if (filters.busca) params.set('busca', filters.busca)
  const query = params.toString()
  return query ? `/operations/stock?${query}` : '/operations/stock'
}
