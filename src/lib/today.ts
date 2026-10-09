import { productionQueueHref } from './productionQueue'

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
  upsLabel: 'created' | 'missing' | null
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
}

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
  if (item.upsLabel === 'missing') return { text: 'Gerar etiqueta UPS', tone: 'warning', to: subscription }
  if (item.upsLabel === 'created') return { text: 'Etiqueta criada: despachar', tone: 'success', to: subscription }
  return { text: 'Pronto para entregar', tone: 'success', to: subscription }
}
