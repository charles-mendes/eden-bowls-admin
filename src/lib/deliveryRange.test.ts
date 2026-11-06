import { describe, expect, it } from 'vitest'
import {
  COURIER_TIMEZONE,
  LABELS_TIMEZONE,
  laterRange,
  laterText,
  nextFromRange,
  nextSevenDays,
  presetOf,
  rangeLabel,
  rangeQuery,
  readRange,
  writeRange,
} from './deliveryRange'

// 2026-11-07 02:30 UTC: still the 6th in New York, already 23:30 of the 6th in São Paulo.
const NOW = new Date('2026-11-07T02:30:00Z')

describe('deliveryRange', () => {
  it('reads the default when the URL has no complete range', () => {
    expect(readRange(new URLSearchParams(''))).toBeNull()
    expect(readRange(new URLSearchParams('de=2026-11-06'))).toBeNull()
    expect(readRange(new URLSearchParams('de=2026-02-30&ate=2026-03-01'))).toBeNull()
    expect(readRange(new URLSearchParams('de=2026-11-06&ate=2026-11-12'))).toEqual({ from: '2026-11-06', to: '2026-11-12' })
  })

  it('writes the range and keeps the other parameters', () => {
    const written = writeRange(new URLSearchParams('aba=falhas'), { from: '2026-11-06', to: '2026-11-12' })
    expect(written.toString()).toBe('aba=falhas&de=2026-11-06&ate=2026-11-12')
    expect(writeRange(written, null).toString()).toBe('aba=falhas')
  })

  it('sends nothing for the default', () => {
    expect(rangeQuery(null)).toBe('')
    expect(rangeQuery({ from: '2026-11-06', to: '2026-11-12' })).toBe('?from=2026-11-06&to=2026-11-12')
  })

  it('takes the next seven days from today in the queue timezone', () => {
    expect(nextSevenDays(COURIER_TIMEZONE, NOW)).toEqual({ from: '2026-11-06', to: '2026-11-12' })
    expect(nextSevenDays(LABELS_TIMEZONE, NOW)).toEqual({ from: '2026-11-06', to: '2026-11-12' })
    expect(nextSevenDays(COURIER_TIMEZONE, new Date('2026-11-07T04:00:00Z'))).toEqual({ from: '2026-11-07', to: '2026-11-13' })
  })

  it('names the range', () => {
    expect(presetOf(null, COURIER_TIMEZONE, NOW)).toBe('default')
    expect(rangeLabel(null, COURIER_TIMEZONE, NOW)).toBe('Até amanhã')
    expect(rangeLabel({ from: '2026-11-06', to: '2026-11-12' }, COURIER_TIMEZONE, NOW)).toBe('Próximos 7 dias')
    expect(rangeLabel({ from: '2026-11-01', to: '2026-11-03' }, COURIER_TIMEZONE, NOW)).toBe('01/11 a 03/11')
  })

  it('starts at next_from and keeps the end while it stays within 31 days', () => {
    expect(nextFromRange('2026-11-07', '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-07' })
    expect(nextFromRange('2026-12-20', '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-11' })
    expect(nextFromRange('2026-11-04', '2026-11-05')).toEqual({ from: '2026-11-05', to: '2026-11-11' })
  })

  it('opens the seven days after the range', () => {
    expect(laterRange('2026-11-30')).toEqual({ from: '2026-12-01', to: '2026-12-07' })
    expect(laterText(4, '2026-11-07')).toBe('Mais 4 pedidos com entrega depois de 07/11.')
    expect(laterText(1, '2026-11-07')).toBe('Mais 1 pedido com entrega depois de 07/11.')
  })
})
