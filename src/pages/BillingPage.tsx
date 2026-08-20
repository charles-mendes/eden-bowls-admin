import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'

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

type WebhookItem = {
  id: string
  eventId: string
  eventType: string
  state: string
  attempts: number
  processedAt: string | null
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
  const { token, hasPermission } = useAuth()
  const [market, setMarket] = useState('BR')
  const [currency, setCurrency] = useState('BRL')
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [health, setHealth] = useState<SyncHealth | null>(null)
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null)
  const [webhooks, setWebhooks] = useState<Paginated<WebhookItem> | null>(null)
  const [subscriptions, setSubscriptions] = useState<Paginated<SubscriptionItem> | null>(null)
  const [webhookPage, setWebhookPage] = useState(1)
  const [subscriptionPage, setSubscriptionPage] = useState(1)
  const perPage = 20
  const [subscriptionStatus, setSubscriptionStatus] = useState('active')
  const [search, setSearch] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    if (!token) return

    try {
      setError('')
      const [healthResponse, webhooksResponse, subscriptionsResponse, metricsResponse] = await Promise.all([
        apiRequest<SyncHealth>(`/admin/catalog/sync/health${buildQueryString({ market, currency })}`, { token }),
        apiRequest<Paginated<WebhookItem>>(`/admin/billing/webhooks${buildQueryString({ page: webhookPage, perPage })}`, { token }),
        apiRequest<Paginated<SubscriptionItem>>(`/admin/billing/subscriptions${buildQueryString({ page: subscriptionPage, perPage, status: subscriptionStatus || 'active', q: search || undefined, market: market || undefined })}`, { token }),
        apiRequest<BillingMetrics>('/admin/billing/metrics', { token }),
      ])

      setHealth(healthResponse)
      setWebhooks(webhooksResponse)
      setSubscriptions(subscriptionsResponse)
      setMetrics(metricsResponse)

      try {
        const statusResponse = await apiRequest<SyncStatus>('/admin/catalog/sync/status', { token })
        setStatus(statusResponse)
      } catch {
        setStatus(null)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar billing')
    }
  }

  useEffect(() => {
    void loadData()
  }, [token, market, currency, webhookPage, subscriptionPage, perPage, subscriptionStatus, search])

  const submitSync = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    try {
      const response = await apiRequest<SyncStatus>('/admin/catalog/sync', {
        token,
        method: 'POST',
        body: { market, currency },
      })
      setSyncMessage(`Sync: ${response.status}`)
      await loadData()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao iniciar sync')
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
      setError(requestError instanceof Error ? requestError.message : 'Falha no backfill')
    }
  }

  return (
    <PageFrame title="Assinantes" description="Ledger local Stripe. Sem pause/cancel por esta tela.">
      <div className="grid cards-4">
        <MetricCard label="Ativas" value={metrics?.active ?? '—'} />
        <MetricCard label="Cancelando" value={metrics?.canceling ?? '—'} />
        <MetricCard label="Em atraso" value={metrics?.pastDue ?? '—'} />
        <MetricCard label="Renovação 7d" value={metrics?.renewing7d ?? '—'} />
      </div>

      <Section title="Catálogo Stripe" description="Health e sync de preços.">
        <form className="inline-actions" onSubmit={submitSync}>
          <input value={market} onChange={(event) => setMarket(event.target.value.toUpperCase())} />
          <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
          {hasPermission('catalog.sync') ? <button className="primary-button" type="submit">Sync catálogo</button> : null}
        </form>
        <p className="muted">Mapped {health?.totalMapped ?? 0}/{health?.totalExpected ?? 0} · {status?.status ?? 'sem job'}</p>
        {syncMessage ? <div className="success">{syncMessage}</div> : null}
        {error ? <div className="alert">{error}</div> : null}
      </Section>

      <Section title="Assinaturas" description="Default status=active. Limpar filtros volta para active.">
        <FiltersBar>
          <label>
            Status
            <select value={subscriptionStatus} onChange={(event) => { setSubscriptionStatus(event.target.value); setSubscriptionPage(1) }}>
              <option value="active">active</option>
              <option value="trialing">trialing</option>
              <option value="past_due">past_due</option>
              <option value="canceled">canceled</option>
              <option value="canceling">canceling</option>
              <option value="all">all</option>
            </select>
          </label>
          <label>
            Busca
            <input value={search} onChange={(event) => { setSearch(event.target.value); setSubscriptionPage(1) }} placeholder="sub_, cus_, email, userId" />
          </label>
        </FiltersBar>
        <div className="inline-actions">
          <button className="ghost-button" type="button" onClick={() => { setSubscriptionStatus('active'); setSearch(''); setSubscriptionPage(1) }}>Limpar filtros</button>
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
                <th>Subscription</th>
                <th>Termo</th>
                <th>Status</th>
                <th>Auto renew</th>
                <th>Next billing</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.user.email}</td>
                  <td><Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.providerSubscriptionId}</Link></td>
                  <td>{item.term.marketCountry} · {item.term.months}m</td>
                  <td>{item.status}</td>
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

      <Section title="Webhooks Stripe" description="Inbox local (event_id, type, processed_at). Replay é backlog.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Processado em</th>
              </tr>
            </thead>
            <tbody>
              {webhooks?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.eventId}</td>
                  <td>{item.eventType}</td>
                  <td>{item.state}</td>
                  <td>{item.processedAt ? formatDate(item.processedAt) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={webhooks?.page ?? webhookPage}
          totalPages={Math.max(1, Math.ceil((webhooks?.total ?? 0) / (webhooks?.perPage ?? perPage)))}
          onPrev={() => setWebhookPage((current) => Math.max(1, current - 1))}
          onNext={() => setWebhookPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
