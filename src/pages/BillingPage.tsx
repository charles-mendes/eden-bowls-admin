import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { AccountSelect } from '../components/MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatStripeStatus } from '../lib/format'
import { defaultMarket, defaultStripeAccount, hasBothMarkets } from '../lib/markets'

type SubscriptionItem = {
  id: string
  providerSubscriptionId: string
  status: string
  autoRenew: boolean
  nextBillingAt: string | null
  createdAt: string
  user: { id: string; email: string }
  term: { marketCountry: string; months: number }
  stripeAccount?: string
}

type BillingMetrics = {
  total: number
  active: number
  canceling: number
  pastDue: number
  canceled30d: number
  renewing7d: number
}

type Paginated<T> = {
  total: number
  page: number
  perPage: number
  items: T[]
}

export function BillingPage() {
  const { token, user, hasPermission } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null)
  const [subscriptions, setSubscriptions] = useState<Paginated<SubscriptionItem> | null>(null)
  const [subscriptionPage, setSubscriptionPage] = useState(1)
  const perPage = 20
  const [subscriptionStatus, setSubscriptionStatus] = useState('active')
  const [pickedAccount, setPickedAccount] = useState('all')
  const [search, setSearch] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState('')
  // A two-market admin filters by account; a one-market operator stays in their market.
  const market = bothMarkets ? '' : (defaultMarket(user) ?? '')
  const account = bothMarkets ? pickedAccount : (defaultStripeAccount(user) ?? '')

  const loadData = async () => {
    if (!token || !user) return

    try {
      setError('')
      const [subscriptionsResponse, metricsResponse] = await Promise.all([
        apiRequest<Paginated<SubscriptionItem>>(`/admin/billing/subscriptions${buildQueryString({ page: subscriptionPage, perPage, status: subscriptionStatus || 'active', q: search || undefined, market: market || undefined, account: account === 'all' ? undefined : account })}`, { token }),
        apiRequest<BillingMetrics>('/admin/billing/metrics', { token }),
      ])

      setSubscriptions(subscriptionsResponse)
      setMetrics(metricsResponse)

    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar assinantes')
    }
  }

  useEffect(() => {
    void loadData()
  }, [token, user, market, subscriptionPage, perPage, subscriptionStatus, search, account])

  const reconcile = async () => {
    if (!token) return
    try {
      await apiRequest('/admin/billing/subscriptions/reconcile', { token, method: 'POST' })
      setSyncMessage('Reconciliação disparada.')
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao reconciliar')
    }
  }

  const backfill = async () => {
    if (!token) return
    try {
      const response = await apiRequest<{ success: boolean; data: { linked: number } }>('/admin/billing/subscriptions/backfill-links', { token, method: 'POST' })
      setSyncMessage(`Vinculados: ${response.data?.linked ?? 0}`)
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao vincular')
    }
  }

  return (
    <PageFrame title="Assinantes" description="Assinaturas da loja, vindas da Stripe. Pausa e cancelamento são feitos pelo cliente na loja.">
      <div className="grid cards-4">
        <MetricCard label="Ativas" value={metrics?.active ?? '—'} />
        <MetricCard label="Cancelando" value={metrics?.canceling ?? '—'} />
        <MetricCard label="Em atraso" value={metrics?.pastDue ?? '—'} />
        <MetricCard label="Renovação 7d" value={metrics?.renewing7d ?? '—'} />
      </div>

      {syncMessage ? <div className="success">{syncMessage}</div> : null}
      {error ? <div className="alert">{error}</div> : null}

      <Section title="Assinaturas" description="Começa mostrando as ativas.">
        <FiltersBar>
          <label>
            Status
            <select value={subscriptionStatus} onChange={(event) => { setSubscriptionStatus(event.target.value); setSubscriptionPage(1) }}>
              <option value="active">{formatStripeStatus('active')}</option>
              <option value="trialing">{formatStripeStatus('trialing')}</option>
              <option value="past_due">{formatStripeStatus('past_due')}</option>
              <option value="canceled">{formatStripeStatus('canceled')}</option>
              <option value="canceling">{formatStripeStatus('canceling')}</option>
              <option value="all">{formatStripeStatus('all')}</option>
            </select>
          </label>
          <AccountSelect
            user={user}
            includeAll
            value={account || 'all'}
            onChange={(value) => { setPickedAccount(value); setSubscriptionPage(1) }}
          />
          <label>
            Busca
            <input value={search} onChange={(event) => { setSearch(event.target.value); setSubscriptionPage(1) }} placeholder="e-mail do cliente ou sub_…" />
          </label>
        </FiltersBar>
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={() => { setSubscriptionStatus('active'); setPickedAccount(bothMarkets ? 'all' : (defaultStripeAccount(user) ?? '')); setSearch(''); setSubscriptionPage(1) }}>Limpar filtros</button>
        </div>

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Assinatura</th>
                <th>Conta</th>
                <th>Termo</th>
                <th>Status</th>
                <th>Renovação automática</th>
                <th>Próxima cobrança</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.items.map((item) => (
                <tr key={item.id}>
                  <td><Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.user.email}</Link></td>
                  <td><Link className="muted" to={`/billing/subscriptions/${item.id}`}>{item.providerSubscriptionId}</Link></td>
                  <td><span className="badge-info">{(item.stripeAccount || 'us').toUpperCase()}</span></td>
                  <td>{item.term.marketCountry} · {item.term.months} {item.term.months === 1 ? 'mês' : 'meses'}</td>
                  <td>{formatStripeStatus(item.status)}</td>
                  <td>{item.autoRenew ? 'Sim' : 'Não'}</td>
                  <td>{item.nextBillingAt ? formatDate(item.nextBillingAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={subscriptions?.page ?? subscriptionPage}
          totalPages={Math.max(1, Math.ceil((subscriptions?.total ?? 0) / (subscriptions?.perPage ?? perPage)))}
          onPrev={() => setSubscriptionPage((current) => Math.max(1, current - 1))}
          onNext={() => setSubscriptionPage((current) => current + 1)}
        />
      </Section>

      {hasPermission('billing.subscribers.sync') ? (
        <details className="maintenance-panel">
          <summary>Manutenção da Stripe</summary>
          <p className="muted">Use quando uma assinatura da Stripe não aparece aqui ou aparece sem o cliente.</p>
          <div className="inline-actions">
            <button className="ghost-button" type="button" onClick={() => void reconcile()}>Sincronizar agora</button>
            <button className="ghost-button" type="button" onClick={() => void backfill()}>Vincular ao usuário</button>
          </div>
        </details>
      ) : null}
    </PageFrame>
  )
}
