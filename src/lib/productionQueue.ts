import { stockHref } from './packStock'
export type ProductionStatus = 'to_prepare' | 'in_production' | 'ready' | 'blocked'
export type StockCoverage = 'covered' | 'short' | 'unknown'

// pack-stock: for a short cycle, each recipe the stock left over did not cover, by the queue's due order.
export type StockShortage = { flavorKey: string; packSizeGrams: number; recipeName: string; missing: number }

// production-block-preview: where blocking an unpaid cycle moves its charge.
export type BlockPreview = { charged: boolean; chargeMovesTo: string | null; preparationDay: string | null }

export type ProductionStockResult = {
  shortages: Array<{ flavorKey: string; packSizeGrams: number; onHand: number }>
  unsized: number
}
export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'upcoming'

// The queue keeps its filters in the URL, so Hoje can open it already filtered.
export type QueueDue = 'atrasados' | 'hoje' | 'amanha' | 'proximos'

export type QueueFilters = {
  prazo?: QueueDue
  status?: ProductionStatus
  busca?: string
  mercado?: 'br' | 'us'
}

export const QUEUE_PATH = '/operations/production'

export const DUE_TO_API: Record<QueueDue, DueBucket> = {
  atrasados: 'overdue',
  hoje: 'today',
  amanha: 'tomorrow',
  proximos: 'upcoming',
}

export const DUE_LABELS: Record<QueueDue, string> = {
  atrasados: 'Atrasados',
  hoje: 'Hoje',
  amanha: 'Amanhã',
  proximos: 'Próximos dias',
}

export const PRODUCTION_STATUSES: ProductionStatus[] = ['to_prepare', 'in_production', 'ready', 'blocked']

export const STOCK_COVERAGE_LABELS: Record<StockCoverage, string> = {
  covered: 'Coberto',
  short: 'Falta estoque',
  unknown: 'Sem tamanho',
}

export function formatSeparationShortage(stock: ProductionStockResult) {
  const shortages = stock.shortages.map((item) => `${item.flavorKey} ${item.packSizeGrams} g (${item.onHand})`)
  const parts = [
    shortages.length ? `Separado com estoque negativo: ${shortages.join(', ')}.` : '',
    stock.unsized > 0 ? `${stock.unsized} linhas sem tamanho.` : '',
  ].filter(Boolean)
  return parts.join(' ')
}

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  to_prepare: 'A preparar',
  in_production: 'Em preparo',
  ready: 'Pronto',
  blocked: 'Bloqueado',
}

export function isQueueDue(value: string | null): value is QueueDue {
  return value === 'atrasados' || value === 'hoje' || value === 'amanha' || value === 'proximos'
}

export function isProductionStatus(value: string | null): value is ProductionStatus {
  return PRODUCTION_STATUSES.includes(value as ProductionStatus)
}

export function productionQueueHref(filters: QueueFilters = {}) {
  const params = new URLSearchParams()
  if (filters.prazo) params.set('prazo', filters.prazo)
  if (filters.status) params.set('status', filters.status)
  if (filters.busca) params.set('busca', filters.busca)
  if (filters.mercado) params.set('mercado', filters.mercado)
  const query = params.toString()
  return query ? `${QUEUE_PATH}?${query}` : QUEUE_PATH
}

// "1 pedido", "2 pedidos": counts in copy read as words, not as "pedido(s)".
export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

// pack-stock: "Frango 300 g, Carne 300 g" for the recipes a short cycle is missing.
export function formatStockShortages(shortages: StockShortage[] = []) {
  return shortages.map((item) => `${item.recipeName} ${item.packSizeGrams} g`).join(', ')
}

// The stock screen for a short cycle: short items, the cycle's market when the session has both, and the recipe
// when only one is missing.
export function stockShortageHref(
  item: { stripeAccount: string; stockShortages?: StockShortage[] },
  bothMarkets: boolean,
) {
  const shortages = item.stockShortages ?? []
  return stockHref({
    mercado: bothMarkets ? (String(item.stripeAccount).toLowerCase() === 'us' ? 'US' : 'BR') : undefined,
    situacao: 'short',
    busca: shortages.length === 1 ? shortages[0].recipeName : undefined,
  })
}

export const READY_SHORT_ONE = (recipes: string) => `Pela ordem da fila, falta estoque de ${recipes} para este pedido. Marcar como pronto pode deixar o saldo negativo.`
export const READY_SHORT_BATCH = 'Pela ordem da fila, falta estoque para estes pedidos. Marcar como pronto pode deixar o saldo negativo.'

// production-block-preview: "12/11" for the instant the charge moves to, in the market's timezone.
export function chargeDayMonth(instant: string, stripeAccount: string) {
  const timeZone = String(stripeAccount).toLowerCase() === 'br' ? 'America/Sao_Paulo' : 'America/New_York'
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit' }).format(new Date(instant))
}
