import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { KpiCard } from '../components/reports/KpiCard'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest, buildQueryString } from '../lib/api'
import { formatNumber } from '../lib/format'
import { defaultMarket, hasBothMarkets, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  bucketLabel,
  formatCount,
  formatRate,
  marketName,
  marketToday,
  minorToMoney,
  missingNameMark,
  periodLabel,
  quickRange,
  type AcquisitionReport,
  type MixReport,
  type OperationsReport,
  type RevenueReport,
  type SubscriptionsReport,
} from '../lib/reports'

type InsightPeriod = '7d' | '30d' | '90d'

const PERIODS: Array<{ id: InsightPeriod; label: string }> = [
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
]

type Overview = {
  revenue: RevenueReport
  subscriptions: SubscriptionsReport
  acquisition: AcquisitionReport
  mix: MixReport
  operations: OperationsReport
}

type Loaded = { key: string; data: Overview | null; error: string | null }

// Every number on the page comes from the admin reports API, for one market and one period.
function fetchOverview(market: MarketCode, from: string, to: string, today: string, token: string | null): Promise<Overview> {
  const get = <T,>(report: string, query: Record<string, string>) => apiRequest<T>(`/admin/reports/${report}${buildQueryString({ market, ...query })}`, { token })
  return Promise.all([
    get<RevenueReport>('revenue', { from, to }),
    get<SubscriptionsReport>('subscriptions', { from, to, granularity: 'week' }),
    get<AcquisitionReport>('acquisition', { from, to }),
    get<MixReport>('mix', {}),
    get<OperationsReport>('operations', { from: today, to: today }),
  ]).then(([revenue, subscriptions, acquisition, mix, operations]) => ({ revenue, subscriptions, acquisition, mix, operations }))
}

const percentOf = (value: number, max: number) => (max > 0 ? Math.round((value / max) * 100) : 0)

export function InsightsRoute() {
  const { isReady, hasPermission } = useAuth()
  if (isReady && !hasPermission('reports.read')) return <Navigate to="/dashboard" replace />
  return <BusinessOverviewPage />
}

