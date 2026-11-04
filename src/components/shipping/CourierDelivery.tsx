import { useState, type FormEvent } from 'react'
import { Dialog } from '../Dialog'
import { ApiRequestError, apiRequest } from '../../lib/api'
import {
  COURIER_METHODS,
  COURIER_STATUS,
  costInput,
  courierErrorText,
  formatCost,
  methodLabel,
  readinessText,
  type CourierDelivery,
  type CourierMethod,
  type ReadinessReason,
} from '../../lib/courierDeliveries'
import { formatDate } from '../../lib/format'

type DispatchTarget = { subscriptionId: string; invoiceId: string; name: string }

type DispatchDialogProps = {
  token: string | null
  target: DispatchTarget | null
  onClose: () => void
  onDone: (message: string) => void
}

// One dispatch at a time. When the order is not ready the API answers 409 with the reasons, and the operator
// confirms a second time before it is sent again with confirm_not_ready.
export function CourierDispatchDialog({ token, target, onClose, onDone }: DispatchDialogProps) {
  const [method, setMethod] = useState<CourierMethod>('uber')
  const [courierName, setCourierName] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [cost, setCost] = useState('')
  const [note, setNote] = useState('')
  const [reasons, setReasons] = useState<ReadinessReason[] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const close = () => {
    setReasons(null)
    setError('')
    onClose()
  }

  const send = async (confirmNotReady: boolean) => {
    if (!target || saving) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/admin/billing/subscriptions/${target.subscriptionId}/courier-deliveries`, {
        token,
        method: 'POST',
        body: {
          invoice_id: target.invoiceId,
          method,
          courier_name: courierName.trim() || undefined,
          tracking_url: trackingUrl.trim() || undefined,
          cost: costInput(cost),
          note: note.trim() || undefined,
          ...(confirmNotReady ? { confirm_not_ready: true } : {}),
        },
      })
      setReasons(null)
      setCourierName('')
      setTrackingUrl('')
      setCost('')
      setNote('')
      onDone(`Entrega de ${target.name} registrada como em rota.`)
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'courier_dispatch_needs_confirmation') {
        setReasons(Array.isArray(requestError.details?.reasons) ? requestError.details.reasons as ReadinessReason[] : [])
      } else {
        setError(courierErrorText(requestError))
      }
    } finally {
      setSaving(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void send(false)
  }

  return (
    <Dialog
      open={Boolean(target)}
      onClose={close}
      title={reasons ? 'Pedido ainda não está pronto' : 'Despachar entrega'}
      description={target ? `${target.name} · fatura ${target.invoiceId}` : undefined}
      footer={reasons ? (
        <>
          <button type="button" className="ghost-button" onClick={() => setReasons(null)}>Voltar</button>
          <button type="button" className="primary-button" disabled={saving} onClick={() => void send(true)}>Despachar mesmo assim</button>
        </>
      ) : (
        <button type="submit" form="courier-dispatch-form" className="primary-button" disabled={saving}>Registrar saída</button>
      )}
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {reasons ? (
        <div className="warning" role="alert" aria-label="Confirmação de despacho">
          <strong>Confirme antes de despachar:</strong>
          <ul>
            {reasons.map((reason) => <li key={reason.code}>{readinessText(reason)}</li>)}
          </ul>
        </div>
      ) : (
        <form id="courier-dispatch-form" className="stack" onSubmit={submit}>
          <label>
            Meio de entrega
            <select value={method} onChange={(event) => setMethod(event.target.value as CourierMethod)}>
              {COURIER_METHODS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Entregador
            <input value={courierName} maxLength={120} onChange={(event) => setCourierName(event.target.value)} />
          </label>
          <label>
            Link de acompanhamento
            <input type="url" inputMode="url" placeholder="https://" value={trackingUrl} maxLength={500} onChange={(event) => setTrackingUrl(event.target.value)} />
          </label>
          <label>
            Custo (R$)
            <input inputMode="decimal" placeholder="18,50" value={cost} onChange={(event) => setCost(event.target.value)} />
          </label>
          <label>
            Observação
            <textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </label>
        </form>
      )}
    </Dialog>
  )
}

type ActionsProps = {
  token: string | null
  delivery: CourierDelivery
  canWrite: boolean
  onDone: (message: string) => void
  onError: (message: string) => void
}

// Delivered, failed and cancel apply only while the box is on the road; the API refuses the rest with 409.
export function CourierRowActions({ token, delivery, canWrite, onDone, onError }: ActionsProps) {
  const [failing, setFailing] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  if (!canWrite || delivery.status !== 'out_for_delivery') return null

  const post = async (action: 'delivered' | 'failed' | 'cancel', body: Record<string, unknown> | undefined, message: string) => {
    setBusy(true)
    try {
      // Each path is written out so the route contract test can check it.
      const path = action === 'delivered'
        ? `/admin/courier-deliveries/${delivery.id}/delivered`
        : action === 'failed'
          ? `/admin/courier-deliveries/${delivery.id}/failed`
          : `/admin/courier-deliveries/${delivery.id}/cancel`
      await apiRequest(path, { token, method: 'POST', body })
      setFailing(false)
      setReason('')
      onDone(message)
    } catch (requestError) {
      setFailing(false)
      onError(courierErrorText(requestError))
      if (requestError instanceof ApiRequestError && requestError.code === 'courier_delivery_final') onDone('')
    } finally {
      setBusy(false)
    }
  }

  const markDelivered = () => {
    if (!window.confirm('Marcar como entregue agora? O cliente recebe o e-mail de entrega.')) return
    void post('delivered', {}, 'Entrega marcada como entregue.')
  }

  const cancel = () => {
    if (!window.confirm('Cancelar este registro? Use só quando foi criado por engano. O pedido volta para "A despachar".')) return
    void post('cancel', undefined, 'Registro cancelado.')
  }

  const submitFailure = (event: FormEvent) => {
    event.preventDefault()
    void post('failed', { reason }, 'Falha registrada. O pedido pode ser despachado de novo.')
  }

  return (
    <div className="inline-actions">
      <button type="button" className="primary-button" disabled={busy} onClick={markDelivered}>Entregue</button>
      <button type="button" className="ghost-button" disabled={busy} onClick={() => setFailing(true)}>Falhou</button>
      <button type="button" className="ghost-button" disabled={busy} onClick={cancel}>Cancelar</button>
      <Dialog
        open={failing}
        onClose={() => setFailing(false)}
        title="Registrar falha na entrega"
        description="O cliente não recebe e-mail. O pedido vai para Falhas e pode ser despachado de novo."
        footer={<button type="submit" form={`courier-fail-${delivery.id}`} className="primary-button" disabled={busy || !reason.trim()}>Registrar falha</button>}
      >
        <form id={`courier-fail-${delivery.id}`} onSubmit={submitFailure}>
          <label>
            Motivo
            <textarea value={reason} maxLength={500} required onChange={(event) => setReason(event.target.value)} />
          </label>
        </form>
      </Dialog>
    </div>
  )
}

export function CourierStatusBadge({ status }: { status: CourierDelivery['status'] }) {
  const meta = COURIER_STATUS[status]
  return <span className={meta?.badge ?? 'badge-info'}>{meta?.label ?? status}</span>
}

// Method, courier, link and cost in one cell.
export function CourierSummary({ delivery }: { delivery: CourierDelivery }) {
  return (
    <div>
      <div>{methodLabel(delivery.method)}{delivery.courier_name ? ` · ${delivery.courier_name}` : ''}</div>
      <div className="muted">
        {formatCost(delivery.cost_minor)}
        {delivery.tracking_url ? <> · <a href={delivery.tracking_url} target="_blank" rel="noreferrer">Acompanhar</a></> : null}
      </div>
      {delivery.note ? <div className="muted">{delivery.note}</div> : null}
      {delivery.status === 'failed' && delivery.failure_reason ? <div className="muted">Motivo: {delivery.failure_reason}</div> : null}
    </div>
  )
}

export function courierStageText(delivery: CourierDelivery): string {
  if (delivery.status === 'delivered') return `Entregue em ${formatDate(delivery.delivered_at)}`
  if (delivery.status === 'failed') return `Falhou em ${formatDate(delivery.failed_at)}`
  if (delivery.status === 'canceled') return `Cancelada em ${formatDate(delivery.canceled_at)}`
  return `Saiu em ${formatDate(delivery.out_for_delivery_at)}`
}
