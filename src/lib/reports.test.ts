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
  detailApiPath,
  detailExportPath,
  detailLink,
  detailPagePath,
  parseDetailParams,
  reportsLink,
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

describe('report details links', () => {
  const state = { tab: 'receita' as const, market: 'US' as const, from: '2026-10-20', to: '2026-11-18', granularity: null }

  it('opens the details of a card with the Reports filters', () => {
    expect(detailLink(state, 'grossRevenue')).toBe('/reports/detalhe?aba=receita&indicador=grossRevenue&mercado=US&de=2026-10-20&ate=2026-11-18')
    expect(detailLink({ ...state, granularity: 'week' }, 'series.revenue', { bucket: '2026-10-19' }))
      .toBe('/reports/detalhe?aba=receita&indicador=series.revenue&mercado=US&de=2026-10-20&ate=2026-11-18&granularidade=week&bucket=2026-10-19')
    expect(detailLink({ ...state, tab: 'resumo' }, 'grossRevenue', { market: 'BR' })).toContain('mercado=BR')
  })

  it('reads the details URL back and returns to the same tab and filters', () => {
    const params = new URLSearchParams('aba=operacao&indicador=cycles.ready&mercado=US&de=2026-10-20&ate=2026-11-18&granularidade=week&bucket=2026-10-19&anterior=1&pagina=2')
    const parsed = parseDetailParams(params)
    expect(parsed).toEqual({
      tab: 'operacao', indicator: 'cycles.ready', market: 'US', from: '2026-10-20', to: '2026-11-18',
      granularity: 'week', bucket: '2026-10-19', previous: true, page: 2,
    })
    const detail = { ...parsed, market: 'US' as const }
    expect(reportsLink(detail)).toBe('/reports?aba=operacao&mercado=US&de=2026-10-20&ate=2026-11-18&granularidade=week')
    expect(detailPagePath(detail, { previous: false, page: 1 }))
      .toBe('/reports/detalhe?aba=operacao&indicador=cycles.ready&mercado=US&de=2026-10-20&ate=2026-11-18&granularidade=week&bucket=2026-10-19')
  })

  it('asks the API in its own names', () => {
    const detail = { ...state, indicator: 'grossRevenue', bucket: null, previous: true, page: 3 }
    expect(detailApiPath(detail)).toBe('/admin/reports/details?report=revenue&indicator=grossRevenue&market=US&from=2026-10-20&to=2026-11-18&period=previous&page=3&perPage=50')
    expect(detailExportPath({ ...detail, tab: 'resumo' })).toBe('/admin/reports/details/export.csv?report=summary&indicator=grossRevenue&market=US&from=2026-10-20&to=2026-11-18&period=previous&formato=excel')
  })
})
