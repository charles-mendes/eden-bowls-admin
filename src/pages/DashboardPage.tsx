import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { MetricCard } from '../components/MetricCard'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate } from '../lib/format'

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

const SYNC_STATUS_LABELS: Record<string, string> = {
  idle: 'nenhum job em andamento',
  queued: 'na fila',
  completed: 'concluído',
  completed_with_skips: 'concluído com variações ignoradas',
}

function catalogHealthCopy(health: SyncHealth | null) {
  if (!health) {
    return {
      badgeClass: 'badge-info',
      badgeLabel: 'Carregando',
      summary: 'Consultando as variações do catálogo Brasil (BRL).',
    }
  }

  const gapCount = health.gaps.length
  const complete = health.totalExpected > 0 && gapCount === 0 && health.totalMapped === health.totalExpected

  if (health.totalExpected === 0) {
    return {
      badgeClass: 'badge-info',
      badgeLabel: 'Sem variações',
      summary: 'Não há variações no mercado BR. Confira se os produtos têm país do plano = BR.',
    }
  }

  if (complete) {
    return {
      badgeClass: 'badge-success',
      badgeLabel: 'Completo',
      summary: `As ${health.totalMapped} variações do catálogo BR já têm um Price ID em BRL. O checkout pode cobrar essas opções.`,
    }
  }

  return {
    badgeClass: 'badge-warning',
    badgeLabel: `${gapCount} sem Price`,
    summary: `Faltam Price IDs em ${gapCount} de ${health.totalExpected} variações. Sem esse vínculo o checkout BR não consegue cobrar essas opções.`,
  }
}

function formatSyncJobStatus(status?: string) {
  if (!status) {
    return 'nenhum sync disparado nesta sessão do servidor'
  }

  return SYNC_STATUS_LABELS[status] ?? status
}

export function DashboardPage() {
  const { token } = useAuth()
  const [metrics, setMetrics] = useState<CheckoutMetrics | null>(null)
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setError('')
      try {
        const [metricsResponse, syncHealthResponse] = await Promise.all([
          apiRequest<CheckoutMetrics>('/admin/onboarding/metrics', { token }),
          apiRequest<SyncHealth>('/admin/catalog/sync/health?market=BR&currency=BRL', { token }),
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
    }

    void load()
  }, [token])

  const coverage = catalogHealthCopy(syncHealth)
  const gapIds = syncHealth?.gaps ?? []

  return (
    <PageFrame
      title="Dashboard"
      description="Checkouts de onboarding, vínculo Stripe e saúde do catálogo."
    >
      {error ? <div className="alert">{error}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Checkouts" value={metrics?.totalCheckouts ?? '—'} hint={`Gerado em ${formatDate(metrics?.generatedAt)}`} />
        <MetricCard label="Vinculados Stripe" value={metrics?.linkedToStripe ?? '—'} />
        <MetricCard label="Stripe ativos" value={metrics?.stripeActive ?? '—'} />
        <MetricCard label="Com simplificado" value={metrics?.withSimplified ?? '—'} />
      </div>

      <Section
        title="Preços Stripe no catálogo"
        description="Cada variação vendável (sabor/peso) precisa de um Price ID no Stripe. Este recorte é o mercado Brasil em BRL."
      >
        <div className="stack">
          <div className="inline-actions">
            <span className={coverage.badgeClass}>{coverage.badgeLabel}</span>
            <span>{coverage.summary}</span>
          </div>

          <div className="grid cards-3">
            <MetricCard
              label="Com Price Stripe"
              value={syncHealth ? `${syncHealth.totalMapped} / ${syncHealth.totalExpected}` : '—'}
              hint="Variações já vinculadas em BRL"
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
            Último sync: {formatSyncJobStatus(syncStatus?.status)}
            {syncStatus?.summary?.scope || syncStatus?.scope ? ` · escopo ${syncStatus.summary?.scope ?? syncStatus.scope}` : ''}
          </p>

          <div className="inline-actions">
            <Link className="ghost-button" to="/catalog/products">Ver produtos</Link>
            <Link className="ghost-button" to="/billing">Sync e assinantes</Link>
          </div>
        </div>
      </Section>
    </PageFrame>
  )
}
