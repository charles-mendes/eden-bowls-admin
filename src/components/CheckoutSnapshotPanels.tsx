import { JsonDetails } from './JsonDetails'
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
    <>
      <Section title="Plano e itens" description="Snapshot do plano escolhido no checkout. Sem recálculo live.">
        <div className="stack">
          <MetaGrid items={snapshots.plan.items} />
          {snapshots.plan.pets.length ? (
            <div className="table-shell table-scroll table-compact">
              <table>
                <thead>
                  <tr>
                    <th>Pet</th>
                    <th>Sabores</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.plan.pets.map((item) => (
                    <tr key={item.petName}>
                      <td>{item.petName}</td>
                      <td>{item.flavors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {snapshots.plan.lineItems.length ? (
            <div className="table-shell table-scroll table-compact">
              <table>
                <thead>
                  <tr>
                    <th>Pet</th>
                    <th>Item</th>
                    <th>Qtd</th>
                    <th>Embalagem</th>
                    <th>Unitário</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.plan.lineItems.map((item, index) => (
                    <tr key={`${item.petName}-${item.product}-${index}`}>
                      <td>{item.petName}</td>
                      <td>{item.product}</td>
                      <td>{item.quantity}</td>
                      <td>{item.packSize}</td>
                      <td>{item.unitPrice}</td>
                      <td>{item.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <MetaGrid items={snapshots.plan.totals} />
        </div>
      </Section>

      <div className="grid cards-2">
        <Section title="Desconto 1ª compra" description="Snapshot do checkout, sem recálculo live.">
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

      <div className="grid cards-2">
        <Section title="Endereço" description="Endereço de entrega gravado no checkout.">
          <div className="stack">
            {snapshots.address.lines.length ? (
              <div className="address-block">
                {snapshots.address.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="muted">Sem endereço no snapshot.</p>
            )}
            <MetaGrid items={snapshots.address.items} />
          </div>
        </Section>

        <Section title="Frete" description="Cotação persistida. Sem recálculo live.">
          <MetaGrid items={snapshots.shipping.items} />
        </Section>
      </div>

      <Section title="JSON técnico" description="Payload persistido, recolhido para conferência.">
        <div className="stack">
          <JsonDetails title="Plano" value={raw.planSelection} />
          <JsonDetails title="Itens" value={raw.lineItems} />
          <JsonDetails title="Checkout" value={raw.checkoutReference} />
          <JsonDetails title="Pagamento" value={raw.paymentReference} />
          <JsonDetails title="Endereço" value={raw.address} />
          <JsonDetails title="Frete" value={raw.shipping} />
          <JsonDetails title="Recorrência" value={raw.recurrence} />
        </div>
      </Section>
    </>
  )
}
