import { describe, expect, it } from 'vitest'
import {
  exportFilename,
  exportPath,
  formatDelta,
  marketToday,
  matchQuickPeriod,
  minorToMoney,
  quickRange,
  reportPath,
  validateRange,
  type ReportState,
} from './reports'

const nbsp = (text: string) => text.replace(/\u00a0/g, ' ')

const state: ReportState = { tab: 'receita', market: 'US', from: '2026-09-28', to: '2026-10-27', granularity: null }

describe('reports lib', () => {
  it('formats minor units in each market currency', () => {
    expect(nbsp(minorToMoney(1000000, 'BR'))).toBe('R$ 10.000,00')
    expect(nbsp(minorToMoney(1234567, 'US'))).toBe('US$ 12.345,67')
    expect(minorToMoney(null, 'BR')).toBe('—')
  })

  it('shows the change in % for counts and money and in p.p. for rates, omitted without a previous value', () => {
    expect(formatDelta(1000000, 800000, 'money')).toBe('+25,0%')
    expect(formatDelta(90, 100, 'count')).toBe('−10,0%')
    expect(formatDelta(0.05, 0.04, 'rate')).toBe('+1,0 p.p.')
    expect(formatDelta(5, 0, 'count')).toBeNull()
    expect(formatDelta(5, null, 'count')).toBeNull()
    expect(formatDelta(null, 0.04, 'rate')).toBeNull()
  })

  it('quick periods end yesterday in the market time zone', () => {
    // 2026-10-29 01:00 UTC is still 2026-10-28 in Sao Paulo.
    const today = marketToday('BR', new Date('2026-10-29T01:00:00Z'))
    expect(today).toBe('2026-10-28')
    expect(quickRange('30d', today)).toEqual({ from: '2026-09-28', to: '2026-10-27' })
    expect(quickRange('7d', today)).toEqual({ from: '2026-10-21', to: '2026-10-27' })
    expect(matchQuickPeriod('2026-09-28', '2026-10-27', today)).toBe('30d')
    expect(matchQuickPeriod('2026-07-01', '2026-09-30', today)).toBeNull()
  })

  it('blocks a range over 366 days or a start after the end', () => {
    expect(validateRange('2025-01-01', '2026-10-28')).toMatch(/366 dias/)
    expect(validateRange('2026-10-10', '2026-10-01')).toMatch(/antes/)
    expect(validateRange('2025-10-28', '2026-10-28')).toBeNull()
    expect(validateRange('', '2026-10-28')).not.toBeNull()
  })

  it('maps the URL state to the API query; the summary sends no market', () => {
    expect(reportPath(state)).toBe('/admin/reports/revenue?market=US&from=2026-09-28&to=2026-10-27')
    expect(reportPath({ ...state, tab: 'resumo' })).toBe('/admin/reports/summary?from=2026-09-28&to=2026-10-27')
    expect(reportPath({ ...state, granularity: 'week' })).toContain('granularity=week')
    expect(exportPath({ ...state, tab: 'estoque', market: 'BR' })).toBe(
      '/admin/reports/export.csv?report=stock&market=BR&from=2026-09-28&to=2026-10-27&formato=excel',
    )
  })

  it('uses the file name the API sends, with a fallback', () => {
    expect(exportFilename(state, 'attachment; filename="eden-revenue-US-2026-09-28-2026-10-27.csv"')).toBe('eden-revenue-US-2026-09-28-2026-10-27.csv')
    expect(exportFilename(state, null)).toBe('eden-revenue-US-2026-09-28-2026-10-27.csv')
  })
})
