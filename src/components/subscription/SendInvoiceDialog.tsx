import { Dialog } from '../Dialog'
import type { CustomerInvoice } from '../../lib/customerInvoices'

// Emailing the customer goes through this confirmation, naming the invoice and the address. Cancelling sends nothing.
export function SendInvoiceDialog({ invoice, onCancel, onConfirm }: { invoice: CustomerInvoice | null; onCancel: () => void; onConfirm: (invoice: CustomerInvoice) => void }) {
  const resend = invoice?.email_status === 'sent'
  return (
    <Dialog
      open={Boolean(invoice)}
      title={resend ? 'Reenviar invoice ao cliente?' : 'Enviar invoice ao cliente?'}
      onClose={onCancel}
      footer={invoice ? (
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={onCancel}>Cancelar</button>
          <button className="primary-button" type="button" onClick={() => onConfirm(invoice)}>
            {resend ? 'Reenviar' : 'Enviar'}
          </button>
        </div>
      ) : null}
    >
      {invoice ? (
        <p>
          A invoice <strong>{invoice.invoice_number}</strong> vai por e-mail para <strong>{invoice.email_to || 'o e-mail do cliente'}</strong>, com o PDF anexado.
          {resend ? ' O cliente já recebeu esta invoice antes.' : ''}
        </p>
      ) : null}
    </Dialog>
  )
}
