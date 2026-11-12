import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CustomerContact } from '../components/CustomerContact'
import { PageFrame } from '../components/PageFrame'
import { SystemHealth } from '../components/SystemHealth'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { billingHref } from '../lib/billing'
import { courierHref } from '../lib/courierDeliveries'
import { nfeListHref } from '../lib/nfe'
import { getBrowserTimeZone } from '../lib/format'
import { effectiveSessionMarkets } from '../lib/markets'
import { plural, productionQueueHref, QUEUE_PATH, type QueueFilters } from '../lib/productionQueue'
import { nextStep, UPS_CHECK_PATH, UPS_PICKUP_PATH, type Bucket, type ClosedDay, type Counts, type Fulfillment, type TodayItem, type TodayOverview, type Tone } from '../lib/today'

const MARKET_NAME = { BR: 'Brasil', US: 'EUA' } as const

// Buying UPS labels happens in bulk on Etiquetas UPS, not in the production queue.
const LABELS_PATH = '/operations/labels'

type Severity = 'high' | 'medium' | 'low'

const SEVERITY_LABEL: Record<Severity, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' }

type Pending = { key: string; severity: Severity; title: string; detail: string; action: string; to: string; refused?: TodayItem[] }

const customer = (item: TodayItem) => item.displayName || item.email

// What blocks the deliveries, worst first. Each one opens the place where it gets solved.
function pendingItems(items: TodayItem[], mercado: QueueFilters['mercado'], stalePaid = 0): Pending[] {
  // Paid boxes stuck for over a month are counted apart: they need a decision, not just the kitchen.
  const overdue = items.filter((item) => item.dueBucket === 'overdue' && item.productionStatus !== 'ready' && !item.stale)
  const refused = items.filter((item) => item.paymentState === 'past_due')
  const blocked = items.filter((item) => item.productionStatus === 'blocked')
  const notStarted = items.filter((item) => item.dueBucket === 'today' && item.paymentState === 'paid' && item.productionStatus === 'to_prepare')
  const noLabel = items.filter((item) => item.upsLabel === 'missing' && item.productionStatus === 'ready')
  // queue-overdue-filter-matches-metric: a ready Brazil order past its preparation day whose box has not left is
  // late for the customer even though the kitchen is done; "Atrasados" leaves it out, so it is pending here.
  const waitingToLeave = items.filter((item) => item.dueBucket === 'overdue' && item.productionStatus === 'ready'
    && item.market === 'BR' && (item.courierDelivery == null || item.courierDelivery === 'none'))

  const list: Pending[] = []
  if (stalePaid > 0) {
    list.push({
      key: 'stale-paid', severity: 'high',
      title: plural(stalePaid, 'pedido pago parado há mais de 30 dias', 'pedidos pagos parados há mais de 30 dias'),
      detail: 'O cliente pagou e não recebeu. Marque como pronto se já saiu, bloqueie com nota ou cancele e reembolse na assinatura.',
      action: 'Ver na fila', to: productionQueueHref({ prazo: 'atrasados', mercado }),
    })
  }
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
      action: one ? 'Abrir pedido' : 'Ver assinantes', to: one ? `/billing/subscriptions/${one.id}` : billingHref({ status: 'past_due' }),
      refused,
    })
  }
  if (blocked.length) {
    list.push({
      key: 'blocked', severity: 'high', title: plural(blocked.length, 'pedido bloqueado', 'pedidos bloqueados'),
      detail: 'Leia a nota de cada um e resolva o bloqueio.',
      action: 'Ver na fila', to: productionQueueHref({ status: 'blocked', mercado }),
    })
  }
  if (waitingToLeave.length) {
    const one = waitingToLeave.length === 1 ? waitingToLeave[0] : null
    list.push({
      key: 'waiting-to-leave', severity: 'medium',
      title: plural(waitingToLeave.length, 'pedido pronto esperando saída', 'pedidos prontos esperando saída'),
      detail: one
        ? `${customer(one)}: o dia de preparo já passou e a caixa ainda não saiu.`
        : 'O dia de preparo já passou e as caixas ainda não saíram.',
      action: 'Abrir entregas', to: courierHref(),
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
      action: one ? 'Abrir pedido' : 'Ver etiquetas',
      to: one ? `/billing/subscriptions/${one.id}` : LABELS_PATH,
    })
  }
  return list
}

