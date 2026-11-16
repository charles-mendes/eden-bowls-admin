// Days and times in the Brazilian format (dd/mm/aaaa, hh:mm 24 h), converted to and from the ISO the API speaks.

export function maskDigits(raw: string, sizes: number[], separator: string) {
  const digits = raw.replace(/\D/g, '').slice(0, sizes.reduce((sum, size) => sum + size, 0))
  const parts: string[] = []
  let start = 0
  for (const size of sizes) {
    if (start >= digits.length) break
    parts.push(digits.slice(start, start + size))
    start += size
  }
  return parts.join(separator)
}

// "2026-11-08" -> "08/11/2026"; anything else -> ''.
export function isoToBrDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

// "08/11/2026" -> "2026-11-08"; an incomplete or impossible day -> ''.
export function brDateToIso(text: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return ''
  const iso = `${match[3]}-${match[2]}-${match[1]}`
  const date = new Date(`${iso}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : ''
}

// "15:40" when it is a real time of day, else ''.
export function validTime(text: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  return match && Number(match[1]) < 24 && Number(match[2]) < 60 ? text : ''
}

export const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
export const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

// "8 de novembro de 2026", what a screen reader says for a day of the calendar.
export function longBrDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} de ${MONTH_NAMES[month - 1]} de ${year}`
}

// The weeks of a month (month 1-12), Sunday first as in Brazilian calendars; null fills the days outside it.
export function monthWeeks(year: number, month: number): Array<Array<string | null>> {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: Array<string | null> = Array.from({ length: first }, () => null)
  for (let day = 1; day <= days; day += 1) cells.push(`${year}-${pad(month)}-${pad(day)}`)
  while (cells.length % 7) cells.push(null)
  const weeks: Array<Array<string | null>> = []
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7))
  return weeks
}

// The ISO day `days` after (or before) `iso`.
export function shiftDay(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Today in the operator's own clock, as ISO.
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
