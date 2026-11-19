import { useEffect, useState } from 'react'
import type { AdminUser } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { formatDate, formatTermMonths } from '../lib/format'
import { MARKET_LABELS, sessionMarkets, type MarketCode } from '../lib/markets'
import { Section } from './Section'

// customer-purchase-trail (backend): what the customer did on the way to a purchase, or to a change of a bought
// subscription, and what failed there. Read only, one market at a time: BR and US never share a list.
type TrailError = {
  http_status: number | null
  error_code: string | null
  error_message: string | null
  stripe_code: string | null
  stripe_type: string | null
  stripe_param: string | null
}

export type TrailEvent = TrailError & {
  id: number
  area: string
  step: string
  action: string | null
  outcome: 'ok' | 'failed'
  pet_id: number | null
  subscription_id: string | null
  stripe_event_id: string | null
  stripe_event_type: string | null
  created_at: string | null
}

export type TrailAttempt = TrailError & {
  id: number
  market: 'br' | 'us'
  area: string
  status: 'in_progress' | 'paid' | 'completed' | 'failed'
  final_step: string | null
  attempt_id: string | null
  term_months: number | null
  currency: string | null
  promotion_code_id: string | null
  subscription_id: string | null
  stripe_account: string | null
  started_at: string | null
  finished_at: string | null
  events: TrailEvent[]
}

type CustomerTrail = { market: 'br' | 'us'; attempts: TrailAttempt[]; unlinked_events: TrailEvent[] }

type ConfigEvent = {
  id: number
  action: string
  target_ref: string | null
  outcome: 'ok' | 'failed'
  error_code: string | null
  actor_admin_id: number | null
  created_at: string | null
}

const STATUS: Record<TrailAttempt['status'], { label: string; className: string }> = {
  in_progress: { label: 'Em andamento', className: 'badge-info' },
  paid: { label: 'Pago', className: 'badge-success' },
  completed: { label: 'Concluída', className: 'badge-success' },
  failed: { label: 'Falhou', className: 'badge-error' },
}

const AREAS: Record<string, string> = {
  onboarding: 'Onboarding',
  plan: 'Plano',
  checkout: 'Checkout',
  subscription: 'Assinatura',
  webhook: 'Webhook Stripe',
}

function errorText(item: TrailError) {
  const parts = [item.error_code, item.stripe_code && item.stripe_code !== item.error_code ? `Stripe: ${item.stripe_code}` : null, item.stripe_param ? `campo ${item.stripe_param}` : null]
  return parts.filter(Boolean).join(' · ')
}

