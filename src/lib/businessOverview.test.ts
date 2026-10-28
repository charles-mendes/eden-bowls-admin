import { describe, expect, it } from 'vitest'
import { buildBusinessOverview } from './businessOverview'

describe('buildBusinessOverview', () => {
  it('formats Brasil MRR in pt-BR and scales only billing and the funnel', () => {
    const month = buildBusinessOverview('BR', '30d')
    const week = buildBusinessOverview('BR', '7d')

    expect(month.revenue.find((card) => card.label === 'MRR')?.value).toBe('R$ 241.390')
    expect(month.mrrValue).toBe(241390)
    expect(week.revenue.find((card) => card.label === 'MRR')?.value).toBe(month.revenue.find((card) => card.label === 'MRR')?.value)

    const monthBilling = month.revenue.find((card) => card.label === 'Faturamento no período')?.value
    const weekBilling = week.revenue.find((card) => card.label === 'Faturamento no período')?.value
    expect(weekBilling).not.toBe(monthBilling)
    expect(week.funnel[0].value).not.toBe(month.funnel[0].value)
    expect(week.funnel[1].conversion).toBe(month.funnel[1].conversion)
    expect(week.trendAria).toContain('últimas 8 semanas')
    expect(week.weeks).toHaveLength(8)
    expect(week.subscriptions.find((card) => card.label === 'Ativas')?.value).toBe(month.subscriptions.find((card) => card.label === 'Ativas')?.value)
  })
})
