import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate, formatJson } from '../lib/format'

type SubscriptionDetail = {
  id: string
  stripeSubscriptionId: string
  stripeCustomerId: string
  status: string
  planLabel: string | null
  stripePriceId: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  dashboardUrl: string
  user: { id: string; email: string }
  petsSnapshot: unknown
  planSelection: unknown
  shipping: unknown
  address: unknown
}

type InvoiceItem = {
  id: string
  number: string | null
  status: string
  amountPaid: number
  currency: string
  createdAt: string | null
}

export function SubscriptionDetailPage() {
  const { token, hasPermission } = useAuth()
  const { id } = useParams()
  const [data, setData] = useState<SubscriptionDetail | null>(null)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    if (!token || !id) return
    try {
      setError('')
      const response = await apiRequest<SubscriptionDetail>(`/admin/billing/subscriptions/${id}`, { token })
      setData(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar assinatura')
    }
  }

  useEffect(() => {
    void load()
  }, [token, id])

  const syncInvoices = async () => {
    if (!token || !id) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: InvoiceItem[] } }>(`/admin/billing/subscriptions/${id}/sync-invoices`, {
        token,
        method: 'POST',
      })
      setInvoices(response.data?.items || [])
      setMessage('Faturas sincronizadas.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao sincronizar faturas')
    }
  }

  const openPdf = async (invoiceId: string) => {
    if (!token) return
    const response = await apiRequest<{ url: string }>(`/admin/billing/invoices/${invoiceId}/pdf`, { token })
    if (response.url) {
      window.open(response.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <PageFrame title={data?.stripeSubscriptionId ?? 'Assinatura'} description="Detalhe do ledger. Pause/cancel permanece na API do cliente.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Status" value={data?.status ?? '—'} />
        <MetricCard label="Cliente" value={data?.user.email ?? '—'} />
        <MetricCard label="Renovação" value={formatDate(data?.currentPeriodEnd)} />
        <MetricCard label="Cancelando" value={data?.cancelAtPeriodEnd ? 'Sim' : 'Não'} />
      </div>

      <Section title="Identidade">
        <p>{data?.planLabel} · {data?.stripePriceId}</p>
        <div className="inline-actions">
          {data?.dashboardUrl ? <a className="ghost-button" href={data.dashboardUrl} target="_blank" rel="noreferrer">Ver no Stripe</a> : null}
          <Link className="ghost-button" to={`/users/${data?.user.id}`}>Cliente</Link>
          <Link className="ghost-button" to={`/onboarding/sessions/${data?.user.id}`}>360</Link>
        </div>
      </Section>

      <Section title="Faturas">
        {hasPermission('billing.subscribers.sync') ? (
          <button className="primary-button" type="button" onClick={() => void syncInvoices()}>Sincronizar invoices</button>
        ) : null}
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((item) => (
                <tr key={item.id}>
                  <td>{item.number ?? item.id}</td>
                  <td>{item.status}</td>
                  <td>{item.amountPaid} {item.currency}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td><button className="ghost-button" type="button" onClick={() => void openPdf(item.id)}>PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Snapshots">
        <div className="grid cards-2">
          <pre>{formatJson(data?.petsSnapshot)}</pre>
          <pre>{formatJson(data?.planSelection)}</pre>
          <pre>{formatJson(data?.address)}</pre>
          <pre>{formatJson(data?.shipping)}</pre>
        </div>
      </Section>
    </PageFrame>
  )
}
