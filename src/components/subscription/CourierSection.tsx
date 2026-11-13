import { Section } from '../Section'
import { SectionFeedbackView } from '../SectionFeedbackView'
import { CourierRowActions, CourierStatusBadge, CourierSummary } from '../shipping/CourierDelivery'
import { issueCodeText } from '../../lib/addressIssues'
import type { CourierDelivery } from '../../lib/courierDeliveries'
import { formatCurrency, formatDate } from '../../lib/format'
import type { PaidCycle } from '../../lib/paidCycles'
import type { SectionFeedback } from '../../lib/useSectionFeedback'
import { cycleText } from './types'

type Props = {
  token: string | null
  recipient: string
  phone: string | null
  // The freight the customer paid at checkout: one value for the subscription, in the currency's main unit.
  chargedFreight: number | null
  lock: string[]
  awaiting: PaidCycle[]
  items: CourierDelivery[]
  canWrite: boolean
  canFillRecipient: boolean
  feedback: SectionFeedback
  onDispatch: (invoiceId: string) => void
  onFillRecipient: () => void
  onDone: (text: string) => void
}

export function CourierSection(props: Props) {
  const { feedback, lock, awaiting, items } = props
  const freight = props.chargedFreight === null ? null : formatCurrency(props.chargedFreight, 'BRL')
  return (
    <Section id="entrega-brasil" title="Entrega Brasil" description="Entrega por Uber, motoboy ou entregador próprio, registrada à mão. Cada tentativa fica no histórico.">
      <SectionFeedbackView feedback={feedback} />
      <p>
        Quem recebe: <strong>{props.recipient || '—'}</strong>
        {props.phone ? <> · <span>Telefone {props.phone}</span></> : null}
      </p>
      {/* A lock, as on Entregas Brasil: no dialog opens and there is no way to dispatch anyway. */}
      {lock.length && awaiting.length ? (
        <p id="courier-lock" className="badge-warning">Travado: {lock.map(issueCodeText).join(' · ')}</p>
      ) : null}
      {/* operator-fills-recipient-name: the recipient is the one address field filled here, only when missing. */}
      {props.canFillRecipient && lock.includes('recipient_name_missing') ? (
        <button className="link-button" type="button" onClick={props.onFillRecipient}>Informar quem recebe</button>
      ) : null}
      <div className="table-shell table-scroll">
        <table className="stack-table">
          <thead>
            <tr>
              <th>Fatura</th>
              <th>Status</th>
              <th>Meio, custo e link</th>
              <th>Saiu</th>
              <th>Entregue ou falhou</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {awaiting.map((item) => (
              <tr key={`courier-awaiting-${item.invoice_id}`}>
                <td data-label="Fatura">{item.invoice_id}</td>
                <td data-label="Status"><span className="badge-warning">A despachar</span></td>
                <td colSpan={3} className="muted" data-label="Ciclo">{cycleText(item)}</td>
                <td>
                  {props.canWrite ? (
                    <button
                      className="primary-button"
                      type="button"
                      disabled={lock.length > 0}
                      aria-describedby={lock.length ? 'courier-lock' : undefined}
                      onClick={() => props.onDispatch(item.invoice_id)}
                    >
                      Despachar
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {items.length === 0 && awaiting.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhuma entrega registrada e nenhum ciclo pago esperando saída.</td>
              </tr>
            ) : null}
            {items.map((item) => (
              <tr key={`courier-${item.id}`}>
                <td data-label="Fatura">{item.stripe_invoice_id}</td>
                <td data-label="Status"><CourierStatusBadge status={item.status} /></td>
                <td data-label="Meio e custo">
                  <CourierSummary delivery={item} />
                  {freight ? <div className="muted">Frete cobrado no checkout: {freight}</div> : null}
                </td>
                <td data-label="Saiu">{formatDate(item.out_for_delivery_at)}</td>
                <td data-label="Entregue ou falhou">{formatDate(item.delivered_at || item.failed_at || item.canceled_at)}</td>
                <td>
                  <CourierRowActions token={props.token} delivery={item} canWrite={props.canWrite} onDone={props.onDone} onError={feedback.fail} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
