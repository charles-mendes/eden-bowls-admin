import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { SystemHealth } from '../components/SystemHealth'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { getBrowserTimeZone } from '../lib/format'
import { hasBothMarkets, sessionMarkets } from '../lib/markets'
import { plural, productionQueueHref, QUEUE_PATH, type QueueFilters } from '../lib/productionQueue'
import { nextStep, type Bucket, type ClosedDay, type Counts, type TodayItem, type TodayOverview, type Tone } from '../lib/today'

const MARKET_NAME = { BR: 'Brasil', US: 'EUA' } as const

type Severity = 'high' | 'medium' | 'low'

const SEVERITY_LABEL: Record<Severity, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }

type Pending = { key: string; severity: Severity; title: string; detail: string; action: string; to: string }

const customer = (item: TodayItem) => item.displayName || item.email

// What blocks the deliveries, worst first. Each one opens the place where it gets solved.
function pendingItems(items: TodayItem[], mercado: QueueFilters['mercado']): Pending[] {
  const overdue = items.filter((item) => item.dueBucket === 'overdue' && item.productionStatus !== 'ready')
  const refused = items.filter((item) => item.paymentState === 'past_due')
  const blocked = items.filter((item) => item.productionStatus === 'blocked')
  const notStarted = items.filter((item) => item.dueBucket === 'today' && item.paymentState === 'paid' && item.productionStatus === 'to_prepare')
  const noLabel = items.filter((item) => item.upsLabel === 'missing' && item.productionStatus === 'ready')

  const list: Pending[] = []
  if (overdue.length) {
    list.push({
      key: 'overdue', severity: 'high', title: plural(overdue.length, 'pedido atrasado', 'pedidos atrasados'),
      detail: 'O dia de preparo já passou e o preparo não foi concluído.',
      action: 'Ver na fila', to: productionQueueHref({ prazo: 'atrasados', mercado }),
    })
  }
  if (refused.length) {
    const one = refused.length === 1 ? refused[0] : null
    list.push({
      key: 'refused', severity: 'high', title: plural(refused.length, 'pagamento recusado', 'pagamentos recusados'),
      detail: one ? `${customer(one)}: falar com o cliente antes de preparar.` : 'Falar com os clientes antes de preparar.',
      action: one ? 'Abrir pedido' : 'Ver assinantes', to: one ? `/billing/subscriptions/${one.id}` : '/billing',
    })
  }
  if (blocked.length) {
    list.push({
      key: 'blocked', severity: 'high', title: plural(blocked.length, 'pedido bloqueado', 'pedidos bloqueados'),
      detail: 'Leia a nota de cada um e resolva o bloqueio.',
      action: 'Ver na fila', to: productionQueueHref({ status: 'blocked', mercado }),
    })
  }
  if (notStarted.length) {
    list.push({
      key: 'not-started', severity: 'medium',
      title: notStarted.length === 1 ? '1 pedido de hoje com preparo não iniciado' : `${notStarted.length} pedidos de hoje com preparo não iniciado`,
      detail: 'Já pagos e liberados para a cozinha.',
      action: 'Ver na fila', to: productionQueueHref({ prazo: 'hoje', status: 'to_prepare', mercado }),
    })
  }
  if (noLabel.length) {
    const one = noLabel.length === 1 ? noLabel[0] : null
    list.push({
      key: 'ups', severity: 'low', title: plural(noLabel.length, 'pedido pronto sem etiqueta UPS', 'pedidos prontos sem etiqueta UPS'),
      detail: one ? `${customer(one)}: gerar a etiqueta para envio.` : 'Gerar as etiquetas para envio.',
      action: one ? 'Abrir pedido' : 'Ver na fila',
      to: one ? `/billing/subscriptions/${one.id}` : productionQueueHref({ status: 'ready', mercado: 'us' }),
    })
  }
  return list
}

function closedDayText(day: ClosedDay, today: string) {
  const when = day.date === today ? 'Hoje' : 'Amanhã'
  const closes = [
    day.closesPreparation ? 'sem preparo' : '',
    day.closesPickup ? 'sem coleta' : '',
    day.closesDelivery ? 'sem entrega' : '',
  ].filter(Boolean).join(', ')
  return { title: `${when} (${MARKET_NAME[day.market]}): ${day.label}`, closes }
}

function longDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const text = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(year, month - 1, day))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function splitHint(counts: Record<'BR' | 'US', Counts>, bucket: Bucket, markets: Array<'BR' | 'US'>) {
  if (markets.length < 2) return undefined
  return `Brasil ${counts.BR[bucket]} · EUA ${counts.US[bucket]}`
}

const STEP_TONE: Record<Tone, string> = {
  error: 'day-step-error',
  warning: 'day-step-warning',
  info: 'day-step-info',
  success: 'day-step-success',
}

