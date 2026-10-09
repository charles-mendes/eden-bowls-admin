import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from './MetricCard'
import { Section } from './Section'
import { MarketSelect } from './MarketSelect'
import { Pager } from './Pager'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatSyncJobStatus } from '../lib/format'
import { currencyForMarket, defaultMarket, hasBothMarkets, MARKET_LABELS, type MarketCode } from '../lib/markets'

type SyncHealth = {
  market: string
  currency: string
  totalExpected: number
  totalMapped: number
  gaps: string[]
}

type SyncRun = {
  syncJobId: string
  status: string
  scope?: string
  market?: string
  error?: string | null
  updatedAt?: string
}

type SyncStatus = {
  status: string | null
  byMarket?: Record<string, SyncRun>
}

type MarketConflict = {
  userId: string
  email: string
  profileMarket: string
  stripeAccount: string
}

type ConflictsPage = {
  total: number
  page: number
  totalPages: number
  items: MarketConflict[]
}

type WebhookAccount = {
  account: 'br' | 'us'
  status: 'ok' | 'attention' | 'no_events'
  lastEventAt: string | null
  lastEventType: string | null
  failedLast24h: number
  pendingOverdue: number
}

type WebhookHealth = {
  staleAfterHours: number
  accounts: WebhookAccount[]
}

const ACCOUNT_LABELS: Record<WebhookAccount['account'], string> = { br: 'Brasil', us: 'EUA' }

const WEBHOOK_BADGES: Record<WebhookAccount['status'], { className: string; label: string }> = {
  ok: { className: 'badge-success', label: 'OK' },
  attention: { className: 'badge-warning', label: 'Atenção' },
  no_events: { className: 'badge-info', label: 'Sem eventos' },
}

const CONFLICTS_PER_PAGE = 20

function marketLabel(market: string) {
  return market === 'US' || market === 'BR' ? MARKET_LABELS[market] : market
}

function catalogHealthCopy(health: SyncHealth | null, market: string, currency: string) {
  const label = marketLabel(market)
  const place = market || '—'
  const money = currency || '—'

  if (!health) {
    return {
      badgeClass: 'badge-info',
      badgeLabel: 'Carregando',
      summary: `Consultando as variações do catálogo ${label} (${money}).`,
    }
  }

  const gapCount = health.gaps.length
  const complete = health.totalExpected > 0 && gapCount === 0 && health.totalMapped === health.totalExpected

  if (health.totalExpected === 0) {
    return {
      badgeClass: 'badge-info',
      badgeLabel: 'Sem variações',
      summary: `Não há variações no mercado ${place}. Confira se os produtos têm país do plano = ${place}.`,
    }
  }

  if (complete) {
    return {
      badgeClass: 'badge-success',
      badgeLabel: 'Completo',
      summary: `As ${health.totalMapped} variações do catálogo ${place} já têm um Price ID em ${money}. O checkout pode cobrar essas opções.`,
    }
  }

  return {
    badgeClass: 'badge-warning',
    badgeLabel: `${gapCount} sem Price`,
    summary: `Faltam Price IDs em ${gapCount} de ${health.totalExpected} variações. Sem esse vínculo o checkout ${place} não consegue cobrar essas opções.`,
  }
}

