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

export type StockOverview = {
  market: string
  windowDays: number
  items: StockItem[]
  unsizedLines: UnsizedLine[]
}

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
  production: 'Produção',
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

export function isStockWindow(value: number): value is StockWindow {
  return STOCK_WINDOWS.includes(value as StockWindow)
}

export function stockItemLabel(flavorKey: string, packSizeGrams: number) {
  return `${flavorKey} ${packSizeGrams} g`
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