function EventsTable({ events, label }: { events: TrailEvent[]; label: string }) {
  if (!events.length) return <p className="empty-note">Nenhum passo registrado.</p>
  return (
    <div className="table-shell table-scroll">
      <table className="history-table stack-table" aria-label={label}>
        <thead>
          <tr>
            <th scope="col">Quando</th>
            <th scope="col">Passo</th>
            <th scope="col">Resultado</th>
            <th scope="col">Erro</th>
            <th scope="col">Mensagem ao cliente</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id}>
              <td data-label="Quando">{formatDate(event.created_at)}</td>
              <td data-label="Passo">
                <span>
                  {event.step}{event.action ? ` · ${event.action}` : ''}
                  {event.pet_id ? <span className="muted"> · pet {event.pet_id}</span> : null}
                  {event.stripe_event_type ? <span className="muted"> · {event.stripe_event_type}</span> : null}
                </span>
              </td>
              <td data-label="Resultado">
                <span>
                  <span className={event.outcome === 'ok' ? 'badge-success' : 'badge-error'}>{event.outcome === 'ok' ? 'OK' : 'Falhou'}</span>
                  {event.http_status ? <span className="muted"> {event.http_status}</span> : null}
                </span>
              </td>
              <td data-label="Erro">{errorText(event) || '-'}</td>
              <td data-label="Mensagem ao cliente">{event.error_message || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AttemptItem({ attempt, open }: { attempt: TrailAttempt; open: boolean }) {
  const status = STATUS[attempt.status] ?? { label: attempt.status, className: 'badge-info' }
  const meta = [
    attempt.term_months ? formatTermMonths(attempt.term_months) : null,
    attempt.currency,
    attempt.subscription_id,
    attempt.promotion_code_id ? `cupom ${attempt.promotion_code_id}` : null,
    attempt.attempt_id ? `tentativa ${attempt.attempt_id}` : null,
  ].filter(Boolean)
  return (
    <details className="checkout-history-item" open={open}>
      <summary>
        <strong>{AREAS[attempt.area] ?? attempt.area}</strong>
        <span className={status.className}>{status.label}</span>
        {attempt.status === 'failed' && attempt.error_code ? <span className="muted">{attempt.error_code}</span> : null}
        <span className="muted checkout-history-date">Início {formatDate(attempt.started_at)}</span>
      </summary>
      <div className="stack checkout-history-body">
        {meta.length ? <p className="muted">{meta.join(' · ')}</p> : null}
        <EventsTable events={attempt.events} label="Passos da tentativa" />
      </div>
    </details>
  )
}

function initialMarket(user: AdminUser | null, customerCountry?: MarketCode): MarketCode {
  const allowed = sessionMarkets(user)
  if (customerCountry && (!allowed.length || allowed.includes(customerCountry))) return customerCountry
  return allowed[0] ?? 'BR'
}

export function PurchaseTrail({ userId, token, user, customerCountry }: { userId: string; token: string; user: AdminUser | null; customerCountry?: MarketCode }) {
  const [market, setMarket] = useState<MarketCode>(() => initialMarket(user, customerCountry))
  const [trail, setTrail] = useState<{ key: string; data: CustomerTrail | null; config: ConfigEvent[]; error: string }>({ key: '', data: null, config: [], error: '' })
  const key = `${userId}|${market}`
  const allowed = sessionMarkets(user)
  const markets: MarketCode[] = allowed.length ? allowed : [market]

  useEffect(() => {
    let cancelled = false
    const query = `market=${market.toLowerCase()}`
    Promise.all([
      apiRequest<{ data: CustomerTrail }>(`/admin/users/${userId}/purchase-trail?${query}`, { token }),
      apiRequest<{ data: { events: ConfigEvent[] } }>(`/admin/purchase-trail/config-events?${query}`, { token }),
    ]).then(([customer, config]) => {
      if (!cancelled) setTrail({ key, data: customer.data, config: config.data?.events ?? [], error: '' })
    }).catch((error: unknown) => {
      if (cancelled) return
      const message = error instanceof ApiRequestError && error.status === 403
        ? 'Seu papel não lê a trilha de compra deste mercado.'
        : error instanceof Error ? error.message : 'Não foi possível carregar a trilha.'
      setTrail({ key, data: null, config: [], error: message })
    })
    return () => { cancelled = true }
  }, [key, market, token, userId])

  const loading = trail.key !== key
  const data = loading ? null : trail.data

  return (
    <div className="page-stack">
      <Section
        title={`Trilha de compra · ${MARKET_LABELS[market]}`}
        description="Passos do cliente até comprar ou mudar a assinatura, e o erro de cada um. Só leitura; BR e US em listas separadas."
        actions={markets.length > 1 ? (
          <div className="segmented" role="group" aria-label="Mercado">
            {markets.map((option) => (
              <button key={option} type="button" aria-pressed={market === option} className={market === option ? 'active' : ''} onClick={() => setMarket(option)}>
                {MARKET_LABELS[option]}
              </button>
            ))}
          </div>
        ) : <span className="badge-info">{MARKET_LABELS[market]}</span>}
      >
        {!loading && trail.error ? <div className="alert">{trail.error}</div> : null}
        {loading ? <p className="muted" aria-busy="true">Carregando…</p> : null}
        {data ? (
          data.attempts.length ? (
            <div className="stack">
              {data.attempts.map((attempt, index) => <AttemptItem key={attempt.id} attempt={attempt} open={index === 0} />)}
            </div>
          ) : <p className="empty-note">Nenhuma tentativa neste mercado.</p>
        ) : null}
      </Section>

      {data && data.unlinked_events.length ? (
        <Section title="Webhooks Stripe sem tentativa" description="Eventos da Stripe deste cliente e mercado que não se ligaram a uma tentativa.">
          <EventsTable events={data.unlinked_events} label="Webhooks sem tentativa" />
        </Section>
      ) : null}

      {!loading && !trail.error ? (
        <Section title={`Configuração do mercado · ${MARKET_LABELS[market]}`} description="Mudanças de cupom, frete, catálogo e life stage que afetam a compra de todos os clientes deste mercado.">
          {trail.config.length ? (
            <div className="table-shell table-scroll">
              <table className="history-table stack-table" aria-label="Configuração do mercado">
                <thead>
                  <tr>
                    <th scope="col">Quando</th>
                    <th scope="col">Ação</th>
                    <th scope="col">Alvo</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Operador</th>
                  </tr>
                </thead>
                <tbody>
                  {trail.config.map((event) => (
                    <tr key={event.id}>
                      <td data-label="Quando">{formatDate(event.created_at)}</td>
                      <td data-label="Ação">{event.action}</td>
                      <td data-label="Alvo">{event.target_ref || '-'}</td>
                      <td data-label="Resultado">
                        <span>
                          <span className={event.outcome === 'ok' ? 'badge-success' : 'badge-error'}>{event.outcome === 'ok' ? 'OK' : 'Falhou'}</span>
                          {event.error_code ? <span className="muted"> {event.error_code}</span> : null}
                        </span>
                      </td>
                      <td data-label="Operador">{event.actor_admin_id ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty-note">Nenhuma mudança de configuração registrada.</p>}
        </Section>
      ) : null}
    </div>
  )
}
