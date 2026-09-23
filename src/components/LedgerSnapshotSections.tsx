import type { ReactNode } from 'react'
import { JsonDetails } from './JsonDetails'
import { MetaGrid } from './MetaGrid'
import { Section } from './Section'
import type { CheckoutSnapshots } from '../lib/checkoutSnapshot'

const DEFAULT_PLAN_TITLE = 'Plano e itens'
const DEFAULT_PLAN_DESCRIPTION = 'Cópia do plano escolhido no checkout. Sem recalcular.'

export function LedgerSnapshotSections({
  snapshots,
  raw,
  planTitle = DEFAULT_PLAN_TITLE,
  planDescription = DEFAULT_PLAN_DESCRIPTION,
  children,
}: {
  snapshots: Pick<CheckoutSnapshots, 'plan' | 'address' | 'shipping'>
  raw: {
    petsSnapshot?: unknown
    planSelection?: unknown
    address?: unknown
    shipping?: unknown
    lineItems?: unknown
    checkoutReference?: unknown
    paymentReference?: unknown
    recurrence?: unknown
  }
  planTitle?: string
  planDescription?: string
  children?: ReactNode
}) {
  return (
    <>
      <Section title={planTitle} description={planDescription}>
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
                  {snapshots.plan.pets.map((item, index) => (
                    <tr key={`${item.petName}-${index}`}>
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

      {children}

      <div className="grid cards-2">
        <Section title="Endereço" description="Endereço de entrega gravado no checkout, sem recalcular.">
          <div className="stack">
            {snapshots.address.lines.length ? (
              <div className="address-block">
                {snapshots.address.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            ) : (
              <p className="muted">Sem endereço na cópia gravada.</p>
            )}
            <MetaGrid items={snapshots.address.items} />
          </div>
        </Section>

        <Section title="Frete" description="Cotação gravada. Sem recalcular.">
          <MetaGrid items={snapshots.shipping.items} />
        </Section>
      </div>

      <Section title="JSON técnico" description="Dados gravados, recolhidos para conferência.">
        <div className="stack">
          <JsonDetails title="Pets" value={raw.petsSnapshot} />
          <JsonDetails title="Plano" value={raw.planSelection} />
          <JsonDetails title="Itens" value={raw.lineItems} />
          <JsonDetails title="Checkout" value={raw.checkoutReference} />
          <JsonDetails title="Pagamento" value={raw.paymentReference} />
          <JsonDetails title="Endereço" value={raw.address} />
          <JsonDetails title="Frete" value={raw.shipping} />
          <JsonDetails title="JSON de recorrência" value={raw.recurrence} />
        </div>
      </Section>
    </>
  )
}
