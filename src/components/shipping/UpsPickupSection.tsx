import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '../Section'
import { ApiRequestError, apiRequest } from '../../lib/api'
import { LABELS_TIMEZONE, todayIn } from '../../lib/deliveryRange'
import {
  PICKUP_STATUS_LABELS,
  pickupDay,
  pickupErrorText,
  packageCountOf,
  type QueuePickup,
  type ShipmentPackage,
  type UpsPickup,
} from '../../lib/upsLabels'
import { BrDateInput, BrTimeInput } from '../BrDateInput'

// A created label of the queue, as much of it as the pickup needs.
export type PickupLabel = {
  invoice_id: string
  customer_name: string | null
  stripe_subscription_id: string
  shipment: { id: string | number; tracking_number: string | null; in_transit_at?: string | null; out_for_delivery_at?: string | null; packages?: ShipmentPackage[] } | null
  pickup?: QueuePickup | null
}

type Notice = { kind: 'ok' | 'error'; text: string; settingsLink?: boolean }

// The API answered with something to check again: the list is reloaded.
const RELOAD_CODES = new Set(['pickup_shipment_not_eligible', 'pickup_unconfirmed', 'pickup_not_cancelable', 'pickup_not_unknown'])

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// ups-pickup (PM-28, option B): the day's pickup is asked of UPS only on days with boxes, for that day's count.
export function UpsPickupSection({
  token,
  canWrite,
  labels,
  onChanged,
}: {
  token: string | null
  canWrite: boolean
  labels: PickupLabel[] | null
  onChanged: () => Promise<void> | void
}) {
  // The labels Today counts: no active pickup and no tracking scan yet (a scanned box already left).
  const free = (labels ?? []).filter((label) => label.shipment && !label.pickup && !label.shipment.in_transit_at && !label.shipment.out_for_delivery_at)
  const freeKey = free.map((label) => String(label.shipment?.id)).join(',')
  // Every label without a pickup starts selected: the state keeps only the ones the operator left out.
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [count, setCount] = useState<string | null>(null)
  const [date, setDate] = useState(() => todayIn(LABELS_TIMEZONE))
  const [readyTime, setReadyTime] = useState('14:00')
  const [closeTime, setCloseTime] = useState('18:00')
  const [pickups, setPickups] = useState<UpsPickup[] | null>(null)
  const [reloads, setReloads] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const selected = new Set(freeKey ? freeKey.split(',').filter((id) => !excluded.has(id)) : [])

  useEffect(() => {
    if (!token) return
    let active = true
    apiRequest<{ data: { items: UpsPickup[] } }>('/admin/shipments/pickups', { token })
      .then((response) => {
        if (active) setPickups(response.data.items)
      })
      .catch((requestError: unknown) => {
        if (!active) return
        setPickups([])
        setNotice({ kind: 'error', text: requestError instanceof Error ? requestError.message : 'Falha ao carregar as coletas' })
      })
    return () => {
      active = false
    }
  }, [token, reloads])

  const refresh = async () => {
    setReloads((value) => value + 1)
    await onChanged()
  }

  const fail = async (requestError: unknown) => {
    if (requestError instanceof ApiRequestError) {
      setNotice({
        kind: 'error',
        text: pickupErrorText(
          requestError.code,
          requestError.message,
          Array.isArray(requestError.details?.missing) ? requestError.details.missing as string[] : [],
        ),
        settingsLink: requestError.code === 'pickup_ship_from_incomplete',
      })
      if (RELOAD_CODES.has(requestError.code)) await refresh()
      return
    }
    setNotice({ kind: 'error', text: requestError instanceof Error ? requestError.message : 'Falha ao falar com a UPS' })
  }

  // The count follows the boxes of the selected labels (shipping-boxes: one per package, one for a label bought
  // before boxes) until the operator types it.
  const selectedBoxes = free
    .filter((label) => selected.has(String(label.shipment?.id)))
    .reduce((sum, label) => sum + packageCountOf(label.shipment), 0)
  const boxes = count ?? String(selectedBoxes)

  const toggle = (id: string) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || busy || !selected.size) return
    const packageCount = Number(boxes)
    const question = `Pedir coleta à UPS para ${pickupDay(date)}, das ${readyTime} às ${closeTime}, com ${plural(packageCount, 'caixa', 'caixas')} (${plural(selected.size, 'etiqueta', 'etiquetas')})?`
    if (!window.confirm(question)) return
    setBusy(true)
    setNotice(null)
    try {
      const response = await apiRequest<{ data: { pickup: UpsPickup } }>('/admin/shipments/pickups', {
        token,
        method: 'POST',
        body: {
          pickup_date: date,
          ready_time: readyTime,
          close_time: closeTime,
          package_count: packageCount,
          shipment_ids: free.filter((label) => selected.has(String(label.shipment?.id))).map((label) => Number(label.shipment?.id)),
        },
      })
      setNotice({ kind: 'ok', text: `Coleta pedida. PRN ${response.data.pickup.prn}.` })
      setCount(null)
      setExcluded(new Set())
      await refresh()
    } catch (requestError) {
      await fail(requestError)
    } finally {
      setBusy(false)
    }
  }

  const act = async (pickup: UpsPickup, action: 'cancel' | 'not-created') => {
    if (!token || busy) return
    const question = action === 'cancel'
      ? `Cancelar a coleta de ${pickupDay(pickup.pickup_date)} na UPS (PRN ${pickup.prn})? As etiquetas voltam a ficar sem coleta.`
      : 'Confira no portal da UPS que esta coleta não existe. Fechar como não criada e soltar as etiquetas?'
    if (!window.confirm(question)) return
    setBusy(true)
    setNotice(null)
    try {
      const path = action === 'cancel'
        ? `/admin/shipments/pickups/${pickup.id}/cancel`
        : `/admin/shipments/pickups/${pickup.id}/not-created`
      await apiRequest(path, { token, method: 'POST', body: {} })
      setNotice({ kind: 'ok', text: action === 'cancel' ? 'Coleta cancelada na UPS.' : 'Coleta fechada como não criada.' })
      await refresh()
    } catch (requestError) {
      await fail(requestError)
    } finally {
      setBusy(false)
    }
  }

  const labelName = (label: PickupLabel) => label.customer_name || label.stripe_subscription_id

  return (
    <Section
      id="coleta"
      title="Coleta"
      description="Peça à UPS para buscar as caixas só nos dias com etiqueta, com a quantidade do dia. O número de confirmação (PRN) fica guardado."
    >
      {notice ? (
        <div className={notice.kind === 'error' ? 'alert' : 'muted'} role={notice.kind === 'error' ? 'alert' : 'status'}>
          {notice.text}
          {notice.settingsLink ? <> <Link to="/config/shipping?aba=sede&mercado=us">Abrir Regras de frete</Link></> : null}
        </div>
      ) : null}

      {labels === null ? (
        <p className="muted">Carregando…</p>
      ) : !free.length ? (
        <p className="muted">Nenhuma etiqueta sem coleta.</p>
      ) : (
        <form onSubmit={(event) => void submit(event)} aria-label="Pedir coleta">
          <ul className="pickup-labels">
            {free.map((label) => {
              const id = String(label.shipment?.id)
              // One text: the name and the tracking number together, so the row reads as one label.
              const text = [labelName(label), label.shipment?.tracking_number].filter(Boolean).join(' · ')
              return (
                <li key={id}>
                  {canWrite ? (
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${labelName(label)} na coleta`}
                        checked={selected.has(id)}
                        disabled={busy}
                        onChange={() => toggle(id)}
                      />
                      <span>{text}</span>
                    </label>
                  ) : <span>{text}</span>}
                </li>
              )
            })}
          </ul>
          {canWrite ? (
            <div className="ship-fields">
              <label className="ship-field">
                <span>Data da coleta</span>
                <BrDateInput value={date} onChange={setDate} />
              </label>
              <label className="ship-field">
                <span>Pronto a partir de</span>
                <BrTimeInput value={readyTime} onChange={setReadyTime} />
              </label>
              <label className="ship-field">
                <span>Fecha às</span>
                <BrTimeInput value={closeTime} onChange={setCloseTime} />
              </label>
              <label className="ship-field">
                <span>Caixas</span>
                <input type="number" min={1} step={1} value={boxes} onChange={(event) => setCount(event.target.value)} />
              </label>
              <div className="ship-actions">
                <button className="primary-button" type="submit" disabled={busy || !selected.size}>
                  {busy ? 'Pedindo…' : 'Pedir coleta à UPS'}
                </button>
              </div>
            </div>
          ) : null}
        </form>
      )}

      <div className="table-shell table-scroll">
        <table aria-label="Coletas pedidas">
          <thead>
            <tr>
              <th>Data</th>
              <th>Janela</th>
              <th>Caixas</th>
              <th>PRN</th>
              <th>Situação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pickups === null ? (
              <tr><td colSpan={6}>Carregando…</td></tr>
            ) : !pickups.length ? (
              <tr><td colSpan={6}>Nenhuma coleta nos últimos 7 dias.</td></tr>
            ) : pickups.map((pickup) => (
              <tr key={pickup.id}>
                <td>{pickupDay(pickup.pickup_date)}</td>
                <td>{pickup.ready_time}–{pickup.close_time}</td>
                <td>{pickup.package_count}</td>
                <td>{pickup.prn || '—'}</td>
                <td>
                  {PICKUP_STATUS_LABELS[pickup.status] ?? pickup.status}
                  {pickup.status === 'unknown' ? <div className="muted">Verificar no portal da UPS</div> : null}
                </td>
                <td>
                  {canWrite && pickup.status === 'requested' ? (
                    <button type="button" className="ghost-button" disabled={busy} onClick={() => void act(pickup, 'cancel')}>Cancelar coleta</button>
                  ) : null}
                  {canWrite && pickup.status === 'unknown' ? (
                    <button type="button" className="ghost-button" disabled={busy} onClick={() => void act(pickup, 'not-created')}>Não foi criada</button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
