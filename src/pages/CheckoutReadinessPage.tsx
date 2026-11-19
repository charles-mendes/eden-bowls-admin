import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { useAuth } from '../contexts/AuthContext'
import {
  emptyMessage,
  fetchCheckoutReadiness,
  inFilter,
  noteMessage,
  parseReadinessFilter,
  readinessAction,
  warningMessage,
  type CheckoutReadiness,
  type ReadinessFilter,
} from '../lib/checkoutReadiness'
import { plural } from '../lib/productionQueue'

const SEVERITY_LABEL = { high: 'Alta', medium: 'Média' } as const
const SEVERITY_ORDER = { high: 0, medium: 1 } as const
const FILTERS: Array<[ReadinessFilter, string]> = [['todos', 'Todos'], ['br', 'Brasil'], ['us', 'EUA']]

// Admin only: what would make store checkout fail, per country, each row linked to the screen that fixes it.
export function CheckoutReadinessPage() {
  const { token } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const filter = parseReadinessFilter(searchParams.get('pais'))
  const [data, setData] = useState<CheckoutReadiness | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const response = await fetchCheckoutReadiness(token)
        if (!cancelled) setData(response)
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Falha ao conferir o checkout')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [token, reload])

  const setFilter = (value: ReadinessFilter) => {
    const next = new URLSearchParams(searchParams)
    if (value === 'todos') next.delete('pais')
    else next.set('pais', value)
    setSearchParams(next, { replace: true })
  }

  const warnings = (data?.warnings ?? [])
    .filter((item) => inFilter(filter, item.market))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  const notes = (data?.notes ?? []).filter((item) => inFilter(filter, item.market))

  return (
    <PageFrame
      eyebrow="Operação"
      title="Checkout da loja"
      description="O que faria o pagamento falhar na loja agora, por país. Cada linha some quando o ponto fica certo."
      actions={(
        <div className="day-toolbar">
          <div className="segmented" role="group" aria-label="País">
            {FILTERS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="ghost-button" onClick={() => setReload((value) => value + 1)} disabled={loading}>
            {loading ? 'Conferindo…' : 'Conferir de novo'}
          </button>
        </div>
      )}
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}

      <section className="day-section" aria-labelledby="readiness-warnings">
        <div className="day-section-head">
          <h3 id="readiness-warnings">Avisos</h3>
          {warnings.length > 0 ? (
            <span className="muted">{plural(warnings.length, 'aviso', 'avisos')}, do mais grave para o menos grave</span>
          ) : null}
        </div>
        {!data ? (
          <p className="muted">{loading ? 'Conferindo…' : '—'}</p>
        ) : warnings.length === 0 ? (
          <p className="day-all-clear">{emptyMessage(filter)}</p>
        ) : (
          <ul className="day-pending">
            {warnings.map((item) => {
              const action = readinessAction(item.action)
              return (
                <li key={item.key}>
                  <span className={`day-severity day-severity-${item.severity}`}>{SEVERITY_LABEL[item.severity]}</span>
                  <div className="day-pending-text">
                    <strong>{item.market === 'BR' ? 'Brasil' : 'EUA'}</strong>
                    <span>{warningMessage(item)}</span>
                  </div>
                  {action ? <Link className="ghost-button" to={action.to}>{action.label}</Link> : null}
                </li>
              )
            })}
          </ul>
        )}
        {notes.length > 0 ? (
          <ul className="muted day-note" aria-label="Notas">
            {notes.map((item) => <li key={item.key}>{noteMessage(item)}</li>)}
          </ul>
        ) : null}
      </section>
    </PageFrame>
  )
}
