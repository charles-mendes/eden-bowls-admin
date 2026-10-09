export type ProductionStatus = 'to_prepare' | 'in_production' | 'ready' | 'blocked'
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
