import { describe, expect, it } from 'vitest'
import { chargeHistoryEvents, describeChargeEvent, emptySettings, mergeSettings } from './shippingSettings'

describe('mergeSettings', () => {
  it('reads the US ship-from phone, empty when the API has none', () => {
    expect(mergeSettings({ us: { ship_from: { phone: '305 555 0100' } } } as never).us.ship_from.phone).toBe('305 555 0100')
    expect(mergeSettings(undefined).us.ship_from.phone).toBe('')
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
