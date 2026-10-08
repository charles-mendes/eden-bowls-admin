import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MetricCard } from './MetricCard'
import { Section } from './Section'
import { MarketSelect } from './MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatSyncJobStatus } from '../lib/format'
import { currencyForMarket, defaultMarket, hasBothMarkets, MARKET_LABELS, type MarketCode } from '../lib/markets'

type CheckoutMetrics = {
  totalCheckouts: number
  linkedToStripe: number
  stripeActive: number
  withSimplified: number
  generatedAt: string
}

type SyncHealth = {
  market: string
  currency: string
  totalExpected: number
  totalMapped: number
  gaps: string[]
}

type SyncStatus = {
  syncJobId: string
  status: string
  summary?: { scope?: string }
  scope?: string
}

type MarketConflict = {
  userId: string
  email: string
  profileMarket: string
  stripeAccount: string
}

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
  const [metrics, setMetrics] = useState<CheckoutMetrics | null>(null)
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [conflicts, setConflicts] = useState<MarketConflict[] | null>(null)
  const [conflictsError, setConflictsError] = useState('')
  const [error, setError] = useState('')
  const market = bothMarkets ? (pickedMarket || defaultMarket(user) || '') : (defaultMarket(user) ?? '')
  const currency = market === 'BR' || market === 'US' ? currencyForMarket(market) : ''

  useEffect(() => {
    if (!token || !user) return

    const load = async () => {
      setError('')
      try {
        const [metricsResponse, syncHealthResponse] = await Promise.all([
          apiRequest<CheckoutMetrics>('/admin/onboarding/metrics', { token }),
          apiRequest<SyncHealth>(`/admin/catalog/sync/health${buildQueryString({
            market: market || undefined,
            currency: currency || undefined,
          })}`, { token }),
        ])

        setMetrics(metricsResponse)
        setSyncHealth(syncHealthResponse)

        try {
          const syncStatusResponse = await apiRequest<SyncStatus>('/admin/catalog/sync/status', { token })
          setSyncStatus(syncStatusResponse)
        } catch {
          setSyncStatus(null)
        }
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar dashboard')
      }

      if (!isAdmin) {
        setConflicts(null)
        setConflictsError('')
        return
      }

      try {
        setConflictsError('')
        const response = await apiRequest<{ items?: MarketConflict[] }>('/admin/markets/conflicts', { token })
        setConflicts(response.items ?? [])
      } catch (requestError) {
        setConflicts([])
        setConflictsError(requestError instanceof Error ? requestError.message : 'Falha ao carregar conflitos')
      }
    }

    void load()
  }, [token, user, market, currency, isAdmin])

  const coverage = catalogHealthCopy(syncHealth, market, currency)
  const gapIds = syncHealth?.gaps ?? []
  const catalogLabel = marketLabel(market)

  return (
    <div className="page-stack">
      {error ? <div className="alert">{error}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Checkouts" value={metrics?.totalCheckouts ?? '—'} hint={`Gerado em ${formatDate(metrics?.generatedAt)}`} />
        <MetricCard label="Vinculados Stripe" value={metrics?.linkedToStripe ?? '—'} />
        <MetricCard label="Stripe ativos" value={metrics?.stripeActive ?? '—'} />
        <MetricCard label="Com simplificado" value={metrics?.withSimplified ?? '—'} />
      </div>

      <Section
        title="Preços Stripe no catálogo"
        description={`Cada variação vendável (sabor/peso) precisa de um Price ID no Stripe. Este recorte é o mercado ${catalogLabel} em ${currency || '—'}.`}
      >
        <div className="stack">
          {bothMarkets ? (
            <MarketSelect
              user={user}
              value={market}
              onChange={(value) => setPickedMarket(value === 'US' ? 'US' : 'BR')}
            />
          ) : null}

          <div className="inline-actions">
            <span className={coverage.badgeClass}>{coverage.badgeLabel}</span>
            <span>{coverage.summary}</span>
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

          <p className="muted">
            Última sincronização: {syncStatus?.status ? formatSyncJobStatus(syncStatus.status) : 'nenhum sync disparado nesta sessão do servidor'}
            {syncStatus?.summary?.scope || syncStatus?.scope ? ` · escopo ${syncStatus.summary?.scope ?? syncStatus.scope}` : ''}
          </p>

          <div className="inline-actions">
            <Link className="ghost-button" to="/catalog/products">Ver produtos</Link>
            <Link className="ghost-button" to="/billing">Sincronizar e assinantes</Link>
          </div>
        </div>
      </Section>

      {isAdmin ? (
        <Section title="Conflitos de mercado" description="Perfis cujo mercado não bate com a conta Stripe do ledger.">
          {conflictsError ? <div className="alert">{conflictsError}</div> : null}
          {conflicts == null ? null : conflicts.length === 0 ? (
            <p>Nenhum conflito perfil vs Stripe.</p>
          ) : (
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
                  {conflicts?.map((item) => (
                    <tr key={item.userId}>
                      <td>{item.email}</td>
                      <td>{item.profileMarket}</td>
                      <td><span className="badge-info">{item.stripeAccount.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : null}
    </div>
  )
}
