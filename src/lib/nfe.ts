import { type AddressIssue } from './addressIssues'
import { formatDate } from './format'

export type NfeStatus = 'pending' | 'blocked_missing_document' | 'submitted' | 'authorized' | 'rejected' | 'canceled' | 'error'

export type NfeEmailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

export const NFE_EMAIL_LABELS: Record<NfeEmailStatus, string> = {
  pending: 'Na fila',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
  skipped: 'Não enviado',
}

// NF-e issued through Bling. Not the Eden Bowls invoice (EB-YYYY-NNNNNN) in customerInvoices.ts.
export type NfeSummary = {
  id: number
  status: NfeStatus
  customer_name: string | null
  customer_email: string | null
  can_resend_email?: boolean
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
  bling_situacao: number | null
  bling_situacao_label: string | null
  imported: boolean
  can_retry: boolean
  can_edit: boolean
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
  customer_address: Record<string, string> | null
  request_payload: unknown
  response_payload: unknown
  danfe_url: string | null
  pdf_url: string | null
  xml_url: string | null
  email_status: NfeEmailStatus | null
  email_to: string | null
  email_sent_at: string | null
  email_attempts: number
  email_last_error: string | null
  email_next_attempt_at: string | null
  next_attempt_at: string | null
  submitted_at: string | null
  updated_at: string | null
  // What keeps a blocked note from leaving (nfe-admin): `tax_document`, `fiscal_name`.
  missing_fields?: string[]
  // delivery-address-issues: what the customer was told about the subscription of this note.
  address_issue?: AddressIssue | null
  // The fields Bling named when it last refused the note; empty when it named none or the note moved on.
  bling_problems?: BlingProblem[]
  // The panel's id of the subscription the note bills; null for a note created in Bling or an unknown subscription.
  subscription_id?: number | null
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  tax_document: 'CPF',
  fiscal_name: 'Nome fiscal',
}

export type BlingProblem = { element: string; message: string }
export type BlingProblemGuide = { where: string; how: string }

// Where each kind of field is fixed. Bling names the field in `element` (contato.telefone, itens[0].ncm, ...); the
// message alone is often the same generic sentence. First match wins, so the narrow rules come first.
const BLING_PROBLEM_GUIDES: Array<{ test: RegExp; guide: BlingProblemGuide }> = [
  {
    test: /natureza|cfop/,
    guide: {
      where: 'Natureza de operação no Bling',
      how: 'No Bling, abra a natureza de operação usada pela integração e confira as regras de CFOP e de tributos para o estado do cliente. Depois, use Nova tentativa.',
    },
  },
  {
    test: /transport|volume|frete/,
    guide: {
      where: 'Transporte da nota',
      how: 'Esses dados saem da integração da loja, não de um cadastro. Passe esta mensagem para o time técnico.',
    },
  },
  {
    test: /parcela|pagamento/,
    guide: {
      where: 'Pagamento da nota',
      how: 'Esses dados saem da integração da loja, não de um cadastro. Passe esta mensagem para o time técnico.',
    },
  },
  {
    test: /contato|destinat|cpf|cnpj|documento|endere|cep|munic|bairro|telefone|inscri|\bie\b|\buf\b/,
    guide: {
      where: 'Dados do cliente',
      how: 'Use Corrigir dados nesta tela, ou peça ao cliente para corrigir em Meu plano → Editar assinatura. Depois, use Nova tentativa.',
    },
  },
  {
    test: /iten|item|produto|ncm|origem|tribut|icms|pis|cofins|ipi|cest|gtin|unidade|peso/,
    guide: {
      where: 'Cadastro do produto no Bling',
      how: 'No Bling, abra Cadastros → Produtos, procure o código do item (EDEN-…) e complete o que falta, em geral na aba Tributação. Depois, use Nova tentativa.',
    },
  },
  {
    test: /certificad|emitente|empresa|s[eé]rie|numera/,
    guide: {
      where: 'Cadastro da empresa no Bling',
      how: 'No Bling, confira os dados da empresa, a série e a numeração da NF-e e o certificado digital. Depois, use Nova tentativa.',
    },
  },
]

const UNKNOWN_PROBLEM_GUIDE: BlingProblemGuide = {
  where: 'Não identificado',
  how: 'Abra a nota no Bling e clique em Enviar: o Bling destaca o campo que falta.',
}

export function blingProblemGuide(problem: BlingProblem): BlingProblemGuide {
  const text = `${problem.element} ${problem.message}`.toLowerCase()
  return BLING_PROBLEM_GUIDES.find((rule) => rule.test.test(text))?.guide ?? UNKNOWN_PROBLEM_GUIDE
}

