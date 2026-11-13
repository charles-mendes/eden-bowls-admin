import { describe, expect, it } from 'vitest'
import { mergeSettings } from './shippingSettings'

describe('mergeSettings', () => {
  it('reads the US ship-from phone, empty when the API has none', () => {
    expect(mergeSettings({ us: { ship_from: { phone: '305 555 0100' } } } as never).us.ship_from.phone).toBe('305 555 0100')
    expect(mergeSettings(undefined).us.ship_from.phone).toBe('')
  })
})
