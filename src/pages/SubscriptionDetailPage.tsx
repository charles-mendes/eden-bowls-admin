import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { LedgerSnapshotSections } from '../components/LedgerSnapshotSections'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { SectionFeedbackView } from '../components/SectionFeedbackView'
import { CustomerContact } from '../components/CustomerContact'
import { RecipientNameDialog } from '../components/shipping/RecipientNameDialog'
import { SubscriptionInstructions } from '../components/shipping/SubscriptionInstructions'
import { CourierDispatchDialog } from '../components/shipping/CourierDelivery'
import { AddressIssueStatus } from '../components/AddressIssueStatus'
import { AttentionList } from '../components/subscription/AttentionList'
import { ChargesSection } from '../components/subscription/ChargesSection'
import { CourierSection } from '../components/subscription/CourierSection'
import { CurrentCycleCard } from '../components/subscription/CurrentCycleCard'
import { SendInvoiceDialog } from '../components/subscription/SendInvoiceDialog'
import { SubscriptionHeaderActions, SubscriptionHeaderLine } from '../components/subscription/SubscriptionHeader'
import { UpsShipmentSection, type UpsActions } from '../components/subscription/UpsShipmentSection'
import { addressPhone, subscriptionTitle, type SubscriptionDetail, type UpsShipment } from '../components/subscription/types'
import { useAuth } from '../contexts/AuthContext'
import { ADDRESS_SECTION_ID, attentionEntries } from '../lib/attention'
import { ApiRequestError, apiRequest, getApiBaseUrl } from '../lib/api'
import { buildCharges, type StripeInvoiceItem } from '../lib/charges'
import { mergeReadablePets, parseCheckoutSnapshots, planDescription } from '../lib/checkoutSnapshot'
import { currentCycle } from '../lib/currentCycle'
import { printLabel } from '../lib/printLabel'
import { labelRefusalText, type LabelIssue } from '../lib/upsLabels'
import type { NfeSummary } from '../lib/nfe'
import { describeInvoiceDelivery, type CustomerInvoice } from '../lib/customerInvoices'
import { isProfileInScope } from '../lib/markets'
import { customerShippingFrom, holdTitle, readinessText, type CourierDelivery, type ReadinessReason } from '../lib/courierDeliveries'
import { lastContactText, outcomeLabel, reasonLabel, contactsPath, type CustomerContact as Contact } from '../lib/customerContacts'
import { paidCyclesPath, type PaidCycle } from '../lib/paidCycles'
import { useSectionFeedback, type SectionFeedback } from '../lib/useSectionFeedback'

const failure = (requestError: unknown, fallback: string) => (requestError instanceof Error ? requestError.message : fallback)

