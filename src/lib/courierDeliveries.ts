import type { DeliveryRangeInfo } from './deliveryRange'
import { ApiRequestError } from './api'
import { issueCodeText, type AddressIssue } from './addressIssues'
import { PRODUCTION_STATUS_LABELS, isProductionStatus } from './productionQueue'

// Brazil courier deliveries (courier-delivery): recorded by hand, no courier API.
export type CourierMethod = 'uber' | 'motoboy' | 'own_driver' | 'other'
export type CourierStatus = 'out_for_delivery' | 'delivered' | 'failed' | 'canceled'
export type FailureKind = 'address_unusable' | 'customer_absent' | 'other'

export type CourierDelivery = {
  id: number
  subscription_id: string
  stripe_invoice_id: string
  method: CourierMethod
  courier_name: string | null
  tracking_url: string | null
  cost_minor: number | null
  currency: string
  note: string | null
  status: CourierStatus
  out_for_delivery_at: string | null
  delivered_at: string | null
  failed_at: string | null
  failure_reason: string | null
  failure_kind?: FailureKind | null
  canceled_at: string | null
}

export type CourierQueueItem = {
  subscription_id: string
  stripe_subscription_id: string | null
  invoice_id: string
  recipient_name: string | null
  neighborhood: string | null
  city: string | null
  zipcode: string | null
  address?: CourierAddress
  phone?: string | null
  delivery_instructions?: string | null
  delivery_instructions_source?: 'profile'
  items?: Array<{ flavor: string; quantity: number; pack_size: string | null }>
  delivery_date: string | null
  production_status: string | null
  subscription_status: string | null
  delivery: CourierDelivery | null
  // Under "A despachar" and "Falhas": what the courier lock finds missing (courier-delivery). Not empty means
  // the box cannot leave.
  issues?: string[]
  address_issue?: AddressIssue | null
}

export type CourierAddress = {
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zipcode: string | null
}

export type CourierQueue = {
  to_dispatch: CourierQueueItem[]
  out_for_delivery: CourierQueueItem[]
  failed: CourierQueueItem[]
  delivered: CourierQueueItem[]
  truncated: boolean
} & DeliveryRangeInfo

export type ReadinessReason = { code: 'production_not_ready' | 'subscription_not_active' | string; production_status?: string | null; subscription_status?: string | null }

export const COURIER_METHODS: Array<{ value: CourierMethod; label: string }> = [
  { value: 'uber', label: 'Uber' },
  { value: 'motoboy', label: 'Motoboy' },
  { value: 'own_driver', label: 'Entregador próprio' },
  { value: 'other', label: 'Outro' },
]

export const FAILURE_KINDS: Array<{ value: FailureKind; label: string }> = [
  { value: 'address_unusable', label: 'Endereço não serve' },
  { value: 'customer_absent', label: 'Cliente ausente' },
  { value: 'other', label: 'Outro' },
]

export function failureKindLabel(kind: string | null | undefined): string | null {
  if (!kind) return null
  return FAILURE_KINDS.find((item) => item.value === kind)?.label ?? kind
}

// The lines in the order the Uber app asks for them: street and number, complement, neighborhood, city/state, ZIP.
export function addressLines(address: CourierAddress | undefined): string[] {
  if (!address) return []
  const street = [address.street, address.number].filter(Boolean).join(', ')
  const cityState = [address.city, address.state].filter(Boolean).join('/')
  return [street, address.complement, address.neighborhood, cityState, address.zipcode].filter((line): line is string => Boolean(line))
}

export const COURIER_STATUS: Record<CourierStatus, { label: string; badge: string }> = {
  out_for_delivery: { label: 'Em rota', badge: 'badge-info' },
  delivered: { label: 'Entregue', badge: 'badge-success' },
  failed: { label: 'Falhou', badge: 'badge-warning' },
  canceled: { label: 'Cancelada', badge: 'badge-error' },
}

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Ativa',
  past_due: 'Pagamento pendente',
  paused: 'Pausada',
  canceled: 'Cancelada',
}

export function methodLabel(method: string): string {
  return COURIER_METHODS.find((item) => item.value === method)?.label ?? method
}

export function productionLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return isProductionStatus(status) ? PRODUCTION_STATUS_LABELS[status] : status
}

export function subscriptionStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return SUBSCRIPTION_STATUS[status] ?? status
}

export function formatCost(costMinor: number | null | undefined): string {
  if (costMinor === null || costMinor === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(costMinor / 100)
}

// "18,50" or "18.50" in the form; the API takes a decimal string with a dot.
export function costInput(value: string): string | undefined {
  const clean = value.trim().replace(/\s/g, '')
  if (!clean) return undefined
  return clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
}

export function readinessText(reason: ReadinessReason): string {
  if (reason.code === 'production_not_ready') {
    return `Preparo: ${productionLabel(reason.production_status) === '—' ? 'sem ciclo de produção' : productionLabel(reason.production_status)}`
  }
  if (reason.code === 'subscription_not_active') {
    return `Assinatura: ${subscriptionStatusLabel(reason.subscription_status)}`
  }
  return reason.code
}

const ERROR_TEXT: Record<string, string> = {
  courier_delivery_final: 'Esta entrega já foi encerrada por outra pessoa. A lista foi atualizada.',
  courier_delivery_active: 'Esta fatura já tem uma entrega em rota ou entregue.',
  courier_country_not_supported: 'Esta assinatura não entrega no Brasil.',
  shipment_market_exception: 'Conta e país do endereço não combinam: esta assinatura não sai por nenhum mercado. Veja Exceções de mercado.',
  invoice_not_paid: 'A fatura ainda não foi paga.',
  invoice_not_delivery: 'Esta fatura não é uma entrega cobrada (ciclo pulado).',
  invoice_not_in_subscription: 'A fatura não pertence a esta assinatura.',
}

const FIELD_TEXT: Record<string, string> = {
  tracking_url: 'O link de acompanhamento precisa começar com https:// e ter até 500 caracteres.',
  cost: 'O custo precisa ser zero ou mais, com até duas casas decimais.',
  method: 'Escolha o meio de entrega.',
  courier_name: 'O nome do entregador tem até 120 caracteres.',
  note: 'A observação tem até 500 caracteres.',
  reason: 'Informe o motivo da falha.',
  failure_kind: 'Escolha o tipo da falha.',
  delivered_at: 'A data de entrega não pode ser no futuro nem antes da saída.',
}

export function courierErrorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const field = typeof error.details?.field === 'string' ? error.details.field : ''
    if (field && FIELD_TEXT[field]) return FIELD_TEXT[field]
    if (error.code === 'courier_address_incomplete') {
      const listed = error.details?.issues
      const issues = Array.isArray(listed) ? listed.map(String) : []
      const missing = issues.length ? `: ${issues.map(issueCodeText).join(', ').toLowerCase()}` : ''
      return `O endereço não serve para a entrega${missing}. Nada foi despachado. O cliente corrige em Meu plano, na loja.`
    }
    if (ERROR_TEXT[error.code]) return ERROR_TEXT[error.code]
  }
  return error instanceof Error ? error.message : 'Falha ao salvar a entrega'
}

// Entregas Brasil keeps its tab in the URL (`aba`), so a link opens the right tab.
export type CourierTab = 'a_despachar' | 'em_rota' | 'falhas' | 'entregues'

export function courierHref(aba?: CourierTab) {
  return aba && aba !== 'a_despachar' ? `/operations/courier?aba=${aba}` : '/operations/courier'
}