// The API joins Bling's message, its description and the field messages with " · ". The first part is the headline.
export function splitNfeError(text: string): { title: string; details: string[] } {
  const [title = '', ...details] = text.split(' · ').map((part) => part.trim()).filter(Boolean)
  return { title, details }
}

export function missingFieldLabel(field: string): string {
  return MISSING_FIELD_LABELS[field] ?? field
}

export type NfeListResponse = {
  success: boolean
  data: { items: NfeSummary[]; total: number; page: number; perPage: number; totalPages: number }
}

export type BlingConnection = { configured: boolean; connected: boolean }

export const NFE_STATUS_OPTIONS: { value: NfeStatus; label: string }[] = [
  { value: 'pending', label: 'Pendente' },
  { value: 'blocked_missing_document', label: 'Sem CPF' },
  { value: 'submitted', label: 'Enviada' },
  { value: 'authorized', label: 'Autorizada' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'canceled', label: 'Cancelada' },
  { value: 'error', label: 'Erro' },
]

// "Precisam de ação": the notes an operator can move (blocked, rejected, error). One URL value, three API statuses.
export const NFE_NEEDS_ACTION = 'needs_action'
export const NFE_NEEDS_ACTION_STATUSES: NfeStatus[] = ['blocked_missing_document', 'rejected', 'error']

export const NFE_LIST_PATH = '/operations/nfe'

export type NfeListFilters = { status?: string; de?: string; ate?: string; busca?: string; pagina?: number }

export function isNfeListStatus(value: string | null) {
  return value === NFE_NEEDS_ACTION || NFE_STATUS_OPTIONS.some((option) => option.value === value)
}

// What the API receives for the status the URL holds.
export function nfeApiStatus(status: string) {
  return status === NFE_NEEDS_ACTION ? NFE_NEEDS_ACTION_STATUSES.join(',') : status
}

export function nfeListHref(filters: NfeListFilters = {}) {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.de) params.set('de', filters.de)
  if (filters.ate) params.set('ate', filters.ate)
  if (filters.busca) params.set('busca', filters.busca)
  if (filters.pagina && filters.pagina > 1) params.set('pagina', String(filters.pagina))
  const query = params.toString()
  return query ? `${NFE_LIST_PATH}?${query}` : NFE_LIST_PATH
}

const STATUS_TONE: Record<NfeStatus, string> = {
  pending: 'badge-info',
  blocked_missing_document: 'badge-warning',
  submitted: 'badge-info',
  authorized: 'badge-success',
  rejected: 'badge-error',
  canceled: 'badge-neutral',
  error: 'badge-error',
}

export function nfeStatusLabel(status: NfeStatus) {
  return NFE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status
}

export function nfeStatusTone(status: NfeStatus) {
  return STATUS_TONE[status] ?? 'badge-info'
}

// GET /nfe `situacao` in the API: 5 Autorizada, 6 Emitida DANFE, 2 Cancelada, 4 Rejeitada, 9 Denegada, 11 Bloqueada.
export function blingSituacaoTone(situacao: number | null) {
  if (situacao === 5 || situacao === 6) return 'badge-success'
  if (situacao === 4 || situacao === 9 || situacao === 11) return 'badge-error'
  if (situacao === 2) return 'badge-neutral'
  return 'badge-info'
}

// Bling does not document this address. It was checked by hand against a real note in November 2026.
export function blingNfeUrl(id: number) {
  return `https://www.bling.com.br/notas.fiscais.php#edit/${id}`
}

export function formatNfeNumber(item: Pick<NfeSummary, 'nfe_number' | 'nfe_series'>) {
  if (!item.nfe_number) return '—'
  return item.nfe_series ? `${item.nfe_number} / ${item.nfe_series}` : item.nfe_number
}

export function formatNfeAmount(item: Pick<NfeSummary, 'total_minor' | 'currency'>) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency.toUpperCase() }).format(item.total_minor / 100)
}

export const BR_STATES = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

// Table of the NF-e tag `orig`.
export const GOODS_ORIGINS = [
  { value: '0', label: '0: Nacional' },
  { value: '1', label: '1: Estrangeira, importação direta' },
  { value: '2', label: '2: Estrangeira, adquirida no mercado interno' },
  { value: '3', label: '3: Nacional, importação acima de 40%' },
  { value: '4', label: '4: Nacional, processos produtivos básicos' },
  { value: '5', label: '5: Nacional, importação até 40%' },
  { value: '6', label: '6: Estrangeira, importação direta sem similar' },
  { value: '7', label: '7: Estrangeira, mercado interno sem similar' },
  { value: '8', label: '8: Nacional, importação acima de 70%' },
]

export function maskCpf(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2')
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
