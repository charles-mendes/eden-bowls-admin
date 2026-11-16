// The delivery range of the shipping queues (courier-deliveries, ups-labels): `de` and `ate` in the URL, sent as
// `from` and `to`. Without them the API reads its default: from 30 days ago to tomorrow. The API validates.

export type DeliveryRange = { from: string; to: string }

// What the queue answers about the range it read.
export type DeliveryRangeInfo = {
  range?: { from: string; to: string; default: boolean }
  later?: number
  next_from?: string | null
}

export type RangePreset = 'default' | 'next7' | 'custom'

export const COURIER_TIMEZONE = 'America/Sao_Paulo'
export const LABELS_TIMEZONE = 'America/New_York'
export const RANGE_INVALID_TEXT = 'Período inválido: até 31 dias, a partir de 30 dias atrás.'
const MAX_SPAN_DAYS = 31
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validIso(value: string | null): value is string {
  if (!value || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00Z`).getTime() - new Date(`${from}T12:00:00Z`).getTime()) / 86_400_000)
}

export function todayIn(timeZone: string, now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone })
}

// The range in the URL, or null for the API's default. Both dates are needed; anything else is the default.
export function readRange(params: URLSearchParams): DeliveryRange | null {
  const from = params.get('de')
  const to = params.get('ate')
  return validIso(from) && validIso(to) ? { from, to } : null
}

// The URL with the range written in (or removed for the default), keeping every other parameter.
export function writeRange(params: URLSearchParams, range: DeliveryRange | null) {
  const next = new URLSearchParams(params)
  if (range) {
    next.set('de', range.from)
    next.set('ate', range.to)
  } else {
    next.delete('de')
    next.delete('ate')
  }
  return next
}

// `?from=…&to=…` for the queue request, or '' for the default.
export function rangeQuery(range: DeliveryRange | null) {
  return range ? `?${new URLSearchParams({ from: range.from, to: range.to }).toString()}` : ''
}

export function nextSevenDays(timeZone: string, now = new Date()): DeliveryRange {
  const today = todayIn(timeZone, now)
  return { from: today, to: addDays(today, 6) }
}

export function presetOf(range: DeliveryRange | null, timeZone: string, now = new Date()): RangePreset {
  if (!range) return 'default'
  const seven = nextSevenDays(timeZone, now)
  return range.from === seven.from && range.to === seven.to ? 'next7' : 'custom'
}

// "Ver a partir de {next_from}": starts at next_from and keeps `to` while the range stays within 31 days.
export function nextFromRange(currentTo: string, nextFrom: string): DeliveryRange {
  const keep = currentTo >= nextFrom && daysBetween(nextFrom, currentTo) <= MAX_SPAN_DAYS
  return { from: nextFrom, to: keep ? currentTo : addDays(nextFrom, 6) }
}

// "Mais N pedidos depois de {to}": the seven days after `to`.
export function laterRange(to: string): DeliveryRange {
  return { from: addDays(to, 1), to: addDays(to, 7) }
}

export function dayMonth(iso: string) {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

export function rangeLabel(range: DeliveryRange | null, timeZone: string, now = new Date()) {
  const preset = presetOf(range, timeZone, now)
  if (preset === 'default' || !range) return 'Até amanhã'
  if (preset === 'next7') return 'Próximos 7 dias'
  return `${dayMonth(range.from)} a ${dayMonth(range.to)}`
}

export function laterText(later: number, to: string) {
  return `Mais ${later} ${later === 1 ? 'pedido' : 'pedidos'} com entrega depois de ${dayMonth(to)}.`
}

// The range back from `from|to` (a stable dependency for a load callback), or null for ''.
export function rangeFromKey(key: string): DeliveryRange | null {
  const [from, to] = key.split('|')
  return from && to ? { from, to } : null
}

// simplify-brazil-dispatch: a `datetime-local` value read in the market's zone, whatever the browser's zone.
function zoneParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]))
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second }
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const p = zoneParts(date, timeZone)
  const wall = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second))
  return wall - Math.floor(date.getTime() / 1000) * 1000
}

// "2026-11-08T15:40" for now in the zone, the value a `datetime-local` input takes.
export function nowInputIn(timeZone: string, now = new Date()) {
  const p = zoneParts(now, timeZone)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

// The instant of a `datetime-local` value read as wall time in the zone, or null for a malformed value.
export function zonedInputToIso(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  let instant = wall - zoneOffsetMs(new Date(wall), timeZone)
  // Across a clock change the offset at the instant decides.
  instant = wall - zoneOffsetMs(new Date(instant), timeZone)
  const date = new Date(instant)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
