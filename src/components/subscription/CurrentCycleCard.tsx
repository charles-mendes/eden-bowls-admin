import { Link } from 'react-router-dom'
import { Section } from '../Section'
import { SectionFeedbackView } from '../SectionFeedbackView'
import { CustomerContact } from '../CustomerContact'
import { CourierRowActions } from '../shipping/CourierDelivery'
import type { CustomerContact as Contact } from '../../lib/customerContacts'
import type { CurrentCycle } from '../../lib/currentCycle'
import type { SectionFeedback } from '../../lib/useSectionFeedback'
import { formatDay } from './types'
import type { UpsActions } from './UpsShipmentSection'

type Props = {
  current: CurrentCycle | null
  token: string | null
  feedback: SectionFeedback
  subscriptionId: string
  contactName: string
  phone: string | null
  dispatchLocked: boolean
  labelLocked: boolean
  ups: UpsActions
  onDispatch: (invoiceId: string) => void
  onCourierDone: (text: string) => void
  onContactSaved: (contact: Contact) => void
}

const TONE_BADGE: Record<string, string> = {
  success: 'badge-success',
  info: 'badge-info',
  warning: 'badge-warning',
  error: 'badge-error',
  neutral: 'badge-neutral',
}

export function CurrentCycleCard(props: Props) {
  const { current, feedback } = props
  if (!current) {
    return (
      <Section title="Ciclo atual">
        <p className="muted">Nenhum ciclo pago ainda.</p>
      </Section>
    )
  }

  const { cycle, shipment, courier } = current
  const dates = [
    cycle.preparation_day ? `Preparo ${formatDay(cycle.preparation_day)}` : null,
    cycle.delivery_date ? `Entrega ${formatDay(cycle.delivery_date)}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <Section title="Ciclo atual" description={dates || undefined}>
      <SectionFeedbackView feedback={feedback} />
      <div className="current-cycle">
        <p className="current-cycle-stage">
          <span className={TONE_BADGE[current.tone]}>{current.stage}</span>
          {shipment?.tracking_number ? <span className="muted"> Rastreio {shipment.tracking_number}</span> : null}
          {cycle.courier_delivery?.out_for_delivery_at && current.stage === 'Em rota'
            ? <span className="muted"> Saiu em {new Date(cycle.courier_delivery.out_for_delivery_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            : null}
        </p>
        <div className="inline-actions">
          {current.action === 'courier_close' && courier ? (
            <CourierRowActions token={props.token} delivery={courier} canWrite onDone={props.onCourierDone} onError={feedback.fail} />
          ) : null}
          {current.action === 'courier_redispatch' || current.action === 'dispatch' ? (
            <button className="primary-button" type="button" disabled={props.dispatchLocked} onClick={() => props.onDispatch(cycle.invoice_id)}>
              {current.action === 'dispatch' ? 'Despachar' : 'Despachar de novo'}
            </button>
          ) : null}
          {current.action === 'ups_label' ? (
            <button className="primary-button" type="button" disabled={props.labelLocked} onClick={() => props.ups.createShipment(cycle.invoice_id, feedback)}>
              Gerar etiqueta UPS
            </button>
          ) : null}
          {(current.action === 'ups_refresh' || current.action === 'ups_problem') && shipment ? (
            <button className="ghost-button" type="button" onClick={() => props.ups.refreshTracking(shipment.id, feedback)}>
              Atualizar rastreio
            </button>
          ) : null}
          {current.action === 'ups_problem' ? (
            <CustomerContact
              subscriptionId={props.subscriptionId}
              name={props.contactName}
              phone={props.phone}
              reason="delivery_failed"
              showLast={false}
              onSaved={props.onContactSaved}
            />
          ) : null}
          {current.action === 'ups_print' && shipment ? (
            <button className="primary-button" type="button" onClick={() => props.ups.printShipmentLabel(shipment.id, feedback)}>
              Imprimir etiqueta
            </button>
          ) : null}
          {current.action === 'ups_close' && shipment ? (
            <button className="ghost-button" type="button" onClick={() => props.ups.closeUnresolvedShipment(shipment.id, feedback)}>
              Fechar após conferir na UPS
            </button>
          ) : null}
          {current.action === 'production_queue' ? (
            <Link className="ghost-button" to="/operations/production">Abrir fila de produção</Link>
          ) : null}
        </div>
        {current.waiting > 0 ? (
          <p className="muted">
            {current.waiting === 1 ? 'Mais 1 ciclo pago esperando.' : `Mais ${current.waiting} ciclos pagos esperando.`}
          </p>
        ) : null}
      </div>
    </Section>
  )
}
