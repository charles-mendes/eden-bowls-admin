// Paid delivery cycles of one subscription, with the shipping state of each (subscription detail).
export type PaidCycle = {
  invoice_id: string
  preparation_day: string | null
  production_status: string | null
  delivery_date: string | null
  paid_at: string | null
  ups_shipment: { id: string | number; status: string; tracking_number: string | null } | null
  courier_delivery: {
    id: number
    status: 'out_for_delivery' | 'delivered' | 'failed'
    out_for_delivery_at: string | null
    delivered_at: string | null
    failed_at: string | null
  } | null
}

export function paidCyclesPath(subscriptionId: string | number) {
  return `/admin/billing/subscriptions/${encodeURIComponent(String(subscriptionId))}/paid-cycles`
}
