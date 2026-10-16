import { formatDate } from './format'

// Eden Bowls invoice (EB-YYYY-NNNNNN) as returned by GET /admin/billing/subscriptions/:id/customer-invoices.
export type CustomerInvoice = {
  id: number
  invoice_number: string
  stripe_invoice_id: string
  stripe_account: string
  locale: string
  currency: string
  total_minor: number
  amount_paid_minor: number
  invoice_status: string
  billing_reason: string | null
  issued_at: string | null
  pdf_available: boolean
  pdf_generated_at: string | null
  email_to: string | null
  email_status: 'pending' | 'sent' | 'failed' | 'skipped' | string
  email_sent_at: string | null
  email_attempts: number
  email_last_error: string | null
  email_next_attempt_at: string | null
}

export type InvoiceDelivery = {
  label: string
  tone: 'success' | 'warning' | 'error' | 'info'
  detail: string
}

// How the send to the customer reads in the panel: when, to whom, or why it has not happened yet.
export function describeInvoiceDelivery(item: CustomerInvoice): InvoiceDelivery {
  const to = item.email_to || 'e-mail não informado'
  if (item.email_status === 'sent') {
    return { label: 'Enviada', tone: 'success', detail: `${formatDate(item.email_sent_at)} para ${to}` }
  }
  if (item.email_status === 'failed') {
    const retry = item.email_next_attempt_at
      ? `nova tentativa ${formatDate(item.email_next_attempt_at)}`
      : 'sem novas tentativas automáticas'
    const reason = item.email_last_error ? `${item.email_last_error} · ` : ''
    return { label: 'Falhou', tone: 'error', detail: `${reason}${item.email_attempts} tentativa(s), ${retry}` }
  }
  if (item.email_status === 'skipped') {
    return { label: 'Não enviada', tone: 'warning', detail: item.email_last_error || 'SMTP não configurado' }
  }
  return { label: 'Aguardando envio', tone: 'info', detail: `para ${to}` }
}

export function formatInvoiceStatus(value: string | null | undefined) {
  if (value === 'paid') return 'Paga'
  if (value === 'open') return 'Em aberto'
  return value || '-'
}

export function formatMinorAmount(amountMinor: number | null | undefined, currency: string | null | undefined) {
  if (amountMinor === null || amountMinor === undefined) return '-'
  const code = String(currency || 'usd').toUpperCase()
  return new Intl.NumberFormat(code === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency: code }).format(amountMinor / 100)
}
