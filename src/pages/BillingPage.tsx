import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { AccountSelect, MarketSelect } from '../components/MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatStripeStatus, formatSyncJobStatus } from '../lib/format'
import { currencyForMarket, defaultMarket, defaultStripeAccount, hasBothMarkets } from '../lib/markets'

type SyncStatus = {
  syncJobId: string
  status: string
  scope?: string
  summary?: { scope?: string; created?: number; updated?: number }
}

type SyncHealth = {
  market: string
  currency: string
  totalExpected: number
  totalMapped: number
  gaps: string[]
}

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
  const [pickedMarket, setPickedMarket] = useState('')
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [health, setHealth] = useState<SyncHealth | null>(null)
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null)
  const [subscriptions, setSubscriptions] = useState<Paginated<SubscriptionItem> | null>(null)
  const [subscriptionPage, setSubscriptionPage] = useState(1)
  const perPage = 20
  const [subscriptionStatus, setSubscriptionStatus] = useState('active')
  const [pickedAccount, setPickedAccount] = useState('all')
  const [search, setSearch] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState('')
  const market = bothMarkets ? (pickedMarket || defaultMarket(user) || '') : (defaultMarket(user) ?? '')
  const currency = market === 'BR' || market === 'US' ? currencyForMarket(market) : ''
  const account = bothMarkets ? pickedAccount : (defaultStripeAccount(user) ?? '')

  const loadData = async () => {
    if (!token || !user) return

    try {
      setError('')
      const [healthResponse, subscriptionsResponse, metricsResponse] = await Promise.all([
        apiRequest<SyncHealth>(`/admin/catalog/sync/health${buildQueryString({ market, currency })}`, { token }),
        apiRequest<Paginated<SubscriptionItem>>(`/admin/billing/subscriptions${buildQueryString({ page: subscriptionPage, perPage, status: subscriptionStatus || 'active', q: search || undefined, market: market || undefined, account: account === 'all' ? undefined : account })}`, { token }),
        apiRequest<BillingMetrics>('/admin/billing/metrics', { token }),
      ])

      setHealth(healthResponse)
      setSubscriptions(subscriptionsResponse)
      setMetrics(metricsResponse)

      try {
        const statusResponse = await apiRequest<SyncStatus>('/admin/catalog/sync/status', { token })
        setStatus(statusResponse)
      } catch {
        setStatus(null)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar assinantes')
    }
  }

  useEffect(() => {
    void loadData()
  }, [token, user, market, currency, subscriptionPage, perPage, subscriptionStatus, search, account])

  const submitSync = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    try {
      const response = await apiRequest<SyncStatus>('/admin/catalog/sync', {
        token,
        method: 'POST',
        body: { market, currency },
      })
      setSyncMessage(`Sincronização: ${formatSyncJobStatus(response.status)}`)
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao iniciar a sincronização')
    }
  }

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
    <PageFrame title="Assinantes" description="Registro local da Stripe. Pausa e cancelamento não são feitos nesta tela.">
      <div className="grid cards-4">
        <MetricCard label="Ativas" value={metrics?.active ?? '—'} />
        <MetricCard label="Cancelando" value={metrics?.canceling ?? '—'} />
        <MetricCard label="Em atraso" value={metrics?.pastDue ?? '—'} />
        <MetricCard label="Renovação 7d" value={metrics?.renewing7d ?? '—'} />
      </div>

      <Section title="Catálogo Stripe" description="Saúde do catálogo e sincronização de preços.">
        <form className="inline-actions" onSubmit={submitSync}>
          <MarketSelect
            user={user}
            value={market}
            onChange={setPickedMarket}
          />
          <span className="muted">{currency || '—'}</span>
          {hasPermission('catalog.sync') ? <button className="primary-button" type="submit">Sincronizar catálogo</button> : null}
        </form>
        <p className="muted">Mapeados {health?.totalMapped ?? 0}/{health?.totalExpected ?? 0} · {formatSyncJobStatus(status?.status)}</p>
        {syncMessage ? <div className="success">{syncMessage}</div> : null}
        {error ? <div className="alert">{error}</div> : null}
      </Section>

      <Section title="Assinaturas" description="O filtro começa em Ativas. Limpar filtros volta para Ativas.">
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
            <input value={search} onChange={(event) => { setSearch(event.target.value); setSubscriptionPage(1) }} placeholder="sub_, cus_, email, userId" />
          </label>
        </FiltersBar>
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={() => { setSubscriptionStatus('active'); setPickedAccount(bothMarkets ? 'all' : (defaultStripeAccount(user) ?? '')); setSearch(''); setSubscriptionPage(1) }}>Limpar filtros</button>
          {hasPermission('billing.subscribers.sync') ? (
            <>
              <button className="ghost-button" type="button" onClick={() => void backfill()}>Vincular ao usuário</button>
              <button className="ghost-button" type="button" onClick={() => void reconcile()}>Sincronizar agora</button>
            </>
          ) : null}
        </div>

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
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
                  <td>{item.user.email}</td>
                  <td><Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.providerSubscriptionId}</Link></td>
                  <td><span className="badge-info">{(item.stripeAccount || 'us').toUpperCase()}</span></td>
                  <td>{item.term.marketCountry} · {item.term.months}m</td>
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
    </PageFrame>
  )
}
