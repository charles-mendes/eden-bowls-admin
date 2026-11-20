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
  // Paid, still not ready and more than 30 days past its preparation day. Absent on an older API.
  stale?: boolean
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
  // keep-ready-orders-dispatchable: part of courierToDispatch the address keeps from leaving. Absent on an older API.
  courierAddressLocked?: number | null
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
  // Paid cycles still not ready more than 30 days late, counted apart from the list cut. Absent on an older API.
  stalePaid?: number
  truncated: boolean
  total: number
  items: TodayItem[]
  closedDays: ClosedDay[]
  fulfillment?: Fulfillment
}

export const UPS_CHECK_PATH = '/operations/labels#verificar-ups'
export const UPS_PICKUP_PATH = '/operations/labels#coleta'
