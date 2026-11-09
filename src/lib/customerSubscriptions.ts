import { courierHref, type CourierStatus, type CourierTab } from './courierDeliveries'
import { formatCurrency, formatDate, formatNumber, formatTermMonths } from './format'
import { nfeListHref, type NfeEmailStatus, type NfeStatus } from './nfe'

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
  alerts?: SubscriptionAlert[]
}

// Computed by the API from what the operator already reads (backend: customer-subscriptions-alerts).
export type SubscriptionAlert =
  | { code: 'nfe_problem'; nfeId: number; status: NfeStatus; lastError: string | null }
  | { code: 'nfe_missing'; status: NfeStatus | null; paidAt: string | null }
  | { code: 'delivery_failed'; courierDeliveryId: number; failedAt: string | null }
  | { code: 'ready_not_dispatched'; deliveryDate: string }
  | { code: 'pending_change'; kinds: Array<'edit' | 'delivery'> }
  | { code: string; [key: string]: unknown }

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

export type AlertPresentation = { text: string; badge: string; href: string | null; title: string }

const NFE_PROBLEM_TEXT: Record<string, string> = {
  rejected: 'NF-e rejeitada',
  error: 'NF-e com erro',
  blocked_missing_document: 'NF-e sem CPF',
}

const PENDING_KIND_TEXT: Record<string, string> = { edit: 'edição esperando pagamento', delivery: 'mudança de entrega' }

// Text, status color, link and title of one alert on the subscription card. An unknown code stays visible, neutral.
export function alertPresentation(alert: SubscriptionAlert, subscription: Pick<CustomerSubscription, 'id' | 'stripeAccount'>): AlertPresentation {
  const detail = `/billing/subscriptions/${subscription.id}`
  const value = alert as Record<string, unknown>
  switch (alert.code) {
    case 'nfe_problem': {
      const status = String(value.status ?? '')
      return {
        text: NFE_PROBLEM_TEXT[status] ?? 'NF-e com problema',
        badge: 'badge-error',
        href: value.nfeId == null ? null : `/operations/nfe/${value.nfeId}`,
        title: typeof value.lastError === 'string' && value.lastError ? value.lastError : 'A nota do último ciclo não foi autorizada.',
      }
    }
    case 'nfe_missing':
      return {
        text: 'NF-e atrasada',
        badge: 'badge-warning',
        href: nfeListHref(),
        title: `Ciclo pago em ${formatDate(typeof value.paidAt === 'string' ? value.paidAt : null)} ${value.status ? 'com a nota ainda não autorizada' : 'sem nota emitida'} depois de 24 horas.`,
      }
    case 'delivery_failed':
      return {
        text: 'Entrega falhou',
        badge: 'badge-warning',
        href: courierHref('falhas'),
        title: `Tentativa sem nova saída desde ${formatDate(typeof value.failedAt === 'string' ? value.failedAt : null)}.`,
      }
    case 'ready_not_dispatched': {
      const brazil = String(subscription.stripeAccount || '').toLowerCase() === 'br'
      return {
        text: 'Pronto sem despacho',
        badge: 'badge-warning',
        href: `${detail}#${brazil ? 'entrega-brasil' : 'envio-ups'}`,
        title: `Pronto e ainda não despachado. Entrega prevista em ${formatCalendarDay(typeof value.deliveryDate === 'string' ? value.deliveryDate : null)}.`,
      }
    }
    case 'pending_change': {
      const kinds = Array.isArray(value.kinds) ? value.kinds.map((kind) => PENDING_KIND_TEXT[String(kind)] ?? String(kind)) : []
      return {
        text: 'Alteração pendente',
        badge: 'badge-info',
        href: detail,
        title: kinds.length ? `Pendente: ${kinds.join(' e ')}.` : 'A assinatura tem uma alteração pendente.',
      }
    }
    default:
      return { text: alert.code, badge: 'badge-neutral', href: null, title: alert.code }
  }
}
