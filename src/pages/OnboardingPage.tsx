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

type CheckoutItem = {
  userId: string
  email: string
  displayName: string
  updatedAt: string
  petCount: number
  subscriptionCount: number
  stripeStatus: string
  stripeSubscriptionId: string
  frequency: string | null
  termMonths: number | null
}

type CheckoutList = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: CheckoutItem[]
}

type CheckoutMetrics = {
  totalCheckouts: number
  linkedToStripe: number
  stripeActive: number
  withSimplified: number
  generatedAt: string
}

export function OnboardingPage() {
  const { token } = useAuth()
  const [data, setData] = useState<CheckoutList | null>(null)
  const [metrics, setMetrics] = useState<CheckoutMetrics | null>(null)
  const [email, setEmail] = useState('')
  const [link, setLink] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setError('')
      try {
        const query = buildQueryString({
          page,
          perPage,
          email: email || undefined,
          link: link || undefined,
        })
        const [listResponse, metricsResponse] = await Promise.all([
          apiRequest<CheckoutList>(`/admin/onboarding/checkouts${query}`, { token }),
          apiRequest<CheckoutMetrics>(`/admin/onboarding/metrics${query}`, { token }),
        ])
        setData(listResponse)
        setMetrics(metricsResponse)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar onboarding')
      }
    }

    void load()
  }, [token, email, link, page, perPage])

  return (
    <PageFrame title="Onboarding 360" description="Consulta operacional de checkouts por user_id. Um usuário pode ter N assinaturas.">
      <div className="grid cards-4">
        <MetricCard label="Checkouts" value={metrics?.totalCheckouts ?? '—'} />
        <MetricCard label="Vinculados" value={metrics?.linkedToStripe ?? '—'} />
        <MetricCard label="Stripe ativos" value={metrics?.stripeActive ?? '—'} />
        <MetricCard label="Com pets" value={metrics?.withSimplified ?? '—'} />
      </div>

      <Section title="Filtros" description="Busca server-side. CSV usa os mesmos filtros.">
        <FiltersBar>
          <label>
            E-mail
            <input value={email} onChange={(event) => { setEmail(event.target.value); setPage(1) }} placeholder="cliente@..." />
          </label>
          <label>
            Vínculo
            <select value={link} onChange={(event) => { setLink(event.target.value); setPage(1) }}>
              <option value="">Todos</option>
              <option value="linked">Vinculados</option>
              <option value="unlinked">Não vinculados</option>
            </select>
          </label>
          <label>
            Por página
            <select value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }}>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
        </FiltersBar>
        <button
          className="ghost-button"
          type="button"
          onClick={async () => {
            if (!token) return
            const response = await fetch(`${import.meta.env.VITE_ADMIN_API_BASE_URL ?? '/api/v1'}/admin/onboarding/checkouts.csv${buildQueryString({ email, link })}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            const anchor = document.createElement('a')
            anchor.href = url
            anchor.download = 'onboarding-checkouts.csv'
            anchor.click()
            URL.revokeObjectURL(url)
          }}
        >
          Exportar CSV
        </button>
      </Section>

      {error ? <div className="alert">{error}</div> : null}

      <Section title="Checkouts" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Pets</th>
                <th>Stripe</th>
                <th>Status</th>
                <th>Prazo</th>
                <th>Recorrência</th>
                <th>Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.userId}>
                  <td>
                    <Link className="table-link" to={`/onboarding/sessions/${item.userId}`}>{item.email}</Link>
                    <div className="muted">{item.displayName} · {item.userId}</div>
                  </td>
                  <td>{item.petCount}</td>
                  <td>{item.stripeSubscriptionId}</td>
                  <td>{item.stripeStatus}</td>
                  <td>{item.termMonths ? `${item.termMonths}m` : '-'}</td>
                  <td>{item.frequency ?? '-'}</td>
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
