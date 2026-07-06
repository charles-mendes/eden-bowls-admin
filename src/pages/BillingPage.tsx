import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
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
  scope: string
  market?: string
  currency?: string
  productId?: string
  createdAt: string
  updatedAt: string
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
  correlationId: string | null
  createdAt: string
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

type Paginated<T> = {
  total: number
  page: number
  perPage: number
  items: T[]
}

export function BillingPage() {
  const { token } = useAuth()
  const [market, setMarket] = useState('BR')
  const [currency, setCurrency] = useState('BRL')
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [health, setHealth] = useState<SyncHealth | null>(null)
  const [syncProductId, setSyncProductId] = useState('')
  const [syncMessage, setSyncMessage] = useState('')
  const [webhooks, setWebhooks] = useState<Paginated<WebhookItem> | null>(null)
  const [subscriptions, setSubscriptions] = useState<Paginated<SubscriptionItem> | null>(null)
  const [webhookPage, setWebhookPage] = useState(1)
  const [subscriptionPage, setSubscriptionPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [webhookState, setWebhookState] = useState('')
  const [subscriptionStatus, setSubscriptionStatus] = useState('')
  const [error, setError] = useState('')

  const loadData = async () => {
    if (!token) return

    try {
      setError('')
      const [healthResponse, webhooksResponse, subscriptionsResponse] = await Promise.all([
        apiRequest<SyncHealth>(`/billing/catalog/sync/health${buildQueryString({ market, currency })}`, { token }),
        apiRequest<Paginated<WebhookItem>>(`/admin/billing/webhooks${buildQueryString({ page: webhookPage, perPage, state: webhookState || undefined })}`, { token }),
        apiRequest<Paginated<SubscriptionItem>>(`/admin/billing/subscriptions${buildQueryString({ page: subscriptionPage, perPage, status: subscriptionStatus || undefined, market: market || undefined })}`, { token }),
      ])

      setHealth(healthResponse)
      setWebhooks(webhooksResponse)
      setSubscriptions(subscriptionsResponse)

      try {
        const statusResponse = await apiRequest<SyncStatus>('/billing/catalog/sync/status', { token })
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
  }, [token, market, currency, webhookPage, subscriptionPage, perPage, webhookState, subscriptionStatus])

  const submitSync = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return

    try {
      setError('')
      const response = await apiRequest<{ syncJobId: string; status: string }>(`/billing/catalog/sync`, {
        token,
        method: 'POST',
        body: { market, currency },
      })
      setSyncMessage(`Sync iniciado: ${response.syncJobId} (${response.status})`)
      await loadData()
    } catch (requestError) {
      setSyncMessage('')
      setError(requestError instanceof Error ? requestError.message : 'Falha ao iniciar sync')
    }
  }

  const submitProductSync = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !syncProductId) return

    try {
      setError('')
      const response = await apiRequest<{ syncJobId: string; status: string }>(`/billing/catalog/sync/${syncProductId}`, {
        token,
        method: 'POST',
      })
      setSyncMessage(`Sync do produto iniciado: ${response.syncJobId} (${response.status})`)
      await loadData()
    } catch (requestError) {
      setSyncMessage('')
      setError(requestError instanceof Error ? requestError.message : 'Falha ao sincronizar produto')
    }
  }

  return (
    <PageFrame
      title="Billing"
      description="Sincronização de catálogo, eventos Stripe e assinaturas operacionais."
    >
      <div className="grid cards-4">
        <MetricCard label="Health expected" value={health?.totalExpected ?? '—'} />
        <MetricCard label="Health mapped" value={health?.totalMapped ?? '—'} />
        <MetricCard label="Gaps" value={health?.gaps?.length ?? '—'} />
        <MetricCard label="Sync status" value={status?.status ?? '—'} />
      </div>

      <Section title="Sincronização" description="Execute sync geral ou por produto e acompanhe o status atual.">
        <div className="grid cards-2">
          <form className="editor-card" onSubmit={submitSync}>
            <h3>Sync de catálogo</h3>
            <FiltersBar>
              <label>
                Mercado
                <input value={market} onChange={(event) => setMarket(event.target.value.toUpperCase())} />
              </label>
              <label>
                Moeda
                <input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} />
              </label>
            </FiltersBar>
            <button className="primary-button" type="submit">Iniciar sync</button>
          </form>

          <form className="editor-card" onSubmit={submitProductSync}>
            <h3>Sync por produto</h3>
            <label>
              Product ID
              <input value={syncProductId} onChange={(event) => setSyncProductId(event.target.value)} placeholder="UUID do produto" />
            </label>
            <button className="primary-button" type="submit">Sincronizar produto</button>
          </form>
        </div>

        {syncMessage ? <div className="success">{syncMessage}</div> : null}
        {error ? <div className="alert">{error}</div> : null}

        <div className="grid cards-2">
          <article className="stat-card">
            <strong>Sync status</strong>
            <span>{status ? `${status.status} · ${status.scope}` : 'Sem job atual'}</span>
            <div className="muted">{status ? formatDate(status.updatedAt) : '-'}</div>
          </article>
          <article className="stat-card">
            <strong>Health gaps</strong>
            <span>{health?.gaps?.length ? health.gaps.join(', ') : 'Sem gaps detectados'}</span>
            <div className="muted">{health ? `${health.market}/${health.currency}` : '-'}</div>
          </article>
        </div>
      </Section>

      <Section title="Webhooks Stripe" description="Eventos registrados e seu estado operacional.">
        <FiltersBar>
          <label>
            Estado
            <input value={webhookState} onChange={(event) => { setWebhookState(event.target.value); setWebhookPage(1) }} placeholder="processed" />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setWebhookPage(1); setSubscriptionPage(1) }} />
          </label>
        </FiltersBar>

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Tentativas</th>
                <th>Correlation</th>
                <th>Processado em</th>
              </tr>
            </thead>
            <tbody>
              {webhooks?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.eventId}</td>
                  <td>{item.eventType}</td>
                  <td>{item.state}</td>
                  <td>{item.attempts}</td>
                  <td>{item.correlationId ?? '-'}</td>
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

      <Section title="Subscriptions" description="Visão administrativa das assinaturas ativas e recorrentes.">
        <FiltersBar>
          <label>
            Status
            <input value={subscriptionStatus} onChange={(event) => { setSubscriptionStatus(event.target.value); setSubscriptionPage(1) }} placeholder="active" />
          </label>
          <label>
            Mercado
            <input value={market} onChange={(event) => setMarket(event.target.value.toUpperCase())} />
          </label>
        </FiltersBar>

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Termo</th>
                <th>Status</th>
                <th>Auto renew</th>
                <th>Next billing</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions?.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.user.email}</td>
                  <td>{item.term.marketCountry} · {item.term.months}m</td>
                  <td>{item.status}</td>
                  <td>{item.autoRenew ? 'Sim' : 'Não'}</td>
                  <td>{item.nextBillingAt ? formatDate(item.nextBillingAt) : '-'}</td>
                  <td>{formatDate(item.createdAt)}</td>
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
