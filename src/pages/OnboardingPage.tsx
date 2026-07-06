import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'

type OnboardingSession = {
  id: string
  status: string
  linkedUser?: { id: string; email: string } | null
  locale: string
  country: string
  state?: string | null
  expiresAt: string
  updatedAt: string
  _count?: { sessionPets: number; answers: number; recommendationRuns: number }
}

type OnboardingListResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: OnboardingSession[]
}

type OnboardingMetrics = {
  totalSessions: number
  byStatus: Record<string, number>
  expiringIn24h: number
  generatedAt: string
}

export function OnboardingPage() {
  const { token } = useAuth()
  const [data, setData] = useState<OnboardingListResponse | null>(null)
  const [metrics, setMetrics] = useState<OnboardingMetrics | null>(null)
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setError('')
      try {
        const [listResponse, metricsResponse] = await Promise.all([
          apiRequest<OnboardingListResponse>(`/admin/onboarding/sessions${buildQueryString({
            page,
            perPage,
            status: status || undefined,
          })}`, { token }),
          apiRequest<OnboardingMetrics>('/admin/onboarding/metrics', { token }),
        ])
        setData(listResponse)
        setMetrics(metricsResponse)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar onboarding')
      }
    }

    void load()
  }, [token, status, page, perPage])

  return (
    <PageFrame
      title="Onboarding"
      description="Sessões, status, métricas e acesso ao detalhe 360 da jornada."
    >
      <div className="grid cards-4">
        <MetricCard label="Total sessões" value={metrics?.totalSessions ?? '—'} />
        <MetricCard label="Expiram em 24h" value={metrics?.expiringIn24h ?? '—'} />
        <MetricCard label="Status ativos" value={Object.values(metrics?.byStatus ?? {}).reduce((acc, value) => acc + value, 0)} />
        <MetricCard label="Última coleta" value={formatDate(metrics?.generatedAt)} />
      </div>

      <Section title="Filtros" description="Filtre por status antes de abrir a sessão 360.">
        <FiltersBar>
          <label>
            Status
            <input value={status} onChange={(event) => { setStatus(event.target.value); setPage(1) }} placeholder="started" />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

      {error ? <div className="alert">{error}</div> : null}

      <Section title="Sessões recentes" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sessão</th>
                <th>Status</th>
                <th>Usuário vinculado</th>
                <th>Pets</th>
                <th>Respostas</th>
                <th>Runs</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="table-link" to={`/onboarding/sessions/${item.id}`}>{item.id}</Link>
                    <div className="muted">{item.locale} · {item.country}</div>
                  </td>
                  <td>{item.status}</td>
                  <td>{item.linkedUser?.email ?? '-'}</td>
                  <td>{item._count?.sessionPets ?? 0}</td>
                  <td>{item._count?.answers ?? 0}</td>
                  <td>{item._count?.recommendationRuns ?? 0}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager page={data?.page ?? page} totalPages={data?.totalPages ?? 1} onPrev={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => current + 1)} />
      </Section>
    </PageFrame>
  )
}
