import { Link } from 'react-router-dom'
import { CheckoutSnapshotPanels } from './CheckoutSnapshotPanels'
import { LedgerSnapshotSections } from './LedgerSnapshotSections'
import { mergeReadablePets, parseCheckoutSnapshots } from '../lib/checkoutSnapshot'
import { subscriptionBadgeClass } from '../lib/customerSubscriptions'
import { formatDate, formatStripeStatus } from '../lib/format'

// checkout-history: one entry per subscription (backend admin-onboarding getByUserId `checkouts`).
export type CheckoutHistoryEntry = {
  subscriptionId: string
  stripeSubscriptionId: string
  status: string
  planLabel: string | null
  createdAt: string | null
  completeness: 'complete' | 'partial'
  source: 'checkout' | 'backfill' | 'ledger'
  capturedAt: string | null
  planSelection: unknown
  petsSnapshot: unknown
  address: unknown
  shipping: unknown
  recurrence: unknown
  subscriptionTermMonths: number | null
  lineItems: unknown[]
  discount: { promotionCodeId?: string | null; percent?: number | null; duration?: string | null; amountPaid?: number | null; eligibilityReason?: string | null } | null
  checkoutReference: unknown
}

function readableSnapshots(entry: CheckoutHistoryEntry) {
  const snapshots = parseCheckoutSnapshots({
    recurrence: entry.recurrence,
    planSelection: entry.planSelection,
    address: entry.address,
    shipping: entry.shipping,
    discount: entry.discount ?? undefined,
    lineItems: entry.lineItems,
    checkoutReference: entry.checkoutReference,
  })
  return {
    ...snapshots,
    plan: { ...snapshots.plan, pets: mergeReadablePets(entry.planSelection, entry.petsSnapshot) },
  }
}

function CheckoutHistoryItem({ entry, open }: { entry: CheckoutHistoryEntry; open: boolean }) {
  const complete = entry.completeness === 'complete'
  const snapshots = readableSnapshots(entry)
  const raw = {
    petsSnapshot: entry.petsSnapshot,
    planSelection: entry.planSelection,
    address: entry.address,
    shipping: entry.shipping,
    lineItems: entry.lineItems,
    checkoutReference: entry.checkoutReference,
    recurrence: entry.recurrence,
  }

  return (
    <details className="checkout-history-item" open={open}>
      <summary>
        <strong>{entry.planLabel || 'Assinatura'}</strong>
        <span className={subscriptionBadgeClass(entry.status)}>{formatStripeStatus(entry.status)}</span>
        <span className={complete ? 'badge-success' : 'badge-warning'}>{complete ? 'Completo' : 'Parcial'}</span>
        <span className="muted checkout-history-date">Compra em {formatDate(entry.createdAt)}</span>
      </summary>
      <div className="stack checkout-history-body">
        <p className="muted checkout-updated">
          <Link className="table-link" to={`/billing/subscriptions/${entry.subscriptionId}`}>{entry.stripeSubscriptionId}</Link>
          {' · '}
          {complete
            ? (entry.source === 'backfill'
              ? 'Recuperado do último checkout gravado. Edições e webhooks não alteram este registro.'
              : `Gravado no checkout em ${formatDate(entry.capturedAt)}. Edições e webhooks não alteram este registro.`)
            : 'Registro parcial: compra anterior ao histórico de checkout. Mostra o que a assinatura guarda hoje e pode refletir edições posteriores; desconto, pagamento e recorrência não foram guardados.'}
        </p>
        {complete
          ? <CheckoutSnapshotPanels snapshots={snapshots} raw={raw} />
          : <LedgerSnapshotSections planDescription="Cópia atual da assinatura, não necessariamente a do checkout." snapshots={snapshots} raw={raw} />}
      </div>
    </details>
  )
}

export function CheckoutHistory({ entries }: { entries: CheckoutHistoryEntry[] }) {
  return (
    <div className="stack checkout-history">
      <p className="muted checkout-updated">
        {entries.length === 1 ? '1 checkout' : `${entries.length} checkouts`}, um por assinatura, da compra mais recente para a mais antiga.
      </p>
      {entries.map((entry, index) => (
        <CheckoutHistoryItem key={entry.subscriptionId} entry={entry} open={index === 0} />
      ))}
    </div>
  )
}
