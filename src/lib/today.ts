import { courierHref } from './courierDeliveries'
import { productionQueueHref } from './productionQueue'
import type { CustomerContact } from './customerContacts'

export type Bucket = 'overdue' | 'today' | 'tomorrow'
export type Counts = Record<Bucket, number>

export type TodayItem = {
  id: number
  market: 'BR' | 'US'
  dueBucket: Bucket
  dueLabel: string
  displayName: string
  email: string
  city: string
  flavorMix: string
  packCount: number
  packSizeLabel: string
  productionStatus: 'to_prepare' | 'in_production' | 'ready' | 'blocked'
  paymentState: 'awaiting_payment' | 'past_due' | 'paid'
  note: string | null
  // 'unresolved': a purchase was sent and UPS never confirmed it.
  upsLabel: 'created' | 'missing' | 'unresolved' | null
  // Brazil paid items only: where the box is after it is ready.
  courierDelivery?: 'none' | 'out_for_delivery' | 'delivered' | 'failed' | null
  // Refused payments only.
  lastContact?: CustomerContact | null
  phone?: string | null
}

// Shipping and invoice work for Today. Counts are already limited to the markets the user sees.
export type Fulfillment = {
  courierToDispatch: number
  courierOnTheRoadLong: number
  courierFailed: number
  // PM-25: part of courierToDispatch, waiting for an authorized NF-e; null while the fiscal lock is off.
  courierAwaitingNfe?: number | null
  nfeMissingDocument: number
  nfeRejected: number
  nfeError: number
  upsUnresolved: number
  // ups-pickup: created US labels with no pickup asked of UPS and no tracking scan. Absent on an older API.
  upsLabelsWithoutPickup?: number
  // null when the user cannot see Bling or it is not configured.
  blingConnected: boolean | null
  // admin-flow-fixes-5: open address problems (stale = open 72 h or more) and market exceptions, per market.
  // Absent on an older API.
  addressIssues?: Record<'BR' | 'US', { open: number; stale: number }>
  marketExceptions?: Record<'BR' | 'US', number>
}

export type ClosedDay = {
  market: 'BR' | 'US'
  date: string
  label: string
  closesPreparation?: boolean
  closesPickup?: boolean
  closesDelivery?: boolean
}

export type TodayOverview = {
  generatedAt: string
  today: string
  totals: Counts
  byMarket: Record<'BR' | 'US', Counts>
  truncated: boolean
  total: number
  items: TodayItem[]
  closedDays: ClosedDay[]
  fulfillment?: Fulfillment
}

export const UPS_CHECK_PATH = '/operations/labels#verificar-ups'
export const UPS_PICKUP_PATH = '/operations/labels#coleta'

export type Tone = 'error' | 'warning' | 'info' | 'success'

// What the team does next with one order, in the order the work happens.
export function nextStep(item: TodayItem): { text: string; tone: Tone; to: string } {
  const subscription = `/billing/subscriptions/${item.id}`
  const production = productionQueueHref({ busca: item.email, mercado: item.market === 'US' ? 'us' : 'br' })
  if (item.paymentState === 'past_due') return { text: 'Pagamento recusado: falar com o cliente', tone: 'error', to: subscription }
  if (item.paymentState === 'awaiting_payment') return { text: 'Aguardando a cobrança', tone: 'info', to: subscription }
  if (item.productionStatus === 'blocked') return { text: 'Resolver o bloqueio', tone: 'error', to: production }
  if (item.productionStatus === 'to_prepare') return { text: 'Iniciar o preparo', tone: 'warning', to: production }
  if (item.productionStatus === 'in_production') return { text: 'Marcar como pronto', tone: 'warning', to: production }
  // A purchase UPS never confirmed: buying again could charge twice.
  if (item.upsLabel === 'unresolved') return { text: 'Verificar na UPS', tone: 'error', to: UPS_CHECK_PATH }
  if (item.upsLabel === 'missing') return { text: 'Gerar etiqueta UPS', tone: 'warning', to: subscription }
  // The panel has no US dispatch step: once the label exists, the box waits for the UPS pickup.
  if (item.upsLabel === 'created') return { text: 'Aguardando coleta UPS', tone: 'success', to: subscription }
  // Brazil: the box stays "ready" after the dispatch, so the courier record says where it is.
  if (item.courierDelivery === 'out_for_delivery') return { text: 'Em rota', tone: 'info', to: courierHref('em_rota') }
  if (item.courierDelivery === 'delivered') return { text: 'Entregue', tone: 'success', to: courierHref('entregues') }
  if (item.courierDelivery === 'failed') return { text: 'Despachar de novo', tone: 'warning', to: courierHref('falhas') }
  if (item.market === 'BR') return { text: 'Despachar', tone: 'warning', to: courierHref() }
  return { text: 'Ver o pedido', tone: 'info', to: subscription }
}
