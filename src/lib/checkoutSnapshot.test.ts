import { describe, expect, it } from 'vitest'
import { parseCheckoutSnapshots } from './checkoutSnapshot'
import { checkoutDetail } from '../test/fixtures'

describe('parseCheckoutSnapshots', () => {
  it('turns persisted checkout JSON into operator-facing labels', () => {
    const snapshots = parseCheckoutSnapshots(checkoutDetail)

    expect(snapshots.discount.eligible).toBe(false)
    expect(snapshots.discount.items).toEqual(expect.arrayContaining([
      { label: 'Motivo', value: 'Cliente já possui compra anterior' },
      { label: 'Percentual', value: '0%' },
    ]))
    expect(snapshots.plan.pets[0]).toEqual({
      petName: 'Luna',
      flavors: 'Bovino × 5, Peixe × 5',
    })
    expect(snapshots.plan.lineItems[0]).toMatchObject({
      petName: 'Luna',
      product: 'Bovino',
      quantity: '5',
    })
    expect(snapshots.address.lines).toEqual([
      'Rua Aristeu de Castro Fernandes, 941',
      'Apt 1',
      'Maria Antonieta',
      'Pinhais, PR',
      '83331-160',
      'Brasil',
    ])
    expect(snapshots.shipping.items).toEqual(expect.arrayContaining([
      { label: 'Método', value: 'Entrega Eden Bowl' },
      { label: 'Distância', value: '7,37 km' },
    ]))
    expect(snapshots.payment.paymentState).toBe('paid')
  })

  it('keeps sparse snapshots readable without empty noise', () => {
    const snapshots = parseCheckoutSnapshots({
      planSelection: { plan: 'adult' },
      address: { city: 'São Paulo' },
      shipping: { method: 'eden' },
      discount: { eligibilityReason: 'ineligible' },
      lineItems: [{ sku: 'bowl-1' }],
      checkoutReference: { id: 'co_1' },
    })

    expect(snapshots.discount.items).toEqual([
      { label: 'Motivo', value: 'Não elegível' },
    ])
    expect(snapshots.plan.items).toEqual([
      { label: 'Plano', value: 'adult' },
    ])
    expect(snapshots.address.lines).toEqual(['São Paulo'])
    expect(snapshots.shipping.items).toEqual([
      { label: 'Método', value: 'eden' },
    ])
    expect(snapshots.payment.items).toEqual([])
  })
})
