import { ApiRequestError } from './api'
import { PRODUCTION_STATUS_LABELS, isProductionStatus } from './productionQueue'

// Brazil courier deliveries (courier-delivery): recorded by hand, no courier API.
export type CourierMethod = 'uber' | 'motoboy' | 'own_driver' | 'other'
export type CourierStatus = 'out_for_delivery' | 'delivered' | 'failed' | 'canceled'

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
  delivery_date: string | null
  production_status: string | null
  subscription_status: string | null
  delivery: CourierDelivery | null
}

export type CourierQueue = {
  to_dispatch: CourierQueueItem[]
  out_for_delivery: CourierQueueItem[]
  failed: CourierQueueItem[]
  delivered: CourierQueueItem[]
  truncated: boolean
}

export type ReadinessReason = { code: 'production_not_ready' | 'subscription_not_active' | string; production_status?: string | null; subscription_status?: string | null }

export const COURIER_METHODS: Array<{ value: CourierMethod; label: string }> = [
  { value: 'uber', label: 'Uber' },
  { value: 'motoboy', label: 'Motoboy' },
  { value: 'own_driver', label: 'Entregador próprio' },
  { value: 'other', label: 'Outro' },
]

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
  delivered_at: 'A data de entrega não pode ser no futuro nem antes da saída.',
}

export function courierErrorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const field = typeof error.details?.field === 'string' ? error.details.field : ''
    if (field && FIELD_TEXT[field]) return FIELD_TEXT[field]
    if (ERROR_TEXT[error.code]) return ERROR_TEXT[error.code]
  }
  return error instanceof Error ? error.message : 'Falha ao salvar a entrega'
}
