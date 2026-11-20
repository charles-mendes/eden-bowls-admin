import { apiRequest, buildQueryString } from './api'
import { formatCurrency, formatNumber } from './format'
import { MARKET_LABELS, currencyForMarket, type MarketCode } from './markets'

export type Kpi = { value: number | null; previous: number | null }

export type ReportPeriod = {
  from: string
  to: string
  timezone: string
  granularity: Granularity
  partialToday: boolean
  previous: { from: string; to: string }
}

export type Bucket = { key: string; from: string; to: string; partial: boolean } & Record<string, number | string | boolean>

type Envelope = { market: MarketCode; currency: 'BRL' | 'USD'; period: ReportPeriod; generatedAt: string }

export type RevenueReport = Envelope & {
  kpis: Record<'grossRevenue' | 'paidInvoices' | 'averageTicket' | 'firstPurchaseRevenue' | 'renewalRevenue', Kpi>
  estimatedMrr: Kpi & { estimated: true; trialingSubscriptions: number; unpricedSubscriptions: number }
  excludedInvoices: number
  series: Bucket[]
}

export type SubscriptionsReport = Envelope & {
  current: Record<'active' | 'trialing' | 'canceling' | 'pastDue' | 'renewing7d', Kpi>
  kpis: Record<'new' | 'canceled' | 'activeAtStart' | 'churn', Kpi>
  approximateNewCount: number
  approximateCanceledCount: number
  series: Bucket[]
}

export type AcquisitionReport = Envelope & {
  unassignedCheckouts?: number
  stages: Record<'started' | 'linked' | 'activated', Kpi>
  conversions: Record<'startedToLinked' | 'linkedToActivated' | 'startedToActivated', Kpi>
  series: Bucket[]
}

export type MixReport = Omit<Envelope, 'period'> & {
  period: null
  recipes: Array<{ key: string; name: string; nameMissing: boolean; packs: number; subscriptions: number }>
  packSizes: Array<{ grams: number; label: string; packs: number; subscriptions: number; share: number | null }>
}

export type CycleStatus = 'to_prepare' | 'in_production' | 'ready' | 'blocked'

export type OperationsReport = Envelope & {
  cycles: Record<CycleStatus, Kpi>
  late: Kpi
  awaitingPayment: Kpi
  shipments: { total: Kpi; byStatus: Record<string, Kpi> } | null
}

export type StockReport = Envelope & {
  rows: Array<{
    key: string
    name: string
    nameMissing: boolean
    grams: number
    label: string
    produced: number
    separated: number
    adjusted: number
    onHand: number
    minLevel: number | null
  }>
  totals: Record<'produced' | 'separated' | 'adjusted' | 'onHand', Kpi>
}

export type SummaryKpis = Record<
  'grossRevenue' | 'paidInvoices' | 'averageTicket' | 'activeSubscriptions' | 'new' | 'canceled' | 'churn' | 'checkoutsStarted' | 'checkoutToActivation',
  Kpi
>

export type SummaryReport = {
  period: { from: string; to: string; previous: { from: string; to: string } } | null
  generatedAt: string
  markets: Array<{ market: MarketCode; currency: 'BRL' | 'USD'; period: ReportPeriod; kpis: SummaryKpis }>
}

export type ReportTab = 'resumo' | 'receita' | 'assinaturas' | 'aquisicao' | 'mix' | 'operacao' | 'estoque'
export type ReportName = 'summary' | 'revenue' | 'subscriptions' | 'acquisition' | 'mix' | 'operations' | 'stock'
export type Granularity = 'day' | 'week' | 'month'

export const REPORT_TABS: Array<{ id: ReportTab; label: string; report: ReportName }> = [
  { id: 'resumo', label: 'Resumo', report: 'summary' },
  { id: 'receita', label: 'Receita', report: 'revenue' },
  { id: 'assinaturas', label: 'Assinaturas', report: 'subscriptions' },
  { id: 'aquisicao', label: 'Aquisição', report: 'acquisition' },
  { id: 'mix', label: 'Pacotes por entrega', report: 'mix' },
  { id: 'operacao', label: 'Operação', report: 'operations' },
  { id: 'estoque', label: 'Estoque', report: 'stock' },
]

export const GRANULARITIES: Array<{ id: Granularity; label: string }> = [
  { id: 'day', label: 'Dia' },
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
]

export type QuickPeriod = '7d' | '30d' | '90d' | '12m'

export const QUICK_PERIODS: Array<{ id: QuickPeriod; label: string; days: number }> = [
  { id: '7d', label: '7 dias', days: 7 },
  { id: '30d', label: '30 dias', days: 30 },
  { id: '90d', label: '90 dias', days: 90 },
  { id: '12m', label: '12 meses', days: 365 },
]