export function SubscriptionDetailPage() {
  const { token, hasPermission } = useAuth()
  const { id } = useParams()
  const [data, setData] = useState<SubscriptionDetail | null>(null)
  const location = useLocation()
  const [stripeInvoices, setStripeInvoices] = useState<StripeInvoiceItem[]>([])
  const [shipments, setShipments] = useState<UpsShipment[]>([])
  const [labelIssues, setLabelIssues] = useState<LabelIssue[]>([])
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([])
  const [nfeItems, setNfeItems] = useState<NfeSummary[]>([])
  const [courierItems, setCourierItems] = useState<CourierDelivery[]>([])
  const [courierRecipient, setCourierRecipient] = useState('')
  // The dispatch dialog, and which section's feedback reports it.
  const [dispatch, setDispatch] = useState<{ invoiceId: string; from: 'cycle' | 'courier' } | null>(null)
  const [sending, setSending] = useState<CustomerInvoice | null>(null)
  const [paidCycles, setPaidCycles] = useState<PaidCycle[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  // Only load failures stay at the top; an action reports in its own section.
  const [loadError, setLoadError] = useState('')
  const cycleFeedback = useSectionFeedback()
  const upsFeedback = useSectionFeedback()
  const courierFeedback = useSectionFeedback()
  const chargesFeedback = useSectionFeedback()
  const instructionsFeedback = useSectionFeedback()
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
      setLoadError(failure(requestError, 'Falha ao carregar entregas'))
    }
  }

  // Paid cycles decide what waits for a label or a courier, without syncing the Stripe invoices.
  const loadPaidCycles = async () => {
    if (!token || !id || !canReadShipping) return
    try {
      const response = await apiRequest<{ success: boolean; data: { items: PaidCycle[] } }>(paidCyclesPath(id), { token })
      setPaidCycles(response.data?.items || [])
    } catch (requestError) {
      setLoadError(failure(requestError, 'Falha ao carregar os ciclos pagos'))
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

  const courierDone = (feedback: SectionFeedback) => (text: string) => {
    setDispatch(null)
    if (text) feedback.succeed(text)
    void loadCourier()
    void loadPaidCycles()
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
      setLoadError(failure(requestError, 'Falha ao carregar etiquetas UPS'))
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
      setLoadError(failure(requestError, 'Falha ao carregar invoices'))
    }
  }

  const load = async () => {
    if (!token || !id) return
    try {
      setLoadError('')
      const response = await apiRequest<SubscriptionDetail>(`/admin/billing/subscriptions/${id}`, { token })
      setData(response)
      await loadCustomerInvoices()
    } catch (requestError) {
      setLoadError(failure(requestError, 'Falha ao carregar assinatura'))
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

  // Adds the Stripe invoices to the charges; the rows already listed stay.
  const fetchStripeInvoices = async () => {
    if (!token || !id) return
    chargesFeedback.start()
    try {
      const response = await apiRequest<{ success: boolean; data: { items: StripeInvoiceItem[] } }>(`/admin/billing/subscriptions/${id}/sync-invoices`, {
        token,
        method: 'POST',
      })
      setStripeInvoices(response.data?.items || [])
      chargesFeedback.succeed('Faturas da Stripe carregadas.')
    } catch (requestError) {
      chargesFeedback.fail(failure(requestError, 'Falha ao buscar as faturas na Stripe'))
    }
  }

  const openPdf = async (invoiceId: string) => {
    if (!token) return
    chargesFeedback.start()
    try {
      // The account tells the API which Stripe holds the invoice; without it an admin of both markets gets 404.
      const account = data?.stripeAccount ? `?account=${encodeURIComponent(data.stripeAccount)}` : ''
      const response = await apiRequest<{ url: string }>(`/admin/billing/invoices/${invoiceId}/pdf${account}`, { token })
      if (response.url) {
        window.open(response.url, '_blank', 'noopener,noreferrer')
      }
    } catch (requestError) {
      chargesFeedback.fail(failure(requestError, 'Falha ao abrir o PDF da Stripe'))
    }
  }

  const issueCustomerInvoice = async (stripeInvoiceId: string) => {
    if (!token || !id) return
    chargesFeedback.start()
    try {
      await apiRequest(`/admin/billing/subscriptions/${id}/customer-invoices`, {
        token,
        method: 'POST',
        body: { stripe_invoice_id: stripeInvoiceId },
      })
      chargesFeedback.succeed('Invoice gerada. Use "Enviar ao cliente" para mandar por e-mail.')
      await loadCustomerInvoices()
    } catch (requestError) {
      chargesFeedback.fail(failure(requestError, 'Falha ao gerar invoice'))
    }
  }

  const downloadCustomerInvoice = async (item: CustomerInvoice) => {
    if (!token) return
    chargesFeedback.start()
    try {
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
      chargesFeedback.fail(failure(requestError, 'Falha ao baixar invoice'))
    }
  }

  const sendCustomerInvoice = async (item: CustomerInvoice) => {
    if (!token) return
    setSending(null)
    chargesFeedback.start()
    try {
      const response = await apiRequest<{ success: boolean; data: CustomerInvoice }>(
        `/admin/billing/customer-invoices/${item.id}/send`,
        { token, method: 'POST' },
      )
      const updated = response.data
      if (updated) {
        setCustomerInvoices((current) => current.map((row) => (row.id === updated.id ? updated : row)))
      }
      if (response.success) {
        chargesFeedback.succeed(`Invoice ${item.invoice_number} enviada para ${updated?.email_to || item.email_to}.`)
      } else {
        chargesFeedback.fail(`Invoice ${item.invoice_number} não foi enviada: ${describeInvoiceDelivery(updated || item).detail}`)
      }
    } catch (requestError) {
      chargesFeedback.fail(failure(requestError, 'Falha ao enviar invoice'))
    }
  }

  const createShipment = async (invoiceId: string, feedback: SectionFeedback, confirmNotReady = false): Promise<void> => {
    if (!token || !id) return
    feedback.start()
    try {
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
      feedback.succeed(response.data?.reused ? 'Etiqueta já existia para esta invoice (idempotente).' : 'Etiqueta UPS gerada.')
      void loadPaidCycles()
    } catch (requestError) {
      // The order is not ready or the subscription not active: buy only after the operator confirms.
      if (!confirmNotReady && requestError instanceof ApiRequestError && requestError.code === 'ups_label_needs_confirmation') {
        const reasons = Array.isArray(requestError.details?.reasons) ? requestError.details.reasons as ReadinessReason[] : []
        const list = reasons.map((reason) => `- ${readinessText(reason)}`).join('\n')
        const title = holdTitle(reasons, 'Confirme antes de comprar a etiqueta')
        if (window.confirm(`${title}.${list ? `\n\n${list}` : ''}\n\nComprar mesmo assim?`)) {
          await createShipment(invoiceId, feedback, true)
        }
        return
      }
      if (requestError instanceof ApiRequestError && requestError.status === 422) {
        feedback.fail(labelRefusalText(requestError.code, requestError.message))
        return
      }
      feedback.fail(failure(requestError, 'Falha ao gerar etiqueta'))
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

  const printShipmentLabel = async (shipmentId: string, feedback: SectionFeedback) => {
    if (!token) return
    feedback.start()
    try {
      await printLabel(await fetchLabel(shipmentId))
    } catch (requestError) {
      feedback.fail(failure(requestError, 'Falha ao imprimir etiqueta'))
    }
  }

  const downloadLabel = async (shipmentId: string, feedback: SectionFeedback) => {
    if (!token) return
    feedback.start()
    try {
      const blob = await fetchLabel(shipmentId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `ups-label-${shipmentId}.gif`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      feedback.fail(failure(requestError, 'Falha ao baixar etiqueta'))
    }
  }

  const voidShipment = async (shipmentId: string, feedback: SectionFeedback) => {
    if (!token) return
    if (!window.confirm('Anular esta etiqueta na UPS? Ela deixa de valer e a fatura volta a precisar de etiqueta.')) return
    feedback.start()
    try {
      await apiRequest(`/admin/shipments/${shipmentId}/void`, { token, method: 'POST' })
      feedback.succeed('Etiqueta anulada na UPS.')
      await loadShipments()
    } catch (requestError) {
      feedback.fail(failure(requestError, 'Falha ao anular'))
    }
  }

  // A row without a UPS id may still hold a label UPS bought. It closes here only after the operator checks UPS.
  const closeUnresolvedShipment = async (shipmentId: string, feedback: SectionFeedback) => {
    if (!token) return
    const confirmed = window.confirm(
      'Você conferiu no portal da UPS que não existe etiqueta para esta fatura? A linha é fechada só aqui, sem chamar a UPS, e a fatura volta a ficar pronta para etiqueta.',
    )
    if (!confirmed) return
    feedback.start()
    try {
      await apiRequest(`/admin/shipments/${shipmentId}/void`, { token, method: 'POST', body: { confirm_not_created: true } })
      feedback.succeed('Linha fechada. A fatura pode receber uma nova etiqueta.')
      await loadShipments()
    } catch (requestError) {
      feedback.fail(failure(requestError, 'Falha ao anular'))
    }
  }

  const refreshTracking = async (shipmentId: string, feedback: SectionFeedback) => {
    if (!token) return
    feedback.start()
    try {
      await apiRequest(`/admin/shipments/${shipmentId}/refresh-tracking`, { token, method: 'POST' })
      feedback.succeed('Rastreio atualizado.')
      await loadShipments()
    } catch (requestError) {
      feedback.fail(failure(requestError, 'Falha ao atualizar o rastreio'))
    }
  }

  const upsActions: UpsActions = {
    createShipment: (invoiceId, feedback) => void createShipment(invoiceId, feedback),
    printShipmentLabel: (shipmentId, feedback) => void printShipmentLabel(shipmentId, feedback),
    downloadLabel: (shipmentId, feedback) => void downloadLabel(shipmentId, feedback),
    refreshTracking: (shipmentId, feedback) => void refreshTracking(shipmentId, feedback),
    voidShipment: (shipmentId, feedback) => void voidShipment(shipmentId, feedback),
    closeUnresolvedShipment: (shipmentId, feedback) => void closeUnresolvedShipment(shipmentId, feedback),
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
  const contactName = data?.account_name || data?.user.email || 'Cliente'
  const addContact = (contact: Contact) => setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)])
  const shippingMarket = shipsWithUps ? 'US' : shipsByCourier ? 'BR' : null

  const current = data && canReadShipping
    ? currentCycle({ paidCycles, shipments, courierItems, market: shippingMarket, canWrite: canWriteShipping })
    : null
  const entries = data
    ? attentionEntries({
      subscriptionId: data.id,
      stripeAccount: data.stripeAccount,
      nfeItems: canReadNfe ? nfeItems : [],
      addressIssue: data.address_issue,
      courierIssues: data.courier_issues,
      courierWaiting: shipsByCourier && awaitingCourier.length > 0,
      courierItems: shipsByCourier ? courierItems : [],
      marketException: data.market_exception,
    })
    : []
  const charges = buildCharges({
    subscriptionAccount: data?.stripeAccount,
    paidCycles,
    customerInvoices,
    nfeItems: canReadNfe ? nfeItems : [],
    stripeInvoices,
  })
  const plan = data ? planDescription({ planLabel: data.planLabel, planSelection: data.planSelection, petsSnapshot: data.petsSnapshot, termMonths: data.term?.months }) : ''
  const chargedFreight = customerShippingFrom(data?.shipping)?.amount ?? null
  const dispatchFeedback = dispatch?.from === 'cycle' ? cycleFeedback : courierFeedback

  return (
    <PageFrame
      title={subscriptionTitle(data)}
      description={data ? <SubscriptionHeaderLine data={data} plan={plan} /> : 'Carregando assinatura…'}
      actions={data ? <SubscriptionHeaderActions data={data} profileInScope={profileInScope} /> : null}
    >
      {loadError ? <div className="alert">{loadError}</div> : null}

      <div className="subscription-detail">
        <AttentionList entries={entries} />

        {data && canReadShipping ? (
          <CurrentCycleCard
            current={current}
            token={token}
            feedback={cycleFeedback}
            subscriptionId={data.id}
            contactName={contactName}
            phone={phone}
            dispatchLocked={courierLock.length > 0}
            labelLocked={labelIssues.length > 0}
            ups={upsActions}
            onDispatch={(invoiceId) => setDispatch({ invoiceId, from: 'cycle' })}
            onCourierDone={courierDone(cycleFeedback)}
            onContactSaved={addContact}
          />
        ) : null}

        {data && data.delivery_instructions !== undefined ? (
          <Section title="Instruções de entrega">
            <SectionFeedbackView feedback={instructionsFeedback} />
            <SubscriptionInstructions
              subscriptionId={data.id}
              text={data.delivery_instructions}
              source={data.delivery_instructions_source}
              canWrite={canFillRecipient}
              onSaved={(text) => {
                instructionsFeedback.succeed(text)
                void load()
              }}
            />
          </Section>
        ) : null}

        {data?.address_issue ? (
          <Section
            id={ADDRESS_SECTION_ID}
            title="Problema de endereço"
            description="O cliente corrige em Meu plano → Editar assinatura, na loja. O problema fecha sozinho quando ele salva."
            actions={(
              <CustomerContact
                subscriptionId={data.id}
                name={contactName}
                phone={phone}
                reason="address"
                showLast={false}
                onSaved={addContact}
              />
            )}
          >
            <AddressIssueStatus issue={data.address_issue} detailed />
          </Section>
        ) : null}

        {canReadShipping && shipsWithUps ? (
          <UpsShipmentSection
            shipments={shipments}
            labelIssues={labelIssues}
            awaitingLabel={awaitingLabel}
            canWrite={canWriteShipping}
            feedback={upsFeedback}
            actions={upsActions}
          />
        ) : null}

        {canReadShipping && shipsByCourier ? (
          <CourierSection
            token={token}
            recipient={courierRecipient}
            phone={phone}
            chargedFreight={chargedFreight}
            lock={courierLock}
            awaiting={awaitingCourier}
            items={courierItems}
            canWrite={canWriteShipping}
            canFillRecipient={canFillRecipient}
            feedback={courierFeedback}
            onDispatch={(invoiceId) => setDispatch({ invoiceId, from: 'courier' })}
            onFillRecipient={() => setFillingRecipient(true)}
            onDone={courierDone(courierFeedback)}
          />
        ) : null}

        <ChargesSection
          charges={charges}
          canSync={canSyncBilling}
          canReadNfe={canReadNfe}
          feedback={chargesFeedback}
          onFetchStripe={() => void fetchStripeInvoices()}
          onOpenStripePdf={(invoiceId) => void openPdf(invoiceId)}
          onIssueInvoice={(invoiceId) => void issueCustomerInvoice(invoiceId)}
          onDownloadInvoice={(item) => void downloadCustomerInvoice(item)}
          onSendInvoice={setSending}
        />

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
                onSaved={addContact}
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
      </div>

      {canReadShipping && shipsByCourier ? (
        <CourierDispatchDialog
          token={token}
          target={dispatch && data ? { subscriptionId: data.id, invoiceId: dispatch.invoiceId, name: courierRecipient || data.user.email, customerShipping: customerShippingFrom(data.shipping) } : null}
          onClose={() => setDispatch(null)}
          onDone={courierDone(dispatchFeedback)}
        />
      ) : null}
      <SendInvoiceDialog invoice={sending} onCancel={() => setSending(null)} onConfirm={(item) => void sendCustomerInvoice(item)} />
      {fillingRecipient && id ? (
        <RecipientNameDialog
          subscriptionId={id}
          accountName={data?.account_name}
          onClose={() => setFillingRecipient(false)}
          onSaved={(text) => {
            setFillingRecipient(false)
            courierFeedback.succeed(text)
            void load()
            void loadCourier()
          }}
        />
      ) : null}
    </PageFrame>
  )
}
