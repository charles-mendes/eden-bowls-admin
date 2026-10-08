import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { SystemHealth } from '../components/SystemHealth'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { getBrowserTimeZone } from '../lib/format'
import { hasBothMarkets, sessionMarkets } from '../lib/markets'
import { nextStep, type Bucket, type ClosedDay, type Counts, type TodayItem, type TodayOverview, type Tone } from '../lib/today'

const MARKET_NAME = { BR: 'Brasil', US: 'EUA' } as const

const STATUS_LABEL: Record<TodayItem['productionStatus'], string> = {
  to_prepare: 'A preparar',
  in_production: 'Em produção',
  ready: 'Pronto',
  blocked: 'Bloqueado',
}

const BUCKETS: Array<{ key: Bucket; title: string; empty: string }> = [
  { key: 'overdue', title: 'Atrasados', empty: 'Nenhum pedido atrasado.' },
  { key: 'today', title: 'Hoje', empty: 'Nada programado para hoje.' },
  { key: 'tomorrow', title: 'Amanhã', empty: 'Nada programado para amanhã.' },
]

function pendingAlerts(items: TodayItem[]) {
  const count = (predicate: (item: TodayItem) => boolean) => items.filter(predicate).length
  const alerts: Array<{ tone: Tone; count: number; text: string; to: string }> = [
    { tone: 'error', count: count((item) => item.dueBucket === 'overdue' && item.productionStatus !== 'ready'), text: 'pedido(s) atrasado(s) ainda sem ficar pronto', to: '/operations/production' },
    { tone: 'error', count: count((item) => item.paymentState === 'past_due'), text: 'pagamento(s) recusado(s) travando a produção', to: '/billing' },
    { tone: 'error', count: count((item) => item.productionStatus === 'blocked'), text: 'pedido(s) bloqueado(s)', to: '/operations/production' },
    { tone: 'warning', count: count((item) => item.upsLabel === 'missing' && item.productionStatus === 'ready'), text: 'pedido(s) dos EUA pronto(s) sem etiqueta UPS', to: '/operations/production' },
    { tone: 'warning', count: count((item) => item.dueBucket === 'today' && item.paymentState === 'paid' && item.productionStatus === 'to_prepare'), text: 'pedido(s) pago(s) para hoje com preparo não iniciado', to: '/operations/production' },
  ]
  return alerts.filter((alert) => alert.count > 0)
}

function closedDayText(day: ClosedDay, today: string) {
  const when = day.date === today ? 'Hoje' : 'Amanhã'
  const closes = [
    day.closesPreparation ? 'sem preparo' : '',
    day.closesPickup ? 'sem coleta' : '',
    day.closesDelivery ? 'sem entrega' : '',
  ].filter(Boolean).join(', ')
  return `${when} (${MARKET_NAME[day.market]}): ${day.label}${closes ? ` · ${closes}` : ''}`
}

function longDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(year, month - 1, day))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function splitHint(counts: Record<'BR' | 'US', Counts>, bucket: Bucket, markets: Array<'BR' | 'US'>) {
  if (markets.length < 2) return undefined
  return `Brasil ${counts.BR[bucket]} · EUA ${counts.US[bucket]}`
}

