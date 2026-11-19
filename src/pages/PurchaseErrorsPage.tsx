import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BrDateInput } from '../components/BrDateInput'
import { PageFrame } from '../components/PageFrame'
import { TrailEventsTable } from '../components/PurchaseTrail'
import { TRAIL_AREAS, TRAIL_STATUS, trailErrorText, type TrailAttempt, type TrailEvent } from '../lib/purchaseTrail'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { formatDate } from '../lib/format'
import { MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'

// purchase-error-monitor (backend): what already failed on the way to a purchase, for every customer of one market.
// Read only. Checkout da loja shows what would fail now; this page shows what did.
export type FailureRow = {
  kind: 'attempt' | 'webhook'
  occurred_at: string | null
  market: 'br' | 'us'
  user_id: number | null
  email: string | null
  area: string
  step: string | null
  action: string | null
  attempt_status: TrailAttempt['status'] | null
  stripe_event_type: string | null
  http_status: number | null
  error_code: string | null
  error_message: string | null
  stripe_code: string | null
  stripe_type: string | null
  stripe_param: string | null
  attempt: { id: number } | null
  events: TrailEvent[]
}

type ConfigEvent = { id: number; action: string; target_ref: string | null; outcome: 'ok' | 'failed'; error_code: string | null; actor_admin_id: number | null; created_at: string | null }

const AREA_FILTERS: Array<[string, string]> = [['', 'Todas'], ['onboarding', 'Onboarding'], ['plan', 'Plano'], ['checkout', 'Checkout'], ['subscription', 'Assinatura'], ['webhook', 'Webhook Stripe']]
const DAY_MS = 24 * 60 * 60 * 1000

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function loadError(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && error.status === 403) return 'Seu papel não lê os erros de compra deste mercado.'
  return error instanceof Error ? error.message : fallback
}

function FailureItem({ row }: { row: FailureRow }) {
  const status = row.attempt_status ? TRAIL_STATUS[row.attempt_status] ?? { label: row.attempt_status, className: 'badge-info' } : null
  const customer = row.user_id
    ? <Link to={`/users/${row.user_id}?aba=trilha&mercado=${row.market.toUpperCase()}`}>{row.email || `cliente ${row.user_id}`}</Link>
    : <span className="muted">cliente não resolvido</span>
  return (
    <details className="checkout-history-item purchase-error-item">
      <summary>
        <span className="muted purchase-error-when">{formatDate(row.occurred_at)}</span>
        <strong>{TRAIL_AREAS[row.area] ?? row.area}</strong>
        <span>{row.step || '-'}{row.action ? ` · ${row.action}` : ''}</span>
        {row.error_code ? <span className="muted">{row.error_code}</span> : null}
        {status ? <span className={status.className}>{status.label}</span> : <span className="badge-error">Webhook</span>}
      </summary>
      <div className="stack checkout-history-body">
        <dl className="purchase-error-facts">
          <div><dt>Mercado</dt><dd>{MARKET_LABELS[row.market.toUpperCase() as MarketCode]}</dd></div>
          <div><dt>Cliente</dt><dd>{customer}</dd></div>
          <div><dt>HTTP</dt><dd>{row.http_status ?? '-'}</dd></div>
          <div><dt>Erro</dt><dd>{trailErrorText(row) || '-'}</dd></div>
          <div><dt>Mensagem</dt><dd>{row.error_message || '-'}</dd></div>
          {row.stripe_event_type ? <div><dt>Evento Stripe</dt><dd>{row.stripe_event_type}</dd></div> : null}
        </dl>
        {row.kind === 'attempt' ? <TrailEventsTable events={row.events} label="Passos da tentativa" /> : null}
      </div>
    </details>
  )
}

