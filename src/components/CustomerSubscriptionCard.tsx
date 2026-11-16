import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { COURIER_STATUS, courierHref, productionLabel } from '../lib/courierDeliveries'
import {
  alertPresentation,
  courierMoment,
  courierTabFor,
  formatCalendarDay,
  formatCheckoutShipping,
  formatContract,
  formatPaymentMethod,
  formatSubscriptionPets,
  subscriptionBadgeClass,
  type CustomerSubscription,
  type LatestCycle,
} from '../lib/customerSubscriptions'
import { formatDate, formatStripeStatus } from '../lib/format'
import { MARKET_LABELS, type MarketCode } from '../lib/markets'
import { NFE_EMAIL_LABELS, nfeStatusLabel, nfeStatusTone } from '../lib/nfe'
import { productionQueueHref } from '../lib/productionQueue'
import { UPS_SHIPMENT_STATUS } from '../lib/upsLabels'

function productionBadgeClass(status: string | null) {
  if (status === 'ready') return 'badge-success'
  if (status === 'blocked') return 'badge-warning'
  return 'badge-info'
}

function marketLabel(stripeAccount: string | undefined) {
  const code = String(stripeAccount || '').toUpperCase() as MarketCode
  return MARKET_LABELS[code] ?? (stripeAccount ? stripeAccount.toUpperCase() : '-')
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="meta-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function CustomerSubscriptionCard({ item }: { item: CustomerSubscription }) {
  const market = String(item.stripeAccount || '').toLowerCase()

  return (
    <li className="subscription-card" aria-label={`Assinatura ${item.stripeSubscriptionId}`}>
      <div className="subscription-card-head">
        <Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.stripeSubscriptionId}</Link>
        <span className={subscriptionBadgeClass(item.status)}>{formatStripeStatus(item.status)}</span>
        <span className="muted">{item.planLabel ?? '-'} · {marketLabel(item.stripeAccount)}</span>
        {item.alerts?.length ? (
          <ul className="subscription-card-alerts" aria-label="Alertas">
            {item.alerts.map((alert) => {
              const view = alertPresentation(alert, item)
              return (
                <li key={alert.code}>
                  {view.href
                    ? <Link className={view.badge} to={view.href} title={view.title}>{view.text}</Link>
                    : <span className={view.badge} title={view.title}>{view.text}</span>}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      <dl className="meta-grid">
        <Item label="Início">{formatDate(item.createdAt ?? null)}</Item>
        <Item label="Fim do período">{formatDate(item.currentPeriodEnd)}</Item>
        <Item label="Cancelando">{item.cancelAtPeriodEnd ? 'Sim' : 'Não'}</Item>
        <Item label="Contrato">{formatContract(item)}</Item>
        {item.pets !== undefined ? <Item label="Pets">{formatSubscriptionPets(item.pets)}</Item> : null}
        {item.paymentMethod !== undefined ? <Item label="Pagamento">{formatPaymentMethod(item.paymentMethod)}</Item> : null}
        {item.checkoutShipping !== undefined ? <Item label="Frete do checkout">{formatCheckoutShipping(item.checkoutShipping)}</Item> : null}
      </dl>

      {item.latestCycleUnavailable ? (
        <p className="warning">Não foi possível carregar o último ciclo agora. Abra a assinatura para ver produção, entrega e NF-e.</p>
      ) : item.latestCycle !== undefined ? (
        <section className="subscription-card-cycle" aria-label="Último ciclo">
          <h4>Último ciclo</h4>
          {item.latestCycle === null
            ? <p className="empty-note">Nenhum ciclo pago.</p>
            : <LatestCycleGrid cycle={item.latestCycle} subscription={item} market={market} />}
        </section>
      ) : null}
    </li>
  )
}

function LatestCycleGrid({ cycle, subscription, market }: { cycle: LatestCycle; subscription: CustomerSubscription; market: string }) {
  const { delivery, nfe, production } = cycle

  return (
    <dl className="meta-grid">
      <Item label="Pago em">{formatDate(cycle.paidAt)}</Item>
      <Item label="Fatura"><InvoicePdf invoiceId={cycle.invoiceId} subscription={subscription} /></Item>
      <Item label="Preparo">{formatCalendarDay(cycle.preparationDay)}</Item>
      <Item label="Entrega prevista">{formatCalendarDay(cycle.deliveryDate)}</Item>

      {production !== undefined ? (
        <Item label="Produção">
          <Link
            className="table-link"
            to={productionQueueHref({ busca: subscription.stripeSubscriptionId, mercado: market === 'us' ? 'us' : market === 'br' ? 'br' : undefined })}
          >
            <span className={productionBadgeClass(production.status)}>{productionLabel(production.status)}</span>
          </Link>
          {production.note ? <span className="muted"> {production.note}</span> : null}
        </Item>
      ) : null}

      {delivery !== undefined ? (
        <Item label="Entrega">
          {delivery === null ? 'Não despachado' : delivery.kind === 'courier' ? (
            <>
              <Link className="table-link" to={courierHref(courierTabFor(delivery.status))}>
                <span className={COURIER_STATUS[delivery.status]?.badge ?? 'badge-info'}>{COURIER_STATUS[delivery.status]?.label ?? delivery.status}</span>
              </Link>
              <span className="muted"> {formatDate(courierMoment(delivery))}</span>
            </>
          ) : (
            <>
              <Link className="table-link" to={`/billing/subscriptions/${subscription.id}#envio-ups`}>
                <span className={UPS_SHIPMENT_STATUS[delivery.status]?.badge ?? 'badge-info'}>UPS · {UPS_SHIPMENT_STATUS[delivery.status]?.label ?? delivery.status}</span>
              </Link>
              {delivery.trackingNumber ? <span className="muted"> {delivery.trackingNumber}</span> : null}
            </>
          )}
        </Item>
      ) : null}

      {nfe !== undefined ? (
        <Item label="NF-e">
          {nfe === null ? 'Sem NF-e' : (
            <>
              <Link className="table-link" to={`/operations/nfe/${nfe.id}`}>{nfe.number ? `NF-e ${nfe.number}` : `Nota ${nfe.id}`}</Link>{' '}
              <span className={nfeStatusTone(nfe.status)}>{nfeStatusLabel(nfe.status)}</span>
              {nfe.lastError ? <span className="subscription-card-error">{nfe.lastError}</span> : null}
              {nfe.emailStatus ? <span className="muted"> E-mail: {NFE_EMAIL_LABELS[nfe.emailStatus] ?? nfe.emailStatus}</span> : null}
            </>
          )}
        </Item>
      ) : null}
    </dl>
  )
}

// The paid invoice of the cycle: its id, and the Stripe PDF for who reads billing (same route as the subscription
// detail). The API asks Stripe for the link, so it opens on click and never on page load.
function InvoicePdf({ invoiceId, subscription }: { invoiceId: string; subscription: CustomerSubscription }) {
  const { token, hasPermission } = useAuth()
  const [failed, setFailed] = useState(false)
  const canOpen = hasPermission('billing.subscribers.read')

  const open = async () => {
    if (!token) return
    setFailed(false)
    try {
      // The account tells the API which Stripe holds the invoice; without it an admin of both markets gets 404.
      const account = subscription.stripeAccount ? `?account=${encodeURIComponent(subscription.stripeAccount)}` : ''
      const response = await apiRequest<{ url: string }>(`/admin/billing/invoices/${encodeURIComponent(invoiceId)}/pdf${account}`, { token })
      if (response.url) window.open(response.url, '_blank', 'noopener,noreferrer')
    } catch {
      setFailed(true)
    }
  }

  return (
    <>
      <Link className="table-link" to={`/billing/subscriptions/${subscription.id}#faturas-stripe`}>{invoiceId}</Link>
      {canOpen ? <> <button className="ghost-button" type="button" onClick={() => void open()}>PDF Stripe</button></> : null}
      {failed ? <span className="subscription-card-error">Não foi possível abrir o PDF agora.</span> : null}
    </>
  )
}
