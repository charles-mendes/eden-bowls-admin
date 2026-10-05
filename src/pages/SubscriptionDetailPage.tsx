import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LedgerSnapshotSections } from '../components/LedgerSnapshotSections'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, getApiBaseUrl } from '../lib/api'
import { mergeReadablePets, parseCheckoutSnapshots } from '../lib/checkoutSnapshot'
import { formatDate } from '../lib/format'
import { describeInvoiceDelivery, formatInvoiceStatus, formatMinorAmount, type CustomerInvoice } from '../lib/customerInvoices'
import { isProfileInScope } from '../lib/markets'

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
  stripeAccount?: string
  customerProfileInScope?: boolean
  customerName?: string | null
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
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canReadShipping = hasPermission('shipping.read')
  const canWriteShipping = hasPermission('shipping.write')
  const canSyncBilling = hasPermission('billing.subscribers.sync')
  const profileInScope = isProfileInScope(data?.customerProfileInScope)

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

  const loadCustomerInvoices = async () => {
    if (!token || !id) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: CustomerInvoice[] } }>(
        `/admin/billing/subscriptions/${id}/customer-invoices`,
        { token },
      )
      setCustomerInvoices(response.data?.items || [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar invoices')
    }
  }

  const load = async () => {
    if (!token || !id) return
    try {
      setError('')
      const response = await apiRequest<SubscriptionDetail>(`/admin/billing/subscriptions/${id}`, { token })
      setData(response)
      await Promise.all([loadShipments(), loadCustomerInvoices()])
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

  const issueCustomerInvoice = async (stripeInvoiceId: string) => {
    if (!token || !id) return
    try {
      setError('')
      await apiRequest(`/admin/billing/subscriptions/${id}/customer-invoices`, {
        token,
        method: 'POST',
        body: { stripe_invoice_id: stripeInvoiceId },
      })
      setMessage('Invoice gerada. Use "Enviar ao cliente" para mandar por e-mail.')
      await loadCustomerInvoices()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar invoice')
    }
  }

  const downloadCustomerInvoice = async (item: CustomerInvoice) => {
    if (!token) return
    try {
      setError('')
      const response = await fetch(`${getApiBaseUrl()}/admin/billing/customer-invoices/${item.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { message?: string } | null
        throw new Error(errorBody?.message || 'Falha ao baixar invoice')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${item.invoice_number}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao baixar invoice')
    }
  }

  const sendCustomerInvoice = async (item: CustomerInvoice) => {
    if (!token) return
    try {
      setError('')
      const response = await apiRequest<{ success: boolean; data: CustomerInvoice }>(
        `/admin/billing/customer-invoices/${item.id}/send`,
        { token, method: 'POST' },
      )
      const updated = response.data
      if (updated) {
        setCustomerInvoices((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      }
      if (response.success) {
        setMessage(`Invoice ${item.invoice_number} enviada para ${updated?.email_to || item.email_to}.`)
      } else {
        setError(`Invoice ${item.invoice_number} não foi enviada: ${describeInvoiceDelivery(updated || item).detail}`)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao enviar invoice')
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
      setMessage('Etiqueta anulada na UPS.')
      await loadShipments()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao anular')
    }
  }

  const refreshTracking = async (shipmentId: string) => {
    if (!token) return
    try {
      setError('')
      await apiRequest(`/admin/shipments/${shipmentId}/refresh-tracking`, { token, method: 'POST' })
      setMessage('Rastreio atualizado.')
      await loadShipments()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar o rastreio')
    }
  }

  const snapshots = parseCheckoutSnapshots({
    planSelection: data?.planSelection,
    address: data?.address,
    shipping: data?.shipping,
  })
  const readableSnapshots = {
    ...snapshots,
    plan: {
      ...snapshots.plan,
      pets: mergeReadablePets(data?.planSelection, data?.petsSnapshot),
    },
  }

  const customerInvoiceByStripeId = new Map(customerInvoices.map((item) => [item.stripe_invoice_id, item]))

  const activeByInvoice = new Map(
    shipments
      .filter((item) => item.status !== 'voided')
      .map((item) => [item.stripe_invoice_id, item]),
  )

  return (
    <PageFrame title={data?.stripeSubscriptionId ?? 'Assinatura'} description="Detalhe do registro local. Pausa e cancelamento permanecem na API do cliente.">
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
        <p className="muted">Conta <span className="badge-info">{(data?.stripeAccount || 'us').toUpperCase()}</span></p>
        <div className="inline-actions">
          {data?.dashboardUrl ? <a className="ghost-button" href={data.dashboardUrl} target="_blank" rel="noreferrer">Ver no Stripe</a> : null}
          {profileInScope && data?.user.id ? (
            <>
              <Link className="ghost-button" to={`/users/${data.user.id}`}>Cliente</Link>
              <Link className="ghost-button" to={`/onboarding/sessions/${data.user.id}`}>360</Link>
            </>
          ) : (
            <>
              <span>Cliente</span>
              <span>360</span>
            </>
          )}
        </div>
      </Section>

      <Section
        title="Invoices Eden Bowls"
        description="PDF no padrão Eden Bowls, gerado quando a Stripe confirma o pagamento e enviado ao cliente por e-mail com o PDF anexado."
      >
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Número</th>
                <th>Emissão</th>
                <th>Total</th>
                <th>Pagamento</th>
                <th>Envio ao cliente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customerInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nenhuma invoice gerada ainda.</td>
                </tr>
              ) : (
                customerInvoices.map((item) => {
                  const delivery = describeInvoiceDelivery(item)
                  return (
                    <tr key={item.id}>
                      <td>
                        {item.invoice_number}
                        <div className="muted">{item.stripe_invoice_id}</div>
                      </td>
                      <td>{formatDate(item.issued_at)}</td>
                      <td>{formatMinorAmount(item.total_minor, item.currency)}</td>
                      <td>{formatInvoiceStatus(item.invoice_status)}</td>
                      <td>
                        <span className={`badge-${delivery.tone}`}>{delivery.label}</span>
                        <div className="muted">{delivery.detail}</div>
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button className="ghost-button" type="button" onClick={() => void downloadCustomerInvoice(item)}>
                            Baixar PDF
                          </button>
                          {canSyncBilling ? (
                            <button className="ghost-button" type="button" onClick={() => void sendCustomerInvoice(item)}>
                              {item.email_status === 'sent' ? 'Reenviar' : 'Enviar ao cliente'}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Faturas Stripe">
        {canSyncBilling ? (
          <button className="primary-button" type="button" onClick={() => void syncInvoices()}>Sincronizar faturas</button>
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
                const customerInvoice = customerInvoiceByStripeId.get(item.id)
                return (
                  <tr key={item.id}>
                    <td>{item.number ?? item.id}</td>
                    <td>{item.status}</td>
                    <td>{item.amountPaid} {item.currency}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="inline-actions">
                        <button className="ghost-button" type="button" onClick={() => void openPdf(item.id)}>PDF Stripe</button>
                        {customerInvoice ? (
                          <span className="muted">{customerInvoice.invoice_number}</span>
                        ) : canSyncBilling && item.status === 'paid' ? (
                          <button className="ghost-button" type="button" onClick={() => void issueCustomerInvoice(item.id)}>
                            Gerar invoice
                          </button>
                        ) : null}
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
        <Section title="Envio UPS" description="Etiqueta por fatura paga. Valor cotado no checkout comparado ao custo UPS na etiqueta.">
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fatura</th>
                  <th>Status</th>
                  <th>Rastreio</th>
                  <th>Serviço</th>
                  <th>Cotado</th>
                  <th>Custo UPS</th>
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
                              Baixar
                            </button>
                          ) : null}
                          {item.tracking_number ? (
                            <button className="ghost-button" type="button" onClick={() => void refreshTracking(item.id)}>
                              Atualizar rastreio
                            </button>
                          ) : null}
                          {canWriteShipping && item.status !== 'voided' && item.ups_shipment_id ? (
                            <button className="ghost-button" type="button" onClick={() => void voidShipment(item.id)}>
                              Anular
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

      {data ? (
        <LedgerSnapshotSections
          planTitle="Detalhes do produto"
          planDescription="Cópia gravada no checkout, sem recalcular."
          snapshots={readableSnapshots}
          raw={{
            petsSnapshot: data.petsSnapshot,
            planSelection: data.planSelection,
            address: data.address,
            shipping: data.shipping,
          }}
        />
      ) : null}
    </PageFrame>
  )
}
