export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '-'

  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '-'

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
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