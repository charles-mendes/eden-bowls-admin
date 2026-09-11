import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, getApiBaseUrl } from '../lib/api'
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

type UpsShipment = {
  id: string
  subscription_id: string
  stripe_invoice_id: string
  ups_shipment_id: string | null
  tracking_number: string | null
  service_code: string | null
  label_format: string | null
  has_label: boolean
  quoted_shipping_cost: number | null
  ups_monetary_value: number | null
  status: string
  shipped_at: string | null
  created_at: string | null
  updated_at: string | null
}

export function SubscriptionDetailPage() {
  const { token, hasPermission } = useAuth()
  const { id } = useParams()
  const [data, setData] = useState<SubscriptionDetail | null>(null)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [shipments, setShipments] = useState<UpsShipment[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canReadShipping = hasPermission('shipping.read')
  const canWriteShipping = hasPermission('shipping.write')

  const loadShipments = async () => {
    if (!token || !id || !canReadShipping) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: UpsShipment[] } }>(
        `/admin/billing/subscriptions/${id}/shipments`,
        { token },
      )
      setShipments(response.data?.items || [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar etiquetas UPS')
    }
  }

  const load = async () => {
    if (!token || !id) return
    try {
      setError('')
      const response = await apiRequest<SubscriptionDetail>(`/admin/billing/subscriptions/${id}`, { token })
      setData(response)
      await loadShipments()
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

  const createShipment = async (invoiceId: string) => {
    if (!token || !id) return
    try {
      setError('')
      const response = await apiRequest<{ success: boolean; data: { shipment: UpsShipment; reused?: boolean } }>(
        `/admin/billing/subscriptions/${id}/shipments`,
        {
          token,
          method: 'POST',
          body: { invoice_id: invoiceId },
        },
      )
      const shipment = response.data?.shipment
      if (shipment) {
        setShipments((current) => {
          const without = current.filter((item) => item.id !== shipment.id)
          return [shipment, ...without]
        })
      } else {
        await loadShipments()
      }
      setMessage(response.data?.reused ? 'Etiqueta já existia para esta invoice (idempotente).' : 'Etiqueta UPS gerada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar etiqueta')
    }
  }

  const downloadLabel = async (shipmentId: string, filenameHint?: string | null) => {
    if (!token) return
    try {
      setError('')
      const response = await fetch(`${getApiBaseUrl()}/admin/shipments/${shipmentId}/label`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(errorBody?.message || 'Falha ao baixar etiqueta')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filenameHint || `ups-label-${shipmentId}.gif`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao baixar etiqueta')
    }
  }

  const voidShipment = async (shipmentId: string) => {
    if (!token) return
    try {
      setError('')
      await apiRequest(`/admin/shipments/${shipmentId}/void`, { token, method: 'POST' })
      setMessage('Shipment voided na UPS.')
      await loadShipments()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao void')
    }
  }

  const refreshTracking = async (shipmentId: string) => {
    if (!token) return
    try {
      setError('')
      await apiRequest(`/admin/shipments/${shipmentId}/refresh-tracking`, { token, method: 'POST' })
      setMessage('Tracking atualizado.')
      await loadShipments()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar tracking')
    }
  }

  const activeByInvoice = new Map(
    shipments
      .filter((item) => item.status !== 'voided')
      .map((item) => [item.stripe_invoice_id, item]),
  )

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
              {invoices.map((item) => {
                const existing = activeByInvoice.get(item.id)
                return (
                  <tr key={item.id}>
                    <td>{item.number ?? item.id}</td>
                    <td>{item.status}</td>
                    <td>{item.amountPaid} {item.currency}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="ghost-button" type="button" onClick={() => void openPdf(item.id)}>PDF</button>
                        {canWriteShipping && !existing ? (
                          <button className="ghost-button" type="button" onClick={() => void createShipment(item.id)}>
                            Gerar etiqueta UPS
                          </button>
                        ) : null}
                        {existing ? (
                          <span className="muted">UPS {existing.tracking_number || existing.status}</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {canReadShipping ? (
        <Section title="UPS fulfillment" description="Etiqueta por invoice paga. Cotado no checkout vs custo UPS na etiqueta (margem aceita na v1).">
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th>Serviço</th>
                  <th>Quoted</th>
                  <th>UPS cost</th>
                  <th>Enviado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shipments.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Nenhuma etiqueta ainda.</td>
                  </tr>
                ) : (
                  shipments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.stripe_invoice_id}</td>
                      <td>{item.status}</td>
                      <td>{item.tracking_number || '—'}</td>
                      <td>{item.service_code || '—'}</td>
                      <td>{item.quoted_shipping_cost != null ? item.quoted_shipping_cost : '—'}</td>
                      <td>{item.ups_monetary_value != null ? item.ups_monetary_value : '—'}</td>
                      <td>{formatDate(item.shipped_at)}</td>
                      <td>
                        <div className="inline-actions">
                          {item.has_label ? (
                            <button className="ghost-button" type="button" onClick={() => void downloadLabel(item.id)}>
                              Download
                            </button>
                          ) : null}
                          {item.tracking_number ? (
                            <button className="ghost-button" type="button" onClick={() => void refreshTracking(item.id)}>
                              Refresh tracking
                            </button>
                          ) : null}
                          {canWriteShipping && item.status !== 'voided' && item.ups_shipment_id ? (
                            <button className="ghost-button" type="button" onClick={() => void voidShipment(item.id)}>
                              Void
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

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
