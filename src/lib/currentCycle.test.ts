import { currentCycle, type CycleShipment } from './currentCycle'
import type { CourierDelivery } from './courierDeliveries'
import type { PaidCycle } from './paidCycles'

function cycle(invoiceId: string, overrides: Partial<PaidCycle> = {}): PaidCycle {
  return {
    invoice_id: invoiceId,
    preparation_day: '2026-11-02',
    production_status: 'ready',
    delivery_date: '2026-11-03',
    paid_at: '2026-11-02T22:00:00Z',
    ups_shipment: null,
    courier_delivery: null,
    ...overrides,
  }
}

function courierOf(id: number, status: 'out_for_delivery' | 'delivered' | 'failed') {
  return { id, status, out_for_delivery_at: '2026-11-03T10:00:00Z', delivered_at: null, failed_at: null }
}

function courierItem(id: number, invoiceId: string): CourierDelivery {
  return {
    id,
    subscription_id: '12',
    stripe_invoice_id: invoiceId,
    method: 'uber',
    courier_name: null,
    tracking_url: null,
    cost_minor: 1000,
    currency: 'brl',
    note: null,
    status: 'out_for_delivery',
    out_for_delivery_at: '2026-11-03T10:00:00Z',
    delivered_at: null,
    failed_at: null,
    failure_reason: null,
    canceled_at: null,
  } as CourierDelivery
}

function shipment(invoiceId: string, overrides: Partial<CycleShipment> = {}): CycleShipment {
  return { id: 's1', stripe_invoice_id: invoiceId, status: 'created', tracking_status: null, tracking_number: '1Z999', has_label: true, ups_shipment_id: 'ups1', ...overrides }
}

const write = { canWrite: true }

describe('currentCycle: which cycle', () => {
  test('the oldest paid cycle not delivered wins over a newer paid one', () => {
    const december = cycle('in_dec', { production_status: 'to_prepare', delivery_date: '2026-12-03' })
    const november = cycle('in_nov', { courier_delivery: courierOf(1, 'out_for_delivery') })
    const result = currentCycle({ paidCycles: [december, november], courierItems: [courierItem(1, 'in_nov')], market: 'BR', ...write })

    expect(result?.cycle.invoice_id).toBe('in_nov')
    expect(result?.stage).toBe('Em rota')
    expect(result?.waiting).toBe(1)
  })

  test('when every cycle was delivered, the newest one', () => {
    const result = currentCycle({
      paidCycles: [cycle('in_dec', { courier_delivery: courierOf(2, 'delivered') }), cycle('in_nov', { courier_delivery: courierOf(1, 'delivered') })],
      market: 'BR',
      ...write,
    })

    expect(result).toMatchObject({ cycle: { invoice_id: 'in_dec' }, stage: 'Entregue', action: null, waiting: 0 })
  })

  test('no paid cycle', () => {
    expect(currentCycle({ paidCycles: [], market: 'BR', ...write })).toBeNull()
  })

  test('a voided UPS shipment is ignored', () => {
    const result = currentCycle({ paidCycles: [cycle('in_nov')], shipments: [shipment('in_nov', { status: 'voided', tracking_status: 'delivered' })], market: 'US', ...write })

    expect(result).toMatchObject({ stage: 'Pronto para sair', action: 'ups_label', shipment: null })
  })
})

describe('currentCycle: stage table', () => {
  test.each([
    ['delivered', 'Entregue', null],
    ['out_for_delivery', 'Em rota', 'courier_close'],
    ['failed', 'Entrega falhou', 'courier_redispatch'],
  ] as const)('courier %s', (status, stage, action) => {
    const result = currentCycle({ paidCycles: [cycle('in_nov', { courier_delivery: courierOf(1, status) })], courierItems: [courierItem(1, 'in_nov')], market: 'BR', ...write })

    expect(result).toMatchObject({ stage, action })
  })

  test.each([
    [{ status: 'delivered' }, 'Entregue', null],
    [{ tracking_status: 'delivered' }, 'Entregue', null],
    [{ tracking_status: 'out_for_delivery' }, 'Saiu para entrega', 'ups_refresh'],
    [{ tracking_status: 'in_transit' }, 'Em trânsito', 'ups_refresh'],
    [{ tracking_status: 'exception' }, 'Problema na entrega', 'ups_problem'],
    [{ tracking_status: 'returned' }, 'Problema na entrega', 'ups_problem'],
    [{ tracking_status: null }, 'Aguardando coleta', 'ups_print'],
    [{ tracking_status: 'label_created' }, 'Aguardando coleta', 'ups_print'],
    [{ status: 'pending', ups_shipment_id: null }, 'Verificar na UPS', 'ups_close'],
    [{ status: 'unknown', ups_shipment_id: null }, 'Verificar na UPS', 'ups_close'],
  ] as const)('UPS %o', (overrides, stage, action) => {
    const result = currentCycle({ paidCycles: [cycle('in_nov')], shipments: [shipment('in_nov', overrides)], market: 'US', ...write })

    expect(result).toMatchObject({ stage, action })
  })

  test.each([
    ['ready', 'BR', 'Pronto para sair', 'dispatch'],
    ['ready', 'US', 'Pronto para sair', 'ups_label'],
    ['in_production', 'BR', 'Em preparo', null],
    ['to_prepare', 'BR', 'A preparar', null],
    ['blocked', 'BR', 'Produção bloqueada', 'production_queue'],
  ] as const)('production %s (%s)', (status, market, stage, action) => {
    const result = currentCycle({ paidCycles: [cycle('in_nov', { production_status: status })], market, ...write })

    expect(result).toMatchObject({ stage, action })
  })

  test('the shipment decides before production', () => {
    const result = currentCycle({ paidCycles: [cycle('in_nov', { production_status: 'blocked' })], shipments: [shipment('in_nov', { tracking_status: 'in_transit' })], market: 'US', ...write })

    expect(result?.stage).toBe('Em trânsito')
  })
})

describe('currentCycle: permissions', () => {
  test('a reader without shipping write sees the stage and no action that changes something', () => {
    expect(currentCycle({ paidCycles: [cycle('in_nov')], market: 'BR', canWrite: false })).toMatchObject({ stage: 'Pronto para sair', action: null })
  })

  test('reading actions stay for a reader without write', () => {
    const result = currentCycle({ paidCycles: [cycle('in_nov')], shipments: [shipment('in_nov', { tracking_status: 'in_transit' })], market: 'US', canWrite: false })

    expect(result?.action).toBe('ups_refresh')
  })
})
