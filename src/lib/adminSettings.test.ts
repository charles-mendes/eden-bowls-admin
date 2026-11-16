import { describe, expect, it } from 'vitest'
import { todayVersion, versionFromLabel, versionLabel } from './adminSettings'

describe('legal version dates', () => {
  it('shows the API version AAAA-MM-DD as DD/MM/AAAA, without a time zone shift', () => {
    expect(versionLabel('2026-11-15')).toBe('15/11/2026')
    expect(versionLabel('2026-01-01')).toBe('01/01/2026')
    expect(versionLabel('rascunho')).toBe('rascunho')
  })

  it('turns a typed DD/MM/AAAA into the API version, and refuses a day that does not exist', () => {
    expect(versionFromLabel('15/11/2026')).toBe('2026-11-15')
    expect(versionFromLabel(' 29/02/2028 ')).toBe('2028-02-29')
    expect(versionFromLabel('31/02/2026')).toBeNull()
    expect(versionFromLabel('29/02/2026')).toBeNull()
    expect(versionFromLabel('2026-11-15')).toBeNull()
    expect(versionFromLabel('15/11/26')).toBeNull()
  })

  it('suggests today as DD/MM/AAAA', () => {
    expect(todayVersion(new Date(2026, 10, 5))).toBe('05/11/2026')
  })
})
