import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { LedgerSnapshotSections } from '../components/LedgerSnapshotSections'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { CustomerContact } from '../components/CustomerContact'
import { RecipientNameDialog } from '../components/shipping/RecipientNameDialog'
import { AddressIssueStatus } from '../components/AddressIssueStatus'
import { issueCodeText, type AddressIssue } from '../lib/addressIssues'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest, getApiBaseUrl } from '../lib/api'
import { mergeReadablePets, parseCheckoutSnapshots } from '../lib/checkoutSnapshot'
import { formatDate, formatStripeStatus } from '../lib/format'
import { printLabel } from '../lib/printLabel'
import { labelIssueText, labelRefusalText, UPS_SHIPMENT_STATUS, type LabelIssue } from '../lib/upsLabels'
import { formatNfeAmount, formatNfeDate, formatNfeNumber, nfeStatusLabel, nfeStatusTone, type NfeSummary } from '../lib/nfe'
import { describeInvoiceDelivery, formatInvoiceStatus, formatMinorAmount, type CustomerInvoice } from '../lib/customerInvoices'
import { isProfileInScope } from '../lib/markets'
import { CourierDispatchDialog, CourierRowActions, CourierStatusBadge, CourierSummary } from '../components/shipping/CourierDelivery'
import { customerShippingFrom, holdTitle, productionLabel, readinessText, type CourierDelivery, type ReadinessReason } from '../lib/courierDeliveries'
import { lastContactText, outcomeLabel, reasonLabel, contactsPath, type CustomerContact as Contact } from '../lib/customerContacts'
import { paidCyclesPath, type PaidCycle } from '../lib/paidCycles'

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
  term?: { marketCountry: string; months: number }
  customerProfileInScope?: boolean
  customerName?: string | null
  user: { id: string; email: string }
  petsSnapshot: unknown
  planSelection: unknown
  shipping: unknown
  address: unknown
  // shipment-market: null when the account and the address country fit no market.
  shipment_market?: 'BR' | 'US' | null
  market_exception?: boolean
  // delivery-address-issues: the open problem, or the last one resolved in 30 days.
  address_issue?: AddressIssue | null
  // keep-ready-orders-dispatchable: what the courier dispatch would refuse for this address; null outside the
  // Brazil market, absent on an older API.
  courier_issues?: string[] | null
  // operator-fills-recipient-name: the account name to suggest, null outside the operator's market.
  account_name?: string | null
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
  tracking_url: string | null
  tracking_status: string | null
  tracking_description: string | null
  delivered_at: string | null
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

const TRACKING_STATUS: Record<string, string> = {
  label_created: 'Aguardando coleta',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  exception: 'Problema na entrega',
  returned: 'Devolvido ao remetente',
}

function cycleText(cycle: PaidCycle) {
  return [
    cycle.preparation_day ? `Preparo ${formatDay(cycle.preparation_day)}` : null,
    productionLabel(cycle.production_status),
    cycle.delivery_date ? `entrega ${formatDay(cycle.delivery_date)}` : null,
  ].filter(Boolean).join(' · ')
}

function formatDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

