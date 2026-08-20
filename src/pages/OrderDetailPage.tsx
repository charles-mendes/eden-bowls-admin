import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate, formatJson } from '../lib/format'

type CheckoutDetail = {
  userId: string
  email: string
  displayName: string
  activationStatus: string
  empty: boolean
  createdAt: string
  updatedAt: string
  subscriptions: Array<{ id: string; stripeSubscriptionId: string; status: string; planLabel: string | null }>
  pets: Array<{ id: string; name: string }>
  planSelection: unknown
  address: unknown
  shipping: unknown
  lineItems: unknown[]
  discount: { promotionCodeId?: string | null; eligibilityReason?: string | null }
}

export function OrderDetailPage() {
  const { token } = useAuth()
  const { orderId } = useParams()
  const [data, setData] = useState<CheckoutDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !orderId) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<CheckoutDetail>(`/admin/onboarding/checkouts/${orderId}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar checkout')
      }
    }

    void load()
  }, [token, orderId])

  return (
    <PageFrame title={`Checkout ${data?.email ?? orderId ?? ''}`} description="Detalhe read-only do onboarding. Sem alteração de status.">
      {error ? <div className="alert">{error}</div> : null}
      {data?.empty ? <div className="warning">No onboarding data found for this checkout.</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Cliente" value={data?.email ?? '—'} />
        <MetricCard label="Pets" value={data?.pets.length ?? '—'} />
        <MetricCard label="Assinaturas" value={data?.subscriptions.length ?? '—'} />
        <MetricCard label="Itens" value={data?.lineItems.length ?? '—'} />
      </div>

      <Section title="Resumo" description="Mesmo payload do Onboarding 360.">
        <p>{data?.displayName} · {data?.activationStatus}</p>
        <p className="muted">Criado em {formatDate(data?.createdAt)}</p>
        <Link className="ghost-button" to={`/onboarding/sessions/${data?.userId}`}>Abrir 360</Link>
      </Section>

      <Section title="Stripe" description="N assinaturas do ledger.">
        {data?.subscriptions.map((item) => (
          <p key={item.id}><Link className="table-link" to={`/billing/subscriptions/${item.id}`}>{item.stripeSubscriptionId}</Link> · {item.status} · {item.planLabel ?? '-'}</p>
        ))}
        <p>Cupom: {data?.discount.promotionCodeId || data?.discount.eligibilityReason || 'Não aplicável / inelegível'}</p>
      </Section>

      <Section title="Snapshot" description="Plano, endereço e frete persistidos.">
        <div className="grid cards-2">
          <pre>{formatJson(data?.planSelection)}</pre>
          <pre>{formatJson({ address: data?.address, shipping: data?.shipping, lineItems: data?.lineItems })}</pre>
        </div>
      </Section>
    </PageFrame>
  )
}
