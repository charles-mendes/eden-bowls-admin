import { formatDate } from './format'

export type NfeStatus = 'pending' | 'blocked_missing_document' | 'submitted' | 'authorized' | 'rejected' | 'error'

// NF-e issued through Bling. Not the Eden Bowls invoice (EB-YYYY-NNNNNN) in customerInvoices.ts.
export type NfeSummary = {
  id: number
  status: NfeStatus
  customer_name: string | null
  customer_email: string | null
  customer_document: string | null
  total_minor: number
  currency: string
  nfe_number: string | null
  nfe_series: string | null
  access_key: string | null
  last_error: string | null
  attempts: number
  created_at: string | null
  authorized_at: string | null
  can_retry: boolean
}

export type NfeDetail = NfeSummary & {
  user_id: number | null
  stripe_account: string
  stripe_subscription_id: string | null
  stripe_invoice_id: string
  bling_contact_id: number | null
  bling_order_id: number | null
  bling_nfe_id: number | null
  protocol: string | null
  bling_situacao: number | null
  bling_situacao_label: string | null
  customer_address: Record<string, string> | null
  request_payload: unknown
  response_payload: unknown
  danfe_url: string | null
  pdf_url: string | null
  xml_url: string | null
  next_attempt_at: string | null
  submitted_at: string | null
  updated_at: string | null
}

export type NfeListResponse = {
  success: boolean
  data: { items: NfeSummary[]; total: number; page: number; perPage: number; totalPages: number }
}

export type BlingConnection = { configured: boolean; connected: boolean }

export const NFE_STATUS_OPTIONS: { value: NfeStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'blocked_missing_document', label: 'Sem CPF/CNPJ' },
  { value: 'submitted', label: 'Enviada' },
  { value: 'authorized', label: 'Autorizada' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'error', label: 'Erro' },
]

const STATUS_TONE: Record<NfeStatus, string> = {
  pending: 'badge-info',
  blocked_missing_document: 'badge-warning',
  submitted: 'badge-info',
  authorized: 'badge-success',
  rejected: 'badge-error',
  error: 'badge-error',
}

export function nfeStatusLabel(status: NfeStatus) {
  return NFE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

export function nfeStatusTone(status: NfeStatus) {
  return STATUS_TONE[status] ?? 'badge-info'
}

export function formatNfeNumber(item: Pick<NfeSummary, 'nfe_number' | 'nfe_series'>) {
  if (!item.nfe_number) return '—'
  return item.nfe_series ? `${item.nfe_number} / ${item.nfe_series}` : item.nfe_number
}

export function formatNfeAmount(item: Pick<NfeSummary, 'total_minor' | 'currency'>) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency.toUpperCase() }).format(item.total_minor / 100)
}

export function formatTaxDocument(value: string | null) {
  if (!value) return '—'
  if (value.length === 11) return value.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  if (value.length === 14) return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
  return value
}

export function formatNfeDate(value: string | null) {
  return value ? formatDate(value) : '—'
}
