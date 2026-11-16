import { Link } from 'react-router-dom'
import { Section } from '../Section'
import { SectionFeedbackView } from '../SectionFeedbackView'
import type { Charge } from '../../lib/charges'
import { describeInvoiceDelivery, formatInvoiceStatus, type CustomerInvoice } from '../../lib/customerInvoices'
import { formatNfeNumber, nfeStatusLabel, nfeStatusTone } from '../../lib/nfe'
import type { SectionFeedback } from '../../lib/useSectionFeedback'
import { formatDay, formatDayOf } from './types'

type Props = {
  charges: Charge[]
  canSync: boolean
  canReadNfe: boolean
  feedback: SectionFeedback
  onFetchStripe: () => void
  onOpenStripePdf: (stripeInvoiceId: string) => void
  onIssueInvoice: (stripeInvoiceId: string) => void
  onDownloadInvoice: (invoice: CustomerInvoice) => void
  onSendInvoice: (invoice: CustomerInvoice) => void
}

// The day of the row: a delivery day stays a day, an instant is shown in the operator's time zone.
function chargeDay(charge: Charge) {
  if (!charge.date) return '—'
  return /^\d{4}-\d{2}-\d{2}$/.test(charge.date) ? formatDay(charge.date) : formatDayOf(charge.date)
}

function InvoiceCell({ charge, canSync, onDownload, onSend }: { charge: Charge; canSync: boolean; onDownload: Props['onDownloadInvoice']; onSend: Props['onSendInvoice'] }) {
  const invoice = charge.invoice
  if (!invoice) return <span className="muted">Sem invoice</span>
  const delivery = describeInvoiceDelivery(invoice)
  return (
    <div>
      <div>{invoice.invoice_number}</div>
      <span className={`badge-${delivery.tone}`}>{delivery.label}</span>
      <div className="muted">{delivery.detail}</div>
      <div className="inline-actions">
        <button className="ghost-button" type="button" onClick={() => onDownload(invoice)}>Baixar PDF</button>
        {canSync ? (
          <button className="ghost-button" type="button" onClick={() => onSend(invoice)}>
            {invoice.email_status === 'sent' ? 'Reenviar' : 'Enviar ao cliente'}
          </button>
        ) : null}
      </div>
      {charge.otherInvoices.map((other) => (
        <div key={other.id} className="muted charge-other-invoice">
          Também emitida como {other.invoice_number} (conta {String(other.stripe_account).toUpperCase()}).{' '}
          <button className="link-button" type="button" onClick={() => onDownload(other)}>Baixar {other.invoice_number}</button>
        </div>
      ))}
    </div>
  )
}

function NfeCell({ charge }: { charge: Charge }) {
  const nfe = charge.nfe
  if (!nfe) return <span className="muted">—</span>
  const number = formatNfeNumber(nfe)
  return (
    <div>
      <span className={nfeStatusTone(nfe.status)}>{nfeStatusLabel(nfe.status)}</span>
      <div><Link className="table-link" to={`/operations/nfe/${nfe.id}`}>{number === '—' ? `Abrir nota ${nfe.id}` : `Nota ${number}`}</Link></div>
    </div>
  )
}

// One row per Stripe invoice: the cycle, the Eden Bowls invoice, the NF-e and the Stripe PDF side by side. Built from
// what the page already loaded; "Buscar na Stripe" adds the invoices that have no cycle.
export function ChargesSection(props: Props) {
  const { charges, feedback } = props
  return (
    <Section
      id="faturas-stripe"
      title="Cobranças"
      description="Uma linha por fatura da Stripe, com a invoice Eden Bowls e a NF-e do mesmo pagamento."
      actions={props.canSync ? (
        <button className="ghost-button" type="button" onClick={props.onFetchStripe}>Buscar na Stripe</button>
      ) : null}
    >
      <SectionFeedbackView feedback={feedback} />
      <div className="table-shell table-scroll">
        <table className="stack-table">
          <thead>
            <tr>
              <th>Ciclo</th>
              <th>Valor</th>
              <th>Invoice Eden Bowls</th>
              {props.canReadNfe ? <th>NF-e</th> : null}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {charges.length === 0 ? (
              <tr>
                <td colSpan={props.canReadNfe ? 5 : 4}>
                  Nenhuma cobrança registrada ainda.{props.canSync ? ' Use "Buscar na Stripe" para listar as faturas da Stripe.' : ''}
                </td>
              </tr>
            ) : charges.map((charge) => (
              <tr key={charge.key}>
                <td data-label="Ciclo">
                  <div>{chargeDay(charge)}</div>
                  <div className="muted">
                    {charge.stripe ? `${formatInvoiceStatus(charge.stripe.status)} · ` : ''}
                    {charge.stripe?.number || charge.stripeInvoiceId || 'Fatura não informada'}
                  </div>
                </td>
                <td data-label="Valor">{charge.amount}</td>
                <td data-label="Invoice Eden Bowls">
                  <InvoiceCell charge={charge} canSync={props.canSync} onDownload={props.onDownloadInvoice} onSend={props.onSendInvoice} />
                </td>
                {props.canReadNfe ? <td data-label="NF-e"><NfeCell charge={charge} /></td> : null}
                <td>
                  <div className="inline-actions">
                    {charge.stripeInvoiceId ? (
                      <button className="ghost-button" type="button" onClick={() => props.onOpenStripePdf(charge.stripeInvoiceId as string)}>PDF Stripe</button>
                    ) : null}
                    {!charge.invoice && charge.paid && charge.stripeInvoiceId && props.canSync ? (
                      <button className="ghost-button" type="button" onClick={() => props.onIssueInvoice(charge.stripeInvoiceId as string)}>
                        Gerar invoice
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
