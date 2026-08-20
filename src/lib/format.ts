const STRIPE_STATUS_LABELS: Record<string, string> = {
  mixed: 'Misto',
  unlinked: 'Não vinculado',
  active: 'Ativo',
  trialing: 'Em trial',
  past_due: 'Pagamento atrasado',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
  unpaid: 'Não pago',
  incomplete: 'Incompleto',
  incomplete_expired: 'Expirado',
  paused: 'Pausado',
}

const FREQUENCY_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  month: 'Mensal',
  every_month: 'Mensal',
  weekly: 'Semanal',
  week: 'Semanal',
  every_week: 'Semanal',
  biweekly: 'Quinzenal',
  bi_weekly: 'Quinzenal',
  fortnightly: 'Quinzenal',
  every_4_weeks: 'A cada 4 semanas',
}

const FLAVOR_LABELS: Record<string, string> = {
  beef: 'Bovino',
  turkey: 'Peru',
  pork: 'Porco',
  fish: 'Peixe',
}

const DISCOUNT_REASON_LABELS: Record<string, string> = {
  HAS_PREVIOUS_PURCHASE: 'Cliente já possui compra anterior',
  HAS_ACTIVE_SUBSCRIPTION: 'Cliente já possui assinatura ativa',
  NOT_AUTHENTICATED: 'Sessão sem autenticação',
  ineligible: 'Não elegível',
}

const PAYMENT_STATE_LABELS: Record<string, string> = {
  paid: 'Pago',
  succeeded: 'Confirmado',
  requires_confirmation: 'Aguardando confirmação',
  requires_payment_method: 'Aguardando método de pagamento',
  pending_sync: 'Sincronização pendente',
  sync_error: 'Erro de sincronização',
  processing: 'Processando',
  failed: 'Falhou',
  canceled: 'Cancelado',
  cancelled: 'Cancelado',
  incomplete: 'Incompleto',
}

const CHECKOUT_MODE_LABELS: Record<string, string> = {
  subscription_first: 'Assinatura na 1ª cobrança',
}

const DISCOUNT_DURATION_LABELS: Record<string, string> = {
  once: 'Somente 1ª fatura',
  repeating: 'Recorrente',
  forever: 'Permanente',
}

const COUNTRY_LABELS: Record<string, string> = {
  BR: 'Brasil',
  US: 'Estados Unidos',
}

const DISTANCE_SOURCE_LABELS: Record<string, string> = {
  osrm: 'OSRM',
  haversine: 'Haversine',
}

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function formatDate(
  value: string | Date | null | undefined,
  timeZone: string = getBrowserTimeZone(),
) {
  if (!value) return '-'

  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date)
}

export function formatStripeStatus(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return STRIPE_STATUS_LABELS[raw.toLowerCase()] ?? raw
}

export function formatFrequency(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_')
  if (FREQUENCY_LABELS[normalized]) {
    return FREQUENCY_LABELS[normalized]
  }

  const everyNMonths = /^(?:every_)?(\d+)_months?$/.exec(normalized)
  if (everyNMonths) {
    const count = everyNMonths[1]
    return count === '1' ? 'Mensal' : `A cada ${count} meses`
  }

  return raw
}

export function formatCurrency(value: number | string | null | undefined, currency = 'BRL') {
  if (value === null || value === undefined || value === '') return '-'

  const numberValue = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numberValue)) return '-'

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(numberValue)
}

export function formatNumber(value: number | string | null | undefined, options?: Intl.NumberFormatOptions) {
  if (value === null || value === undefined || value === '') return '-'

  const numberValue = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numberValue)) return '-'

  return new Intl.NumberFormat('pt-BR', options).format(numberValue)
}

export function formatPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'

  const numberValue = typeof value === 'string' ? Number(value) : value
  if (Number.isNaN(numberValue)) return '-'

  return `${formatNumber(numberValue)}%`
}

export function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return 'Sim'
  if (value === false) return 'Não'
  return '-'
}

export function formatFlavor(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return FLAVOR_LABELS[raw.toLowerCase()] ?? raw
}

export function formatDiscountReason(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return 'Não aplicável / inelegível'

  return DISCOUNT_REASON_LABELS[raw] ?? DISCOUNT_REASON_LABELS[raw.toLowerCase()] ?? raw
}

export function formatPaymentState(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return PAYMENT_STATE_LABELS[raw.toLowerCase()] ?? raw
}

export function formatCheckoutMode(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return CHECKOUT_MODE_LABELS[raw.toLowerCase()] ?? raw
}

export function formatDiscountDuration(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return DISCOUNT_DURATION_LABELS[raw.toLowerCase()] ?? raw
}

export function formatCountry(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return COUNTRY_LABELS[raw.toUpperCase()] ?? raw
}

export function formatPostalCode(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  const digits = raw.replace(/\D/g, '')
  if (digits.length === 8) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`
  }

  return raw
}

export function formatTermMonths(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'

  const months = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(months) || months <= 0) return '-'

  return months === 1 ? '1 mês' : `${formatNumber(months)} meses`
}

export function formatDeliveryDays(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return '-'

  const days = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(days) || days < 0) return '-'

  return days === 1 ? '1 dia útil' : `${formatNumber(days)} dias úteis`
}

export function formatDistanceSource(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return '-'

  return DISTANCE_SOURCE_LABELS[raw.toLowerCase()] ?? raw
}

export function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
