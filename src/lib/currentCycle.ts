import type { CourierDelivery } from './courierDeliveries'
import type { PaidCycle } from './paidCycles'

// The UPS shipment fields the card reads, from GET /admin/billing/subscriptions/:id/shipments (the page's list,
// which carries the tracking status the paid cycle does not).
export type CycleShipment = {
  id: string
  stripe_invoice_id: string
  status: string
  tracking_status: string | null
  tracking_number: string | null
  has_label: boolean
  ups_shipment_id: string | null
}

// What the card offers. The page maps each one to the handler it already has.
export type CycleAction =
  | 'courier_close' // Marcar entregue, Falhou
  | 'courier_redispatch'
  | 'ups_refresh'
  | 'ups_problem' // Atualizar rastreio, plus the customer contact
  | 'ups_print'
  | 'ups_close'
  | 'dispatch'
  | 'ups_label'
  | 'production_queue'

export type CycleTone = 'success' | 'info' | 'warning' | 'error' | 'neutral'

export type CurrentCycle = {
  cycle: PaidCycle
  stage: string
  tone: CycleTone
  action: CycleAction | null
  shipment: CycleShipment | null
  courier: CourierDelivery | null
  // Other paid cycles still not delivered.
  waiting: number
}

type Sources = {
  paidCycles: PaidCycle[]
  shipments?: CycleShipment[]
  courierItems?: CourierDelivery[]
  market: 'BR' | 'US' | null | undefined
  canWrite: boolean
}

// Actions that change something. Printing and refreshing the tracking only read.
const WRITE_ACTIONS: CycleAction[] = ['courier_close', 'courier_redispatch', 'ups_close', 'dispatch', 'ups_label']

function activeShipment(cycle: PaidCycle, shipments: CycleShipment[]) {
  return shipments.find((item) => item.stripe_invoice_id === cycle.invoice_id && item.status !== 'voided') ?? null
}

function isDelivered(cycle: PaidCycle, shipments: CycleShipment[]) {
  if (cycle.courier_delivery?.status === 'delivered') return true
  const shipment = activeShipment(cycle, shipments)
  return Boolean(shipment && (shipment.status === 'delivered' || shipment.tracking_status === 'delivered'))
}

type Stage = { stage: string; tone: CycleTone; action: CycleAction | null }

function shipmentStage(shipment: CycleShipment): Stage {
  if (shipment.status === 'delivered' || shipment.tracking_status === 'delivered') return { stage: 'Entregue', tone: 'success', action: null }
  if (shipment.status === 'pending' || shipment.status === 'unknown') return { stage: 'Verificar na UPS', tone: 'warning', action: 'ups_close' }
  switch (shipment.tracking_status) {
    case 'out_for_delivery':
      return { stage: 'Saiu para entrega', tone: 'info', action: 'ups_refresh' }
    case 'in_transit':
      return { stage: 'Em trânsito', tone: 'info', action: 'ups_refresh' }
    case 'exception':
    case 'returned':
      return { stage: 'Problema na entrega', tone: 'error', action: 'ups_problem' }
    default:
      return { stage: 'Aguardando coleta', tone: 'info', action: 'ups_print' }
  }
}

function courierStage(status: string): Stage | null {
  if (status === 'delivered') return { stage: 'Entregue', tone: 'success', action: null }
  if (status === 'out_for_delivery') return { stage: 'Em rota', tone: 'info', action: 'courier_close' }
  if (status === 'failed') return { stage: 'Entrega falhou', tone: 'error', action: 'courier_redispatch' }
  return null
}

function productionStage(status: string | null, market: Sources['market']): Stage {
  switch (status) {
    case 'ready':
      return { stage: 'Pronto para sair', tone: 'warning', action: market === 'US' ? 'ups_label' : market === 'BR' ? 'dispatch' : null }
    case 'in_production':
      return { stage: 'Em preparo', tone: 'info', action: null }
    case 'blocked':
      return { stage: 'Produção bloqueada', tone: 'error', action: 'production_queue' }
    default:
      return { stage: 'A preparar', tone: 'neutral', action: null }
  }
}

// The cycle the operator asks about: the oldest paid one not delivered yet, else the newest delivered. The list
// comes newest delivery first. Shipment decides the stage first, then production.
export function currentCycle({ paidCycles, shipments = [], courierItems = [], market, canWrite }: Sources): CurrentCycle | null {
  if (!paidCycles.length) return null
  const open = paidCycles.filter((cycle) => !isDelivered(cycle, shipments))
  const cycle = open.length ? open[open.length - 1] : paidCycles[0]

  const shipment = activeShipment(cycle, shipments)
  const courier = cycle.courier_delivery
    ? courierItems.find((item) => item.id === cycle.courier_delivery?.id) ?? null
    : null
  const stage = (cycle.courier_delivery && courierStage(cycle.courier_delivery.status))
    || (shipment && shipmentStage(shipment))
    || productionStage(cycle.production_status, market)

  let action = stage.action
  if (action && !canWrite && WRITE_ACTIONS.includes(action)) action = null
  if (action === 'ups_print' && !shipment?.has_label) action = null
  if (action === 'courier_close' && !courier) action = null

  return {
    cycle,
    stage: stage.stage,
    tone: stage.tone,
    action,
    shipment,
    courier,
    waiting: Math.max(0, open.length - (open.includes(cycle) ? 1 : 0)),
  }
}