export function DashboardPage() {
  const { token, user } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const markets = sessionMarkets(user)
  const [market, setMarket] = useState<'' | 'BR' | 'US'>('')
  const [data, setData] = useState<TodayOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!token || !user) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await apiRequest<{ success: boolean; data: TodayOverview }>(`/admin/today${buildQueryString({
          timezone: getBrowserTimeZone(),
          account: market ? market.toLowerCase() : undefined,
        })}`, { token })
        if (!cancelled) setData(response.data)
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar o dia')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token, user, market, reload])

  const items = data?.items ?? []
  const alerts = pendingAlerts(items)
  const shownMarkets = market ? [market] : markets
  const showUps = shownMarkets.includes('US')
  const missingLabels = items.filter((item) => item.upsLabel === 'missing').length

  return (
    <PageFrame
      title="Hoje"
      description={data ? `${longDate(data.today)} · o que precisa sair e o que está travando.` : 'O que precisa sair hoje e o que está travando.'}
      actions={(
        <div className="today-toolbar">
          {bothMarkets ? (
            <div className="today-segment" role="group" aria-label="Mercado">
              {([['', 'Todos'], ['BR', 'Brasil'], ['US', 'EUA']] as const).map(([value, label]) => (
                <button key={label} type="button" aria-pressed={market === value} className={market === value ? 'active' : ''} onClick={() => setMarket(value)}>
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className="ghost-button" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            {loading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
      )}
    >
      {error ? <div className="alert">{error}</div> : null}

      {data?.closedDays.map((day) => (
        <div key={`${day.market}-${day.date}-${day.label}`} className="warning today-closed">
          {closedDayText(day, data.today)} · <Link to="/operations/delivery-calendar">Ver calendário</Link>
        </div>
      ))}

      <div className={showUps ? 'today-metrics' : 'today-metrics today-metrics-3'}>
        <Link to="/operations/production" className="today-metric today-metric-primary">
          <span>Para hoje</span>
          <strong>{data ? data.totals.today : '—'}</strong>
          <small>{data ? splitHint(data.byMarket, 'today', shownMarkets) ?? 'pedidos com preparo hoje' : ' '}</small>
        </Link>
        <Link to="/operations/production" className={data && data.totals.overdue > 0 ? 'today-metric today-metric-danger' : 'today-metric'}>
          <span>Atrasados</span>
          <strong>{data ? data.totals.overdue : '—'}</strong>
          <small>{data ? splitHint(data.byMarket, 'overdue', shownMarkets) ?? 'deveriam ter saído' : ' '}</small>
        </Link>
        <Link to="/operations/production" className="today-metric">
          <span>Amanhã</span>
          <strong>{data ? data.totals.tomorrow : '—'}</strong>
          <small>{data ? splitHint(data.byMarket, 'tomorrow', shownMarkets) ?? 'para se adiantar' : ' '}</small>
        </Link>
        {showUps ? (
          <Link to="/operations/production" className={missingLabels > 0 ? 'today-metric today-metric-warning' : 'today-metric'}>
            <span>Sem etiqueta UPS</span>
            <strong>{data ? missingLabels : '—'}</strong>
            <small>pedidos pagos dos EUA</small>
          </Link>
        ) : null}
      </div>

      <Section title="Pendências" description="O que trava as entregas agora.">
        {!data ? (
          <p className="muted">{loading ? 'Carregando…' : '—'}</p>
        ) : alerts.length === 0 ? (
          <p className="today-all-clear">Nada travado. Tudo em dia.</p>
        ) : (
          <ul className="today-alerts">
            {alerts.map((alert) => (
              <li key={alert.text} className={`today-alert today-alert-${alert.tone}`}>
                <strong>{alert.count}</strong>
                <span>{alert.text}</span>
                <Link to={alert.to}>Resolver</Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Pedidos"
        description="Do mais urgente ao de amanhã, com o próximo passo de cada um."
        actions={<Link className="ghost-button" to="/operations/production">Abrir produção</Link>}
      >
        {data?.truncated ? <div className="muted-panel">Mostrando {items.length} de {data.total}. A lista completa está em Produção.</div> : null}
        {BUCKETS.map((bucket) => {
          const rows = items.filter((item) => item.dueBucket === bucket.key)
          if (bucket.key === 'overdue' && rows.length === 0) return null
          return (
            <div key={bucket.key} className="today-group">
              <h4>{bucket.title} <span className="muted">({rows.length})</span></h4>
              {rows.length === 0 ? (
                <p className="muted">{data ? bucket.empty : '—'}</p>
              ) : (
                <ul className="today-orders">
                  {rows.map((item) => {
                    const step = nextStep(item)
                    return (
                      <li key={`${item.id}-${item.dueBucket}`} className="today-order">
                        <div className="today-order-who">
                          <strong>{item.displayName || item.email}</strong>
                          <small>{[MARKET_NAME[item.market], item.city].filter(Boolean).join(' · ')}</small>
                        </div>
                        <div className="today-order-what">
                          <span>{item.flavorMix || '—'}</span>
                          <small>{item.packCount} pacote(s){item.packSizeLabel ? ` · ${item.packSizeLabel}` : ''}</small>
                        </div>
                        <div className="today-order-status">
                          <span className={item.productionStatus === 'blocked' ? 'badge-error' : item.productionStatus === 'ready' ? 'badge-success' : 'badge-info'}>
                            {STATUS_LABEL[item.productionStatus]}
                          </span>
                          {item.note ? <small title={item.note}>{item.note}</small> : null}
                        </div>
                        <Link to={step.to} className={`today-step today-step-${step.tone}`}>{step.text} →</Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </Section>

      <details className="today-health">
        <summary>Saúde do sistema <span className="muted">· checkouts, preços Stripe e conflitos de mercado</span></summary>
        <SystemHealth />
      </details>
    </PageFrame>
  )
}
