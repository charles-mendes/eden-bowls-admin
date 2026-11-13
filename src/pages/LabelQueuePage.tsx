import { OtherMarketNotice } from '../components/OtherMarketNotice'
import { isOutsideMarket } from '../lib/markets'
import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest, getApiBaseUrl } from '../lib/api'
import { printLabels } from '../lib/printLabel'
import { PRODUCTION_STATUS_LABELS, isProductionStatus } from '../lib/productionQueue'
import { instructionsLine, readinessText, type ReadinessReason } from '../lib/courierDeliveries'
import type { DeliveryInstructionsSource } from '../lib/deliveryInstructions'
import { boxesSummary, labelIssueText, labelRefusalText, pickupLabel, type LabelIssue, type QueuePickup, type ShipmentPackage } from '../lib/upsLabels'
import { UpsPickupSection } from '../components/shipping/UpsPickupSection'
import { AddressIssueStatus } from '../components/AddressIssueStatus'
import { type AddressIssue } from '../lib/addressIssues'
import { DeliveryRangeFilter } from '../components/shipping/DeliveryRangeFilter'
import {
  LABELS_TIMEZONE,
  RANGE_INVALID_TEXT,
  rangeFromKey,
  rangeQuery,
  readRange,
  writeRange,
  type DeliveryRange,
  type DeliveryRangeInfo,
} from '../lib/deliveryRange'

type QueueShipment = { id: string | number; status: string; tracking_number: string | null; has_label: boolean; in_transit_at?: string | null; out_for_delivery_at?: string | null; packages?: ShipmentPackage[] }

type QueueItem = {
  subscription_id: string
  stripe_subscription_id: string
  invoice_id: string
  customer_name: string | null
  // delivery-instructions: read by whoever packs the box; the UPS label does not carry them.
  delivery_instructions?: string | null
  delivery_instructions_source?: DeliveryInstructionsSource
  city: string | null
  zipcode: string | null
  production_status: string
  subscription_status: string
  delivery_date: string | null
  shipment: QueueShipment | null
  issues?: LabelIssue[]
  // delivery-address-issues: on ready rows, the subscription's problem and the email state.
  address_issue?: AddressIssue | null
  // ups-pickup: on created rows, the active pickup of the label, or null.
  pickup?: QueuePickup | null
}

type QueueData = { ready: QueueItem[]; unresolved: QueueItem[]; created: QueueItem[]; truncated: boolean } & DeliveryRangeInfo

type Outcome =
  | { kind: 'created'; shipmentId: string; packages: number }
  | { kind: 'existing'; shipmentId: string; packages: number }
  | { kind: 'in_progress'; shipmentId: string | null }
  | { kind: 'failed'; reason: string }
  | { kind: 'missing_file' }
  | { kind: 'needs_confirmation'; reasons: ReadinessReason[] }

type CreateResponse = { data?: { reused?: boolean; shipment?: { id: string | number; has_label?: boolean; packages?: ShipmentPackage[] } } }

// One page per box: a shipment with packages prints each `?package=N`; one bought before boxes prints once.
type PrintableLabel = { invoiceId: string; shipmentId: string; packages: number }

// UPS may already have bought these labels, so they are never retried from the queue.
const IN_PROGRESS_CODES = new Set(['ups_shipment_unknown', 'ups_shipment_unresolved', 'ups_shipment_in_progress'])
const ACTIVE_SUBSCRIPTION = new Set(['active', 'trialing'])

const SUBSCRIPTION_STATUS: Record<string, string> = {
  active: 'Ativa',
  trialing: 'Ativa',
  past_due: 'Pagamento pendente',
  paused: 'Pausada',
  canceled: 'Cancelada',
}

function productionLabel(status: string): string {
  return isProductionStatus(status) ? PRODUCTION_STATUS_LABELS[status] : status
}

function formatDay(value: string | null): string {
  const day = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—'
  const [year, month, date] = day.split('-')
  return `${month}/${date}/${year}`
}

function orderName(item: QueueItem): string {
  return item.customer_name || item.stripe_subscription_id
}