// The phone saved with this subscription's delivery address. The detail API carries no account phone.
function addressPhone(address: unknown): string | null {
  if (!address || typeof address !== 'object') return null
  const value = (address as Record<string, unknown>).phone
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function SubscriptionDetailPage() {
  const { token, hasPermission } = useAuth()
  const { id } = useParams()
  const [data, setData] = useState<SubscriptionDetail | null>(null)
  const location = useLocation()
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [shipments, setShipments] = useState<UpsShipment[]>([])
  const [labelIssues, setLabelIssues] = useState<LabelIssue[]>([])
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([])
  const [nfeItems, setNfeItems] = useState<NfeSummary[]>([])
  const [courierItems, setCourierItems] = useState<CourierDelivery[]>([])
  const [courierRecipient, setCourierRecipient] = useState('')
  const [dispatchInvoice, setDispatchInvoice] = useState<string | null>(null)
  const [paidCycles, setPaidCycles] = useState<PaidCycle[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const canReadShipping = hasPermission('shipping.read')
  const canWriteShipping = hasPermission('shipping.write')
  const canSyncBilling = hasPermission('billing.subscribers.sync')
  const canReadNfe = hasPermission('nfe.read')
  const canReadSubscription = hasPermission('billing.subscribers.read')
  const canFillRecipient = hasPermission('users.delivery.write')
  const [fillingRecipient, setFillingRecipient] = useState(false)
  const profileInScope = isProfileInScope(data?.customerProfileInScope)
  // Brazil delivers by courier, with no UPS label. The delivery address decides, not the Stripe account.
  const shipsWithUps = data?.term?.marketCountry === 'US'
  const shipsByCourier = data?.term?.marketCountry === 'BR'

  const loadCourier = async () => {
    if (!token || !id || !canReadShipping || !shipsByCourier) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: CourierDelivery[]; recipient_name?: string } }>(
        `/admin/billing/subscriptions/${id}/courier-deliveries`,
        { token },
      )
      setCourierItems(response.data?.items || [])
      setCourierRecipient(response.data?.recipient_name || '')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar entregas')
    }
  }

  // Paid cycles decide what waits for a label or a courier, without syncing the Stripe invoices.
  const loadPaidCycles = async () => {
    if (!token || !id || !canReadShipping) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: PaidCycle[] } }>(paidCyclesPath(id), { token })
      setPaidCycles(response.data?.items || [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar os ciclos pagos')
    }
  }

  const loadContacts = async () => {
    if (!token || !id || !canReadSubscription) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: Contact[] } }>(contactsPath(id), { token })
      setContacts(response.data?.items || [])
    } catch {
      setContacts([])
    }
  }

  useEffect(() => {
    void loadPaidCycles()
  }, [token, id, canReadShipping])

  useEffect(() => {
    void loadContacts()
  }, [token, id, canReadSubscription])

  const courierDone = (text: string) => {
    setDispatchInvoice(null)
    if (text) {
      setMessage(text)
      setError('')
    }
    void loadCourier()
    void loadPaidCycles()
  }

  const courierFailed = (text: string) => {
    setMessage('')
    setError(text)
  }

  const loadShipments = async () => {
    if (!token || !id || !canReadShipping) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: UpsShipment[]; label_issues?: LabelIssue[] } }>(
        `/admin/billing/subscriptions/${id}/shipments`,
        { token },
      )
      setShipments(response.data?.items || [])
      setLabelIssues(response.data?.label_issues || [])
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar etiquetas UPS')
    }
  }

  const loadNfe = async () => {
    if (!token || !id || !canReadNfe) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: NfeSummary[] } }>(
        `/admin/billing/subscriptions/${id}/nfe`,
        { token },
      )
      setNfeItems(response.data?.items || [])
    } catch {
      setNfeItems([])
    }
  }

  // Apart from the page load: the permissions arrive with the session, after the first render.
  useEffect(() => {
    void loadNfe()
  }, [token, id, canReadNfe])

  // The permissions load after the first render, so this waits for them, like the fiscal notes above.
  useEffect(() => {
    void loadShipments()
  }, [token, id, canReadShipping])

  useEffect(() => {
    void loadCourier()
  }, [token, id, canReadShipping, shipsByCourier])

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
      await loadCustomerInvoices()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar assinatura')
    }
  }

  useEffect(() => {
    void load()
  }, [token, id])

  // A link from another screen can point at a section (#envio-ups, #entrega-brasil, #faturas-stripe). The sections
  // render after the subscription loads, so the scroll waits for it.
  useEffect(() => {
    if (!data || !location.hash) return
    document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView?.({ block: 'start' })
  }, [data, location.hash])

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
    // The account tells the API which Stripe holds the invoice; without it an admin of both markets gets 404.
    const account = data?.stripeAccount ? `?account=${encodeURIComponent(data.stripeAccount)}` : ''
    const response = await apiRequest<{ url: string }>(`/admin/billing/invoices/${invoiceId}/pdf${account}`, { token })
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

  const createShipment = async (invoiceId: string, confirmNotReady = false): Promise<void> => {
    if (!token || !id) return
    try {
      setError('')
      const response = await apiRequest<{ success: boolean; data: { shipment: UpsShipment; reused?: boolean } }>(
        `/admin/billing/subscriptions/${id}/shipments`,
        {
          token,
          method: 'POST',
          body: { invoice_id: invoiceId, ...(confirmNotReady ? { confirm_not_ready: true } : {}) },
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
      void loadPaidCycles()
    } catch (requestError) {
      // The order is not ready or the subscription not active: buy only after the operator confirms.
      if (!confirmNotReady && requestError instanceof ApiRequestError && requestError.code === 'ups_label_needs_confirmation') {
        const reasons = Array.isArray(requestError.details?.reasons) ? requestError.details.reasons as ReadinessReason[] : []
        const list = reasons.map((reason) => `- ${readinessText(reason)}`).join('\n')
        const title = holdTitle(reasons, 'Confirme antes de comprar a etiqueta')
        if (window.confirm(`${title}.${list ? `\n\n${list}` : ''}\n\nComprar mesmo assim?`)) {
          await createShipment(invoiceId, true)
        }
        return
      }
      if (requestError instanceof ApiRequestError && requestError.status === 422) {
        setError(labelRefusalText(requestError.code, requestError.message))
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Falha ao gerar etiqueta')
    }
  }

  const fetchLabel = async (shipmentId: string) => {
    const response = await fetch(`${getApiBaseUrl()}/admin/shipments/${shipmentId}/label`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) {
      const errorBody = await response.json().catch(() => null) as { message?: string } | null
      throw new Error(errorBody?.message || 'Falha ao baixar etiqueta')
    }
    return response.blob()
  }

  const printShipmentLabel = async (shipmentId: string) => {
    if (!token) return
    try {
      setError('')
      await printLabel(await fetchLabel(shipmentId))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao imprimir etiqueta')
    }
  }

  const downloadLabel = async (shipmentId: string, filenameHint?: string | null) => {
    if (!token) return
    try {
      setError('')
      const blob = await fetchLabel(shipmentId)
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
    if (!window.confirm('Anular esta etiqueta na UPS? Ela deixa de valer e a fatura volta a precisar de etiqueta.')) return
    try {
      setError('')
      await apiRequest(`/admin/shipments/${shipmentId}/void`, { token, method: 'POST' })
      setMessage('Etiqueta anulada na UPS.')
      await loadShipments()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao anular')
    }
  }

  // A row without a UPS id may still hold a label UPS bought. It closes here only after the operator checks UPS.
  const closeUnresolvedShipment = async (shipmentId: string) => {
    if (!token) return
    const confirmed = window.confirm(
      'Você conferiu no portal da UPS que não existe etiqueta para esta fatura? A linha é fechada só aqui, sem chamar a UPS, e a fatura volta a ficar pronta para etiqueta.',
    )
    if (!confirmed) return
    try {
      setError('')
      await apiRequest(`/admin/shipments/${shipmentId}/void`, { token, method: 'POST', body: { confirm_not_created: true } })
      setMessage('Linha fechada. A fatura pode receber uma nova etiqueta.')
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

  // Paid cycles still waiting for a label: the shipping team starts here. An invoice with no cycle never shows.
  const awaitingLabel = paidCycles.filter((cycle) => !cycle.ups_shipment && !activeByInvoice.has(cycle.invoice_id))

  // Paid cycles with no courier delivery on the road or delivered.
  const courierActiveInvoices = new Set(
    courierItems.filter((item) => item.status === 'out_for_delivery' || item.status === 'delivered').map((item) => item.stripe_invoice_id),
  )
  const awaitingCourier = paidCycles.filter((cycle) => (
    (!cycle.courier_delivery || cycle.courier_delivery.status === 'failed') && !courierActiveInvoices.has(cycle.invoice_id)
  ))
  const courierLock = data?.courier_issues ?? []
  const phone = addressPhone(data?.address)
  const contactName = data?.customerName || data?.user.email || 'Cliente'

  return (
    <PageFrame
      title={data?.user.email || data?.stripeSubscriptionId || 'Assinatura'}
      description={data ? `Assinatura ${data.stripeSubscriptionId}${data.planLabel ? ` · ${data.planLabel}` : ''}. Pausa e cancelamento são feitos pelo cliente na loja.` : 'Carregando assinatura…'}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Status" value={data ? formatStripeStatus(data.status) : '—'} />
        <MetricCard label="Produto" value={data?.planLabel || '—'} />
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
              <Link className="ghost-button" to={`/users/${data.user.id}?aba=checkout`}>Checkout</Link>
            </>
          ) : (
            <>
              <span>Cliente</span>
              <span>Checkout</span>
            </>
          )}
        </div>
      </Section>

      {data?.market_exception ? (
        <div className="warning" role="status">
          Conta e país do endereço não combinam: esta assinatura não sai pela fila de etiquetas nem pela de entregas e não recebe NF-e até a conta e o país do endereço combinarem. Ela aparece em Exceções de mercado.
        </div>
      ) : null}

      {data?.address_issue ? (
        <Section
          title="Problema de endereço"
          description="O cliente corrige em Meu plano → Editar assinatura, na loja. O problema fecha sozinho quando ele salva."
          actions={(
            <CustomerContact
              subscriptionId={data.id}
              name={contactName}
              phone={phone}
              reason="address"
              showLast={false}
              onSaved={(contact) => setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)])}
            />
          )}
        >
          <AddressIssueStatus issue={data.address_issue} detailed />
        </Section>
      ) : null}

      {canReadShipping && shipsWithUps ? (
        <Section id="envio-ups" title="Envio UPS" description="Uma etiqueta por fatura paga. Compare o frete cobrado no checkout com o custo da UPS.">
          {labelIssues.length > 0 ? (
            <div className="warning" role="alert" aria-label="Etiqueta bloqueada">
              <strong>Não é possível gerar a etiqueta. Corrija antes:</strong>
              <ul>
                {labelIssues.map((issue) => (
                  <li key={issue.code}>
                    {labelIssueText(issue)}
                    {issue.code === 'ship_from_missing' ? <> <Link to="/config/shipping?aba=sede&mercado=us">Abrir configuração de frete</Link></> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                {awaitingLabel.map((item) => (
                  <tr key={`awaiting-${item.invoice_id}`}>
                    <td>{item.invoice_id}</td>
                    <td><span className="badge-warning">Sem etiqueta</span></td>
                    <td colSpan={5} className="muted">{cycleText(item)}</td>
                    <td>
                      {canWriteShipping ? (
                        <button className="primary-button" type="button" disabled={labelIssues.length > 0} onClick={() => void createShipment(item.invoice_id)}>
                          Gerar etiqueta UPS
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {shipments.length === 0 && awaitingLabel.length === 0 ? (
                  <tr>
                    <td colSpan={8}>Nenhuma etiqueta ainda. Ciclos pagos aparecem aqui para gerar a etiqueta.</td>
                  </tr>
                ) : (
                  shipments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.stripe_invoice_id}</td>
                      <td><span className={UPS_SHIPMENT_STATUS[item.status]?.badge ?? 'badge-info'}>{UPS_SHIPMENT_STATUS[item.status]?.label ?? item.status}</span></td>
                      <td>
                        {item.tracking_url ? (
                          <a href={item.tracking_url} target="_blank" rel="noreferrer">{item.tracking_number}</a>
                        ) : (item.tracking_number || '—')}
                        {item.tracking_status ? (
                          <div className="muted">
                            {TRACKING_STATUS[item.tracking_status] ?? item.tracking_description ?? item.tracking_status}
                            {item.delivered_at ? ` em ${formatDate(item.delivered_at)}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td>{item.service_code || '—'}</td>
                      <td>{item.quoted_shipping_cost != null ? item.quoted_shipping_cost : '—'}</td>
                      <td>{item.ups_monetary_value != null ? item.ups_monetary_value : '—'}</td>
                      <td>{formatDate(item.shipped_at)}</td>
                      <td>
                        <div className="inline-actions">
                          {item.has_label ? (
                            <button className="ghost-button" type="button" onClick={() => void printShipmentLabel(item.id)}>
                              Imprimir
                            </button>
                          ) : null}
                          {item.has_label ? (
                            <button className="ghost-button" type="button" onClick={() => void downloadLabel(item.id)}>
                              Baixar
                            </button>
                          ) : null}
                          {item.tracking_number && item.status === 'created' ? (
                            <button className="ghost-button" type="button" onClick={() => void refreshTracking(item.id)}>
                              Atualizar rastreio
                            </button>
                          ) : null}
                          {canWriteShipping && item.status === 'created' && item.ups_shipment_id ? (
                            <button className="ghost-button" type="button" onClick={() => void voidShipment(item.id)}>
                              Anular
                            </button>
                          ) : null}
                          {canWriteShipping && (item.status === 'pending' || item.status === 'unknown') && !item.ups_shipment_id ? (
                            <button className="ghost-button" type="button" onClick={() => void closeUnresolvedShipment(item.id)}>
                              Fechar após conferir na UPS
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

      {canReadShipping && shipsByCourier ? (
        <Section id="entrega-brasil" title="Entrega Brasil" description="Entrega por Uber, motoboy ou entregador próprio, registrada à mão. Cada tentativa fica no histórico.">
          <p>Quem recebe: <strong>{courierRecipient || '—'}</strong></p>
          {/* A lock, as on Entregas Brasil: no dialog opens and there is no way to dispatch anyway. */}
          {courierLock.length && awaitingCourier.length ? (
            <p id="courier-lock" className="badge-warning">Travado: {courierLock.map(issueCodeText).join(' · ')}</p>
          ) : null}
          {/* operator-fills-recipient-name: the recipient is the one address field filled here, only when missing. */}
          {canFillRecipient && courierLock.includes('recipient_name_missing') ? (
            <button className="link-button" type="button" onClick={() => setFillingRecipient(true)}>Informar quem recebe</button>
          ) : null}
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fatura</th>
                  <th>Status</th>
                  <th>Meio, custo e link</th>
                  <th>Saiu</th>
                  <th>Entregue ou falhou</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {awaitingCourier.map((item) => (
                  <tr key={`courier-awaiting-${item.invoice_id}`}>
                    <td>{item.invoice_id}</td>
                    <td><span className="badge-warning">A despachar</span></td>
                    <td colSpan={3} className="muted">{cycleText(item)}</td>
                    <td>
                      {canWriteShipping ? (
                        <button
                          className="primary-button"
                          type="button"
                          disabled={courierLock.length > 0}
                          aria-describedby={courierLock.length ? 'courier-lock' : undefined}
                          onClick={() => setDispatchInvoice(item.invoice_id)}
                        >
                          Despachar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                {courierItems.length === 0 && awaitingCourier.length === 0 ? (
                  <tr>
                    <td colSpan={6}>Nenhuma entrega registrada e nenhum ciclo pago esperando saída.</td>
                  </tr>
                ) : null}
                {courierItems.map((item) => (
                  <tr key={`courier-${item.id}`}>
                    <td>{item.stripe_invoice_id}</td>
                    <td><CourierStatusBadge status={item.status} /></td>
                    <td><CourierSummary delivery={item} /></td>
                    <td>{formatDate(item.out_for_delivery_at)}</td>
                    <td>{formatDate(item.delivered_at || item.failed_at || item.canceled_at)}</td>
                    <td>
                      <CourierRowActions token={token} delivery={item} canWrite={canWriteShipping} onDone={courierDone} onError={courierFailed} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CourierDispatchDialog
            token={token}
            target={dispatchInvoice && data ? { subscriptionId: data.id, invoiceId: dispatchInvoice, name: courierRecipient || data.user.email, customerShipping: customerShippingFrom(data.shipping) } : null}
            onClose={() => setDispatchInvoice(null)}
            onDone={courierDone}
          />
        </Section>
      ) : null}

      {canReadSubscription ? (
        <Section
          title="Contatos com o cliente"
          description="Contatos feitos por WhatsApp, do mais novo para o mais antigo."
          actions={data ? (
            <CustomerContact
              subscriptionId={data.id}
              name={contactName}
              phone={phone}
              showLast={false}
              onSaved={(contact) => setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)])}
            />
          ) : null}
        >
          {contacts.length ? (
            <ul className="contact-history">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <strong>{reasonLabel(contact.reason)} · {outcomeLabel(contact.outcome)}</strong>
                  <div className="muted">{lastContactText(contact)}</div>
                  {contact.note ? <div>{contact.note}</div> : null}
                </li>
              ))}
            </ul>
          ) : <p className="muted">Nenhum contato registrado.</p>}
        </Section>
      ) : null}

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

      {canReadNfe ? (
        <Section title="Notas fiscais (NF-e)" description="Emitidas pelo Bling. São outro documento, separado das invoices Eden Bowls acima.">
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Número/série</th>
                  <th>Valor</th>
                  <th>Data</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {nfeItems.length === 0 ? (
                  <tr><td colSpan={5}>Nenhuma NF-e para esta assinatura.</td></tr>
                ) : (
                  nfeItems.map((item) => (
                    <tr key={item.id}>
                      <td><span className={nfeStatusTone(item.status)}>{nfeStatusLabel(item.status)}</span></td>
                      <td><Link className="table-link" to={`/operations/nfe/${item.id}`}>{formatNfeNumber(item) === '—' ? `Nota ${item.id}` : formatNfeNumber(item)}</Link></td>
                      <td>{formatNfeAmount(item)}</td>
                      <td>{formatNfeDate(item.created_at)}</td>
                      <td>{item.last_error || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section id="faturas-stripe" title="Faturas Stripe">
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
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nenhuma fatura carregada. {canSyncBilling ? 'Use "Sincronizar faturas" para buscar na Stripe.' : ''}</td>
                </tr>
              ) : null}
              {invoices.map((item) => {
                const existing = activeByInvoice.get(item.id)
                const customerInvoice = customerInvoiceByStripeId.get(item.id)
                return (
                  <tr key={item.id}>
                    <td>{item.number ?? item.id}</td>
                    <td>{formatInvoiceStatus(item.status)}</td>
                    <td>{item.amountPaid} {item.currency?.toUpperCase()}</td>
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
      {fillingRecipient && id ? (
        <RecipientNameDialog
          subscriptionId={id}
          accountName={data?.account_name}
          onClose={() => setFillingRecipient(false)}
          onSaved={(text) => {
            setFillingRecipient(false)
            setError('')
            setMessage(text)
            void load()
            void loadCourier()
          }}
        />
      ) : null}
    </PageFrame>
  )
}
