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

// purchase-error-monitor: the same field in the US format (mm/dd/yyyy, English month names), for US market pages.
// Both calendars start on Sunday.
export type DateFormat = 'br' | 'us'

export const US_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const US_WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const US_WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// "2026-11-08" -> "08/11/2026" (br) or "11/08/2026" (us).
export function isoToDateText(iso: string, format: DateFormat) {
  if (format === 'br') return isoToBrDate(iso)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return match ? `${match[2]}/${match[3]}/${match[1]}` : ''
}

// The typed text back to ISO; an incomplete or impossible day -> ''.
export function dateTextToIso(text: string, format: DateFormat) {
  if (format === 'br') return brDateToIso(text)
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  return match ? brDateToIso(`${match[2]}/${match[1]}/${match[3]}`) : ''
}

export function longDate(iso: string, format: DateFormat) {
  if (format === 'br') return longBrDate(iso)
  const [year, month, day] = iso.split('-').map(Number)
  return `${US_MONTH_NAMES[month - 1]} ${day}, ${year}`
}

// UPS pickup (US): "14:00" <-> "02:00" + PM. The API keeps the 24-hour "HH:MM".
export function to12Hour(time: string): { text: string; period: 'AM' | 'PM' } {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) return { text: '', period: 'AM' }
  const hours = Number(match[1])
  return { text: `${String(hours % 12 || 12).padStart(2, '0')}:${match[2]}`, period: hours < 12 ? 'AM' : 'PM' }
}

// "02:00" + PM -> "14:00"; 12:00 AM is midnight, 12:00 PM noon; an incomplete or impossible time -> ''.
export function from12Hour(text: string, period: 'AM' | 'PM') {
  const match = /^(\d{2}):(\d{2})$/.exec(text)
  if (!match) return ''
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 1 || hours > 12 || minutes > 59) return ''
  return `${String((hours % 12) + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}`
}

// "14:00" -> "2:00 PM", for text that shows a US time.
export function usTime(time: string) {
  const { text, period } = to12Hour(time)
  return text ? `${text.replace(/^0/, '')} ${period}` : time
}
