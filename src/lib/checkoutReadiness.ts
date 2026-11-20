import { apiRequest } from './api'

// What would make store checkout fail in Brazil or the United States (admin-checkout-readiness). Admin only.
export type ReadinessMarket = 'BR' | 'US'
export type ReadinessSeverity = 'high' | 'medium'
export type ReadinessAction = 'products' | 'coupons' | 'shipping_us' | 'shipping_br' | null

export type ReadinessWarning = {
  key: string
  code: string
  market: ReadinessMarket
  severity: ReadinessSeverity
  action: ReadinessAction
  details?: { terms?: number[]; missing_variation_ids?: Array<string | number> }
}

export type ReadinessNote = {
  key: string
  code: string
  market: ReadinessMarket
}

export type CheckoutReadiness = {
  checked_at: string
  config: {
    stripe_br_enabled: boolean
    stripe_secret_key_present: Record<ReadinessMarket, boolean>
    ups_configured: boolean
  }
  warnings: ReadinessWarning[]
  notes: ReadinessNote[]
}

export const CHECKOUT_READINESS_PATH = '/operations/checkout-readiness'

export function fetchCheckoutReadiness(token: string | null | undefined) {
  return apiRequest<CheckoutReadiness>('/admin/checkout/readiness', { token })
}

export type ReadinessFilter = 'todos' | 'br' | 'us'

export function parseReadinessFilter(value: string | null): ReadinessFilter {
  return value === 'br' || value === 'us' ? value : 'todos'
}

export function inFilter(filter: ReadinessFilter, market: ReadinessMarket) {
  return filter === 'todos' || filter.toUpperCase() === market
}

const ACTIONS: Record<Exclude<ReadinessAction, null>, { label: string; to: string }> = {
  products: { label: 'Produtos', to: '/catalog/products' },
  coupons: { label: 'Cupons de 1ª compra', to: '/billing/coupons' },
  shipping_us: { label: 'Regras de frete', to: '/config/shipping?mercado=us' },
  shipping_br: { label: 'Regras de frete', to: '/config/shipping?mercado=br' },
}

export function readinessAction(action: ReadinessAction) {
  return action ? ACTIONS[action] ?? null : null
}

const OF: Record<ReadinessMarket, string> = { BR: 'do Brasil', US: 'dos EUA' }

function terms(list: number[] = []) {
  if (list.length <= 1) return `${list[0] ?? ''}`
  return `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}`
}

export function warningMessage(item: ReadinessWarning) {
  const of = OF[item.market]
  switch (item.code) {
    case 'catalog_never_synced':
      return `O catálogo ${of} nunca foi sincronizado com esta conta Stripe. A loja mostra os produtos, mas o pagamento falha.`
    case 'catalog_account_changed':
      return `A conta Stripe ${of} mudou desde a última sincronização do catálogo. A loja mostra os produtos, mas o pagamento falha.`
    case 'catalog_prices_missing':
      return `Alguns preços ${of} não existem na conta Stripe atual. A loja mostra os produtos, mas o pagamento falha.`
    case 'coupon_missing':
      return `O cupom de 1ª compra de ${terms(item.details?.terms)} meses ${of} não está vinculado ou está inativo nesta conta Stripe. O checkout desses planos é recusado.`
    case 'us_shipping_fixed':
      return 'O frete dos EUA está em valor fixo. O checkout recusa o endereço por não ter prazo de entrega.'
    case 'us_ups_not_configured':
      return 'A UPS não tem credencial no servidor. O frete dos EUA cai no valor de reserva e o checkout recusa o endereço.'
    case 'us_ship_from_missing':
      return 'Falta o CEP de origem da UPS. O frete dos EUA cai no valor de reserva e o checkout recusa o endereço.'
    case 'us_ups_quote_fallback':
      return 'A cotação da UPS cai no valor de reserva, sem prazo. O checkout dos EUA recusa o endereço.'
    case 'br_center_missing':
      return 'O centro de distribuição do Brasil está sem latitude e longitude. O frete do Brasil não é calculado.'
    case 'stripe_br_disabled':
      return 'A Stripe Brasil está desligada (STRIPE_BR_ENABLED). O checkout do Brasil não abre. Isso se resolve no servidor.'
    case 'stripe_secret_key_missing':
      return `Chave secreta da Stripe ${of}: ausente. O checkout ${of} não abre. Isso se resolve no servidor.`
    default:
      return `O checkout ${of} tem um problema de configuração (${item.code}).`
  }
}

export function noteMessage(item: ReadinessNote) {
  if (item.code === 'ups_unverified') return 'Não foi possível consultar a UPS agora.'
  return `Não foi possível conferir a conta Stripe ${OF[item.market]} agora.`
}

export function emptyMessage(filter: ReadinessFilter) {
  if (filter === 'br') return 'Nada bloqueia o checkout do Brasil.'
  if (filter === 'us') return 'Nada bloqueia o checkout dos EUA.'
  return 'Nada bloqueia o checkout da loja.'
}

export function summaryLine(count: number) {
  return `Checkout da loja tem ${count} ${count === 1 ? 'aviso' : 'avisos'}`
}
