import { describe, expect, it } from 'vitest'
import { chargeHistoryEvents, describeChargeEvent, emptySettings, formatPhone, mergeSettings, usPhoneInvalid } from './shippingSettings'

describe('mergeSettings', () => {
  it('reads the US ship-from phone, empty when the API has none', () => {
    expect(mergeSettings({ us: { ship_from: { phone: '305 555 0100' } } } as never).us.ship_from.phone).toBe('305 555 0100')
    expect(mergeSettings(undefined).us.ship_from.phone).toBe('')
  })
})

describe('formatPhone', () => {
  it('writes a US phone as (area) xxx-xxxx and drops the country code 1', () => {
    expect(formatPhone('US', '1(561)674-6117')).toBe('(561) 674-6117')
    expect(formatPhone('US', '+1 561 674 6117')).toBe('(561) 674-6117')
    expect(formatPhone('US', '5616746117999')).toBe('(561) 674-6117')
    expect(formatPhone('US', '56')).toBe('(56')
    expect(formatPhone('US', '561674')).toBe('(561) 674')
    expect(formatPhone('US', '')).toBe('')
  })

  it('writes a BR phone with the DDD, landline or mobile, and drops the country code 55', () => {
    expect(formatPhone('BR', '4133334444')).toBe('(41) 3333-4444')
    expect(formatPhone('BR', '41998905819')).toBe('(41) 99890-5819')
    expect(formatPhone('BR', '+55 41 99890-5819')).toBe('(41) 99890-5819')
    expect(formatPhone('BR', '413')).toBe('(41) 3')
  })

  it('asks the US phone for exactly 10 digits, a leading 1 apart', () => {
    expect(usPhoneInvalid('')).toBe(false)
    expect(usPhoneInvalid('1(561)674-6117')).toBe(false)
    expect(usPhoneInvalid('(561) 674-611')).toBe(true)
  })
})

describe('US dry ice test environment switch', () => {
  it('reads off when the API has none, and on only for true', () => {
    expect(emptySettings().us.skip_dry_ice_in_test).toBe(false)
    expect(mergeSettings(undefined).us.skip_dry_ice_in_test).toBe(false)
    expect(mergeSettings({ us: { skip_dry_ice_in_test: true } } as never).us.skip_dry_ice_in_test).toBe(true)
    expect(mergeSettings({ us: { skip_dry_ice_in_test: 1 } } as never).us.skip_dry_ice_in_test).toBe(false)
  })
})

describe('US shipping charge switch', () => {
  it('reads the switch off and an empty history when the API has neither', () => {
    expect(emptySettings().us.charge_shipping).toBe(false)
    expect(mergeSettings(undefined).us).toMatchObject({ charge_shipping: false, charge_shipping_history: [] })
  })

  it('reads the switch and its history from the API', () => {
    const history = [{ enabled: true, actor_email: 'ana@edenbowls.com', changed_at: '2026-11-18T15:00:00.000Z' }]
    expect(mergeSettings({ us: { charge_shipping: true, charge_shipping_history: history } } as never).us)
      .toMatchObject({ charge_shipping: true, charge_shipping_history: history })
  })

  it('turns the history into edit log events with their labels', () => {
    const events = chargeHistoryEvents([
      { enabled: false, actor_email: 'rui@edenbowls.com', changed_at: '2026-11-19T14:30:00.000Z' },
      { enabled: true, actor_email: 'ana@edenbowls.com', changed_at: '2026-11-18T15:00:00.000Z' },
    ])
    expect(events.map((event) => [describeChargeEvent(event).title, event.actorEmail, event.createdAt])).toEqual([
      ['Cobrança desligada', 'rui@edenbowls.com', '2026-11-19T14:30:00.000Z'],
      ['Cobrança ligada', 'ana@edenbowls.com', '2026-11-18T15:00:00.000Z'],
    ])
  })
})
