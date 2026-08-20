import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate, formatJson, formatStripeStatus } from '../lib/format'

type CheckoutDetail = {
  userId: string
  email: string
  displayName: string
  activationStatus: string
  empty: boolean
  createdAt: string
  updatedAt: string
  subscriptions: Array<{ id: string; stripeSubscriptionId: string; status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; planLabel: string | null }>
  pets: Array<{ id: string; name: string; breed: string; ageYears: number; ageMonths: number; weightInput: number; weightUnit: string; activityLevel: string; petCondition: string; neutered: boolean; simplified?: { daily?: { formatted?: string }; monthly?: { formatted?: string }; packs?: { formatted?: string } } | null }>
  recurrence: unknown
  planSelection: unknown
  address: unknown
  shipping: unknown
  discount: { promotionCodeId?: string | null; percent?: number | null; eligibilityReason?: string | null; amountPaid?: number | null }
  lineItems: unknown[]
  checkoutReference: unknown
  paymentReference: unknown
}

export function OnboardingSessionPage() {
  const { token } = useAuth()
  const { id } = useParams()
  const [data, setData] = useState<CheckoutDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !id) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<CheckoutDetail>(`/admin/onboarding/checkouts/${id}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar checkout')
      }
    }

    void load()
  }, [token, id])

  return (
    <PageFrame title={`Checkout ${data?.email ?? id ?? ''}`} description="Visão 360 por user_id: pets, plano, endereço, N assinaturas Stripe.">
      {error ? <div className="alert">{error}</div> : null}
      {data?.empty ? <div className="warning">Sem checkout_reference para este usuário.</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Status conta" value={data?.activationStatus ?? '—'} />
        <MetricCard label="Pets" value={data?.pets.length ?? '—'} />
        <MetricCard label="Assinaturas" value={data?.subscriptions.length ?? '—'} />
        <MetricCard label="Atualizado" value={formatDate(data?.updatedAt)} />
      </div>

      <Section title="Cliente" description="Identidade do user_id — não há mais session_id.">
        <p>{data?.displayName} · {data?.email} · {data?.userId}</p>
        <div className="inline-actions">
          <Link className="ghost-button" to={`/users/${data?.userId}`}>Ver cliente</Link>
        </div>
      </Section>

      <Section title="Assinaturas Stripe" description="Ledger local. Um checkout pode ter N assinaturas.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subscription</th>
                <th>Status</th>
                <th>Plano</th>
                <th>Período</th>
                <th>Cancelando</th>
              </tr>
            </thead>
            <tbody>
              {data?.subscriptions.map((item) => (
                <tr key={item.id}>
                  <td><Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.stripeSubscriptionId}</Link></td>
                  <td>{formatStripeStatus(item.status)}</td>
                  <td>{item.planLabel ?? '-'}</td>
                  <td>{formatDate(item.currentPeriodEnd)}</td>
                  <td>{item.cancelAtPeriodEnd ? 'Sim' : 'Não'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Pets" description="Pets atuais do onboarding. Sem nome vira Unnamed pet.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Pet</th>
                <th>Raça</th>
                <th>Idade</th>
                <th>Peso</th>
                <th>Atividade</th>
                <th>Simplificado</th>
              </tr>
            </thead>
            <tbody>
              {data?.pets.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.breed || '-'}</td>
                  <td>{item.ageYears}a {item.ageMonths}m</td>
                  <td>{item.weightInput} {item.weightUnit}</td>
                  <td>{item.activityLevel || '-'}</td>
                  <td>{item.simplified?.daily?.formatted ?? 'Sem dados simplificados'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Desconto 1ª compra" description="Snapshot do checkout, sem recálculo live.">
        <p>{data?.discount.promotionCodeId || data?.discount.eligibilityReason || 'Não aplicável / inelegível'}</p>
      </Section>

      <Section title="JSON técnico" description="checkout_reference, plano, endereço e frete.">
        <div className="grid cards-2">
          <pre>{formatJson(data?.planSelection)}</pre>
          <pre>{formatJson(data?.checkoutReference)}</pre>
          <pre>{formatJson(data?.address)}</pre>
          <pre>{formatJson(data?.shipping)}</pre>
        </div>
      </Section>
    </PageFrame>
  )
}
