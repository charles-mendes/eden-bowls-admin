import { useEffect, useState } from 'react'
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

      <Section title="Catálogo Stripe" description="Consulta de /admin/catalog/sync/health com market BR e currency BRL.">
        <div className="stack-tight">
          <p>Mapped: {syncHealth?.totalMapped ?? '—'}/{syncHealth?.totalExpected ?? '—'} · Gaps: {syncHealth?.gaps.length ? syncHealth.gaps.join(', ') : 'nenhum'}</p>
          <p className="muted">Último sync: {syncStatus?.status ?? 'sem job'} · {syncStatus?.summary?.scope ?? syncStatus?.scope ?? '—'}</p>
        </div>
      </Section>
    </PageFrame>
  )
}