export const MAX_REPORT_DAYS = 366

const TIMEZONES: Record<MarketCode, string> = { BR: 'America/Sao_Paulo', US: 'America/New_York' }
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function reportForTab(tab: ReportTab): ReportName {
  return REPORT_TABS.find((item) => item.id === tab)?.report ?? 'summary'
}

export function parseTab(value: string | null): ReportTab {
  return REPORT_TABS.some((item) => item.id === value) ? value as ReportTab : 'resumo'
}

// Today in the market's own time zone, so "yesterday" matches the API default.
export function marketToday(market: MarketCode, now: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONES[market], year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
}

// Quick periods end yesterday and are stored as concrete dates, so a shared link shows the same window tomorrow.
export function quickRange(period: QuickPeriod, today: string) {
  const days = QUICK_PERIODS.find((item) => item.id === period)?.days ?? 30
  const to = addDays(today, -1)
  return { from: addDays(to, -(days - 1)), to }
}

export function matchQuickPeriod(from: string, to: string, today: string): QuickPeriod | null {
  return QUICK_PERIODS.find((item) => {
    const range = quickRange(item.id, today)
    return range.from === from && range.to === to
  })?.id ?? null
}

export function validateRange(from: string, to: string) {
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return 'Escolha as datas de início e fim.'
  }
  if (from > to) return 'A data de início precisa ser antes da data de fim.'
  if (daysBetween(from, to) > MAX_REPORT_DAYS) return `O período pode ter no máximo ${MAX_REPORT_DAYS} dias.`
  return null
}

export type ReportState = {
  tab: ReportTab
  market: MarketCode
  from: string
  to: string
  granularity: Granularity | null
}

// URL (pt-BR names) to API query. The summary sends no market: the API returns every market in the session.
export function reportQuery(state: ReportState) {
  const report = reportForTab(state.tab)
  return {
    market: report === 'summary' ? undefined : state.market,
    from: state.from,
    to: state.to,
    granularity: state.granularity ?? undefined,
  }
}

export function reportPath(state: ReportState) {
  return `/admin/reports/${reportForTab(state.tab)}${buildQueryString(reportQuery(state))}`
}

export function exportPath(state: ReportState) {
  return `/admin/reports/export.csv${buildQueryString({ report: reportForTab(state.tab), ...reportQuery(state), formato: 'excel' })}`
}

export function exportFilename(state: ReportState, header: string | null) {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null
  if (match) return match[1]
  const market = reportForTab(state.tab) === 'summary' ? 'all' : state.market
  return `eden-${reportForTab(state.tab)}-${market}-${state.from}-${state.to}.csv`
}

export function fetchReport<T>(state: ReportState, token: string | null) {
  return apiRequest<T>(reportPath(state), { token })
}

export function minorToMoney(minor: number | null | undefined, market: MarketCode) {
  if (minor === null || minor === undefined) return '—'
  return formatCurrency(minor / 100, currencyForMarket(market))
}

export function formatCount(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : formatNumber(value)
}

export function formatRate(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `${formatNumber(value * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

export type KpiKind = 'count' | 'money' | 'rate'

const signed = (value: number, suffix: string) => {
  const text = formatNumber(Math.abs(value), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${value < 0 ? '−' : '+'}${text}${suffix}`
}

// Change against the previous period: % for counts and money, p.p. for rates. Omitted when there is nothing to compare with.
export function formatDelta(value: number | null, previous: number | null, kind: KpiKind) {
  if (value === null || previous === null) return null
  if (kind === 'rate') return signed((value - previous) * 100, ' p.p.')
  if (previous === 0) return null
  return signed(((value - previous) / previous) * 100, '%')
}

export function formatKpi(value: number | null, kind: KpiKind, market: MarketCode) {
  if (kind === 'money') return minorToMoney(value, market)
  if (kind === 'rate') return formatRate(value)
  return formatCount(value)
}

