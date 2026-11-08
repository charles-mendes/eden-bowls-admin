import { useState, type FormEvent } from 'react'
import { Dialog } from '../Dialog'
import { ApiRequestError, apiRequest } from '../../lib/api'
import {
  COURIER_METHODS,
  COURIER_STATUS,
  FAILURE_KINDS,
  costInput,
  courierErrorText,
  failureKindLabel,
  formatCost,
  methodLabel,
  readinessText,
  type CourierDelivery,
  type CourierMethod,
  type FailureKind,
  type ReadinessReason,
} from '../../lib/courierDeliveries'
import { formatDate } from '../../lib/format'

type DispatchTarget = { subscriptionId: string; invoiceId: string; name: string }

type DispatchDialogProps = {
  token: string | null
  target: DispatchTarget | null
  // A delivery on the road to edit: the dialog opens with its saved details and saves with PATCH.
  editing?: CourierDelivery | null
  onClose: () => void
  onDone: (message: string) => void
}

const costText = (costMinor: number | null) => (costMinor === null || costMinor === undefined ? '' : (costMinor / 100).toFixed(2).replace('.', ','))

// The form state is born from the delivery being edited (or the dispatch defaults) each time the dialog opens:
// the dialog body remounts per target, so editing two deliveries in a row never shows the first one's data.
export function CourierDispatchDialog(props: DispatchDialogProps) {
  if (!props.target) return null
  const key = `${props.target.invoiceId}-${props.editing ? props.editing.id : 'new'}`
  return <DispatchDialogBody key={key} {...props} target={props.target} />
}

// One dispatch at a time. When the order is not ready the API answers 409 with the reasons, and the operator
// confirms a second time before it is sent again with confirm_not_ready. Editing skips both.
function DispatchDialogBody({ token, target, editing = null, onClose, onDone }: DispatchDialogProps & { target: DispatchTarget }) {
  const [method, setMethod] = useState<CourierMethod>(editing ? editing.method : 'uber')
  const [courierName, setCourierName] = useState(editing?.courier_name ?? '')
  const [trackingUrl, setTrackingUrl] = useState(editing?.tracking_url ?? '')
  const [cost, setCost] = useState(editing ? costText(editing.cost_minor) : '')
  const [note, setNote] = useState(editing?.note ?? '')
  const [reasons, setReasons] = useState<ReadinessReason[] | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const send = async (confirmNotReady: boolean) => {
    if (saving) return
    setSaving(true)
    setError('')
    try {
      if (editing) {
        await apiRequest(`/admin/courier-deliveries/${editing.id}`, {
          token,
          method: 'PATCH',
          body: {
            method,
            courier_name: courierName.trim(),
            tracking_url: trackingUrl.trim(),
            // An emptied field clears the saved value.
            cost: costInput(cost) ?? null,
            note: note.trim(),
          },
        })
        onDone(`Entrega de ${target.name} atualizada.`)
        return
      }
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
      onDone(`Entrega de ${target.name} registrada como em rota.`)
    } catch (requestError) {
      if (!editing && requestError instanceof ApiRequestError && requestError.code === 'courier_dispatch_needs_confirmation') {
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

  // simplify-brazil-dispatch: a new Uber dispatch asks only for the method and the cost; the courier, the link
  // and the note wait behind "Detalhes". Another method, and every edit, show the whole form.
  const shortForm = !editing && method === 'uber'
  const courierField = (
    <label>
      Entregador
      <input value={courierName} maxLength={120} onChange={(event) => setCourierName(event.target.value)} />
    </label>
  )
  const linkField = (
    <>
      <label>
        Link de acompanhamento
        <input type="url" inputMode="url" placeholder="https://" value={trackingUrl} maxLength={500} aria-describedby="courier-link-hint" onChange={(event) => setTrackingUrl(event.target.value)} />
      </label>
      <p id="courier-link-hint" className="muted">O link de acompanhamento que o app (Uber ou outro) gera para compartilhar a viagem.</p>
    </>
  )
  const costField = (
    <label>
      Custo (R$)
      <input inputMode="decimal" placeholder="18,50" value={cost} onChange={(event) => setCost(event.target.value)} />
    </label>
  )
  const noteField = (
    <label>
      Observação
      <textarea value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
    </label>
  )

  const title = reasons ? 'Pedido ainda não está pronto' : editing ? 'Editar entrega' : 'Despachar entrega'
  const description = editing
    ? `${target.name} · a entrega continua em rota e o cliente não é avisado de novo`
    : `${target.name} · fatura ${target.invoiceId}`

  return (
    <Dialog
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={reasons ? (
        <>
          <button type="button" className="ghost-button" onClick={() => setReasons(null)}>Voltar</button>
          <button type="button" className="primary-button" disabled={saving} onClick={() => void send(true)}>Despachar mesmo assim</button>
        </>
      ) : (
        <button type="submit" form="courier-dispatch-form" className="primary-button" disabled={saving}>{editing ? 'Salvar alterações' : 'Registrar saída'}</button>
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
          {shortForm ? (
            <>
              {costField}
              <details className="courier-details">
                <summary>Detalhes</summary>
                <div className="stack">
                  {courierField}
                  {linkField}
                  {noteField}
                </div>
              </details>
            </>
          ) : (
            <>
              {courierField}
              {linkField}
              {costField}
              {noteField}
            </>
          )}
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
  // Opens the dispatch dialog in edit mode for this delivery.
  onEdit?: (delivery: CourierDelivery) => void
}

// Delivered, failed and cancel apply only while the box is on the road; the API refuses the rest with 409.
export function CourierRowActions({ token, delivery, canWrite, onDone, onError, onEdit }: ActionsProps) {
  const [failing, setFailing] = useState(false)
  const [reason, setReason] = useState('')
  const [kind, setKind] = useState<FailureKind | ''>('')
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
      setKind('')
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
    if (!kind) return
    void post('failed', { reason, failure_kind: kind }, 'Falha registrada. O pedido pode ser despachado de novo.')
  }

  return (
    <div className="inline-actions">
      <button type="button" className="primary-button" disabled={busy} onClick={markDelivered}>Entregue</button>
      {onEdit ? <button type="button" className="ghost-button" disabled={busy} onClick={() => onEdit(delivery)}>Editar</button> : null}
      <button type="button" className="ghost-button" disabled={busy} onClick={() => setFailing(true)}>Falhou</button>
      <button type="button" className="ghost-button" disabled={busy} onClick={cancel}>Cancelar</button>
      <Dialog
        open={failing}
        onClose={() => setFailing(false)}
        title="Registrar falha na entrega"
        description="O cliente não recebe e-mail. O pedido vai para Falhas e pode ser despachado de novo."
        footer={<button type="submit" form={`courier-fail-${delivery.id}`} className="primary-button" disabled={busy || !reason.trim() || !kind}>Registrar falha</button>}
      >
        <form id={`courier-fail-${delivery.id}`} className="stack" onSubmit={submitFailure}>
          <fieldset>
            <legend>Tipo da falha</legend>
            {FAILURE_KINDS.map((option) => (
              <label key={option.value} className="radio-line">
                <input type="radio" name={`courier-fail-kind-${delivery.id}`} value={option.value} checked={kind === option.value} required onChange={() => setKind(option.value)} />
                {option.label}
              </label>
            ))}
          </fieldset>
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
      {delivery.status === 'failed' && delivery.failure_kind ? <div><strong>{failureKindLabel(delivery.failure_kind)}</strong></div> : null}
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
