// Assinantes keeps its filters in the URL, so Hoje and the NF-e detail can open it already filtered.
export const BILLING_PATH = '/billing'

export const BILLING_STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'canceling', 'all'] as const
export type BillingStatus = (typeof BILLING_STATUSES)[number]

export type BillingFilters = {
  status?: BillingStatus
  conta?: string
  busca?: string
  pagina?: number
}

export function isBillingStatus(value: string | null): value is BillingStatus {
  return BILLING_STATUSES.includes(value as BillingStatus)
}

export function billingStatusFrom(value: string | null): BillingStatus {
  return isBillingStatus(value) ? value : 'active'
}

export function billingHref(filters: BillingFilters = {}) {
  const params = new URLSearchParams()
  if (filters.busca) params.set('busca', filters.busca)
  if (filters.status && filters.status !== 'active') params.set('status', filters.status)
  if (filters.conta && filters.conta !== 'all') params.set('conta', filters.conta)
  if (filters.pagina && filters.pagina > 1) params.set('pagina', String(filters.pagina))
  const query = params.toString()
  return query ? `${BILLING_PATH}?${query}` : BILLING_PATH
}