// keep-ready-orders-dispatchable: parts after the title, each with its own link when it has one.
type WorkPart = { key: string; text: string; to?: string }
type Work = { key: string; title: string; to: string; action: string; parts?: WorkPart[] }

// Shipping and invoice work, counted by the API. Only counts above zero and markets on screen show.
function fulfillmentItems(fulfillment: Fulfillment | undefined, markets: Array<'BR' | 'US'>): Work[] {
  if (!fulfillment) return []
  const brazil = markets.includes('BR')
  const us = markets.includes('US')
  const list: Work[] = []
  const add = (show: boolean, count: number, key: string, one: string, many: string, to: string, action: string) => {
    if (show && count > 0) list.push({ key, title: plural(count, one, many), to, action })
  }
  add(brazil, fulfillment.courierToDispatch, 'courier-dispatch', 'pedido a despachar', 'pedidos a despachar', courierHref(), 'Abrir entregas')
  // simplify-brazil-dispatch: the ready orders still held by the fiscal lock are part of that count, so they share
  // its line instead of counting the same boxes twice. Null (lock off) or 0 adds nothing.
  // keep-ready-orders-dispatchable: so do the ones the address keeps from leaving, linked to that filter.
  const awaitingNfe = fulfillment.courierAwaitingNfe ?? 0
  const addressLocked = fulfillment.courierAddressLocked ?? 0
  const dispatch = list.find((work) => work.key === 'courier-dispatch')
  if (dispatch) {
    const parts: WorkPart[] = []
    if (addressLocked > 0) {
      parts.push({ key: 'address', text: plural(addressLocked, 'travado por endereço', 'travados por endereço'), to: '/operations/courier?problema=endereco' })
    }
    if (awaitingNfe > 0) parts.push({ key: 'nfe', text: `${awaitingNfe} aguardando NF-e` })
    if (parts.length) dispatch.parts = parts
  }
  add(brazil, fulfillment.courierOnTheRoadLong, 'courier-road', 'entrega em rota há mais de 24 h', 'entregas em rota há mais de 24 h', courierHref('em_rota'), 'Abrir entregas')
  add(brazil, fulfillment.courierFailed, 'courier-failed', 'entrega com falha sem novo despacho', 'entregas com falha sem novo despacho', courierHref('falhas'), 'Abrir entregas')
  add(brazil, fulfillment.nfeMissingDocument, 'nfe-document', 'NF-e sem CPF', 'NF-e sem CPF', nfeListHref({ status: 'blocked_missing_document' }), 'Abrir notas')
  add(brazil, fulfillment.nfeRejected, 'nfe-rejected', 'NF-e rejeitada', 'NF-e rejeitadas', nfeListHref({ status: 'rejected' }), 'Abrir notas')
  add(brazil, fulfillment.nfeError, 'nfe-error', 'NF-e com erro', 'NF-e com erro', nfeListHref({ status: 'error' }), 'Abrir notas')
  add(us, fulfillment.upsUnresolved, 'ups-unresolved', 'compra UPS sem confirmação', 'compras UPS sem confirmação', UPS_CHECK_PATH, 'Verificar na UPS')
  add(us, fulfillment.upsLabelsWithoutPickup ?? 0, 'ups-without-pickup', 'etiqueta sem coleta pedida', 'etiquetas sem coleta pedida', UPS_PICKUP_PATH, 'Pedir coleta')
  // PM-26: open address problems and market exceptions, per market on screen.
  const suffix = (market: 'BR' | 'US') => (markets.length > 1 ? ` (${MARKET_NAME[market]})` : '')
  for (const market of markets) {
    const issues = fulfillment.addressIssues?.[market]
    if (issues && issues.open > 0) {
      const stale = issues.stale > 0 ? ` · ${issues.stale} sem correção há mais de 2 dias` : ''
      list.push({
        key: `address-issues-${market}`,
        title: `${plural(issues.open, 'problema de endereço aberto', 'problemas de endereço abertos')}${stale}${suffix(market)}`,
        to: market === 'BR' ? '/operations/courier?problema=endereco' : `${LABELS_PATH}?problema=endereco`,
        action: market === 'BR' ? 'Abrir entregas' : 'Abrir etiquetas',
      })
    }
    const exceptions = fulfillment.marketExceptions?.[market] ?? 0
    if (exceptions > 0) {
      list.push({
        key: `market-exceptions-${market}`,
        title: `${plural(exceptions, 'exceção de mercado', 'exceções de mercado')}${suffix(market)}`,
        to: '/operations/market-exceptions',
        action: 'Abrir exceções',
      })
    }
  }
  if (brazil && fulfillment.blingConnected === false) {
    list.push({ key: 'bling', title: 'Bling desconectado', to: nfeListHref(), action: 'Abrir notas' })
  }
  return list
}

