import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate, formatFrequency, formatStripeStatus } from '../lib/format'

type CheckoutItem = {
  userId: string
  email: string
  displayName: string
  updatedAt: string
  createdAt: string
  stripeStatus: string
  stripeSubscriptionId: string
  frequency: string | null
}

type CheckoutList = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: CheckoutItem[]
}

export function OrdersPage() {
  const { token } = useAuth()
  const [data, setData] = useState<CheckoutList | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<CheckoutList>(`/admin/onboarding/checkouts${buildQueryString({ page, perPage, email: email || undefined })}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar checkouts')
      }
    }

    void load()
  }, [token, page, perPage, email])

  return (
    <PageFrame title="Checkouts" description="Consulta dos checkouts concluídos, com status da Stripe e acesso ao onboarding do cliente.">
      <Section title="Filtros" description="Filtre por e-mail para localizar um checkout.">
        <FiltersBar>
          <label>
            E-mail
            <input value={email} onChange={(event) => { setEmail(event.target.value); setPage(1) }} />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>

        {error ? <div className="alert">{error}</div> : null}

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Stripe</th>
                <th>Status</th>
                <th>Recorrência</th>
                <th>Atualizado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.userId}>
                  <td>
                    <Link className="table-link" to={`/orders/${item.userId}`}>{item.email}</Link>
                    <div className="muted">{item.displayName}</div>
                  </td>
                  <td>{item.stripeSubscriptionId}</td>
                  <td title={item.stripeStatus === 'mixed' ? 'Cliente com mais de uma assinatura Stripe' : undefined}>
                    {formatStripeStatus(item.stripeStatus)}
                  </td>
                  <td>{formatFrequency(item.frequency)}</td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td><Link className="ghost-button" to={`/onboarding/sessions/${item.userId}`}>360</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
