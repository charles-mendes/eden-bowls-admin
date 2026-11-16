import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiRequestError } from './api'
import {
  createClosedDay,
  describeWeek,
  getOperatingWeek,
  previewOperatingWeek,
  saveOperatingWeek,
  getCalendarAlerts,
  listCalendarHistory,
  listCalendarSyncs,
  listClosedDays,
  previewClosedDayChange,
  previewNewClosedDay,
  removeClosedDay,
  resendCalendarSync,
  updateClosedDay,
  type CalendarSync,
} from './deliveryCalendar'

type Recorded = { url: string; method: string; body: unknown; authorization: string | null }

function stubFetch(response: { status?: number; body?: unknown } = {}) {
  const calls: Recorded[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : null,
      authorization: new Headers(init?.headers).get('Authorization'),
    })
    return new Response(JSON.stringify(response.body ?? {}), { status: response.status ?? 200, headers: { 'Content-Type': 'application/json' } })
  }))
  return calls
}

const row = { type: 'adhoc' as const, closedOn: '2027-12-21', label: 'Manutenção', closesPreparation: true, closesPickup: true, closesDelivery: true }
const sync = (overrides: Partial<CalendarSync> = {}): CalendarSync => ({
  id: 3, stripeSubscriptionId: 'sub_1', market: 'US', auditEventId: 1, expectedTrialEnd: null,
  targetTrialEnd: '2027-12-22T05:00:00.000Z', foundTrialEnd: null, status: 'failed', attempts: 8, lastError: null,
  createdAt: '2027-12-10T14:00:00.000Z', ...overrides,
})

describe('delivery calendar client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads the calendar, history, syncs, and alerts of one market', async () => {
    const calls = stubFetch()
    await listClosedDays('t', 'US', 2027)
    await listCalendarHistory('t', 'BR', 2027)
    await listCalendarSyncs('t', 'US')
    await getCalendarAlerts('t', 'US')
    expect(calls.map((call) => [call.method, call.url])).toEqual([
      ['GET', '/api/v1/admin/delivery-calendar?market=US&year=2027'],
      ['GET', '/api/v1/admin/delivery-calendar/history?market=BR&year=2027'],
      ['GET', '/api/v1/admin/delivery-calendar/syncs?market=US'],
      ['GET', '/api/v1/admin/delivery-calendar/alerts?market=US'],
    ])
    expect(calls[0].authorization).toBe('Bearer t')
  })

  it('sends previews and writes with the market in the body', async () => {
    const calls = stubFetch()
    await previewNewClosedDay('t', 'US', row)
    await previewClosedDayChange('t', 'US', 4, { active: true })
    await createClosedDay('t', 'US', row)
    await updateClosedDay('t', 'US', 4, { closesPickup: false })
    await removeClosedDay('t', 'US', 4)
    expect(calls.map((call) => [call.method, call.url, call.body])).toEqual([
      ['POST', '/api/v1/admin/delivery-calendar/preview', { market: 'US', ...row }],
      ['POST', '/api/v1/admin/delivery-calendar/preview', { market: 'US', id: 4, active: true }],
      ['POST', '/api/v1/admin/delivery-calendar', { market: 'US', ...row }],
      ['PATCH', '/api/v1/admin/delivery-calendar/4', { market: 'US', closesPickup: false }],
      ['DELETE', '/api/v1/admin/delivery-calendar/4?market=US', null],
    ])
  })

  it('a conflict resend carries the found value the operator saw', async () => {
    const calls = stubFetch()
    await resendCalendarSync('t', 'US', sync())
    await resendCalendarSync('t', 'US', sync({ status: 'conflict', foundTrialEnd: '2028-01-24T05:00:00.000Z' }))
    expect(calls.map((call) => call.body)).toEqual([
      { market: 'US' },
      { market: 'US', foundTrialEnd: '2028-01-24T05:00:00.000Z' },
    ])
  })

  it('keeps the error details, such as the locked subscriptions', async () => {
    stubFetch({ status: 409, body: { message: 'Há entregas travadas.', details: { code: 'delivery_locked', subscriptions: [{ stripeSubscriptionId: 'sub_1' }] } } })
    const error = await createClosedDay('t', 'US', row).catch((caught) => caught)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ status: 409, code: 'delivery_locked', details: { subscriptions: [{ stripeSubscriptionId: 'sub_1' }] } })
  })
})

describe('standard week client', () => {
  afterEach(() => vi.unstubAllGlobals())
  const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: weekday <= 5, opensAt: '09:00', closesAt: '20:00' }))

  it('reads, previews and saves the week of one market', async () => {
    const calls = stubFetch({ body: { success: true, data: {} } })
    await getOperatingWeek('tok', 'BR')
    await previewOperatingWeek('tok', 'BR', days)
    await saveOperatingWeek('tok', 'BR', days, [{ stripeSubscriptionId: 'sub_1', deliveryId: 'current', newPreparationDay: '2026-11-23' }])

    expect(calls[0]).toMatchObject({ method: 'GET', authorization: 'Bearer tok' })
    expect(calls[0].url).toMatch(/\/admin\/delivery-calendar\/week\?market=BR$/)
    expect(calls[1]).toMatchObject({ method: 'POST', body: { market: 'BR', days } })
    expect(calls[1].url).toMatch(/\/admin\/delivery-calendar\/week\/preview$/)
    expect(calls[2]).toMatchObject({
      method: 'PUT',
      body: { market: 'BR', days, confirmedMoves: [{ stripeSubscriptionId: 'sub_1', deliveryId: 'current', newPreparationDay: '2026-11-23' }] },
    })
  })

  it('a changed impact comes back as week_impact_changed', async () => {
    stubFetch({ status: 409, body: { message: 'mudou', details: { code: 'week_impact_changed' } } })
    await expect(saveOperatingWeek('tok', 'BR', days, [])).rejects.toMatchObject({ status: 409, code: 'week_impact_changed' })
  })
})

describe('describeWeek', () => {
  const day = (weekday: number, open: boolean, opensAt = '09:00', closesAt = '20:00') => ({ weekday, open, opensAt, closesAt })

  it('joins runs of open days with the same hours', () => {
    expect(describeWeek([1, 2, 3, 4, 5, 6, 7].map((weekday) => day(weekday, weekday <= 5)))).toBe('seg–sex 09:00–20:00')
    expect(describeWeek([day(1, true), day(2, true), day(3, false), day(4, true), day(5, true), day(6, true, '09:00', '13:00'), day(7, false)]))
      .toBe('seg–ter, qui–sex 09:00–20:00 · sáb 09:00–13:00')
  })

  it('says when no day is open', () => {
    expect(describeWeek([day(1, false)])).toBe('Nenhum dia aberto')
    expect(describeWeek(null)).toBe('—')
  })
})
