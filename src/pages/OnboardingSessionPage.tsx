import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate, formatJson } from '../lib/format'

type Session360 = {
  id: string
  status: string
  locale: string
  country: string
  expiresAt: string
  createdAt: string
  updatedAt: string
  linkedUser: { id: string; email: string; status: string } | null
  sessionPets: Array<{ id: string; sortOrder: number; pet: { id: string; name: string; species: string; weightKg: number | null; activityLevel: string | null; nutritionGoal: string | null } }>
  answers: Array<{ id: string; questionKey: string; answerJson: unknown; updatedAt: string }>
  recommendationRuns: Array<{ id: string; status: string; createdAt: string; petResults: unknown[]; planSnapshots: unknown[] }>
  checkoutOrders: Array<{ id: string; createdAt: string; orders: unknown[]; subscriptions: unknown[] }>
}

export function OnboardingSessionPage() {
  const { token } = useAuth()
  const { id } = useParams()
  const [data, setData] = useState<Session360 | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<Session360>(`/admin/onboarding/sessions/${id}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar sessão')
      }
    }

    void load()
  }, [token, id])

  return (
    <PageFrame
      title={`Sessão ${id ?? ''}`}
      description="Visão 360 da sessão com pets, answers, recommendation runs e checkout vinculado."
    >
      {error ? <div className="alert">{error}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Status" value={data?.status ?? '—'} />
        <MetricCard label="Pets" value={data?.sessionPets.length ?? '—'} />
        <MetricCard label="Answers" value={data?.answers.length ?? '—'} />
        <MetricCard label="Runs" value={data?.recommendationRuns.length ?? '—'} />
      </div>

      <Section title="Resumo" description="Dados principais da sessão e do usuário vinculado.">
        <div className="grid cards-2">
          <article className="stat-card">
            <strong>Identidade</strong>
            <span>{data?.locale ?? '-'} · {data?.country ?? '-'}</span>
            <div className="muted">Criada em {formatDate(data?.createdAt)}</div>
          </article>
          <article className="stat-card">
            <strong>Usuário vinculado</strong>
            <span>{data?.linkedUser?.email ?? 'Sem vínculo'}</span>
            <div className="muted">{data?.linkedUser?.status ?? '-'}</div>
          </article>
        </div>
      </Section>

      <Section title="Pets" description="Itens ordenados da jornada de onboarding.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Pet</th>
                <th>Espécie</th>
                <th>Peso</th>
                <th>Activity</th>
                <th>Goal</th>
              </tr>
            </thead>
            <tbody>
              {data?.sessionPets.map((item) => (
                <tr key={item.id}>
                  <td>{item.sortOrder}</td>
                  <td>{item.pet.name}</td>
                  <td>{item.pet.species}</td>
                  <td>{item.pet.weightKg ?? '-'}</td>
                  <td>{item.pet.activityLevel ?? '-'}</td>
                  <td>{item.pet.nutritionGoal ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Answers" description="Respostas capturadas na jornada.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Question key</th>
                <th>Resposta</th>
                <th>Atualizado em</th>
              </tr>
            </thead>
            <tbody>
              {data?.answers.map((item) => (
                <tr key={item.id}>
                  <td>{item.questionKey}</td>
                  <td><pre>{formatJson(item.answerJson)}</pre></td>
                  <td>{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Recommendation runs" description="Execuções e snapshots ligados à sessão.">
        {data?.recommendationRuns.map((item) => (
          <article key={item.id} className="lookup-card">
            <div className="inline-actions">
              <strong>{item.status}</strong>
              <span className="muted">{formatDate(item.createdAt)}</span>
            </div>
            <div className="grid cards-2">
              <div>
                <div className="eyebrow">Pet results</div>
                <pre>{formatJson(item.petResults)}</pre>
              </div>
              <div>
                <div className="eyebrow">Plan snapshots</div>
                <pre>{formatJson(item.planSnapshots)}</pre>
              </div>
            </div>
          </article>
        ))}
      </Section>

      <Section title="Checkout vinculado" description="Pedidos e assinaturas originados da sessão.">
        {data?.checkoutOrders.map((item) => (
          <article key={item.id} className="lookup-card">
            <div className="inline-actions">
              <strong>Checkout order</strong>
              <span className="muted">{formatDate(item.createdAt)}</span>
            </div>
            <div className="grid cards-2">
              <div>
                <div className="eyebrow">Orders</div>
                <pre>{formatJson(item.orders)}</pre>
              </div>
              <div>
                <div className="eyebrow">Subscriptions</div>
                <pre>{formatJson(item.subscriptions)}</pre>
              </div>
            </div>
          </article>
        ))}
      </Section>
    </PageFrame>
  )
}
