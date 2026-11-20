import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Pager } from '../components/Pager'
import { ReportTable } from '../components/reports/ReportTable'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, getApiBaseUrl } from '../lib/api'
import { formatNumber } from '../lib/format'
import { MARKET_LABELS, defaultMarket, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  REPORT_TABS,
  detailExportPath,
  detailPagePath,
  fetchReportDetail,
  formatDay,
  formatDetailValue,
  parseDetailParams,
  reportsLink,
  type DetailRecord,
  type DetailState,
  type ReportDetail,
} from '../lib/reports'

type Loaded = { key: string; data: ReportDetail | null; error: string | null }

// Instants in the market's own time zone; calendar dates as they are.
function formatWhen(value: string | null, timeZone: string) {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDay(value)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function windowText(detail: ReportDetail) {
  if (detail.pointInTime) return 'Retrato de agora'
  const { window } = detail
  const range = window.from && window.to ? (window.from === window.to ? formatDay(window.from) : `${formatDay(window.from)} a ${formatDay(window.to)}`) : ''
  if (window.bucket) return `Ponto do gráfico: ${range}${window.bucket.partial ? ' (parcial)' : ''}`
  return `${window.previous ? 'Período anterior' : 'Período'}: ${range}`
}

export function ReportDetailPage() {
  const { user, token, hasPermission } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const parsed = parseDetailParams(params)
  const markets = sessionMarkets(user)
  const requested = parsed.market === 'BR' || parsed.market === 'US' ? parsed.market : null
  const market: MarketCode | null = requested && markets.includes(requested) ? requested : defaultMarket(user)
  const state: DetailState | null = market && parsed.indicator ? { ...parsed, market } : null
  const key = state ? detailPagePath(state) : ''
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !state) return
    let active = true
    fetchReportDetail(state, token)
      .then((data) => { if (active) setLoaded({ key, data, error: null }) })
      .catch((error: unknown) => {
        if (!active) return
        const message = error instanceof ApiRequestError || error instanceof Error ? error.message : 'Não foi possível carregar o detalhamento.'
        setLoaded({ key, data: null, error: message })
      })
    return () => { active = false }
    // The URL decides what to load; `state` is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key])

  const tabLabel = REPORT_TABS.find((item) => item.id === parsed.tab)?.label ?? 'Relatórios'
  const back = market ? reportsLink({ ...parsed, market }) : '/reports'
  const backLink = <Link className="ghost-button" to={back}>← Voltar para Relatórios</Link>

  if (!user) {
    return <PageFrame title="Detalhamento" description="Carregando sessão." />
  }
  if (!state) {
    return (
      <PageFrame title="Detalhamento" description="Indicador não informado." actions={backLink}>
        <div className="alert" role="alert">Abra o detalhamento a partir de um número da tela de Relatórios.</div>
      </PageFrame>
    )
  }

  const current = loaded && loaded.key === key ? loaded : null
  const detail = current?.data ?? null

  const download = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const response = await fetch(`${getApiBaseUrl()}${detailExportPath(state)}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(body?.message || 'Não foi possível exportar o CSV.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const match = /filename="?([^";]+)"?/i.exec(response.headers.get('Content-Disposition') ?? '')
      anchor.href = url
      anchor.download = match ? match[1] : `eden-${state.indicator}.csv`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Não foi possível exportar o CSV.')
    } finally {
      setExporting(false)
    }
  }

  const actions = (
    <div className="report-toolbar">
      {backLink}
      {detail?.hasPrevious ? (
        <div className="segmented" role="group" aria-label="Comparação">
          <button type="button" aria-pressed={!state.previous} className={!state.previous ? 'active' : ''} onClick={() => navigate(detailPagePath(state, { previous: false, page: 1 }))}>
            Período atual
          </button>
          <button type="button" aria-pressed={state.previous} className={state.previous ? 'active' : ''} onClick={() => navigate(detailPagePath(state, { previous: true, page: 1 }))}>
            Período anterior
          </button>
        </div>
      ) : null}
      {hasPermission('reports.export') ? (
        <button type="button" className="ghost-button" disabled={exporting || !detail} onClick={download}>
          {exporting ? 'Exportando…' : 'Exportar CSV'}
        </button>
      ) : null}
    </div>
  )

  if (!current) {
    return (
      <PageFrame eyebrow={`Relatórios · ${tabLabel}`} title="Detalhamento" description={`${MARKET_LABELS[market as MarketCode]}`} actions={actions}>
        <p className="muted report-loading" aria-busy="true">Carregando detalhamento…</p>
      </PageFrame>
    )
  }
  if (!detail) {
    return (
      <PageFrame eyebrow={`Relatórios · ${tabLabel}`} title="Detalhamento" description={`${MARKET_LABELS[market as MarketCode]}`} actions={actions}>
        <div className="alert" role="alert">{current.error}</div>
      </PageFrame>
    )
  }

  const value = (amount: number | null | undefined, kind: 'money' | 'count' | 'rate' = detail.kind) => formatDetailValue(amount ?? null, kind, detail.market)
  const isRatio = detail.formula.terms.length === 2 && detail.contributionKind === null
  const termKind = (index: number) => detail.formula.terms[index]?.kind ?? 'count'
  const hasCustomer = detail.records.items.some((record) => record.customer)
  const totalPages = Math.max(1, Math.ceil(detail.records.total / detail.records.perPage))
  const { reconciliation } = detail

  const recordColumns = (withAmount: boolean) => [
    {
      key: 'reference',
      label: 'Registro',
      cell: (record: DetailRecord) => (record.link ? <Link className="table-link" to={record.link}>{record.reference}</Link> : record.reference),
    },
    { key: 'date', label: 'Data', cell: (record: DetailRecord) => formatWhen(record.date, detail.window.timezone) },
    { key: 'group', label: 'Grupo', align: 'left' as const, cell: (record: DetailRecord) => record.group.label },
    {
      key: 'description',
      label: 'Descrição',
      align: 'left' as const,
      cell: (record: DetailRecord) => (
        <>
          {record.description}
          {record.approximateDate ? <span className="badge-info"> data aproximada</span> : null}
        </>
      ),
    },
    ...(hasCustomer ? [{
      key: 'customer',
      label: 'Cliente',
      align: 'left' as const,
      cell: (record: DetailRecord) => (record.customer ? <Link className="table-link" to={record.customer.link}>{record.customer.name || '—'}</Link> : '—'),
    }] : []),
    ...(withAmount && !isRatio ? [{
      key: 'contribution',
      label: 'Contribuição',
      cell: (record: DetailRecord) => value(record.contribution, detail.contributionKind ?? 'count'),
    }] : []),
    ...(withAmount && isRatio ? [
      { key: 'numerator', label: detail.formula.terms[0].label, cell: (record: DetailRecord) => value(record.numerator, termKind(0)) },
      { key: 'denominator', label: detail.formula.terms[1].label, cell: (record: DetailRecord) => value(record.denominator, termKind(1)) },
    ] : []),
  ]

  const footer = [
    'Total',
    '',
    '',
    `${formatNumber(detail.totals.count)} registro(s)`,
    ...(hasCustomer ? [''] : []),
    ...(isRatio
      ? [value(detail.totals.numerator, termKind(0)), value(detail.totals.denominator, termKind(1))]
      : [value(detail.totals.contribution, detail.contributionKind ?? 'count')]),
  ]

  return (
    <PageFrame
      eyebrow={`Relatórios · ${tabLabel}`}
      title={detail.title}
      description={`${detail.description} ${MARKET_LABELS[detail.market]} · ${windowText(detail)}.`}
      actions={actions}
    >
      {exportError ? <div className="alert" role="alert">{exportError}</div> : null}
      {!reconciliation.matches ? (
        <div className="alert" role="alert">
          A soma dos registros ({value(reconciliation.recordsValue)}) não confere com o valor do relatório ({value(reconciliation.reportValue)}).
        </div>
      ) : null}

      <div className="report-body">
        <div className="insights-metrics">
          <div className="day-card">
            <span className="day-card-label">Valor no relatório</span>
            <strong className="insights-value">{value(detail.value)}</strong>
            <span className="muted">{windowText(detail)}</span>
          </div>
          <div className="day-card">
            <span className="day-card-label">Calculado pelos registros</span>
            <strong className="insights-value">{value(reconciliation.recordsValue)}</strong>
            <span className={reconciliation.matches ? 'insights-delta-good' : 'insights-delta-bad'}>
              {reconciliation.matches ? 'Confere com o relatório' : 'Não confere com o relatório'}
            </span>
          </div>
          <div className="day-card">
            <span className="day-card-label">Registros considerados</span>
            <strong className="insights-value">{formatNumber(detail.totals.count)}</strong>
            {detail.excluded.length ? (
              <span className="muted">{formatNumber(detail.excluded.reduce((sum, rule) => sum + rule.count, 0))} fora do cálculo</span>
            ) : null}
          </div>
        </div>

        <div className="insights-split">
          <section className="insights-panel" aria-labelledby="detail-criteria">
            <h3 id="detail-criteria">Critérios e filtros</h3>
            <ul className="report-criteria">
              {detail.criteria.map((text) => <li key={text}>{text}</li>)}
            </ul>
          </section>
          <section className="insights-panel" aria-labelledby="detail-formula">
            <h3 id="detail-formula">Memória de cálculo</h3>
            <p><strong>{detail.formula.expression}</strong></p>
            <dl className="report-formula">
              {detail.formula.terms.map((term) => (
                <div key={term.label}>
                  <dt>{term.label}</dt>
                  <dd>{value(term.value, term.kind)}</dd>
                </div>
              ))}
              <div className="report-total">
                <dt>Resultado</dt>
                <dd>{value(detail.formula.result)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {detail.groups.length ? (
          <section className="insights-panel" aria-labelledby="detail-groups">
            <h3 id="detail-groups">Subtotais</h3>
            <ReportTable
              caption="Subtotais"
              rowKey={(group) => group.key || '—'}
              rows={detail.groups}
              columns={[
                { key: 'label', label: 'Grupo', cell: (group) => group.label },
                { key: 'count', label: 'Registros', cell: (group) => formatNumber(group.count) },
                ...(isRatio
                  ? [
                    { key: 'numerator', label: detail.formula.terms[0].label, cell: (group: typeof detail.groups[number]) => value(group.numerator, termKind(0)) },
                    { key: 'denominator', label: detail.formula.terms[1].label, cell: (group: typeof detail.groups[number]) => value(group.denominator, termKind(1)) },
                  ]
                  : [{ key: 'contribution', label: 'Subtotal', cell: (group: typeof detail.groups[number]) => value(group.contribution, detail.contributionKind ?? 'count') }]),
              ]}
              footer={[
                'Total',
                formatNumber(detail.totals.count),
                ...(isRatio
                  ? [value(detail.totals.numerator, termKind(0)), value(detail.totals.denominator, termKind(1))]
                  : [value(detail.totals.contribution, detail.contributionKind ?? 'count')]),
              ]}
            />
          </section>
        ) : null}

        <section className="insights-panel" aria-labelledby="detail-records">
          <h3 id="detail-records">Registros</h3>
          <ReportTable
            caption="Registros do indicador"
            rowKey={(record) => `${record.type}-${record.id}`}
            rows={detail.records.items}
            empty={detail.formula.terms.length ? 'Nenhum registro compõe este valor.' : 'Este valor é uma configuração e não vem de registros.'}
            columns={recordColumns(true)}
            footer={footer}
          />
          {detail.records.total > detail.records.perPage ? (
            <Pager
              page={detail.records.page}
              totalPages={totalPages}
              onPrev={() => navigate(detailPagePath(state, { page: Math.max(1, state.page - 1) }))}
              onNext={() => navigate(detailPagePath(state, { page: Math.min(totalPages, state.page + 1) }))}
            />
          ) : null}
        </section>

        {detail.excluded.map((rule) => (
          <section key={rule.reason} className="insights-panel" aria-label={`Fora do cálculo: ${rule.reason}`}>
            <div>
              <h3>Fora do cálculo: {rule.reason}</h3>
              <p className="muted">{formatNumber(rule.count)} registro(s), listados para conferência e não somados.</p>
            </div>
            <ReportTable
              caption={`Fora do cálculo: ${rule.reason}`}
              rowKey={(record) => `${record.type}-${record.id}`}
              rows={rule.items}
              empty="Nenhum registro."
              columns={recordColumns(false)}
            />
          </section>
        ))}
      </div>
    </PageFrame>
  )
}
