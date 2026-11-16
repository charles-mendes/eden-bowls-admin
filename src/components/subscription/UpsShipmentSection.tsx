import { Link } from 'react-router-dom'
import { Section } from '../Section'
import { SectionFeedbackView } from '../SectionFeedbackView'
import { formatDate } from '../../lib/format'
import { labelIssueText, UPS_SHIPMENT_STATUS, type LabelIssue } from '../../lib/upsLabels'
import type { PaidCycle } from '../../lib/paidCycles'
import type { SectionFeedback } from '../../lib/useSectionFeedback'
import { cycleText, type UpsShipment } from './types'

const TRACKING_STATUS: Record<string, string> = {
  label_created: 'Aguardando coleta',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  exception: 'Problema na entrega',
  returned: 'Devolvido ao remetente',
}

// What the section can do with a shipment; each handler reports in the feedback it is given.
export type UpsActions = {
  createShipment: (invoiceId: string, feedback: SectionFeedback) => void
  printShipmentLabel: (shipmentId: string, feedback: SectionFeedback) => void
  downloadLabel: (shipmentId: string, feedback: SectionFeedback) => void
  refreshTracking: (shipmentId: string, feedback: SectionFeedback) => void
  voidShipment: (shipmentId: string, feedback: SectionFeedback) => void
  closeUnresolvedShipment: (shipmentId: string, feedback: SectionFeedback) => void
}

type Props = {
  shipments: UpsShipment[]
  labelIssues: LabelIssue[]
  awaitingLabel: PaidCycle[]
  canWrite: boolean
  feedback: SectionFeedback
  actions: UpsActions
}

export function UpsShipmentSection({ shipments, labelIssues, awaitingLabel, canWrite, feedback, actions }: Props) {
  return (
    <Section id="envio-ups" title="Envio UPS" description="Uma etiqueta por fatura paga. Compare o frete cobrado no checkout com o custo da UPS.">
      <SectionFeedbackView feedback={feedback} />
      {labelIssues.length > 0 ? (
        <div className="warning" role="alert" aria-label="Etiqueta bloqueada">
          <strong>Não é possível gerar a etiqueta. Corrija antes:</strong>
          <ul>
            {labelIssues.map((issue) => (
              <li key={issue.code}>
                {labelIssueText(issue)}
                {issue.code === 'ship_from_missing' ? <> <Link to="/config/shipping?aba=sede&mercado=us">Abrir configuração de frete</Link></> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="table-shell table-scroll">
        <table className="stack-table">
          <thead>
            <tr>
              <th>Fatura</th>
              <th>Status</th>
              <th>Rastreio</th>
              <th>Serviço</th>
              <th>Cotado</th>
              <th>Custo UPS</th>
              <th>Enviado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {awaitingLabel.map((item) => (
              <tr key={`awaiting-${item.invoice_id}`}>
                <td data-label="Fatura">{item.invoice_id}</td>
                <td data-label="Status"><span className="badge-warning">Sem etiqueta</span></td>
                <td colSpan={5} className="muted" data-label="Ciclo">{cycleText(item)}</td>
                <td>
                  {canWrite ? (
                    <button className="primary-button" type="button" disabled={labelIssues.length > 0} onClick={() => actions.createShipment(item.invoice_id, feedback)}>
                      Gerar etiqueta UPS
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {shipments.length === 0 && awaitingLabel.length === 0 ? (
              <tr>
                <td colSpan={8}>Nenhuma etiqueta ainda. Ciclos pagos aparecem aqui para gerar a etiqueta.</td>
              </tr>
            ) : (
              shipments.map((item) => (
                <tr key={item.id}>
                  <td data-label="Fatura">{item.stripe_invoice_id}</td>
                  <td data-label="Status"><span className={UPS_SHIPMENT_STATUS[item.status]?.badge ?? 'badge-info'}>{UPS_SHIPMENT_STATUS[item.status]?.label ?? item.status}</span></td>
                  <td data-label="Rastreio">
                    {item.tracking_url ? (
                      <a href={item.tracking_url} target="_blank" rel="noreferrer">{item.tracking_number}</a>
                    ) : (item.tracking_number || '—')}
                    {item.tracking_status ? (
                      <div className="muted">
                        {TRACKING_STATUS[item.tracking_status] ?? item.tracking_description ?? item.tracking_status}
                        {item.delivered_at ? ` em ${formatDate(item.delivered_at)}` : ''}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Serviço">{item.service_code || '—'}</td>
                  <td data-label="Cotado">{item.quoted_shipping_cost != null ? item.quoted_shipping_cost : '—'}</td>
                  <td data-label="Custo UPS">{item.ups_monetary_value != null ? item.ups_monetary_value : '—'}</td>
                  <td data-label="Enviado">{formatDate(item.shipped_at)}</td>
                  <td>
                    <div className="inline-actions">
                      {item.has_label ? (
                        <button className="ghost-button" type="button" onClick={() => actions.printShipmentLabel(item.id, feedback)}>
                          Imprimir
                        </button>
                      ) : null}
                      {item.has_label ? (
                        <button className="ghost-button" type="button" onClick={() => actions.downloadLabel(item.id, feedback)}>
                          Baixar
                        </button>
                      ) : null}
                      {item.tracking_number && item.status === 'created' ? (
                        <button className="ghost-button" type="button" onClick={() => actions.refreshTracking(item.id, feedback)}>
                          Atualizar rastreio
                        </button>
                      ) : null}
                      {canWrite && item.status === 'created' && item.ups_shipment_id ? (
                        <button className="ghost-button" type="button" onClick={() => actions.voidShipment(item.id, feedback)}>
                          Anular
                        </button>
                      ) : null}
                      {canWrite && (item.status === 'pending' || item.status === 'unknown') && !item.ups_shipment_id ? (
                        <button className="ghost-button" type="button" onClick={() => actions.closeUnresolvedShipment(item.id, feedback)}>
                          Fechar após conferir na UPS
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
