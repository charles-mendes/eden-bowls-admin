import { useEffect, useState, type FormEvent } from 'react'
import { MarketSelect } from './MarketSelect'
import { Section } from './Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatSyncJobStatus } from '../lib/format'
import { currencyForMarket, defaultMarket, hasBothMarkets } from '../lib/markets'

type SyncStatus = { syncJobId: string; status: string }

type SyncHealth = {
  market: string
  currency: string
  totalExpected: number
  totalMapped: number
  gaps: string[]
}

// Every sellable variation needs a Stripe price before the checkout can charge it.
export function CatalogPricesSection() {
  const { token, user, hasPermission } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const [pickedMarket, setPickedMarket] = useState('')
  const [health, setHealth] = useState<SyncHealth | null>(null)
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  const market = bothMarkets ? (pickedMarket || defaultMarket(user) || '') : (defaultMarket(user) ?? '')
  const currency = market === 'BR' || market === 'US' ? currencyForMarket(market) : ''

  useEffect(() => {
    if (!token || !user) return
    let cancelled = false
    const run = async () => {
      try {
        const response = await apiRequest<SyncHealth>(`/admin/catalog/sync/health${buildQueryString({ market, currency })}`, { token })
        if (!cancelled) setHealth(response)
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Falha ao consultar os preços')
      }
      try {
        const response = await apiRequest<SyncStatus>('/admin/catalog/sync/status', { token })
        if (!cancelled) setStatus(response)
      } catch {
        if (!cancelled) setStatus(null)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token, user, market, currency, reload])

  const sync = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<SyncStatus>('/admin/catalog/sync', { token, method: 'POST', body: { market, currency } })
      setMessage(`Sincronização: ${formatSyncJobStatus(response.status)}`)
      setReload((value) => value + 1)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao iniciar a sincronização')
    }
  }

  const gaps = health?.gaps.length ?? 0
  const complete = Boolean(health && health.totalExpected > 0 && gaps === 0)

  return (
    <Section title="Preços na Stripe" description="Cada variação à venda precisa de um preço na Stripe para o checkout cobrar.">
      <form className="inline-actions" onSubmit={sync}>
        <MarketSelect label="Mercado dos preços" user={user} value={market} onChange={setPickedMarket} />
        <span className={complete ? 'badge-success' : gaps > 0 ? 'badge-warning' : 'badge-info'}>
          {health ? `${health.totalMapped}/${health.totalExpected} com preço${currency ? ` em ${currency}` : ''}` : 'Consultando…'}
        </span>
        <span className="muted">{formatSyncJobStatus(status?.status)}</span>
        {hasPermission('catalog.sync') ? <button className="primary-button" type="submit">Sincronizar catálogo</button> : null}
      </form>
      {gaps > 0 ? <div className="warning">Sem preço: {health?.gaps.join(', ')}. Sincronize para criar os preços que faltam.</div> : null}
      {message ? <div className="success">{message}</div> : null}
      {error ? <div className="alert">{error}</div> : null}
    </Section>
  )
}
