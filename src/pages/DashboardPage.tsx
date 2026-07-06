import { useEffect, useState } from 'react'
import { PageFrame } from '../components/PageFrame'
import { MetricCard } from '../components/MetricCard'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate } from '../lib/format'

type OnboardingMetrics = {
  totalSessions: number
  byStatus: Record<string, number>
  expiringIn24h: number
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
  summary: {
    scope: string
    market?: string
    currency?: string
    productId?: string
  }
}

export function DashboardPage() {
  const { token } = useAuth()
  const [metrics, setMetrics] = useState<OnboardingMetrics | null>(null)
  const [syncHealth, setSyncHealth] = useState<SyncHealth | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setError('')
      try {
        const [metricsResponse, syncHealthResponse] = await Promise.all([
          apiRequest<OnboardingMetrics>('/admin/onboarding/metrics', { token }),
          apiRequest<SyncHealth>('/billing/catalog/sync/health?market=BR&currency=BRL', { token }),
        ])

        setMetrics(metricsResponse)
        setSyncHealth(syncHealthResponse)

        try {
          const syncStatusResponse = await apiRequest<SyncStatus>('/billing/catalog/sync/status', { token })
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

  return (
    <PageFrame
      title="Dashboard"
      description="Resumo operacional para onboarding, catálogo, billing e qualidade de integrações."
    >
      {error ? <div className="alert">{error}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Sessões" value={metrics?.totalSessions ?? '—'} hint={`Gerado em ${formatDate(metrics?.generatedAt)}`} />
        <MetricCard label="Expiram em 24h" value={metrics?.expiringIn24h ?? '—'} hint="Onboarding aberto" />
        <MetricCard label="Sync health" value={`${syncHealth?.totalMapped ?? '—'}/${syncHealth?.totalExpected ?? '—'}`} hint={`Gaps: ${syncHealth?.gaps.length ?? '—'}`} />
        <MetricCard label="Último sync" value={syncStatus?.status ?? 'sem job'} hint={syncStatus?.summary.scope ?? '—'} />
      </div>

      <Section title="Sessões por status" description="Indicadores vindos de /admin/onboarding/metrics.">
        <div className="status-grid">
          {Object.entries(metrics?.byStatus ?? {}).map(([status, value]) => (
            <div key={status} className="status-pill">
              <strong>{status}</strong>
              <span>{value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Saúde do catálogo Stripe" description="Consulta de /billing/catalog/sync/health com market BR e currency BRL.">
        <div className="stack-tight">
          <p>Mercado: {syncHealth?.market ?? '—'} · Moeda: {syncHealth?.currency ?? '—'}</p>
          <p>Gaps de mapeamento: {syncHealth?.gaps.length ? syncHealth.gaps.join(', ') : 'nenhum gap encontrado'}</p>
        </div>
      </Section>
    </PageFrame>
  )
}