export function BusinessOverviewPage() {
  const { user, token, isReady } = useAuth()
  const markets = sessionMarkets(user)
  const both = hasBothMarkets(user)
  const [picked, setPicked] = useState<MarketCode | null>(null)
  const [period, setPeriod] = useState<InsightPeriod>('30d')
  const market: MarketCode | null = picked && markets.includes(picked) ? picked : defaultMarket(user)
  const today = marketToday(market ?? 'BR')
  const range = quickRange(period, today)
  const key = market ? `${market}|${range.from}|${range.to}|${today}` : ''
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!token || !market) return
    let active = true
    fetchOverview(market, range.from, range.to, today, token)
      .then((data) => { if (active) setLoaded({ key, data, error: null }) })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof ApiRequestError || error instanceof Error ? error.message : 'Não foi possível carregar a visão do negócio.'
        setLoaded({ key, data: null, error: message })
      })
    return () => { active = false }
    // `key` carries market, range and today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key])

  const current = loaded?.key === key ? loaded : null
  const data = current?.data ?? null
  const description = !isReady || !market
    ? 'Carregando sessão.'
    : `Assinaturas, aquisição e receita de ${marketName(market)} · ${periodLabel(range.from, range.to)}.`

  return (
    <PageFrame
      title="Visão do negócio"
      description={description}
      actions={(
        <div className="day-toolbar">
          {both ? (
            <div className="segmented" role="group" aria-label="Mercado">
              {(['BR', 'US'] as const).map((value) => (
                <button key={value} type="button" aria-pressed={market === value} className={market === value ? 'active' : ''} onClick={() => setPicked(value)}>
                  {marketName(value)}
                </button>
              ))}
            </div>
          ) : null}
          <div className="segmented" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <button key={item.id} type="button" aria-pressed={period === item.id} className={period === item.id ? 'active' : ''} onClick={() => setPeriod(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    >
      {isReady && !market ? <div className="alert" role="alert">Sua conta não tem mercado atribuído. Peça a um admin para definir Brasil ou Estados Unidos.</div> : null}
      {current?.error ? <div className="alert" role="alert">{current.error}</div> : null}
      {!current && market ? <p className="muted">Carregando dados.</p> : null}
      {data && market ? <OverviewBody data={data} market={market} /> : null}
    </PageFrame>
  )
}

function OverviewBody({ data, market }: { data: Overview; market: MarketCode }) {
  const { revenue, subscriptions, acquisition, mix, operations } = data
  const weeks = subscriptions.series.map((bucket) => ({
    bucket,
    label: bucketLabel(bucket, 'week'),
    newCount: Number(bucket.newCount ?? 0),
    canceled: Number(bucket.canceled ?? 0),
  }))
  const axisMax = Math.max(1, ...weeks.map((week) => Math.max(week.newCount, week.canceled)))
  const totalNew = subscriptions.kpis.new.value ?? 0
  const totalCanceled = subscriptions.kpis.canceled.value ?? 0
  const net = totalNew - totalCanceled
  const stages = [
    { label: 'Checkouts iniciados', kpi: acquisition.stages.started, conversion: null },
    { label: 'Vinculados a um cliente', kpi: acquisition.stages.linked, conversion: acquisition.conversions.startedToLinked.value },
    { label: 'Assinaturas ativadas', kpi: acquisition.stages.activated, conversion: acquisition.conversions.linkedToActivated.value },
  ]
  const funnelMax = acquisition.stages.started.value ?? 0
  const recipeMax = Math.max(0, ...mix.recipes.map((recipe) => recipe.packs))
  const mixTotal = mix.packSizes.reduce((sum, size) => sum + size.packs, 0)
  const unpriced = revenue.estimatedMrr.unpricedSubscriptions

  return (
    <>
      <Link to="/dashboard" className="insights-strip">
        <span className="insights-strip-label">Hoje na operação</span>
        <span><i className="insights-dot insights-dot-danger" aria-hidden="true" />{formatCount(operations.late.value)} atrasados</span>
        <span><i className="insights-dot insights-dot-danger" aria-hidden="true" />{formatCount(operations.awaitingPayment.value)} aguardando pagamento</span>
        <span><i className="insights-dot insights-dot-warning" aria-hidden="true" />{formatCount(operations.cycles.blocked.value)} bloqueados</span>
        <span className="insights-strip-link">Abrir Hoje →</span>
      </Link>

      <section className="day-section" aria-labelledby="insights-revenue">
        <div className="insights-heading">
          <h3 id="insights-revenue">Receita</h3>
        </div>
        <div className="insights-metrics">
          <KpiCard label="Receita recorrente" kpi={revenue.estimatedMrr} kind="money" market={market} now badge={<span className="badge-info">Estimado</span>} />
          <KpiCard label="Faturamento bruto" kpi={revenue.kpis.grossRevenue} kind="money" market={market} hint={`${formatCount(revenue.kpis.paidInvoices.value)} faturas pagas`} />
          <KpiCard label="Ticket médio" kpi={revenue.kpis.averageTicket} kind="money" market={market} />
          <KpiCard label="Churn" kpi={subscriptions.kpis.churn} kind="rate" market={market} lowerIsBetter />
        </div>
      </section>

      <section className="day-section" aria-labelledby="insights-subs">
        <div className="day-section-head">
          <h3 id="insights-subs">Assinaturas</h3>
          <Link to="/billing">Ver assinantes →</Link>
        </div>
        <div className="insights-metrics insights-metrics-five">
          <KpiCard label="Ativas" kpi={subscriptions.current.active} market={market} now />
          <KpiCard label="Cancelando" kpi={subscriptions.current.canceling} market={market} now />
          <KpiCard label="Pagamento pendente" kpi={subscriptions.current.pastDue} market={market} now />
          <KpiCard label="Renovam em 7 dias" kpi={subscriptions.current.renewing7d} market={market} now />
          <KpiCard label="Canceladas no período" kpi={subscriptions.kpis.canceled} market={market} lowerIsBetter />
        </div>
      </section>

      <div className="insights-split">
        <section className="insights-panel" aria-labelledby="insights-trend">
          <div className="insights-heading">
            <div>
              <h3 id="insights-trend">Tendência semanal</h3>
              <p className="muted">Novas assinaturas e cancelamentos por semana no período</p>
            </div>
          </div>
          <div className="insights-legend">
            <span><i className="insights-swatch insights-swatch-new" aria-hidden="true" />Novas</span>
            <span><i className="insights-swatch insights-swatch-cancel" aria-hidden="true" />Cancelamentos</span>
          </div>
          <div role="img" aria-label={`Novas e cancelamentos por semana: ${weeks.map((week) => `${week.label}, ${week.newCount} novas, ${week.canceled} cancelamentos`).join('; ')}`} className="insights-chart">
            <div className="insights-axis" aria-hidden="true">
              <span>{formatNumber(axisMax)}</span>
              <span>{formatNumber(Math.round(axisMax / 2))}</span>
              <span>0</span>
            </div>
            <div className="insights-plot">
              {weeks.map((week) => (
                <div key={week.bucket.key} className="insights-week" title={`Semana de ${week.label}${week.bucket.partial ? ' (parcial)' : ''}: ${week.newCount} novas, ${week.canceled} cancelamentos`}>
                  <div className="insights-week-bars">
                    <span className="insights-col insights-col-new" style={{ height: `${percentOf(week.newCount, axisMax)}%` }} />
                    <span className="insights-col insights-col-cancel" style={{ height: `${percentOf(week.canceled, axisMax)}%` }} />
                  </div>
                  <span className="insights-week-label" aria-hidden="true">{week.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="insights-totals">
            <span>Novas no período <strong>{formatNumber(totalNew)}</strong></span>
            <span>Cancelamentos <strong>{formatNumber(totalCanceled)}</strong></span>
            <span>Saldo líquido <strong className={net >= 0 ? 'insights-delta-good' : 'insights-delta-bad'}>{net > 0 ? '+' : net < 0 ? '−' : ''}{formatNumber(Math.abs(net))}</strong></span>
          </div>
        </section>

        <section className="insights-panel" aria-labelledby="insights-funnel">
          <div className="day-section-head">
            <div>
              <h3 id="insights-funnel">Funil de aquisição</h3>
              <p className="muted">Do checkout à assinatura ativa no Stripe</p>
            </div>
            <Link to="/onboarding/sessions">Ver checkouts →</Link>
          </div>
          <div className="insights-funnel">
            {stages.map((stage) => (
              <div key={stage.label}>
                {stage.conversion !== null ? <p className="insights-conv">{formatRate(stage.conversion)} converteram</p> : null}
                <div className="insights-funnel-row">
                  <span>{stage.label}</span>
                  <strong>{formatCount(stage.kpi.value)}</strong>
                </div>
                <div className="insights-track">
                  <span className="insights-track-fill" style={{ width: `${percentOf(stage.kpi.value ?? 0, funnelMax)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="insights-totals">
            <span>Conversão total <strong>{formatRate(acquisition.conversions.startedToActivated.value)}</strong></span>
          </div>
        </section>
      </div>

      <section className="insights-panel" aria-labelledby="insights-mix">
        <div className="insights-heading">
          <div>
            <h3 id="insights-mix">Mix das assinaturas ativas</h3>
            <p className="muted">Pacotes por entrega nas assinaturas ativas agora, para planejar compras da cozinha</p>
          </div>
        </div>
        {mix.recipes.length ? (
          <>
            <p className="muted">Total: <strong>{formatNumber(mixTotal)} pacotes</strong></p>
            <div className="insights-split">
              <div>
                <p className="insights-kicker">Sabores</p>
                {mix.recipes.map((recipe) => (
                  <div key={recipe.key} className="insights-hbar">
                    <span>{recipe.name}{recipe.nameMissing ? <span className="report-mark"> ({missingNameMark(market)})</span> : null}</span>
                    <span className="insights-track"><span className="insights-track-fill" style={{ width: `${percentOf(recipe.packs, recipeMax)}%` }} /></span>
                    <strong>{formatNumber(recipe.packs)}</strong>
                  </div>
                ))}
              </div>
              <div>
                <p className="insights-kicker">Tamanhos de pacote</p>
                <table className="insights-table">
                  <thead>
                    <tr>
                      <th scope="col">Pacote</th>
                      <th scope="col">Assinaturas</th>
                      <th scope="col">Pacotes</th>
                      <th scope="col">Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mix.packSizes.map((size) => (
                      <tr key={size.grams}>
                        <td>{size.label}</td>
                        <td>{formatNumber(size.subscriptions)}</td>
                        <td>{formatNumber(size.packs)}</td>
                        <td>{formatRate(size.share)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : <p className="muted">Nenhuma assinatura ativa com pacotes.</p>}
      </section>

      <p className="muted">
        Churn: assinaturas ativas no início do período que terminaram nele ÷ ativas no início.
        {' '}Receita recorrente soma o preço mensal das assinaturas ativas e com pagamento pendente{unpriced ? `; ${formatNumber(unpriced)} sem preço registrado ficaram de fora` : ''}.
        {' '}Faturamento bruto: faturas pagas no Stripe no período, {minorToMoney(revenue.kpis.grossRevenue.value, market)}.
      </p>
    </>
  )
}
