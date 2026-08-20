import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate, formatJson } from './format'

describe('format helpers', () => {
  it('returns a dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not-a-date')).toBe('-')
  })

  it('formats valid dates instead of returning a dash', () => {
    expect(formatDate('2026-08-19T15:00:00.000Z')).not.toBe('-')
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
