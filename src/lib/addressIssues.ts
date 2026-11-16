// Address problems of a subscription (delivery-address-issues): what stops a box or a note, and whether the
// customer was told. The API opens and closes them; the panel only reads.
export type AddressIssueSource = 'payment_check' | 'courier_check' | 'ups_check' | 'courier_failed' | 'nfe_check'

export type AddressIssue = {
  id: number
  codes: string[]
  source: AddressIssueSource | string
  open: boolean
  opened_at: string | null
  email_sent_at: string | null
  resolved_at: string | null
  resolved_by: 'customer' | 'operator' | 'ended' | 'superseded' | string | null
}

const CODE_TEXT: Record<string, string> = {
  address_street_missing: 'Falta a rua',
  address_number_missing: 'Falta o número',
  address_neighborhood_missing: 'Falta o bairro',
  address_city_missing: 'Falta a cidade',
  address_state_missing: 'Falta o estado',
  address_zipcode_invalid: 'CEP inválido (precisa de 8 dígitos)',
  recipient_name_missing: 'Falta o nome de quem recebe',
  address_incomplete: 'Endereço incompleto (rua, cidade, estado ou ZIP)',
  po_box_not_allowed: 'Endereço é PO Box',
  military_address_not_supported: 'Endereço militar (APO, FPO ou DPO)',
  courier_address_unusable: 'O entregador não conseguiu usar o endereço',
  tax_document_missing: 'Falta o CPF',
  fiscal_name_missing: 'Falta o nome fiscal',
}

const SOURCE_TEXT: Record<string, string> = {
  payment_check: 'Pagamento do ciclo',
  courier_check: 'Despacho recusado',
  ups_check: 'Etiqueta recusada',
  courier_failed: 'Falha da entrega',
  nfe_check: 'NF-e travada',
}

export function issueCodeText(code: string): string {
  return CODE_TEXT[code] ?? code
}

export function issueSourceText(source: string): string {
  return SOURCE_TEXT[source] ?? source
}

const DAY_MS = 24 * 60 * 60 * 1000
// A problem open longer than this reads as waiting on the customer.
const WAITING_AFTER_DAYS = 2

function dayMonth(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }).format(date)
}

export type AddressIssueState = {
  // Open: "E-mail enviado em dd/mm" or "E-mail não enviado". Resolved, per `resolved_by`: "Cliente corrigiu em
  // dd/mm", "Operador corrigiu em dd/mm", "Assinatura encerrada em dd/mm" or "Substituído em dd/mm".
  email: string
  // "Sem correção há N dias" while open for more than 2 days, otherwise null.
  waiting: string | null
  tone: 'warning' | 'error' | 'success' | 'muted'
}

export function addressIssueState(issue: AddressIssue, now: Date = new Date()): AddressIssueState {
  if (!issue.open) {
    if (issue.resolved_by === 'customer') {
      return { email: `Cliente corrigiu em ${dayMonth(issue.resolved_at)}`, waiting: null, tone: 'success' }
    }
    if (issue.resolved_by === 'operator') {
      return { email: `Operador corrigiu em ${dayMonth(issue.resolved_at)}`, waiting: null, tone: 'success' }
    }
    // close-address-issues-when-subscription-ends: the subscription ended with no box left to ship.
    if (issue.resolved_by === 'ended') {
      return { email: `Assinatura encerrada em ${dayMonth(issue.resolved_at)}`, waiting: null, tone: 'muted' }
    }
    return { email: `Substituído em ${dayMonth(issue.resolved_at)}`, waiting: null, tone: 'muted' }
  }
  const opened = issue.opened_at ? new Date(issue.opened_at).getTime() : NaN
  const days = Number.isFinite(opened) ? Math.floor((now.getTime() - opened) / DAY_MS) : 0
  const waiting = days > WAITING_AFTER_DAYS ? `Sem correção há ${days} dias` : null
  if (!issue.email_sent_at) return { email: 'E-mail não enviado', waiting, tone: 'error' }
  return { email: `E-mail enviado em ${dayMonth(issue.email_sent_at)}`, waiting, tone: 'warning' }
}