export function SystemHealth() {
  const { token, user, hasRole } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const isAdmin = hasRole('admin')
  const [pickedMarket, setPickedMarket] = useState<MarketCode | ''>('')
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [webhooks, setWebhooks] = useState<WebhookHealth | null>(null)
  const [webhooksError, setWebhooksError] = useState('')
  const [conflicts, setConflicts] = useState<ConflictsPage | null>(null)
  const [conflictsPage, setConflictsPage] = useState(1)
  const [conflictsError, setConflictsError] = useState('')
  const [error, setError] = useState('')
  const market = bothMarkets ? (pickedMarket || defaultMarket(user) || '') : (defaultMarket(user) ?? '')
  const currency = market === 'BR' || market === 'US' ? currencyForMarket(market) : ''

  useEffect(() => {
    if (!token || !user) return

    const load = async () => {
      setError('')
      try {
        setSyncHealth(await apiRequest<SyncHealth>(`/admin/catalog/sync/health${buildQueryString({
          market: market || undefined,
          currency: currency || undefined,
        })}`, { token }))
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar dashboard')
      }

      try {
        setSyncStatus(await apiRequest<SyncStatus>('/admin/catalog/sync/status', { token }))
      } catch {
        setSyncStatus(null)
      }
    }

    void load()
  }, [token, user, market, currency])

  useEffect(() => {
    // Admin-only: the section is not rendered for other roles.
    if (!token || !isAdmin) return

    const load = async () => {
      try {
        setWebhooksError('')
        setWebhooks(await apiRequest<WebhookHealth>('/admin/billing/webhooks/health', { token }))
      } catch (requestError) {
        setWebhooks(null)
        setWebhooksError(requestError instanceof Error ? requestError.message : 'Falha ao carregar webhooks')
      }
    }

    void load()
  }, [token, isAdmin])

  useEffect(() => {
    if (!token || !isAdmin) return

    const load = async () => {
      try {
        setConflictsError('')
        setConflicts(await apiRequest<ConflictsPage>(`/admin/markets/conflicts${buildQueryString({
          page: conflictsPage,
          perPage: CONFLICTS_PER_PAGE,
        })}`, { token }))
      } catch (requestError) {
        setConflicts(null)
        setConflictsError(requestError instanceof Error ? requestError.message : 'Falha ao carregar conflitos')
      }
    }

    void load()
  }, [token, isAdmin, conflictsPage])

  const coverage = catalogHealthCopy(syncHealth, market, currency)
  const gapIds = syncHealth?.gaps ?? []
  const catalogLabel = marketLabel(market)
  const syncRuns = Object.entries(syncStatus?.byMarket ?? {}).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="health-sections">
      {error ? <div className="alert">{error}</div> : null}

      {isAdmin ? (
        <Section
          title="Webhooks Stripe"
          description={`Último evento recebido por conta. Atenção: falha nas últimas 24 h, evento parado há mais de 1 h ou nenhum evento há mais de ${webhooks?.staleAfterHours ?? 72} h.`}
        >
          {webhooksError ? <div className="alert">{webhooksError}</div> : null}
          {webhooks ? (
            <div className="table-shell table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Conta</th>
                    <th>Status</th>
                    <th>Último evento</th>
                    <th>Falhas 24 h</th>
                    <th>Parados &gt; 1 h</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.accounts.map((item) => {
                    const badge = WEBHOOK_BADGES[item.status] ?? WEBHOOK_BADGES.no_events
                    return (
                      <tr key={item.account}>
                        <td>{ACCOUNT_LABELS[item.account] ?? item.account.toUpperCase()}</td>
                        <td><span className={badge.className}>{badge.label}</span></td>
                        <td>{item.lastEventAt ? `${formatDate(item.lastEventAt)} · ${item.lastEventType ?? '—'}` : 'Nenhum evento recebido'}</td>
                        <td>{item.failedLast24h}</td>
                        <td>{item.pendingOverdue}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section
        title="Preços Stripe no catálogo"
        description={`Cada variação vendável (sabor/peso) precisa de um Price ID no Stripe. Recorte: ${catalogLabel} em ${currency || '—'}.`}
        actions={(
          <div className="inline-actions">
            <Link className="ghost-button" to="/catalog/products">Ver produtos</Link>
            <Link className="ghost-button" to="/billing">Sincronizar e assinantes</Link>
          </div>
        )}
      >
        <div className="health-body">
          <div className="inline-actions">
            {bothMarkets ? (
              <MarketSelect
                user={user}
                value={market}
                onChange={(value) => setPickedMarket(value === 'US' ? 'US' : 'BR')}
              />
            ) : null}
            <span className={coverage.badgeClass}>{coverage.badgeLabel}</span>
            <span className="muted">{coverage.summary}</span>
          </div>

          <div className="grid cards-3">
            <MetricCard
              label="Com Price Stripe"
              value={syncHealth ? `${syncHealth.totalMapped} / ${syncHealth.totalExpected}` : '—'}
              hint={`Variações já vinculadas em ${currency || '—'}`}
            />
            <MetricCard
              label="No catálogo"
              value={syncHealth?.totalExpected ?? '—'}
              hint="Variações esperadas neste mercado"
            />
            <MetricCard
              label="Sem vínculo"
              value={syncHealth?.gaps.length ?? '—'}
              hint="Gaps: variação sem Price ID"
            />
          </div>

          {gapIds.length > 0 ? (
            <div className="warning">
              Variações sem Price: {gapIds.join(', ')}. Abra o produto e rode o sync para criar os prices faltantes.
            </div>
          ) : null}

          <ul className="health-meta">
            {syncRuns.length === 0 ? (
              <li>Última sincronização: nenhuma sincronização registrada.</li>
            ) : syncRuns.map(([runMarket, run]) => (
              <li key={runMarket}>
                Última sincronização {marketLabel(runMarket)}: {formatSyncJobStatus(run.status)} em {formatDate(run.updatedAt)}
                {run.status === 'failed' && run.error ? ` · ${run.error}` : null}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {isAdmin ? (
        <Section
          title="Conflitos de mercado"
          description="Clientes cujo mercado do perfil não bate com a conta Stripe de uma assinatura. Um por cliente e conta."
          actions={conflicts && conflicts.total > 0 ? (
            <span className="badge-warning">{conflicts.total === 1 ? '1 conflito' : `${conflicts.total} conflitos`}</span>
          ) : null}
        >
          {conflictsError ? <div className="alert">{conflictsError}</div> : null}
          {conflicts == null ? null : conflicts.total === 0 ? (
            <p>Nenhum conflito perfil vs Stripe.</p>
          ) : (
            <div className="health-body">
              <div className="table-shell table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>E-mail</th>
                      <th>Mercado do perfil</th>
                      <th>Conta Stripe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.items.map((item) => (
                      <tr key={`${item.userId}-${item.stripeAccount}`}>
                        <td>{item.email}</td>
                        <td>{item.profileMarket}</td>
                        <td><span className="badge-info">{item.stripeAccount.toUpperCase()}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {conflicts.totalPages > 1 ? (
                <Pager
                  page={conflicts.page}
                  totalPages={conflicts.totalPages}
                  onPrev={() => setConflictsPage((value) => Math.max(1, value - 1))}
                  onNext={() => setConflictsPage((value) => value + 1)}
                />
              ) : null}
            </div>
          )}
        </Section>
      ) : null}
    </div>
  )
}