export function PurchaseErrorsPage() {
  const { token, user } = useAuth()
  const allowed = sessionMarkets(user)
  const markets: MarketCode[] = allowed.length ? allowed : ['BR']
  const [market, setMarket] = useState<MarketCode>(markets[0])
  const today = new Date()
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 7 * DAY_MS)))
  const [to, setTo] = useState(isoDay(today))
  const [area, setArea] = useState('')
  const [code, setCode] = useState('')
  const [appliedCode, setAppliedCode] = useState('')
  const [reload, setReload] = useState(0)
  // Keyed by the filters: a result of other filters reads as loading, without setState inside the effect.
  const key = `${market}|${from}|${to}|${area}|${appliedCode}|${reload}`
  const [list, setList] = useState<{ key: string; rows: FailureRow[]; next: string | null; error: string }>({ key: '', rows: [], next: null, error: '' })
  const [config, setConfig] = useState<{ key: string; events: ConfigEvent[]; error: string }>({ key: '', events: [], error: '' })
  const [more, setMore] = useState(false)
  const loading = list.key !== key || more
  const rows = list.key === key ? list.rows : null
  const next = list.key === key ? list.next : null
  const error = list.key === key ? list.error : ''
  const dateFormat = market === 'US' ? 'us' : 'br'
  const minDay = isoDay(new Date(today.getTime() - 180 * DAY_MS))

  const query = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ market: market.toLowerCase(), from, to, ...extra })
    if (area) params.set('area', area)
    if (appliedCode) params.set('error_code', appliedCode)
    return params.toString()
  }

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const period = new URLSearchParams({ market: market.toLowerCase(), outcome: 'failed', from, to }).toString()
    apiRequest<{ data: { rows: FailureRow[]; next_before: string | null } }>(`/admin/purchase-trail/errors?${query()}`, { token })
      .then((response) => { if (!cancelled) setList({ key, rows: response.data.rows, next: response.data.next_before, error: '' }) })
      .catch((requestError: unknown) => { if (!cancelled) setList({ key, rows: [], next: null, error: loadError(requestError, 'Não foi possível carregar os erros.') }) })
    apiRequest<{ data: { events: ConfigEvent[] } }>(`/admin/purchase-trail/config-events?${period}`, { token })
      .then((response) => { if (!cancelled) setConfig({ key, events: response.data.events ?? [], error: '' }) })
      .catch((requestError: unknown) => { if (!cancelled) setConfig({ key, events: [], error: loadError(requestError, 'Não foi possível carregar a configuração.') }) })
    return () => { cancelled = true }
    // query() reads the same state the key is made of.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key])

  const loadMore = async () => {
    if (!token || !next) return
    setMore(true)
    try {
      const response = await apiRequest<{ data: { rows: FailureRow[]; next_before: string | null } }>(`/admin/purchase-trail/errors?${query({ before: next })}`, { token })
      setList((current) => current.key === key ? { ...current, rows: [...current.rows, ...response.data.rows], next: response.data.next_before } : current)
    } catch (requestError) {
      setList((current) => current.key === key ? { ...current, error: loadError(requestError, 'Não foi possível carregar os erros.') } : current)
    } finally {
      setMore(false)
    }
  }

  return (
    <PageFrame
      eyebrow="Operação"
      title="Erros de compra"
      description="O que já falhou no caminho da compra, de todos os clientes de um mercado. Só leitura; o status mostra como a tentativa terminou."
      actions={(
        <div className="day-toolbar">
          {markets.length > 1 ? (
            <div className="segmented" role="group" aria-label="Mercado">
              {markets.map((option) => (
                <button key={option} type="button" aria-pressed={market === option} className={market === option ? 'active' : ''} onClick={() => setMarket(option)}>
                  {MARKET_LABELS[option]}
                </button>
              ))}
            </div>
          ) : <span className="badge-info">{MARKET_LABELS[market]}</span>}
          <button type="button" className="ghost-button" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            {loading ? 'Carregando…' : 'Atualizar'}
          </button>
        </div>
      )}
    >
      <form className="purchase-error-filters" onSubmit={(event) => { event.preventDefault(); setAppliedCode(code.trim()) }}>
        {/* The day format follows the market: dd/mm/aaaa for Brasil, mm/dd/yyyy for the United States. */}
        <label>De <BrDateInput format={dateFormat} value={from} min={minDay} max={to} onChange={(value) => value && setFrom(value)} /></label>
        <label>Até <BrDateInput format={dateFormat} value={to} min={from} onChange={(value) => value && setTo(value)} /></label>
        <label>Área
          <select value={area} onChange={(event) => setArea(event.target.value)}>
            {AREA_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Código de erro <input type="search" value={code} placeholder="ex.: invalid_zipcode" onChange={(event) => setCode(event.target.value)} onBlur={() => setAppliedCode(code.trim())} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setAppliedCode(code.trim()) } }} /></label>
      </form>

      {error ? <div className="alert" role="alert">{error}</div> : null}

      <section className="day-section" aria-labelledby="purchase-errors-list">
        <div className="day-section-head">
          <h3 id="purchase-errors-list">Falhas · {MARKET_LABELS[market]}</h3>
        </div>
        {rows === null ? (
          <p className="muted" aria-busy={loading}>{loading ? 'Carregando…' : '—'}</p>
        ) : rows.length === 0 ? (
          <p className="day-all-clear">Nenhuma falha neste mercado e período.</p>
        ) : (
          <div className="stack">
            {rows.map((row, index) => <FailureItem key={`${row.kind}:${row.attempt?.id ?? index}`} row={row} />)}
            {next ? <button type="button" className="ghost-button" onClick={() => void loadMore()} disabled={loading}>Carregar mais</button> : null}
          </div>
        )}
      </section>

      <section className="day-section" aria-labelledby="purchase-errors-config">
        <div className="day-section-head">
          <h3 id="purchase-errors-config">Configuração com falha · {MARKET_LABELS[market]}</h3>
          <span className="muted">Cupom, frete, catálogo e life stage, no mesmo período</span>
        </div>
        {config.key !== key ? <p className="muted">—</p> : config.error ? <div className="alert">{config.error}</div> : config.events.length === 0 ? (
          <p className="day-all-clear">Nenhuma mudança de configuração falhou neste período.</p>
        ) : (
          <div className="table-shell table-scroll">
            <table className="history-table stack-table" aria-label="Configuração com falha">
              <thead>
                <tr><th scope="col">Quando</th><th scope="col">Ação</th><th scope="col">Alvo</th><th scope="col">Erro</th><th scope="col">Operador</th></tr>
              </thead>
              <tbody>
                {config.events.map((event) => (
                  <tr key={event.id}>
                    <td data-label="Quando">{formatDate(event.created_at)}</td>
                    <td data-label="Ação">{event.action}</td>
                    <td data-label="Alvo">{event.target_ref || '-'}</td>
                    <td data-label="Erro">{event.error_code || '-'}</td>
                    <td data-label="Operador">{event.actor_admin_id ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageFrame>
  )
}
