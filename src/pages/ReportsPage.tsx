import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { BarSeries } from '../components/reports/BarSeries'
import { FunnelBars } from '../components/reports/FunnelBars'
import { KpiCard } from '../components/reports/KpiCard'
import { ReportTable } from '../components/reports/ReportTable'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, getApiBaseUrl } from '../lib/api'
import { formatNumber } from '../lib/format'
import { MARKET_LABELS, defaultMarket, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  GRANULARITIES,
  QUICK_PERIODS,
  REPORT_TABS,
  exportFilename,
  exportPath,
  fetchReport,
  formatCount,
  formatRate,
  marketName,
  marketToday,
  matchQuickPeriod,
  minorToMoney,
  missingNameMark,
  parseTab,
  periodLabel,
  quickRange,
  reportForTab,
  reportPath,
  validateRange,
  type AcquisitionReport,
  type CycleStatus,
  type Granularity,
  type MixReport,
  type OperationsReport,
  type ReportState,
  type RevenueReport,
  type StockReport,
  type SubscriptionsReport,
  type SummaryKpis,
  type SummaryReport,
} from '../lib/reports'

type Loaded = { path: string; data: unknown; error: string | null }

const plural = (count: number, one: string, many: string) => `${formatNumber(count)} ${count === 1 ? one : many}`

function parseMarket(value: string | null): MarketCode | null {
  const upper = String(value ?? '').toUpperCase()
  return upper === 'BR' || upper === 'US' ? upper : null
}

function parseGranularity(value: string | null): Granularity | null {
  return GRANULARITIES.some((item) => item.id === value) ? value as Granularity : null
}

function Note({ children }: { children: ReactNode }) {
  return <p className="muted" role="note">{children}</p>
}

function NameMark({ show, market }: { show: boolean; market: MarketCode }) {
  return show ? <span className="report-mark">({missingNameMark(market)})</span> : null
}

