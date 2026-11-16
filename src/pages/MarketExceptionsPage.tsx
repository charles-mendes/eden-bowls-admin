import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { subscriptionStatusLabel } from '../lib/courierDeliveries'

// shipment-market: a subscription whose Stripe account and address country fit no shipping market.
export type MarketException = {
  subscription_id: number | string
  stripe_subscription_id: string
  status: string
  stripe_account: string
  address_country: string
  customer: { id: number | string | null; email: string | null; name: string | null }
  open_paid_cycles: number
}

type Response = { success: boolean; data: { items: MarketException[]; truncated: boolean } }

function countryText(country: string): string {
  return country ? `Endereço ${country}` : 'Endereço sem país'
}

export function MarketExceptionsPage() {
  const { token } = useAuth()
  const [data, setData] = useState<Response['data'] | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      const response = await apiRequest<Response>('/admin/market-exceptions', { token })
      setData(response.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar as exceções')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const items = data?.items ?? []

  return (
    <PageFrame
      title="Exceções de mercado"
      description="Assinaturas cuja conta Stripe e país do endereço não combinam. Elas não entram na fila de etiquetas nem na de entregas e não recebem NF-e até a conta e o país do endereço combinarem."
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {data?.truncated ? <div className="warning">A lista mostra as 200 primeiras exceções.</div> : null}
      <div className="table-shell table-scroll">
        <table>
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Conta</th>
              <th>Endereço</th>
              <th>Assinatura</th>
              <th>Ciclos pagos em aberto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!data && !error ? <tr><td colSpan={6}>Carregando…</td></tr> : null}
            {data && !items.length ? <tr><td colSpan={6}>Nenhuma exceção de mercado.</td></tr> : null}
            {items.map((item) => (
              <tr key={item.stripe_subscription_id}>
                <td>
                  <div className="stack">
                    <strong>{item.customer.name || item.customer.email || '—'}</strong>
                    {item.customer.name && item.customer.email ? <span className="muted">{item.customer.email}</span> : null}
                  </div>
                </td>
                <td>Conta {item.stripe_account.toUpperCase()}</td>
                <td>{countryText(item.address_country)}</td>
                <td>{subscriptionStatusLabel(item.status)}</td>
                <td>{item.open_paid_cycles}</td>
                <td><Link className="ghost-button" to={`/billing/subscriptions/${item.subscription_id}`}>Assinatura</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  )
}