export function formatDay(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

export function periodLabel(from: string, to: string) {
  return `${formatDay(from)} a ${formatDay(to)}`
}

export function marketName(market: MarketCode) {
  return MARKET_LABELS[market]
}

export function missingNameMark(market: MarketCode) {
  return `sem nome no catálogo ${market === 'US' ? 'EUA' : 'Brasil'}`
}

export function bucketLabel(bucket: Bucket, granularity: Granularity) {
  const [year, month, day] = bucket.key.split('-')
  if (granularity === 'month') return `${month}/${year.slice(2)}`
  return `${day}/${month}`
}

// ---- Details of one figure ----

export type DetailKind = 'money' | 'count' | 'rate'

export type DetailRecord = {
  id: number
  type: string
  reference: string
  date: string | null
  description: string
  group: { key: string; label: string }
  link: string | null
  contribution?: number | null
  numerator?: number | null
  denominator?: number | null
  approximateDate?: boolean
  customer?: { name: string; link: string }
}

export type DetailTotals = { count: number; contribution?: number; numerator?: number; denominator?: number }

export type ReportDetail = {
  report: ReportName
  indicator: string
  source: { report: ReportName; indicator: string }
  label: string
  title: string
  description: string
  kind: DetailKind
  contributionKind: 'money' | 'count' | null
  market: MarketCode
  currency: 'BRL' | 'USD'
  pointInTime: boolean
  hasPrevious: boolean
  window: {
    from: string | null
    to: string | null
    timezone: string
    previous: boolean
    bucket: { key: string; from: string; to: string; partial: boolean } | null
  }
  value: number | null
  criteria: string[]
  formula: { expression: string; terms: Array<{ label: string; value: number | null; kind: 'money' | 'count' }>; result: number | null }
  groups: Array<{ key: string; label: string } & DetailTotals>
  totals: DetailTotals
  excluded: Array<{ reason: string; count: number; items: DetailRecord[] }>
  reconciliation: { reportValue: number | null; recordsValue: number | null; matches: boolean }
  records: { items: DetailRecord[]; page: number; perPage: number; total: number }
  generatedAt: string
}

export const DETAIL_PER_PAGE = 50

export type DetailState = {
  tab: ReportTab
  market: MarketCode
  from: string
  to: string
  granularity: Granularity | null
  indicator: string
  bucket: string | null
  previous: boolean
  page: number
}

const DETAIL_PATH = '/reports/detalhe'

function query(values: Record<string, string | null | undefined>) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== '') params.set(key, value)
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

// Panel URL of the details of one figure, carrying the Reports filters so "Voltar" restores them.
export function detailLink(state: ReportState, indicator: string, extras: { bucket?: string; market?: MarketCode; previous?: boolean } = {}) {
  return `${DETAIL_PATH}${query({
    aba: state.tab,
    indicador: indicator,
    mercado: extras.market ?? state.market,
    de: state.from,
    ate: state.to,
    granularidade: state.granularity,
    bucket: extras.bucket,
    anterior: extras.previous ? '1' : null,
  })}`
}

export type DetailLinkFor = (indicator: string, extras?: { bucket?: string; market?: MarketCode; previous?: boolean }) => string

export function parseDetailParams(params: URLSearchParams): Omit<DetailState, 'market'> & { market: string | null } {
  const granularity = params.get('granularidade')
  const page = Number.parseInt(params.get('pagina') ?? '', 10)
  return {
    tab: parseTab(params.get('aba')),
    market: params.get('mercado'),
    from: params.get('de') ?? '',
    to: params.get('ate') ?? '',
    granularity: GRANULARITIES.some((item) => item.id === granularity) ? granularity as Granularity : null,
    indicator: params.get('indicador') ?? '',
    bucket: params.get('bucket') || null,
    previous: params.get('anterior') === '1',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

// The details page URL with some fields changed (period switch, page).
export function detailPagePath(state: DetailState, changes: Partial<DetailState> = {}) {
  const next = { ...state, ...changes }
  return `${DETAIL_PATH}${query({
    aba: next.tab,
    indicador: next.indicator,
    mercado: next.market,
    de: next.from,
    ate: next.to,
    granularidade: next.granularity,
    bucket: next.bucket,
    anterior: next.previous ? '1' : null,
    pagina: next.page > 1 ? String(next.page) : null,
  })}`
}

// Back to the tab the figure came from, with the same filters.
export function reportsLink(state: Pick<DetailState, 'tab' | 'market' | 'from' | 'to' | 'granularity'>) {
  return `/reports${query({ aba: state.tab, mercado: state.market, de: state.from, ate: state.to, granularidade: state.granularity })}`
}

function detailQuery(state: DetailState) {
  return {
    report: reportForTab(state.tab),
    indicator: state.indicator,
    market: state.market,
    from: state.from,
    to: state.to,
    granularity: state.granularity ?? undefined,
    bucket: state.bucket ?? undefined,
    period: state.previous ? 'previous' : undefined,
  }
}

export function detailApiPath(state: DetailState) {
  return `/admin/reports/details${buildQueryString({ ...detailQuery(state), page: String(state.page), perPage: String(DETAIL_PER_PAGE) })}`
}

export function detailExportPath(state: DetailState) {
  return `/admin/reports/details/export.csv${buildQueryString({ ...detailQuery(state), formato: 'excel' })}`
}

export function fetchReportDetail(state: DetailState, token: string | null) {
  return apiRequest<ReportDetail>(detailApiPath(state), { token })
}

export function formatDetailValue(value: number | null | undefined, kind: DetailKind | 'money' | 'count', market: MarketCode) {
  return formatKpi(value ?? null, kind, market)
}
