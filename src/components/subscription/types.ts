import type { AddressIssue } from '../../lib/addressIssues'
import type { DeliveryInstructionsSource } from '../../lib/deliveryInstructions'
import { productionLabel } from '../../lib/courierDeliveries'
import { getBrowserTimeZone } from '../../lib/format'
import type { PaidCycle } from '../../lib/paidCycles'

// GET /admin/billing/subscriptions/:id
export type SubscriptionDetail = {
  id: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: string
  planLabel: string | null
  stripePriceId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  dashboardUrl: string
  stripeAccount?: string
  term?: { marketCountry: string; months: number }
  customerProfileInScope?: boolean
  user: { id: string; email: string }
  petsSnapshot: unknown
  planSelection: unknown
  shipping: unknown
  address: unknown
  // shipment-market: null when the account and the address country fit no market.
  shipment_market?: 'BR' | 'US' | null
  market_exception?: boolean
  // delivery-address-issues: the open problem, or the last one resolved in 30 days.
  address_issue?: AddressIssue | null
  // keep-ready-orders-dispatchable: what the courier dispatch would refuse for this address; null outside the
  // Brazil market, absent on an older API.
  courier_issues?: string[] | null
  // operator-fills-recipient-name: the account name, null outside the operator's market. Also the page title.
  account_name?: string | null
  // delivery-instructions: the subscription text, or the profile text at the same place; absent when the
  // customer profile is outside the operator's market.
  delivery_instructions?: string | null
  delivery_instructions_source?: DeliveryInstructionsSource
}

// GET /admin/billing/subscriptions/:id/shipments
export type UpsShipment = {
  id: string
  subscription_id: string
  stripe_invoice_id: string
  ups_shipment_id: string | null
  tracking_number: string | null
  tracking_url: string | null
  tracking_status: string | null
  tracking_description: string | null
  delivered_at: string | null
  service_code: string | null
  label_format: string | null
  has_label: boolean
  quoted_shipping_cost: number | null
  ups_monetary_value: number | null
  status: string
  shipped_at: string | null
  created_at: string | null
  updated_at: string | null
}

// A calendar day stored as YYYY-MM-DD, shown as DD/MM/YYYY.
export function formatDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

// An instant shown as its day in the operator's time zone, without the time.
export function formatDayOf(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: getBrowserTimeZone() }).format(date)
}

export function cycleText(cycle: PaidCycle) {
  return [
    cycle.preparation_day ? `Preparo ${formatDay(cycle.preparation_day)}` : null,
    productionLabel(cycle.production_status),
    cycle.delivery_date ? `entrega ${formatDay(cycle.delivery_date)}` : null,
  ].filter(Boolean).join(' · ')
}

// The phone saved with this subscription's delivery address. The detail API carries no account phone.
export function addressPhone(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null
  const value = (address as Record<string, unknown>).phone
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

// The page title: the account name when the API gives one (only for a profile in the operator's market), else the
// email.
export function subscriptionTitle(data: SubscriptionDetail | null) {
  if (!data) return 'Assinatura'
  return data.account_name?.trim() || data.user.email || data.stripeSubscriptionId
}
