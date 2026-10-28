import { afterEach, describe, expect, it, vi } from 'vitest'
import { demoInsightsEnabled } from './demoInsights'

describe('demoInsightsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is on only when the flag is the string true', () => {
    vi.stubEnv('VITE_DEMO_INSIGHTS', 'true')
    expect(demoInsightsEnabled()).toBe(true)
  })

  it('is off when the flag is missing or any other value', () => {
    vi.stubEnv('VITE_DEMO_INSIGHTS', '')
    expect(demoInsightsEnabled()).toBe(false)
    vi.stubEnv('VITE_DEMO_INSIGHTS', '1')
    expect(demoInsightsEnabled()).toBe(false)
  })
})
