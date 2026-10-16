import { apiRequest, buildQueryString } from './api'
import type { MarketCode } from './markets'

export type ClosedDayType = 'national' | 'regional' | 'carrier' | 'adhoc'

export type ClosedDayFlags = {
  closesPreparation: boolean
  closesPickup: boolean
  closesDelivery: boolean
}

export type ClosedDay = ClosedDayFlags & {
  id: number
  market: MarketCode
  closedOn: string
  label: string
  origin: string
  type: ClosedDayType
  active: boolean
}

export type DeliveryMove = 'stripe_sync' | 'pending_change' | 'projection_only'

export type AffectedDelivery = {
  stripeSubscriptionId: string
  ledgerId: number
  userId: number
  deliveryId: string
  preparationDay: string
  deliveryDate: string
  newPreparationDay: string | null
  newDeliveryDate: string | null
  locked: boolean
  lockReason: string | null
  move: DeliveryMove
  expectedTrialEnd?: string
  targetTrialEnd?: string
  pendingTrialEnd?: { previous: string; next: string }
}

export type CalendarPreview = {
  market: MarketCode
  change: Omit<ClosedDay, 'id'> & { id?: number }
  affected: AffectedDelivery[]
  shortNotice: boolean
}

export type NewClosedDay = ClosedDayFlags & {
  type: Exclude<ClosedDayType, 'national'>
  closedOn: string
  label: string
}

export type ClosedDayChange = Partial<ClosedDayFlags> & { active?: boolean }

export type CalendarWriteResult = {
  market: MarketCode
  row: ClosedDay
  affected: AffectedDelivery[]
  syncIds: number[]
  auditEventId: number
}

type AuditValues = ClosedDayFlags & { active: boolean }

export type MovedDelivery = {
  stripeSubscriptionId: string
  deliveryId: string
  previousPreparationDay: string
  newPreparationDay: string | null
  move: DeliveryMove
  pendingTrialEnd?: { previous: string; next: string }
}

export type CalendarHistoryItem = {
  id: number
  actorUserId: number | null
  actorEmail: string | null
  action: string
  createdAt: string
  metadata: {
    market: MarketCode
    closedOn: string | null
    type?: ClosedDayType
    label?: string
    before?: AuditValues | null
    after?: AuditValues | null
    moved?: MovedDelivery[]
    syncId?: number
    stripeSubscriptionId?: string
    previousStatus?: string
    expectedTrialEnd?: string | null
    foundTrialEnd?: string | null
    targetTrialEnd?: string
  }
}

export type SyncStatus = 'pending' | 'synced' | 'failed' | 'conflict' | 'superseded'

export type CalendarSync = {
  id: number
  stripeSubscriptionId: string
  market: MarketCode
  auditEventId: number | null
  expectedTrialEnd: string | null
  targetTrialEnd: string
  foundTrialEnd: string | null
  status: SyncStatus
  attempts: number
  lastError: string | null
  createdAt: string
}

export type CalendarSyncs = {
  market: MarketCode
  delayMinutes: number
  delayed: CalendarSync[]
  problems: CalendarSync[]
}

export type CalendarAlerts = {
  market: MarketCode
  upsCalendar: null | {
    coveredThrough: string | null
    missingYear: number
    daysLeft: number | null
    warn: boolean
  }
}

const BASE = '/admin/delivery-calendar'

export function listClosedDays(token: string, market: MarketCode, year: number) {
  return apiRequest<{ market: MarketCode; year: number; items: ClosedDay[] }>(`${BASE}${buildQueryString({ market, year })}`, { token })
}

export function previewNewClosedDay(token: string, market: MarketCode, row: NewClosedDay) {
  return apiRequest<CalendarPreview>(`${BASE}/preview`, { token, method: 'POST', body: { market, ...row } })
}

export function previewClosedDayChange(token: string, market: MarketCode, id: number, change: ClosedDayChange) {
  return apiRequest<CalendarPreview>(`${BASE}/preview`, { token, method: 'POST', body: { market, id, ...change } })
}

export function createClosedDay(token: string, market: MarketCode, row: NewClosedDay) {
  return apiRequest<CalendarWriteResult>(BASE, { token, method: 'POST', body: { market, ...row } })
}

export function updateClosedDay(token: string, market: MarketCode, id: number, change: ClosedDayChange) {
  return apiRequest<CalendarWriteResult>(`${BASE}/${id}`, { token, method: 'PATCH', body: { market, ...change } })
}

export function removeClosedDay(token: string, market: MarketCode, id: number) {
  return apiRequest<{ market: MarketCode; removed: ClosedDay }>(`${BASE}/${id}${buildQueryString({ market })}`, { token, method: 'DELETE' })
}

export function listCalendarHistory(token: string, market: MarketCode, year: number) {
  return apiRequest<{ market: MarketCode; year: number; items: CalendarHistoryItem[] }>(`${BASE}/history${buildQueryString({ market, year })}`, { token })
}

export function listCalendarSyncs(token: string, market: MarketCode) {
  return apiRequest<CalendarSyncs>(`${BASE}/syncs${buildQueryString({ market })}`, { token })
}

export function resendCalendarSync(token: string, market: MarketCode, sync: CalendarSync) {
  return apiRequest<{ syncId: number; status: SyncStatus }>(`${BASE}/syncs/${sync.id}/resend`, {
    token,
    method: 'POST',
    body: sync.status === 'conflict' ? { market, foundTrialEnd: sync.foundTrialEnd } : { market },
  })
}

export function getCalendarAlerts(token: string, market: MarketCode) {
  return apiRequest<CalendarAlerts>(`${BASE}/alerts${buildQueryString({ market })}`, { token })
}

export const FLAG_LABELS: Record<keyof ClosedDayFlags, string> = {
  closesPreparation: 'Preparo',
  closesPickup: 'Coleta',
  closesDelivery: 'Entrega',
}

export const FLAG_HINTS: Record<keyof ClosedDayFlags, string> = {
  closesPreparation: 'Cozinha não produz',
  closesPickup: 'Transportadora não coleta',
  closesDelivery: 'Não há entrega ao cliente',
}

export const FLAGS = Object.keys(FLAG_LABELS) as Array<keyof ClosedDayFlags>

export const MOVE_LABELS: Record<AffectedDelivery['move'], string> = {
  stripe_sync: 'Cobrança movida no Stripe',
  pending_change: 'Mudança pendente remarcada',
  projection_only: 'Só o dia de preparo muda',
}

export const ACTION_LABELS: Record<string, string> = {
  'delivery_calendar.create': 'Inclusão',
  'delivery_calendar.remove': 'Remoção',
  'delivery_calendar.activate': 'Reativação',
  'delivery_calendar.deactivate': 'Desativação',
  'delivery_calendar.update': 'Mudança de marcação',
  'delivery_calendar.sync_resend': 'Reenvio ao Stripe',
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export function formatDay(value: string | null | undefined) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} (${weekday})`
}

export function closedFlags(values: Partial<ClosedDayFlags> | null | undefined) {
  if (!values) return '—'
  const closed = FLAGS.filter((flag) => values[flag]).map((flag) => FLAG_LABELS[flag])
  return closed.length ? closed.join(', ') : 'nenhuma'
}

export function describeValues(values: (Partial<ClosedDayFlags> & { active?: boolean }) | null | undefined) {
  if (!values) return '—'
  return `${values.active === false ? 'Inativa' : 'Ativa'} · fecha ${closedFlags(values)}`
}
