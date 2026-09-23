import { LedgerSnapshotSections } from './LedgerSnapshotSections'
import { MetaGrid } from './MetaGrid'
import { Section } from './Section'
import {
  discountBadgeClass,
  discountBadgeLabel,
  paymentBadgeClass,
  type CheckoutSnapshots,
} from '../lib/checkoutSnapshot'
import { formatPaymentState } from '../lib/format'

export function CheckoutSnapshotPanels({
  snapshots,
  raw,
}: {
  snapshots: CheckoutSnapshots
  raw: {
    planSelection?: unknown
    address?: unknown
    shipping?: unknown
    lineItems?: unknown
    checkoutReference?: unknown
    paymentReference?: unknown
    recurrence?: unknown
  }
}) {
  return (
    <LedgerSnapshotSections snapshots={snapshots} raw={raw}>
      <div className="grid cards-2">
        <Section title="Desconto 1ª compra" description="Cópia gravada no checkout, sem recalcular.">
          <div className="stack">
            <span className={discountBadgeClass(snapshots.discount.eligible)}>{discountBadgeLabel(snapshots.discount.eligible)}</span>
            <MetaGrid items={snapshots.discount.items} />
          </div>
        </Section>

        <Section title="Pagamento" description="Totais e IDs persistidos no checkout.">
          <div className="stack">
            {snapshots.payment.paymentState ? (
              <span className={paymentBadgeClass(snapshots.payment.paymentState)}>
                {formatPaymentState(snapshots.payment.paymentState)}
              </span>
            ) : null}
            <MetaGrid items={snapshots.payment.items} />
          </div>
        </Section>
      </div>
    </LedgerSnapshotSections>
  )
}