export function DashboardPage() {
  const { token, user, hasRole } = useAuth()
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
  const mercado: QueueFilters['mercado'] = market ? (market === 'US' ? 'us' : 'br') : undefined
  const pending = pendingItems(items, mercado)
  const needsYou = items.filter((item) => {
    const tone = nextStep(item).tone
    return tone === 'error' || tone === 'warning'
  })
  const shownMarkets = market ? [market] : markets
  const showUps = shownMarkets.includes('US')
  const readyWithoutLabel = items.filter((item) => item.upsLabel === 'missing' && item.productionStatus === 'ready').length

  const cards: Array<{ key: string; label: string; value: number | undefined; hint: string; split?: string; tone?: string; to: string }> = [
    {
      key: 'overdue', label: 'Atrasados', value: data?.totals.overdue, hint: 'O dia de preparo já passou',
      split: data ? splitHint(data.byMarket, 'overdue', shownMarkets) : undefined,
      tone: data && data.totals.overdue > 0 ? 'day-card-danger' : undefined,
      to: productionQueueHref({ prazo: 'atrasados', mercado }),
    },
    {
      key: 'today', label: 'Hoje', value: data?.totals.today, hint: 'Com preparo hoje',
      split: data ? splitHint(data.byMarket, 'today', shownMarkets) : undefined,
      to: productionQueueHref({ prazo: 'hoje', mercado }),
    },
    {
      key: 'tomorrow', label: 'Amanhã', value: data?.totals.tomorrow, hint: 'Com preparo amanhã',
      split: data ? splitHint(data.byMarket, 'tomorrow', shownMarkets) : undefined,
      to: productionQueueHref({ prazo: 'amanha', mercado }),
    },
  ]
  if (showUps) {
    cards.push({
      key: 'ups', label: 'Sem etiqueta UPS', value: data ? readyWithoutLabel : undefined, hint: 'Prontos, aguardando etiqueta',
      tone: readyWithoutLabel > 0 ? 'day-card-warning' : undefined,
      to: productionQueueHref({ status: 'ready', mercado: 'us' }),
    })
  }

  return (
    <PageFrame
      eyebrow={data ? longDate(data.today) : undefined}
      title="Hoje"
      description="Pendências e pedidos do dia. Clique em um número para abrir a fila já filtrada."
      actions={(
        <div className="day-toolbar">
          {bothMarkets ? (
            <div className="segmented" role="group" aria-label="Mercado">
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
          <Link className="ghost-button" to={QUEUE_PATH}>Abrir a Fila de produção</Link>
        </div>
      )}
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}

      {data?.closedDays.map((day) => {
        const text = closedDayText(day, data.today)
        return (
          <div key={`${day.market}-${day.date}-${day.label}`} className="day-banner" role="status">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <span className="day-banner-text">
              <strong>{text.title}</strong>{text.closes ? ` · ${text.closes}` : ''}
            </span>
            <Link to="/operations/delivery-calendar">Ver feriados e fechamentos</Link>
          </div>
        )
      })}

      <section className="day-section" aria-labelledby="day-numbers">
        <h3 id="day-numbers" className="day-kicker">Números do dia</h3>
        <div className="day-cards">
          {cards.map((card) => (
            <Link key={card.key} to={card.to} className={['day-card', card.tone ?? ''].filter(Boolean).join(' ')}>
              <span className="day-card-label">{card.label}</span>
              <strong className="day-card-value">{card.value ?? '—'}</strong>
              <span className="day-card-hint">{card.hint}</span>
              {card.split ? <span className="day-card-hint">{card.split}</span> : null}
              <span className="day-card-link">Abrir na fila →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="day-section" aria-labelledby="day-pending">
        <div className="day-section-head">
          <h3 id="day-pending">Pendências</h3>
          {pending.length > 0 ? (
            <span className="muted">{plural(pending.length, 'item', 'itens')}, da mais grave para a menos grave</span>
          ) : null}
        </div>
        {!data ? (
          <p className="muted">{loading ? 'Carregando…' : '—'}</p>
        ) : pending.length === 0 ? (
          <p className="day-all-clear">Nada travado. Tudo em dia.</p>
        ) : (
          <ul className="day-pending">
            {pending.map((entry) => (
              <li key={entry.key}>
                <span className={`day-severity day-severity-${entry.severity}`}>{SEVERITY_LABEL[entry.severity]}</span>
                <div className="day-pending-text">
                  <strong>{entry.title}</strong>
                  <span>{entry.detail}</span>
                </div>
                <Link className="ghost-button" to={entry.to}>{entry.action}</Link>
              </li>
            ))}
          </ul>
        )}
        {data?.truncated ? (
          <p className="muted day-note">
            Contagem feita sobre os {items.length} primeiros de {data.total} pedidos. <Link to={QUEUE_PATH}>Ver todos na fila</Link>
          </p>
        ) : null}
      </section>

      <section className="day-section" aria-labelledby="day-needs-you">
        <div className="day-section-head">
          <h3 id="day-needs-you">Precisa de você</h3>
          <span className="muted">Só os pedidos que pedem uma ação agora</span>
        </div>
        {!data ? (
          <p className="muted">{loading ? 'Carregando…' : '—'}</p>
        ) : needsYou.length === 0 ? (
          <p className="day-all-clear">Nenhum pedido pede ação agora.</p>
        ) : (
          <ul className="day-orders">
            {needsYou.map((item) => {
              const step = nextStep(item)
              const inQueue = step.to.startsWith(QUEUE_PATH)
              return (
                <li key={`${item.id}-${item.dueBucket}`} className="day-order">
                  <div className="day-order-head">
                    <strong>{customer(item)}</strong>
                    <span className="muted">{[MARKET_NAME[item.market], item.city].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className="day-order-items">
                    {item.flavorMix || '—'} · {plural(item.packCount, 'pacote', 'pacotes')}{item.packSizeLabel ? ` · ${item.packSizeLabel}` : ''}
                  </span>
                  <span className={`day-order-step ${STEP_TONE[step.tone]}`}>{step.text}</span>
                  {item.note ? <span className="muted day-order-note">{item.note}</span> : null}
                  <Link to={step.to} className="day-order-link" aria-label={`${inQueue ? 'Abrir na fila' : 'Abrir pedido'}: ${customer(item)}`}>
                    {inQueue ? 'Abrir na fila' : 'Abrir pedido'} →
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {hasRole('admin') ? (
        <details className="day-health">
          <summary>Saúde do sistema <span className="muted">· checkouts, preços Stripe e conflitos de mercado</span></summary>
          <SystemHealth />
        </details>
      ) : null}
    </PageFrame>
  )
}