function outcomeText(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'created':
      return 'Etiqueta comprada'
    case 'existing':
      return 'Já tinha etiqueta'
    case 'in_progress':
      return `Em andamento na UPS${outcome.shipmentId ? ` (envio ${outcome.shipmentId})` : ''}. Confira no detalhe da assinatura`
    case 'failed':
      return `Falhou: ${outcome.reason}`
    case 'missing_file':
      return 'Arquivo da etiqueta ausente. Veja o detalhe da assinatura'
    case 'needs_confirmation':
      return `Precisa confirmar${outcome.reasons.length ? `: ${outcome.reasons.map(readinessText).join(', ')}` : ''}. Nada foi comprado`
  }
}

export function LabelQueuePage() {
  const { token, hasPermission, user } = useAuth()
  const otherMarket = isOutsideMarket(user, 'US')
  // Wait for the session: its markets decide whether this screen loads at all.
  const sessionReady = Boolean(user)
  const canBuy = hasPermission('shipping.write')
  const [data, setData] = useState<QueueData | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const { hash } = useLocation()
  // PM-29: the delivery range of the ready orders (`de`/`ate`); created and unresolved labels ignore it.
  // PM-26: `problema=endereco`, from Hoje, keeps the ready orders with an open address problem.
  const [searchParams, setSearchParams] = useSearchParams()
  const range = readRange(searchParams)
  const rangeKey = range ? `${range.from}|${range.to}` : ''
  const addressOnly = searchParams.get('problema') === 'endereco'
  const [rangeInvalid, setRangeInvalid] = useState(false)
  const setRange = (next: DeliveryRange | null) => setSearchParams(writeRange(searchParams, next), { replace: true })
  const clearAddressFilter = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('problema')
    setSearchParams(params, { replace: true })
  }

  const load = useCallback(async () => {
    if (!token || !sessionReady || otherMarket) return
    try {
      const response = await apiRequest<{ data: QueueData }>(`/admin/shipments/queue${rangeQuery(rangeFromKey(rangeKey))}`, { token })
      setRangeInvalid(false)
      setData(response.data)
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'invalid_delivery_range') {
        setData(null)
        setRangeInvalid(true)
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a fila')
    }
  }, [token, sessionReady, otherMarket, rangeKey])

  useEffect(() => {
    void load()
  }, [load])

  // Today links to #verificar-ups and #coleta; the sections only exist at their final place once the queue has loaded.
  const loaded = Boolean(data)
  useEffect(() => {
    if (!loaded || (hash !== '#verificar-ups' && hash !== '#coleta')) return
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ block: 'start' })
  }, [loaded, hash])

  const toggle = (invoiceId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(invoiceId)) next.delete(invoiceId)
      else next.add(invoiceId)
      return next
    })
  }

  const fetchLabel = async (shipmentId: string, packageNumber?: number): Promise<Blob | null> => {
    const query = packageNumber ? `?package=${packageNumber}` : ''
    const response = await fetch(`${getApiBaseUrl()}/admin/shipments/${shipmentId}/label${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Falha ao baixar etiqueta')
    return response.blob()
  }

  // confirmNotReady goes only for the orders the operator confirmed as not ready.
  const buy = async (item: QueueItem, confirmNotReady: boolean): Promise<Outcome> => {
    try {
      const response = await apiRequest<CreateResponse>(`/admin/billing/subscriptions/${item.subscription_id}/shipments`, {
        token,
        method: 'POST',
        body: { invoice_id: item.invoice_id, ...(confirmNotReady ? { confirm_not_ready: true } : {}) },
      })
      const shipmentId = String(response?.data?.shipment?.id ?? '')
      const packages = response?.data?.shipment?.packages?.length ?? 0
      return response?.data?.reused ? { kind: 'existing', shipmentId, packages } : { kind: 'created', shipmentId, packages }
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && IN_PROGRESS_CODES.has(requestError.code)) {
        const id = requestError.details?.shipment_id
        return { kind: 'in_progress', shipmentId: id == null ? null : String(id) }
      }
      // The order changed since the queue loaded: nothing is bought and the batch goes on.
      if (requestError instanceof ApiRequestError && requestError.code === 'ups_label_needs_confirmation') {
        const reasons = requestError.details?.reasons
        return { kind: 'needs_confirmation', reasons: Array.isArray(reasons) ? reasons as ReadinessReason[] : [] }
      }
      if (requestError instanceof ApiRequestError) {
        return { kind: 'failed', reason: labelRefusalText(requestError.code, requestError.message) }
      }
      return { kind: 'failed', reason: requestError instanceof Error ? requestError.message : 'erro desconhecido' }
    }
  }

  const run = async () => {
    if (!data || !token || running) return
    const toBuy = data.ready.filter((item) => selected.has(item.invoice_id) && (item.issues ?? []).length === 0)
    const toPrint = data.created.filter((item) => selected.has(item.invoice_id))
    if (!toBuy.length && !toPrint.length) return

    const notReady = (item: QueueItem) => item.production_status !== 'ready' || !ACTIVE_SUBSCRIPTION.has(item.subscription_status)
    const confirmed = new Set<string>()
    if (toBuy.length) {
      const total = toBuy.length === 1 ? '1 etiqueta' : `${toBuy.length} etiquetas`
      if (!window.confirm(`Comprar ${total} na UPS e imprimir as etiquetas da seleção? Cada etiqueta é cobrada pela UPS.`)) return
      const unusual = toBuy.filter(notReady)
      if (unusual.length) {
        const names = unusual
          .map((item) => `${orderName(item)} (${productionLabel(item.production_status)}, ${SUBSCRIPTION_STATUS[item.subscription_status] ?? item.subscription_status})`)
          .join('\n')
        if (!window.confirm(`Estes pedidos não estão prontos ou a assinatura não está ativa:\n${names}\n\nComprar mesmo assim?`)) return
        unusual.forEach((item) => confirmed.add(item.invoice_id))
      }
    }

    setRunning(true)
    setError('')
    const next: Record<string, Outcome> = {}
    const printable: PrintableLabel[] = []
    try {
      for (const [index, item] of toBuy.entries()) {
        setProgress(`Comprando ${index + 1} de ${toBuy.length}…`)
        const outcome = await buy(item, confirmed.has(item.invoice_id))
        next[item.invoice_id] = outcome
        setOutcomes({ ...next })
        if ((outcome.kind === 'created' || outcome.kind === 'existing') && outcome.shipmentId) {
          printable.push({ invoiceId: item.invoice_id, shipmentId: outcome.shipmentId, packages: outcome.packages })
        }
      }
      for (const item of toPrint) {
        if (item.shipment) printable.push({ invoiceId: item.invoice_id, shipmentId: String(item.shipment.id), packages: item.shipment.packages?.length ?? 0 })
      }

      setProgress('Preparando a impressão…')
      const blobs: Blob[] = []
      for (const label of printable) {
        const numbers = label.packages > 0 ? Array.from({ length: label.packages }, (_, index) => index + 1) : [undefined]
        for (const packageNumber of numbers) {
          const blob = await fetchLabel(label.shipmentId, packageNumber)
          if (blob) blobs.push(blob)
          else next[label.invoiceId] = { kind: 'missing_file' }
        }
      }
      setOutcomes({ ...next })
      if (blobs.length) await printLabels(blobs)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao imprimir etiquetas')
    } finally {
      setRunning(false)
      setProgress('')
      setSelected(new Set())
      await load()
    }
  }

  const row = (item: QueueItem, selectable: boolean, blocked: LabelIssue[] = [], withPickup = false) => {
    const outcome = outcomes[item.invoice_id]
    return (
      <tr key={item.invoice_id}>
        <td>
          {selectable ? (
            <input
              type="checkbox"
              aria-label={`Selecionar ${orderName(item)}`}
              checked={selected.has(item.invoice_id)}
              disabled={running}
              onChange={() => toggle(item.invoice_id)}
            />
          ) : null}
        </td>
        <td>
          <strong>{orderName(item)}</strong>
          <div className="muted">{item.invoice_id}</div>
          {item.delivery_instructions ? <div className="queue-instructions">{instructionsLine(item)}</div> : null}
        </td>
        <td>{[item.city, item.zipcode].filter(Boolean).join(' · ') || '—'}</td>
        <td>{productionLabel(item.production_status)}</td>
        <td>{SUBSCRIPTION_STATUS[item.subscription_status] ?? item.subscription_status}</td>
        <td>{formatDay(item.delivery_date)}</td>
        <td>
          {blocked.map((issue) => <div key={issue.code} className="muted" role="note">{labelIssueText(issue)}</div>)}
          <AddressIssueStatus issue={item.address_issue} />
          {withPickup && boxesSummary(item.shipment?.packages) ? <div className="muted">{boxesSummary(item.shipment?.packages)}</div> : null}
          {withPickup ? <div className="muted">{pickupLabel(item.pickup)}</div> : null}
          {outcome ? <div data-testid={`outcome-${item.invoice_id}`}>{outcomeText(outcome)}</div> : null}
        </td>
        <td>
          <Link className="ghost-button" to={`/billing/subscriptions/${item.subscription_id}`}>Assinatura</Link>
        </td>
      </tr>
    )
  }

  const table = (items: QueueItem[], render: (item: QueueItem) => ReactElement, empty: string) => (
    <div className="table-shell table-scroll">
      <table>
        <thead>
          <tr>
            <th aria-label="Seleção"></th>
            <th>Pedido</th>
            <th>Cidade e ZIP</th>
            <th>Preparo</th>
            <th>Assinatura</th>
            <th>Entrega</th>
            <th>Situação</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length ? items.map(render) : <tr><td colSpan={8}>{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  )

  const readyRows = (data?.ready ?? []).filter((item) => !addressOnly || item.address_issue?.open)
  const readyEmpty = addressOnly ? 'Nenhum pedido com problema de endereço neste período.' : 'Nenhum pedido sem etiqueta.'
  const selectedReady = data?.ready.filter((item) => selected.has(item.invoice_id)).length ?? 0
  const selectedCreated = data?.created.filter((item) => selected.has(item.invoice_id)).length ?? 0
  const actionLabel = selectedReady ? 'Comprar e imprimir' : 'Imprimir'

  if (otherMarket) return <OtherMarketNotice title="Etiquetas UPS" market="US" />

  return (
    <PageFrame
      title="Etiquetas UPS"
      description="Pedidos pagos dos EUA sem etiqueta e etiquetas já criadas. Selecione, confirme e imprima tudo de uma vez. Anular e corrigir endereço ficam no detalhe da assinatura."
      actions={(
        <button
          className="primary-button"
          type="button"
          disabled={running || (!selectedCreated && !(selectedReady && canBuy))}
          onClick={() => void run()}
        >
          {actionLabel}
        </button>
      )}
    >
      {error ? <div className="alert">{error}</div> : null}
      {progress ? <div className="muted" aria-live="polite">{progress}</div> : null}
      {rangeInvalid ? <div className="alert" role="alert">{RANGE_INVALID_TEXT}</div> : null}
      <DeliveryRangeFilter
        key={rangeKey}
        range={range}
        info={data}
        timeZone={LABELS_TIMEZONE}
        truncated={Boolean(data?.truncated)}
        onChange={setRange}
      />
      {addressOnly ? (
        <div className="queue-summary-main">
          <span className="filter-chip">
            Com problema de endereço
            <button type="button" aria-label="Remover filtro Com problema de endereço" onClick={clearAddressFilter}>×</button>
          </span>
        </div>
      ) : null}

      <Section title="Prontos para etiqueta" description="Fatura paga e sem etiqueta. Um pedido bloqueado mostra o motivo e não pode ser selecionado.">
        {table(readyRows, (item) => row(item, canBuy && (item.issues ?? []).length === 0, item.issues ?? []), data ? readyEmpty : 'Carregando…')}
      </Section>

      <Section id="verificar-ups" title="Verificar na UPS" description="A compra não teve resposta confirmada da UPS. Confira no portal da UPS e resolva no detalhe da assinatura.">
        {table(data?.unresolved ?? [], (item) => row(item, false), 'Nenhuma compra pendente.')}
      </Section>

      <Section title="Etiquetas criadas" description="Ainda não entregues. Selecione para imprimir de novo.">
        {table(data?.created ?? [], (item) => row(item, true, [], true), 'Nenhuma etiqueta aberta.')}
      </Section>

      <UpsPickupSection token={token} canWrite={canBuy} labels={data ? data.created : null} onChanged={load} />
    </PageFrame>
  )
}
