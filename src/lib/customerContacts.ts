import { ApiRequestError } from './api'

// Contacts an operator made with a customer by WhatsApp (customer-contacts).
export type ContactReason = 'payment_failed' | 'late' | 'delivery_failed' | 'address'
export type ContactOutcome = 'no_answer' | 'customer_will_fix' | 'resolved'

export type CustomerContact = {
  id: number
  subscription_id: string
  channel: 'whatsapp'
  reason: ContactReason
  outcome: ContactOutcome
  note: string | null
  actor_email: string | null
  created_at: string
}

export const CONTACT_REASONS: Array<{ value: ContactReason; label: string }> = [
  { value: 'payment_failed', label: 'Pagamento recusado' },
  { value: 'late', label: 'Atraso' },
  { value: 'delivery_failed', label: 'Falha de entrega' },
  { value: 'address', label: 'Endereço' },
]

export const CONTACT_OUTCOMES: Array<{ value: ContactOutcome; label: string }> = [
  { value: 'no_answer', label: 'Sem resposta' },
  { value: 'customer_will_fix', label: 'Cliente vai resolver' },
  { value: 'resolved', label: 'Resolvido' },
]

export const CONTACT_NOTE_MAX = 500

export function contactsPath(subscriptionId: string | number) {
  return `/admin/billing/subscriptions/${encodeURIComponent(String(subscriptionId))}/contacts`
}

export function reasonLabel(reason: string): string {
  return CONTACT_REASONS.find((item) => item.value === reason)?.label ?? reason
}

export function outcomeLabel(outcome: string): string {
  return CONTACT_OUTCOMES.find((item) => item.value === outcome)?.label ?? outcome
}

function dayWord(date: Date, now: Date): string {
  const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const diff = Math.round((day(now) - day(date)) / 86400000)
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'ontem'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// "Contatado ontem, 14:05, sem resposta, por ana@…"
export function lastContactText(contact: CustomerContact, now: Date = new Date()): string {
  const at = new Date(contact.created_at)
  const time = at.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const who = contact.actor_email ? `, por ${contact.actor_email}` : ''
  return `Contatado ${dayWord(at, now)}, ${time}, ${outcomeLabel(contact.outcome).toLowerCase()}${who}`
}

const FIELD_TEXT: Record<string, string> = {
  reason: 'Escolha o motivo do contato.',
  outcome: 'Escolha o resultado do contato.',
  note: `A nota tem até ${CONTACT_NOTE_MAX} caracteres.`,
}

export function contactErrorText(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const field = typeof error.details?.field === 'string' ? error.details.field : ''
    if (field && FIELD_TEXT[field]) return FIELD_TEXT[field]
  }
  return error instanceof Error ? error.message : 'Falha ao registrar o contato'
}