export function ReportsPage() {
  const { user, token, hasPermission } = useAuth()
  const [params, setParams] = useSearchParams()
  const markets = sessionMarkets(user)
  const fallbackMarket = defaultMarket(user)
  const urlMarket = parseMarket(params.get('mercado'))
  const market: MarketCode | null = urlMarket && markets.includes(urlMarket) ? urlMarket : fallbackMarket
  const tab = parseTab(params.get('aba'))
  const today = marketToday(market ?? 'BR')
  const urlFrom = params.get('de') ?? ''
  const urlTo = params.get('ate') ?? ''
  const urlRangeValid = validateRange(urlFrom, urlTo) === null
  const range = urlRangeValid ? { from: urlFrom, to: urlTo } : quickRange('30d', today)
  const granularity = parseGranularity(params.get('granularidade'))
  const quick = matchQuickPeriod(range.from, range.to, today)
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState({ from: range.from, to: range.to })
  const [customError, setCustomError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const state: ReportState | null = market ? { tab, market, from: range.from, to: range.to, granularity } : null
  const path = state ? reportPath(state) : null
  const report = reportForTab(tab)

  // The URL is the source of truth; out-of-scope markets and broken periods are rewritten in place.
  useEffect(() => {
    if (!market) return
    const next = new URLSearchParams(params)
    let changed = false
    if (params.get('mercado') !== market) { next.set('mercado', market); changed = true }
    if (!urlRangeValid) { next.set('de', range.from); next.set('ate', range.to); changed = true }
    if (changed) setParams(next, { replace: true })
  }, [market, params, range.from, range.to, setParams, urlRangeValid])

  useEffect(() => {
    if (!token || !path || !state) return
    let active = true
    fetchReport<unknown>(state, token)
      .then((data) => { if (active) setLoaded({ path, data, error: null }) })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof ApiRequestError || error instanceof Error ? error.message : 'Não foi possível carregar o relatório.'
        setLoaded({ path, data: null, error: message })
      })
    return () => { active = false }
    // `state` is derived from `path`; the path alone decides when to reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, path])

  const setParam = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(values)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next)
  }

  const applyCustom = (from: string, to: string) => {
    setDraft({ from, to })
    const error = validateRange(from, to)
    setCustomError(error)
    if (!error) setParam({ de: from, ate: to })
  }

  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = REPORT_TABS.findIndex((option) => option.id === tab)
    const next = REPORT_TABS[(index + (event.key === 'ArrowRight' ? 1 : REPORT_TABS.length - 1)) % REPORT_TABS.length]
    setParam({ aba: next.id })
    document.getElementById(`reports-tab-${next.id}`)?.focus()
  }

  const download = async () => {
    if (!token || !state) return
    setExporting(true)
    setExportError(null)
    try {
      const response = await fetch(`${getApiBaseUrl()}${exportPath(state)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message || 'Não foi possível exportar o CSV.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = exportFilename(state, response.headers.get('Content-Disposition'))
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível exportar o CSV.')
    } finally {
      setExporting(false)
    }
  }

  const subtitle = useMemo(() => {
    if (!market) return 'Sem mercado atribuído.'
    const names = report === 'summary' ? markets.map((item) => MARKET_LABELS[item]).join(' e ') : marketName(market)
    if (report === 'mix') return `${names} · assinaturas ativas agora`
    const partial = range.to === today ? ' Hoje é comparado até o mesmo horário do período anterior.' : ''
    return `${names} · ${periodLabel(range.from, range.to)}.${partial}`
  }, [market, markets, range.from, range.to, report, today])

  if (!user) {
    return <PageFrame title="Relatórios" description="Carregando sessão." />
  }

  if (!market || !state) {
    return (
      <PageFrame title="Relatórios" description={subtitle}>
        <div className="alert" role="alert">Sua conta não tem mercado atribuído. Peça a um admin para definir Brasil ou Estados Unidos.</div>
      </PageFrame>
    )
  }

  const current = loaded && loaded.path === path ? loaded : null

  return (
    <PageFrame
      title="Relatórios"
      description={subtitle}
      actions={(
        <div className="report-toolbar">
          {markets.length > 1 && report !== 'summary' ? (
            <div className="segmented" role="group" aria-label="Mercado">
              {markets.map((value) => (
                <button key={value} type="button" aria-pressed={market === value} className={market === value ? 'active' : ''} onClick={() => setParam({ mercado: value })}>
                  {MARKET_LABELS[value]}
                </button>
              ))}
            </div>
          ) : null}
          {report !== 'mix' ? (
            <>
              <div className="segmented" role="group" aria-label="Período">
                {QUICK_PERIODS.map((item) => {
                  const pressed = !customOpen && quick === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={pressed}
                      className={pressed ? 'active' : ''}
                      onClick={() => {
                        const next = quickRange(item.id, today)
                        setCustomOpen(false)
                        setCustomError(null)
                        setDraft(next)
                        setParam({ de: next.from, ate: next.to })
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}
                <button
                  type="button"
                  aria-pressed={customOpen || !quick}
                  className={customOpen || !quick ? 'active' : ''}
                  onClick={() => { setCustomOpen(true); setDraft(range) }}
                >
                  Personalizado
                </button>
              </div>
              {customOpen || !quick ? (
                <>
                  <label>
                    De
                    <input type="date" value={draft.from} max={today} onChange={(event) => applyCustom(event.target.value, draft.to)} />
                  </label>
                  <label>
                    Até
                    <input type="date" value={draft.to} max={today} onChange={(event) => applyCustom(draft.from, event.target.value)} />
                  </label>
                </>
              ) : null}
              <label>
                Agrupar por
                <select value={granularity ?? ''} onChange={(event) => setParam({ granularidade: event.target.value || null })}>
                  <option value="">Automático</option>
                  {GRANULARITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
            </>
          ) : null}
          {hasPermission('reports.export') ? (
            <button type="button" className="ghost-button" disabled={exporting} onClick={download}>
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </button>
          ) : null}
        </div>
      )}
    >
      {customError ? <div className="alert" role="alert">{customError}</div> : null}
      {exportError ? <div className="alert" role="alert">{exportError}</div> : null}

      <div className="page-tabs" role="tablist" aria-label="Relatórios" onKeyDown={moveTabFocus}>
        {REPORT_TABS.map((option) => (
          <button
            key={option.id}
            id={`reports-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`reports-panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => setParam({ aba: option.id })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div id={`reports-panel-${tab}`} role="tabpanel" aria-labelledby={`reports-tab-${tab}`} className="report-body">
        {customError ? null : !current ? (
          <p className="muted report-loading" aria-busy="true">Carregando relatório…</p>
        ) : current.error ? (
          <div className="alert" role="alert">{current.error}</div>
        ) : (
          <ReportContent report={report} data={current.data} market={market} granularity={granularity} />
        )}
      </div>
    </PageFrame>
  )
}

function ReportContent({ report, data, market, granularity }: { report: string; data: unknown; market: MarketCode; granularity: Granularity | null }) {
  switch (report) {
    case 'summary':
      return <SummaryTab data={data as SummaryReport} />
    case 'revenue':
      return <RevenueTab data={data as RevenueReport} granularity={granularity} />
    case 'subscriptions':
      return <SubscriptionsTab data={data as SubscriptionsReport} granularity={granularity} />
    case 'acquisition':
      return <AcquisitionTab data={data as AcquisitionReport} granularity={granularity} />
    case 'mix':
      return <MixTab data={data as MixReport} />
    case 'operations':
      return <OperationsTab data={data as OperationsReport} />
    case 'stock':
      return <StockTab data={data as StockReport} market={market} />
    default:
      return null
  }
}

const SUMMARY_ROWS: Array<{ key: keyof SummaryKpis; label: string; kind: 'count' | 'money' | 'rate'; now?: boolean; lowerIsBetter?: boolean }> = [
  { key: 'grossRevenue', label: 'Faturamento bruto', kind: 'money' },
  { key: 'paidInvoices', label: 'Faturas pagas', kind: 'count' },
  { key: 'averageTicket', label: 'Ticket médio', kind: 'money' },
  { key: 'activeSubscriptions', label: 'Assinaturas ativas', kind: 'count', now: true },
  { key: 'new', label: 'Novas assinaturas', kind: 'count' },
  { key: 'canceled', label: 'Canceladas', kind: 'count', lowerIsBetter: true },
  { key: 'churn', label: 'Churn', kind: 'rate', lowerIsBetter: true },
  { key: 'checkoutsStarted', label: 'Checkouts iniciados', kind: 'count' },
  { key: 'checkoutToActivation', label: 'Checkout → ativação', kind: 'rate' },
]

function SummaryTab({ data }: { data: SummaryReport }) {
  return (
    <div className="report-columns">
      {data.markets.map((block) => (
        <section key={block.market} className="insights-panel" aria-labelledby={`summary-${block.market}`}>
          <h3 id={`summary-${block.market}`}>{MARKET_LABELS[block.market]} <span className="muted">· {block.currency === 'BRL' ? 'R$' : 'US$'}</span></h3>
          <div className="insights-metrics">
            {SUMMARY_ROWS.map((row) => (
              <KpiCard key={row.key} label={row.label} kpi={block.kpis[row.key]} kind={row.kind} market={block.market} now={row.now} lowerIsBetter={row.lowerIsBetter} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function RevenueTab({ data, granularity }: { data: RevenueReport; granularity: Granularity | null }) {
  const { market, kpis, estimatedMrr } = data
  const money = (value: number) => minorToMoney(value, market)
  return (
    <>
      {data.excludedInvoices > 0 ? (
        <Note>{plural(data.excludedInvoices, 'fatura em outra moeda ficou fora', 'faturas em outra moeda ficaram fora')} do relatório.</Note>
      ) : null}
      <div className="insights-metrics">
        <KpiCard label="Faturamento bruto" kpi={kpis.grossRevenue} kind="money" market={market} hint="Inclui impostos e frete cobrados; não desconta reembolsos." />
        <KpiCard label="Faturas pagas" kpi={kpis.paidInvoices} market={market} />
        <KpiCard label="Ticket médio" kpi={kpis.averageTicket} kind="money" market={market} />
        <KpiCard
          label="MRR estimado"
          kpi={estimatedMrr}
          kind="money"
          market={market}
          now
          badge={<span className="badge-info" title="Soma do preço mensal das assinaturas ativas e com pagamento atrasado, sem cupons recorrentes.">Estimado</span>}
          hint={`${plural(estimatedMrr.trialingSubscriptions, 'em teste fora', 'em teste fora')} · ${plural(estimatedMrr.unpricedSubscriptions, 'sem preço', 'sem preço')}`}
        />
      </div>
      <div className="insights-metrics">
        <KpiCard label="Primeira compra" kpi={kpis.firstPurchaseRevenue} kind="money" market={market} />
        <KpiCard label="Renovações" kpi={kpis.renewalRevenue} kind="money" market={market} />
      </div>
      <section className="insights-panel" aria-labelledby="report-revenue-series">
        <h3 id="report-revenue-series">Faturamento bruto no período</h3>
        <BarSeries title="Faturamento bruto" series={data.series} keys={[{ key: 'revenue', label: 'Faturamento' }]} granularity={granularity ?? data.period.granularity} format={money} />
      </section>
    </>
  )
}

function SubscriptionsTab({ data, granularity }: { data: SubscriptionsReport; granularity: Granularity | null }) {
  const { market, current, kpis } = data
  return (
    <>
      <div className="insights-metrics insights-metrics-five">
        <KpiCard label="Ativas" kpi={current.active} market={market} now />
        <KpiCard label="Em teste" kpi={current.trialing} market={market} now />
        <KpiCard label="Cancelando" kpi={current.canceling} market={market} now />
        <KpiCard label="Pagamento atrasado" kpi={current.pastDue} market={market} now />
        <KpiCard label="Renovam em 7 dias" kpi={current.renewing7d} market={market} now />
      </div>
      <div className="insights-metrics">
        <KpiCard label="Novas" kpi={kpis.new} market={market} />
        <KpiCard label="Canceladas" kpi={kpis.canceled} market={market} lowerIsBetter />
        <KpiCard label="Ativas no início" kpi={kpis.activeAtStart} market={market} />
        <KpiCard label="Churn" kpi={kpis.churn} kind="rate" market={market} lowerIsBetter hint="Canceladas entre as ativas no início ÷ ativas no início." />
      </div>
      {data.approximateNewCount > 0 ? <Note>{plural(data.approximateNewCount, 'nova assinatura tem data aproximada', 'novas assinaturas têm data aproximada')} (registradas antes do relatório).</Note> : null}
      {data.approximateCanceledCount > 0 ? <Note>{plural(data.approximateCanceledCount, 'cancelamento tem data aproximada', 'cancelamentos têm data aproximada')} (registrados antes do relatório).</Note> : null}
      <section className="insights-panel" aria-labelledby="report-subs-series">
        <h3 id="report-subs-series">Novas e cancelamentos</h3>
        <BarSeries
          title="Novas e cancelamentos"
          series={data.series}
          keys={[{ key: 'newCount', label: 'Novas' }, { key: 'canceled', label: 'Cancelamentos', compare: true }]}
          granularity={granularity ?? data.period.granularity}
          format={formatCount}
        />
      </section>
    </>
  )
}

function AcquisitionTab({ data, granularity }: { data: AcquisitionReport; granularity: Granularity | null }) {
  const { stages, conversions } = data
  return (
    <>
      {data.unassignedCheckouts ? (
        <Note>{plural(data.unassignedCheckouts, 'checkout do período está sem mercado e fica', 'checkouts do período estão sem mercado e ficam')} fora do funil.</Note>
      ) : null}
      <div className="insights-split">
        <section className="insights-panel" aria-labelledby="report-funnel">
          <h3 id="report-funnel">Funil de aquisição</h3>
          <FunnelBars
            title="Funil de aquisição"
            funnel
            stages={[
              { key: 'started', label: 'Checkouts iniciados', value: stages.started.value ?? 0 },
              { key: 'linked', label: 'Vinculados ao Stripe', value: stages.linked.value ?? 0, conversion: formatRate(conversions.startedToLinked.value) },
              { key: 'activated', label: 'Chegaram a ativar', value: stages.activated.value ?? 0, conversion: formatRate(conversions.linkedToActivated.value) },
            ]}
          />
          <div className="insights-totals">
            <span>Conversão total <strong>{formatRate(conversions.startedToActivated.value)}</strong></span>
          </div>
        </section>
        <div className="insights-metrics">
          <KpiCard label="Checkouts iniciados" kpi={stages.started} market={data.market} />
          <KpiCard label="Vinculados ao Stripe" kpi={stages.linked} market={data.market} />
          <KpiCard label="Chegaram a ativar" kpi={stages.activated} market={data.market} />
          <KpiCard label="Conversão total" kpi={conversions.startedToActivated} kind="rate" market={data.market} />
        </div>
      </div>
      <section className="insights-panel" aria-labelledby="report-acq-series">
        <h3 id="report-acq-series">Checkouts iniciados</h3>
        <BarSeries title="Checkouts iniciados" series={data.series} keys={[{ key: 'started', label: 'Checkouts' }]} granularity={granularity ?? data.period.granularity} format={formatCount} />
      </section>
    </>
  )
}

function MixTab({ data }: { data: MixReport }) {
  const { market } = data
  return (
    <div className="insights-split">
      <section className="insights-panel" aria-labelledby="report-mix-recipes">
        <div>
          <h3 id="report-mix-recipes">Receitas</h3>
          <p className="muted">Packs por ciclo nas assinaturas ativas</p>
        </div>
        {data.recipes.length ? (
          <FunnelBars
            title="Packs por receita"
            stages={data.recipes.map((row) => ({
              key: row.key,
              label: <>{row.name}<NameMark show={row.nameMissing} market={market} /></>,
              value: row.packs,
            }))}
          />
        ) : <p className="muted">Nenhuma assinatura ativa.</p>}
      </section>
      <section className="insights-panel" aria-labelledby="report-mix-packs">
        <h3 id="report-mix-packs">Tamanhos de pack</h3>
        <ReportTable
          caption="Tamanhos de pack"
          rowKey={(row) => String(row.grams)}
          rows={data.packSizes}
          empty="Nenhuma assinatura ativa."
          columns={[
            { key: 'label', label: 'Pack', cell: (row) => row.label },
            { key: 'subscriptions', label: 'Assinaturas', cell: (row) => formatCount(row.subscriptions) },
            { key: 'packs', label: 'Packs', cell: (row) => formatCount(row.packs) },
            { key: 'share', label: 'Participação', cell: (row) => formatRate(row.share) },
          ]}
        />
      </section>
    </div>
  )
}

const CYCLE_LABELS: Record<CycleStatus, string> = {
  to_prepare: 'A preparar',
  in_production: 'Em produção',
  ready: 'Prontos',
  blocked: 'Bloqueados',
}

const SHIPMENT_LABELS: Record<string, string> = {
  label_created: 'Etiqueta criada',
  shipped: 'Enviados',
  in_transit: 'Em trânsito',
  delivered: 'Entregues',
  exception: 'Com exceção',
  voided: 'Cancelados',
}

function OperationsTab({ data }: { data: OperationsReport }) {
  const { market } = data
  return (
    <>
      <section className="insights-panel" aria-labelledby="report-cycles">
        <div>
          <h3 id="report-cycles">Ciclos pagos por status</h3>
          <p className="muted">Pela data de entrega no período</p>
        </div>
        <div className="insights-metrics">
          {(Object.keys(CYCLE_LABELS) as CycleStatus[]).map((status) => (
            <KpiCard key={status} label={CYCLE_LABELS[status]} kpi={data.cycles[status]} market={market} />
          ))}
        </div>
      </section>
      <div className="insights-metrics">
        <KpiCard label="Atrasados" kpi={data.late} market={market} lowerIsBetter hint="Dia de preparo já passou e o ciclo não está pronto." />
        <KpiCard label="Aguardando pagamento" kpi={data.awaitingPayment} market={market} now hint="Renovações ainda não pagas; não contam como atrasadas." />
      </div>
      {data.shipments ? (
        <section className="insights-panel" aria-labelledby="report-ups">
          <h3 id="report-ups">Envios UPS</h3>
          <div className="insights-metrics">
            <KpiCard label="Envios (sem cancelados)" kpi={data.shipments.total} market={market} />
          </div>
          <ReportTable
            caption="Envios UPS por status"
            rowKey={(row) => row[0]}
            rows={Object.entries(data.shipments.byStatus)}
            empty="Nenhum envio no período."
            columns={[
              { key: 'status', label: 'Status', cell: (row) => SHIPMENT_LABELS[row[0]] ?? row[0] },
              { key: 'value', label: 'Envios', cell: (row) => formatCount(row[1].value) },
              { key: 'previous', label: 'Período anterior', cell: (row) => formatCount(row[1].previous) },
            ]}
          />
        </section>
      ) : null}
    </>
  )
}

function StockTab({ data, market }: { data: StockReport; market: MarketCode }) {
  const { totals } = data
  return (
    <section className="insights-panel" aria-labelledby="report-stock">
      <div>
        <h3 id="report-stock">Estoque por receita e pack</h3>
        <p className="muted">Movimentos no período; saldo e mínimo de agora</p>
      </div>
      <ReportTable
        caption="Estoque por receita e pack"
        rowKey={(row) => `${row.key}|${row.grams}`}
        rows={data.rows}
        empty="Nenhum item de estoque."
        columns={[
          { key: 'name', label: 'Receita', cell: (row) => <>{row.name}<NameMark show={row.nameMissing} market={market} /></> },
          { key: 'label', label: 'Pack', cell: (row) => row.label },
          { key: 'produced', label: 'Produzido', cell: (row) => formatCount(row.produced) },
          { key: 'separated', label: 'Separado', cell: (row) => formatCount(row.separated) },
          { key: 'adjusted', label: 'Ajustado', cell: (row) => formatCount(row.adjusted) },
          { key: 'onHand', label: 'Saldo', cell: (row) => formatCount(row.onHand) },
          { key: 'minLevel', label: 'Mínimo', cell: (row) => formatCount(row.minLevel) },
        ]}
        footer={['Total', '', formatCount(totals.produced.value), formatCount(totals.separated.value), formatCount(totals.adjusted.value), formatCount(totals.onHand.value), '']}
      />
    </section>
  )
}
