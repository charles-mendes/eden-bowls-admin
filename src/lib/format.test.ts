import { describe, expect, it } from 'vitest'
import {
  formatCurrency,
  formatDate,
  formatFrequency,
  formatJson,
  formatStripeStatus,
} from './format'

describe('format helpers', () => {
  it('returns a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not-a-date')).toBe('-')
  })

  it('formats the same instant in the viewer timezone, not a fixed Brazil clock', () => {
    const instant = '2026-08-19T03:46:00.000Z'

    expect(formatDate(instant, 'America/Sao_Paulo')).toContain('00:46')
    expect(formatDate(instant, 'America/New_York')).toContain('23:46')
  })

  it('translates stripe mixed status and monthly frequency to portuguese', () => {
    expect(formatStripeStatus('mixed')).toBe('Misto')
    expect(formatStripeStatus('active')).toBe('Ativo')
    expect(formatStripeStatus('unlinked')).toBe('Não vinculado')
    expect(formatFrequency('monthly')).toBe('Mensal')
    expect(formatFrequency('every_4_weeks')).toBe('A cada 4 semanas')
    expect(formatFrequency('3_month')).toBe('A cada 3 meses')
    expect(formatFrequency(null)).toBe('-')
  })

  it('formats BRL amounts and ignores empty values', () => {
    expect(formatCurrency(null)).toBe('-')
    expect(formatCurrency('not-a-number')).toBe('-')
    expect(formatCurrency(12.5)).toMatch(/12/)
  })

  it('pretty-prints JSON payloads', () => {
    expect(formatJson({ ok: true })).toContain('"ok": true')
  })
})
