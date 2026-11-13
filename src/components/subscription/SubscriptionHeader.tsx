import { Link } from 'react-router-dom'
import { formatStripeStatus } from '../../lib/format'
import { subscriptionBadgeClass } from '../../lib/customerSubscriptions'
import { formatDayOf, type SubscriptionDetail } from './types'

// Under the title: the email when the title is a name, the state, the renewal or the end as a day, the plan.
export function SubscriptionHeaderLine({ data, plan }: { data: SubscriptionDetail; plan: string }) {
  const named = Boolean(data.account_name?.trim())
  const day = formatDayOf(data.currentPeriodEnd)
  return (
    <span className="subscription-header-line">
      <span className="subscription-header-facts">
        {named ? <span>{data.user.email}</span> : null}
        <span className={subscriptionBadgeClass(data.status)}>{formatStripeStatus(data.status)}</span>
        {data.currentPeriodEnd ? <span>{data.cancelAtPeriodEnd ? `termina em ${day}` : `renova em ${day}`}</span> : null}
        <span>Conta <span className="badge-info">{(data.stripeAccount || 'us').toUpperCase()}</span></span>
      </span>
      <span className="subscription-header-plan">{plan}</span>
      <span>Pausa e cancelamento são feitos pelo cliente na loja.</span>
      <span className="muted subscription-header-ids">
        {data.stripeSubscriptionId}{data.stripePriceId ? ` · ${data.stripePriceId}` : ''}
      </span>
    </span>
  )
}

// Where the operator goes from here. The account links only for a profile in the operator's market.
export function SubscriptionHeaderActions({ data, profileInScope }: { data: SubscriptionDetail; profileInScope: boolean }) {
  return (
    <div className="inline-actions">
      {data.dashboardUrl ? <a className="ghost-button" href={data.dashboardUrl} target="_blank" rel="noreferrer">Ver no Stripe</a> : null}
      {profileInScope && data.user.id ? (
        <>
          <Link className="ghost-button" to={`/users/${data.user.id}`}>Abrir cadastro</Link>
          <Link className="ghost-button" to={`/users/${data.user.id}?aba=checkout&assinatura=${data.id}`}>Ver checkout</Link>
        </>
      ) : (
        <span className="muted">Cadastro e checkout fora do seu mercado</span>
      )}
    </div>
  )
}
