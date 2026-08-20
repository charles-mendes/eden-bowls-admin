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

export function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
