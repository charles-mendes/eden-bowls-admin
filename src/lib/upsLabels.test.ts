import { describe, expect, it } from 'vitest'
import { pickupErrorText, pickupLabel } from './upsLabels'

describe('pickupLabel', () => {
  it('a requested pickup shows the day and the PRN', () => {
    expect(pickupLabel({ id: 1, pickup_date: '2026-11-09', status: 'requested', prn: '2929602E9CP' })).toBe('Coleta pedida para 09/11 · PRN 2929602E9CP')
  })

  it('an unknown pickup says UPS did not confirm', () => {
    expect(pickupLabel({ id: 1, pickup_date: '2026-11-09', status: 'unknown', prn: null })).toBe('Coleta sem confirmação da UPS')
  })

  it('a pickup in progress', () => {
    expect(pickupLabel({ id: 1, pickup_date: '2026-11-09', status: 'pending', prn: null })).toBe('Coleta sendo pedida à UPS')
  })

  it('no pickup', () => {
    expect(pickupLabel(null)).toBe('Sem coleta')
    expect(pickupLabel(undefined)).toBe('Sem coleta')
  })
})

describe('pickupErrorText', () => {
  it.each([
    'pickup_date_not_allowed',
    'pickup_window_invalid',
    'pickup_count_invalid',
    'pickup_shipments_required',
    'pickup_shipment_not_eligible',
    'pickup_ship_from_incomplete',
    'pickup_unconfirmed',
    'pickup_not_cancelable',
    'pickup_not_unknown',
  ])('%s has its own text', (code) => {
    expect(pickupErrorText(code, 'API')).not.toBe('API')
  })

  it('the day text names today or the next pickup day', () => {
    expect(pickupErrorText('pickup_date_not_allowed', '')).toBe('Não há coleta da UPS nesse dia. Escolha hoje ou o próximo dia útil sem fechamento no calendário.')
  })

  it('a missing or short phone gets its own text', () => {
    expect(pickupErrorText('pickup_ship_from_incomplete', '', ['phone'])).toMatch(/telefone da sede dos EUA está faltando ou curto.*10 dígitos/)
    expect(pickupErrorText('pickup_ship_from_incomplete', '', ['street', 'phone'])).toBe('A UPS precisa do endereço e do telefone da sede dos EUA para buscar as caixas.')
  })

  it('an unknown code keeps the API message', () => {
    expect(pickupErrorText('ups_upstream_error', 'Invalid address')).toBe('Invalid address')
  })
})
