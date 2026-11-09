import type { CourierStatus, CourierTab } from './courierDeliveries'
import { formatCurrency, formatNumber, formatTermMonths } from './format'
import type { NfeEmailStatus, NfeStatus } from './nfe'

// One subscription in GET /admin/users/:userId (backend: admin-customer-subscriptions). A key absent from the
// payload means the operator's role does not read that screen; null means there is nothing to show.
export type CustomerSubscription = {
  id: string
  stripeSubscriptionId: string
  stripeAccount?: string
  status: string
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  planLabel: string | null
  createdAt?: string | null
  subscriptionTermMonths?: number | null
  chargedDeliveries?: number | null
  autoRenew?: boolean | null
  paymentMethod?: { brand: string | null; last4: string | null }
  checkoutShipping?: { label: string | null; amount: number | null; currency: string } | null
  latestCycle?: LatestCycle | null
  latestCycleUnavailable?: boolean
}

export type LatestCycle = {
  invoiceId: string
  paidAt: string | null
  preparationDay: string | null
  deliveryDate: string | null
  production?: { status: string | null; note: string | null }
  delivery?: CycleDelivery | null
  nfe?: CycleNfe | null
}

export type CycleDelivery =
  | { kind: 'courier'; id: number; status: CourierStatus; outForDeliveryAt: string | null; deliveredAt: string | null; failedAt: string | null }
  | { kind: 'ups'; id: number; status: string; trackingNumber: string | null }

export type CycleNfe = {
  id: number
  number: string | null
  series: string | null
  status: NfeStatus
  lastError: string | null
  emailStatus: NfeEmailStatus | null
}

export function subscriptionBadgeClass(status: string) {
  if (status === 'active' || status === 'trialing') return 'badge-success'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'badge-warning'
  if (status === 'canceled' || status === 'incomplete_expired') return 'badge-neutral'
  return 'badge-info'
}

// A date-only value (YYYY-MM-DD) read as the calendar day, never shifted by the browser time zone.
export function formatCalendarDay(value: string | null | undefined) {
  if (!value) return '-'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function formatContract(item: Pick<CustomerSubscription, 'subscriptionTermMonths' | 'chargedDeliveries' | 'autoRenew'>) {
  const parts = [
    item.subscriptionTermMonths ? formatTermMonths(item.subscriptionTermMonths) : null,
    item.chargedDeliveries == null ? null : `${formatNumber(item.chargedDeliveries)} ${item.chargedDeliveries === 1 ? 'entrega cobrada' : 'entregas cobradas'}`,
    item.autoRenew == null ? null : item.autoRenew ? 'renova automaticamente' : 'não renova',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '-'
}

export function formatPaymentMethod(method: CustomerSubscription['paymentMethod']) {
  if (!method || (!method.brand && !method.last4)) return '-'
  const brand = method.brand ? method.brand.charAt(0).toUpperCase() + method.brand.slice(1) : 'Cartão'
  return method.last4 ? `${brand} •••• ${method.last4}` : brand
}

export function formatCheckoutShipping(shipping: CustomerSubscription['checkoutShipping']) {
  if (!shipping || shipping.amount == null) return '-'
  const amount = formatCurrency(shipping.amount, shipping.currency || 'BRL')
  return shipping.label ? `${amount} · ${shipping.label}` : amount
}

// The Entregas Brasil tab where a courier delivery in this status is listed.
export function courierTabFor(status: CourierStatus): CourierTab {
  if (status === 'delivered') return 'entregues'
  if (status === 'failed') return 'falhas'
  if (status === 'out_for_delivery') return 'em_rota'
  return 'a_despachar'
}

// The moment that matters for a courier delivery in its current status.
export function courierMoment(delivery: Extract<CycleDelivery, { kind: 'courier' }>) {
  if (delivery.status === 'delivered') return delivery.deliveredAt
  if (delivery.status === 'failed') return delivery.failedAt
  return delivery.outForDeliveryAt
}