function stepAction(to: string) {
  if (to.startsWith(QUEUE_PATH)) return 'Abrir na fila'
  if (to.startsWith('/operations/courier')) return 'Abrir entregas'
  if (to.startsWith(LABELS_PATH)) return 'Abrir etiquetas'
  return 'Abrir pedido'
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
  // Effective markets: an admin with no stored market still works in both.
  const markets = effectiveSessionMarkets(user)
  const bothMarkets = markets.includes('BR') && markets.includes('US')
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
  const pending = pendingItems(items, mercado, data?.stalePaid ?? 0)
  const needsYou = items.filter((item) => {
    const tone = nextStep(item).tone
    return tone === 'error' || tone === 'warning'
  })
  const shownMarkets = market ? [market] : markets
  const showUps = shownMarkets.includes('US')
  const work = fulfillmentItems(data?.fulfillment, shownMarkets)
  const readyWithoutLabel = items.filter((item) => item.upsLabel === 'missing' && item.productionStatus === 'ready').length

  const cards: Array<{ key: string; label: string; value: number | undefined; hint: string; split?: string; tone?: string; to: string }> = [
    {
      key: 'overdue', label: 'Atrasados', value: data?.totals.overdue, hint: 'Só o que a cozinha não terminou. Pronto esperando saída conta em pedidos a despachar.',
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
      key: 'ups', label: 'Sem etiqueta UPS', value: data ? readyWithoutLabel : undefined, hint: 'Prontos hoje sem etiqueta',
      tone: readyWithoutLabel > 0 ? 'day-card-warning' : undefined,
      to: LABELS_PATH,
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
                  {entry.refused?.map((item) => (
                    <div key={item.id} className="contact-inline">
                      {entry.refused && entry.refused.length > 1 ? <span>{customer(item)}:</span> : null}
                      <CustomerContact subscriptionId={item.id} name={customer(item)} phone={item.phone} reason="payment_failed" lastContact={item.lastContact} />
                    </div>
                  ))}
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

      {work.length > 0 ? (
        <section className="day-section" aria-labelledby="day-fulfillment">
          <div className="day-section-head">
            <h3 id="day-fulfillment">Expedição e notas</h3>
          </div>
          <ul className="day-pending">
            {work.map((entry) => (
              <li key={entry.key}>
                <div className="day-pending-text">
                  <strong>
                    {entry.title}
                    {entry.parts?.map((part) => (
                      <Fragment key={part.key}>
                        {' · '}
                        {part.to ? <Link to={part.to}>{part.text}</Link> : part.text}
                      </Fragment>
                    ))}
                  </strong>
                </div>
                <Link className="ghost-button" to={entry.to}>{entry.action}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
              const action = stepAction(step.to)
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
                  <Link to={step.to} className="day-order-link" aria-label={`${action}: ${customer(item)}`}>
                    {action} →
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {hasRole('admin') ? (
        <details className="day-health">
          <summary>Saúde do sistema <span className="day-health-hint">Webhooks Stripe, preços do catálogo e conflitos de mercado</span></summary>
          <SystemHealth />
        </details>
      ) : null}
    </PageFrame>
  )
}
