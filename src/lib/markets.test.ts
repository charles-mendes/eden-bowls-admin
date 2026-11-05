import { describe, expect, it } from 'vitest'
import {
  currencyForMarket,
  defaultMarket,
  defaultStripeAccount,
  effectiveSessionMarkets,
  hasBothMarkets,
  isProfileInScope,
  sessionMarkets,
  stripeAccountForMarket,
} from './markets'

describe('markets helpers', () => {
  it('defaults admin with both markets to Brazil', () => {
    const admin = { markets: ['US', 'BR'] }

    expect(sessionMarkets(admin)).toEqual(['BR', 'US'])
    expect(hasBothMarkets(admin)).toBe(true)
    expect(defaultMarket(admin)).toBe('BR')
    expect(defaultStripeAccount(admin)).toBe('br')
    expect(currencyForMarket('BR')).toBe('BRL')
  })

  it('maps a US-only operator to US / us / USD', () => {
    const operator = { markets: ['US'] }

    expect(sessionMarkets(operator)).toEqual(['US'])
    expect(hasBothMarkets(operator)).toBe(false)
    expect(defaultMarket(operator)).toBe('US')
    expect(stripeAccountForMarket('US')).toBe('us')
    expect(defaultStripeAccount(operator)).toBe('us')
    expect(currencyForMarket('US')).toBe('USD')
  })

  it('does not invent a market when the session has none', () => {
    expect(sessionMarkets({ markets: [] })).toEqual([])
    expect(sessionMarkets(null)).toEqual([])
    expect(defaultMarket({ markets: [] })).toBeNull()
    expect(defaultStripeAccount({})).toBeNull()
    expect(isProfileInScope(undefined)).toBe(false)
    expect(isProfileInScope(false)).toBe(false)
    expect(isProfileInScope(true)).toBe(true)
  })

  it('reads the effective markets, then the stored ones, then none', () => {
    expect(effectiveSessionMarkets({ markets: [], effectiveMarkets: ['US', 'BR'] })).toEqual(['BR', 'US'])
    expect(effectiveSessionMarkets({ markets: ['BR'], effectiveMarkets: ['BR'] })).toEqual(['BR'])
    expect(effectiveSessionMarkets({ markets: ['US'] })).toEqual(['US'])
    expect(effectiveSessionMarkets({ markets: [], effectiveMarkets: [] })).toEqual([])
    expect(effectiveSessionMarkets(null)).toEqual([])
  })
})
