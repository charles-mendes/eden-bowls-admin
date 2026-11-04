import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest, getApiBaseUrl } from '../lib/api'
import { printLabels } from '../lib/printLabel'
import { PRODUCTION_STATUS_LABELS, isProductionStatus } from '../lib/productionQueue'
import { labelIssueText, type LabelIssue } from '../lib/upsLabels'

type QueueShipment = { id: string | number; status: string; tracking_number: string | null; has_label: boolean }

type QueueItem = {
  subscription_id: string
  stripe_subscription_id: string
  invoice_id: string
  customer_name: string | null
  city: string | null
  zipcode: string | null
  production_status: string
  subscription_status: string
  delivery_date: string | null
  shipment: QueueShipment | null
  issues?: LabelIssue[]
}

type QueueData = { ready: QueueItem[]; unresolved: QueueItem[]; created: QueueItem[]; truncated: boolean }

type Outcome =
  | { kind: 'created'; shipmentId: string }
  | { kind: 'existing'; shipmentId: string }
  | { kind: 'in_progress'; shipmentId: string | null }
  | { kind: 'failed'; reason: string }
  | { kind: 'missing_file' }

type CreateResponse = { data?: { reused?: boolean; shipment?: { id: string | number; has_label?: boolean } } }

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
  }
}

export function LabelQueuePage() {
  const { token, hasPermission } = useAuth()
  const canBuy = hasPermission('shipping.write')
  const [data, setData] = useState<QueueData | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({})
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')

  const load = useCallback(async () => {
    if (!token) return
    try {
      const response = await apiRequest<{ data: QueueData }>('/admin/shipments/queue', { token })
      setData(response.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar a fila')
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (invoiceId: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(invoiceId)) next.delete(invoiceId)
      else next.add(invoiceId)
      return next
    })
  }

  const fetchLabel = async (shipmentId: string): Promise<Blob | null> => {
    const response = await fetch(`${getApiBaseUrl()}/admin/shipments/${shipmentId}/label`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Falha ao baixar etiqueta')
    return response.blob()
  }

  const buy = async (item: QueueItem): Promise<Outcome> => {
    try {
      const response = await apiRequest<CreateResponse>(`/admin/billing/subscriptions/${item.subscription_id}/shipments`, {
        token,
        method: 'POST',
        body: { invoice_id: item.invoice_id },
      })
      const shipmentId = String(response?.data?.shipment?.id ?? '')
      return response?.data?.reused ? { kind: 'existing', shipmentId } : { kind: 'created', shipmentId }
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && IN_PROGRESS_CODES.has(requestError.code)) {
        const id = requestError.details?.shipment_id
        return { kind: 'in_progress', shipmentId: id == null ? null : String(id) }
      }
      return { kind: 'failed', reason: requestError instanceof Error ? requestError.message : 'erro desconhecido' }
    }
  }

  const run = async () => {
    if (!data || !token || running) return
    const toBuy = data.ready.filter((item) => selected.has(item.invoice_id) && (item.issues ?? []).length === 0)
    const toPrint = data.created.filter((item) => selected.has(item.invoice_id))
    if (!toBuy.length && !toPrint.length) return

    if (toBuy.length) {
      const total = toBuy.length === 1 ? '1 etiqueta' : `${toBuy.length} etiquetas`
      if (!window.confirm(`Comprar ${total} na UPS e imprimir as etiquetas da seleção? Cada etiqueta é cobrada pela UPS.`)) return
      const unusual = toBuy.filter((item) => item.production_status !== 'ready' || !ACTIVE_SUBSCRIPTION.has(item.subscription_status))
      if (unusual.length) {
        const names = unusual
          .map((item) => `${orderName(item)} (${productionLabel(item.production_status)}, ${SUBSCRIPTION_STATUS[item.subscription_status] ?? item.subscription_status})`)
          .join('\n')
        if (!window.confirm(`Estes pedidos não estão prontos ou a assinatura não está ativa:\n${names}\n\nComprar mesmo assim?`)) return
      }
    }

    setRunning(true)
    setError('')
    const next: Record<string, Outcome> = {}
    const printable: Array<{ invoiceId: string; shipmentId: string }> = []
    try {
      for (const [index, item] of toBuy.entries()) {
        setProgress(`Comprando ${index + 1} de ${toBuy.length}…`)
        const outcome = await buy(item)
        next[item.invoice_id] = outcome
        setOutcomes({ ...next })
        if ((outcome.kind === 'created' || outcome.kind === 'existing') && outcome.shipmentId) {
          printable.push({ invoiceId: item.invoice_id, shipmentId: outcome.shipmentId })
        }
      }
      for (const item of toPrint) {
        if (item.shipment) printable.push({ invoiceId: item.invoice_id, shipmentId: String(item.shipment.id) })
      }

      setProgress('Preparando a impressão…')
      const blobs: Blob[] = []
      for (const label of printable) {
        const blob = await fetchLabel(label.shipmentId)
        if (blob) blobs.push(blob)
        else next[label.invoiceId] = { kind: 'missing_file' }
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

  const row = (item: QueueItem, selectable: boolean, blocked: LabelIssue[] = []) => {
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
        </td>
        <td>{[item.city, item.zipcode].filter(Boolean).join(' · ') || '—'}</td>
        <td>{productionLabel(item.production_status)}</td>
        <td>{SUBSCRIPTION_STATUS[item.subscription_status] ?? item.subscription_status}</td>
        <td>{formatDay(item.delivery_date)}</td>
        <td>
          {blocked.map((issue) => <div key={issue.code} className="muted" role="note">{labelIssueText(issue)}</div>)}
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

  const selectedReady = data?.ready.filter((item) => selected.has(item.invoice_id)).length ?? 0
  const selectedCreated = data?.created.filter((item) => selected.has(item.invoice_id)).length ?? 0
  const actionLabel = selectedReady ? 'Comprar e imprimir' : 'Imprimir'

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
      {data?.truncated ? <div className="warning">A fila mostra os 100 primeiros pedidos.</div> : null}

      <Section title="Prontos para etiqueta" description="Fatura paga e sem etiqueta. Um pedido bloqueado mostra o motivo e não pode ser selecionado.">
        {table(data?.ready ?? [], (item) => row(item, canBuy && (item.issues ?? []).length === 0, item.issues ?? []), data ? 'Nenhum pedido sem etiqueta.' : 'Carregando…')}
      </Section>

      <Section title="Verificar na UPS" description="A compra não teve resposta confirmada da UPS. Confira no portal da UPS e resolva no detalhe da assinatura.">
        {table(data?.unresolved ?? [], (item) => row(item, false), 'Nenhuma compra pendente.')}
      </Section>

      <Section title="Etiquetas criadas" description="Ainda não entregues. Selecione para imprimir de novo.">
        {table(data?.created ?? [], (item) => row(item, true), 'Nenhuma etiqueta aberta.')}
      </Section>
    </PageFrame>
  )
}
