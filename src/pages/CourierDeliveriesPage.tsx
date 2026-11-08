import { OtherMarketNotice } from '../components/OtherMarketNotice'
import { isOutsideMarket } from '../lib/markets'
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Dialog } from '../components/Dialog'
import { Link, useSearchParams } from 'react-router-dom'
import { CopyButton } from '../components/CopyButton'
import { CustomerContact } from '../components/CustomerContact'
import { RecipientNameDialog } from '../components/shipping/RecipientNameDialog'
import { AddressIssueStatus } from '../components/AddressIssueStatus'
import { issueCodeText } from '../lib/addressIssues'
import { PageFrame } from '../components/PageFrame'
import {
  CourierDispatchDialog,
  CourierRowActions,
  CourierStatusBadge,
  CourierSummary,
  courierStageText,
} from '../components/shipping/CourierDelivery'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { DeliveryRangeFilter } from '../components/shipping/DeliveryRangeFilter'
import {
  COURIER_TIMEZONE,
  nowInputIn,
  zonedInputToIso,
  RANGE_INVALID_TEXT,
  rangeFromKey,
  rangeQuery,
  readRange,
  writeRange,
  type DeliveryRange,
} from '../lib/deliveryRange'
import {
  addressLines,
  courierErrorText,
  courierNfeState,
  productionLabel,
  subscriptionStatusLabel,
  type CourierDelivery,
  type CourierQueue,
  type CourierQueueItem,
} from '../lib/courierDeliveries'

type TabId = 'to_dispatch' | 'out_for_delivery' | 'failed' | 'delivered'

// `aba` is the tab's name in the URL, so Hoje can open the list on the right tab.
const TABS: Array<{ id: TabId; aba: string; label: string; empty: string }> = [
  { id: 'to_dispatch', aba: 'a_despachar', label: 'A despachar', empty: 'Nenhum pedido pronto esperando saída.' },
  { id: 'out_for_delivery', aba: 'em_rota', label: 'Em rota', empty: 'Nenhuma entrega em rota.' },
  { id: 'failed', aba: 'falhas', label: 'Falhas', empty: 'Nenhuma entrega com falha.' },
  { id: 'delivered', aba: 'entregues', label: 'Entregues 7 dias', empty: 'Nenhuma entrega nos últimos 7 dias.' },
]

function formatDay(value: string | null): string {
  const day = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '—'
  const [year, month, date] = day.split('-')
  return `${date}/${month}/${year}`
}

// Hours since the box left, so a delivery the operator forgot to close stands out.
function onTheRoadFor(value: string | null): string {
  if (!value) return ''
  const hours = Math.floor((Date.now() - new Date(value).getTime()) / 3600000)
  if (!Number.isFinite(hours) || hours < 0) return ''
  return hours < 24 ? `há ${hours} h` : `há ${Math.floor(hours / 24)} d`
}

function itemName(item: CourierQueueItem): string {
  return item.recipient_name || item.stripe_subscription_id || item.subscription_id
}

function itemsText(item: CourierQueueItem): string {
  return (item.items ?? [])
    .map((line) => `${line.flavor} ${line.quantity}${line.pack_size ? ` × ${line.pack_size}` : ''}`)
    .join(' · ')
}

// Address lines in the order the Uber app asks for them, with one button to copy them all.
function AddressCell({ item }: { item: CourierQueueItem }) {
  const lines = addressLines(item.address)
  if (!lines.length) {
    return (
      <>
        {[item.neighborhood, item.city].filter(Boolean).join(' · ') || '—'}
        {item.zipcode ? <div className="muted">{item.zipcode}</div> : null}
      </>
    )
  }
  return (
    <div className="stack">
      <p className="courier-address">{lines.join('\n')}</p>
      <CopyButton value={lines.join('\n')} label={`Copiar endereço de ${itemName(item)}`} />
    </div>
  )
}

// Who receives, the account phone and what goes in the box: what the courier app and WhatsApp need.
function RecipientCell({ item, details }: { item: CourierQueueItem; details: boolean }) {
  const lines = itemsText(item)
  return (
    <div className="stack">
      <strong>
        {itemName(item)}
        {item.name_source === 'account' ? <span className="muted name-source"> (conta)</span> : null}
      </strong>
      {details ? (
        <>
          {item.phone ? (
            <span className="contact-inline">{item.phone}<CopyButton value={item.phone} label={`Copiar telefone de ${itemName(item)}`} /></span>
          ) : <span className="muted">Sem telefone</span>}
          <span className="muted">
            {item.delivery_instructions ? `Instruções (do perfil): ${item.delivery_instructions}` : 'Sem instruções'}
          </span>
          {lines ? <span>{lines}</span> : null}
        </>
      ) : null}
    </div>
  )
}

export function CourierDeliveriesPage() {
  const { token, hasPermission, user } = useAuth()
  const otherMarket = isOutsideMarket(user, 'BR')
  // Wait for the session: its markets decide whether this screen loads at all.
  const sessionReady = Boolean(user)
  const canWrite = hasPermission('shipping.write')
  const canFillRecipient = hasPermission('users.delivery.write')
  const [recipientItem, setRecipientItem] = useState<CourierQueueItem | null>(null)
  const [data, setData] = useState<CourierQueue | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabId = (TABS.find((option) => option.aba === searchParams.get('aba')) ?? TABS[0]).id
  const setTab = (next: TabId) => {
    const aba = (TABS.find((option) => option.id === next) ?? TABS[0]).aba
    const params = new URLSearchParams(searchParams)
    if (aba === 'a_despachar') params.delete('aba')
    else params.set('aba', aba)
    setSearchParams(params, { replace: true })
  }
  // PM-29: the delivery range (`de`/`ate`); PM-26: `problema=endereco`, from Hoje, keeps the rows with an open
  // address problem in "A despachar" and "Falhas".
  const range = readRange(searchParams)
  const rangeKey = range ? `${range.from}|${range.to}` : ''
  const addressOnly = searchParams.get('problema') === 'endereco'
  // simplify-brazil-dispatch: "A despachar" opens on ready orders; `preparo=todos` also brings the kitchen's.
  const showAll = searchParams.get('preparo') === 'todos'
  const setShowAll = (next: boolean) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('preparo', 'todos')
    else params.delete('preparo')
    setSearchParams(params, { replace: true })
  }
  // Expedir opens the page on one invoice (`fatura`), with its subscription (`assinatura`) for when it is not here.
  const targetInvoice = searchParams.get('fatura') || ''
  const targetSubscription = searchParams.get('assinatura') || ''
  const handledTarget = useRef('')
  const setRange = (next: DeliveryRange | null) => setSearchParams(writeRange(searchParams, next), { replace: true })
  const clearAddressFilter = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('problema')
    setSearchParams(params, { replace: true })
  }
  const [error, setError] = useState('')
  const [rangeInvalid, setRangeInvalid] = useState(false)
  const [message, setMessage] = useState('')
  const [dispatching, setDispatching] = useState<CourierQueueItem | null>(null)
  const [editing, setEditing] = useState<{ item: CourierQueueItem; delivery: CourierDelivery } | null>(null)
  // simplify-brazil-dispatch: deliveries on the road picked one by one and closed together at one time.
  const [selected, setSelected] = useState<Set<number>>(() => new Set())
  const [batchAt, setBatchAt] = useState<string | null>(null)
  const [batchBusy, setBatchBusy] = useState(false)
  const [batchErrors, setBatchErrors] = useState<Map<number, string>>(() => new Map())

  const load = useCallback(async () => {
    if (!token || !sessionReady || otherMarket) return
    try {
      const query = rangeQuery(rangeFromKey(rangeKey))
      const preparo = showAll ? `${query ? '&' : '?'}preparo=todos` : ''
      const response = await apiRequest<{ data: CourierQueue }>(`/admin/courier-deliveries/queue${query}${preparo}`, { token })
      setRangeInvalid(false)
      setData(response.data)
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'invalid_delivery_range') {
        setData(null)
        setRangeInvalid(true)
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar as entregas')
    }
  }, [token, sessionReady, otherMarket, rangeKey, showAll])

  useEffect(() => {
    void load()
  }, [load])

  // The invoice Expedir names, wherever the loaded queue has it. Handled once, so a reload after the dispatch does
  // not move the tab again.
  const groups: TabId[] = ['to_dispatch', 'out_for_delivery', 'failed', 'delivered']
  const targetGroup = data && targetInvoice
    ? groups.find((id) => data[id].some((row) => row.invoice_id === targetInvoice)) ?? null
    : null
  const targetMissing = Boolean(data && targetInvoice && !targetGroup)
  useEffect(() => {
    if (!data || !targetInvoice || handledTarget.current === targetInvoice) return
    const group = groups.find((id) => data[id].some((row) => row.invoice_id === targetInvoice))
    if (!group) return
    handledTarget.current = targetInvoice
    const row = data[group].find((candidate) => candidate.invoice_id === targetInvoice) as CourierQueueItem
    if (group !== tab) setTab(group)
    const nfe = row.nfe !== undefined ? courierNfeState(row.nfe, Boolean(data.nfe_required)) : null
    if (group === 'to_dispatch' && canWrite && !row.issues?.length && !nfe?.blocks) setDispatching(row)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, targetInvoice])

  const done = (text: string) => {
    setDispatching(null)
    setEditing(null)
    if (text) {
      setMessage(text)
      setError('')
    }
    void load()
  }

  const fail = (text: string) => {
    setMessage('')
    setError(text)
  }

  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = TABS.findIndex((option) => option.id === tab)
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    setTab(next.id)
    document.getElementById(`courier-tab-${next.id}`)?.focus()
  }

  const selectable = canWrite && tab === 'out_for_delivery'
  const onTheRoadIds = new Set((data?.out_for_delivery ?? []).map((row) => row.delivery?.id).filter((id): id is number => typeof id === 'number'))
  const picked = [...selected].filter((id) => onTheRoadIds.has(id))
  const toggle = (id: number) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  // One request per delivery, on the delivered action each row already uses. A refusal does not undo the others:
  // it stays on the tab, selected, with its error, and the operator picks another time for it.
  const closeTogether = async (event: FormEvent) => {
    event.preventDefault()
    const at = batchAt ? zonedInputToIso(batchAt, COURIER_TIMEZONE) : null
    if (!at || batchBusy) return
    setBatchBusy(true)
    const ids = picked
    const results = await Promise.allSettled(ids.map((id) => apiRequest(`/admin/courier-deliveries/${id}/delivered`, {
      token, method: 'POST', body: { delivered_at: at },
    })))
    const errors = new Map<number, string>()
    results.forEach((result, index) => {
      if (result.status === 'rejected') errors.set(ids[index], courierErrorText(result.reason))
    })
    const closed = ids.length - errors.size
    setBatchErrors(errors)
    setSelected(new Set(errors.keys()))
    setBatchBusy(false)
    setBatchAt(null)
    setError(errors.size ? (errors.size === 1 ? '1 entrega não foi marcada. Veja o motivo na linha.' : `${errors.size} entregas não foram marcadas. Veja o motivo em cada linha.`) : '')
    setMessage(closed ? (closed === 1 ? '1 entrega marcada como entregue.' : `${closed} entregas marcadas como entregues.`) : '')
    void load()
  }

  const filters = (id: TabId) => addressOnly && (id === 'to_dispatch' || id === 'failed')
  const rowsOf = (id: TabId) => {
    const rows = data ? data[id] : []
    // keep-ready-orders-dispatchable: a row the address holds is listed too, problem opened or not.
    return filters(id) ? rows.filter((item) => item.address_issue?.open || (item.issues?.length ?? 0) > 0) : rows
  }
  const items = rowsOf(tab)
  const current = TABS.find((option) => option.id === tab) ?? TABS[0]
  // PM-25: the NF-e of a row whose box can still leave; nothing from an API without the fiscal lock.
  const nfeOf = (item: CourierQueueItem) => (
    (tab === 'to_dispatch' || tab === 'failed') && item.nfe !== undefined
      ? courierNfeState(item.nfe, Boolean(data?.nfe_required))
      : null
  )
  const emptyText = filters(tab)
    ? 'Nenhum pedido com problema de endereço neste período.'
    : (tab === 'to_dispatch' && showAll ? 'Nenhum pedido pago esperando saída.' : current.empty)

  if (otherMarket) return <OtherMarketNotice title="Entregas Brasil" market="BR" />

  return (
    <PageFrame
      title="Entregas Brasil"
      description="Pedidos pagos do Brasil entregues por Uber, motoboy ou entregador próprio. Registre a saída, depois marque entregue ou falha. Nenhuma transportadora é chamada."
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {rangeInvalid ? <div className="alert" role="alert">{RANGE_INVALID_TEXT}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      <DeliveryRangeFilter
        key={rangeKey}
        range={range}
        info={data}
        timeZone={COURIER_TIMEZONE}
        truncated={Boolean(data?.truncated)}
        onChange={setRange}
      />
      {targetMissing ? (
        <div className="warning" role="status" aria-label="Pedido fora do período">
          Este pedido não está nas entregas deste período.
          {targetSubscription ? <> <Link to={`/billing/subscriptions/${targetSubscription}`}>Abrir a assinatura</Link> para despachar por lá.</> : null}
        </div>
      ) : null}
      {tab === 'to_dispatch' ? (
        <div className="segmented" role="group" aria-label="Preparo">
          <button type="button" aria-pressed={!showAll} className={!showAll ? 'active' : ''} onClick={() => setShowAll(false)}>Só prontos</button>
          <button type="button" aria-pressed={showAll} className={showAll ? 'active' : ''} onClick={() => setShowAll(true)}>Mostrar todos</button>
        </div>
      ) : null}
      {selectable && picked.length ? (
        <div className="inline-actions">
          <button type="button" className="primary-button" onClick={() => setBatchAt(nowInputIn(COURIER_TIMEZONE))}>
            Marcar entregues ({picked.length})
          </button>
        </div>
      ) : null}
      {addressOnly ? (
        <div className="queue-summary-main">
          <span className="filter-chip">
            Com problema de endereço
            <button type="button" aria-label="Remover filtro Com problema de endereço" onClick={clearAddressFilter}>×</button>
          </span>
        </div>
      ) : null}

      <div className="page-tabs" role="tablist" aria-label="Entregas Brasil" onKeyDown={moveTabFocus}>
        {TABS.map((option) => (
          <button
            key={option.id}
            id={`courier-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls="courier-panel"
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => setTab(option.id)}
          >
            {option.label}
            {data && rowsOf(option.id).length ? <span className="page-tab-flag">{rowsOf(option.id).length}</span> : null}
          </button>
        ))}
      </div>

      <div id="courier-panel" role="tabpanel" aria-labelledby={`courier-tab-${tab}`} className="table-shell table-scroll">
        <table>
          <thead>
            <tr>
              {selectable ? <th><span className="sr-only">Selecionar</span></th> : null}
              <th>Quem recebe</th>
              <th>Endereço</th>
              <th>Entrega</th>
              <th>Preparo</th>
              <th>Assinatura</th>
              <th>{tab === 'to_dispatch' ? 'Fatura' : 'Entrega registrada'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!data ? <tr><td colSpan={selectable ? 8 : 7}>Carregando…</td></tr> : null}
            {data && !items.length ? <tr><td colSpan={selectable ? 8 : 7}>{emptyText}</td></tr> : null}
            {items.map((item) => (
              <tr key={`${tab}-${item.invoice_id}`}>
                {selectable ? (
                  <td>
                    {item.delivery ? (
                      <input
                        type="checkbox"
                        aria-label={`Selecionar entrega de ${itemName(item)}`}
                        checked={selected.has(item.delivery.id)}
                        onChange={() => toggle((item.delivery as CourierDelivery).id)}
                      />
                    ) : null}
                  </td>
                ) : null}
                <td><RecipientCell item={item} details={tab !== 'delivered'} /></td>
                <td>
                  <AddressCell item={item} />
                  {item.issues?.length ? (
                    <ul className="plain-list address-issues" aria-label={`O que falta no endereço de ${itemName(item)}`}>
                      {item.issues.map((code) => <li key={code}>{issueCodeText(code)}</li>)}
                    </ul>
                  ) : null}
                  {/* operator-fills-recipient-name: the one address field the panel fills, and only when missing. */}
                  {canFillRecipient && (tab === 'to_dispatch' || tab === 'failed') && item.issues?.includes('recipient_name_missing') ? (
                    <button className="link-button" type="button" onClick={() => setRecipientItem(item)}>Informar quem recebe</button>
                  ) : null}
                  <AddressIssueStatus issue={item.address_issue} />
                </td>
                <td>{formatDay(item.delivery_date)}</td>
                <td>{productionLabel(item.production_status)}</td>
                <td>{subscriptionStatusLabel(item.subscription_status)}</td>
                <td>
                  {item.delivery ? (
                    <>
                      <CourierStatusBadge status={item.delivery.status} />
                      <div className="muted">
                        {courierStageText(item.delivery)}
                        {item.delivery.status === 'out_for_delivery' ? ` · ${onTheRoadFor(item.delivery.out_for_delivery_at)}` : ''}
                      </div>
                      <CourierSummary delivery={item.delivery} />
                      {tab === 'out_for_delivery' && batchErrors.get(item.delivery.id) ? (
                        <div className="alert" role="alert" aria-label={`Erro na entrega de ${itemName(item)}`}>{batchErrors.get(item.delivery.id)}</div>
                      ) : null}
                    </>
                  ) : <span className="muted">{item.invoice_id}</span>}
                  {nfeOf(item) ? (
                    <div id={`nfe-${item.invoice_id}`} className={nfeOf(item)?.blocks ? 'badge-warning' : 'muted'}>
                      <span>{nfeOf(item)?.text}</span>
                      {nfeOf(item)?.href ? <> · <Link to={nfeOf(item)?.href as string}>Abrir nota</Link></> : null}
                    </div>
                  ) : null}
                </td>
                <td>
                  <div className="inline-actions">
                    {/* A lock, not a warning: a row with an address problem has no way to leave. */}
                    {canWrite && (tab === 'to_dispatch' || tab === 'failed') && !item.issues?.length ? (
                      <button
                        type="button"
                        className="primary-button"
                        disabled={Boolean(nfeOf(item)?.blocks)}
                        title={nfeOf(item)?.blocks ? nfeOf(item)?.text : undefined}
                        aria-describedby={nfeOf(item)?.blocks ? `nfe-${item.invoice_id}` : undefined}
                        onClick={() => setDispatching(item)}
                      >
                        {tab === 'failed' ? 'Despachar de novo' : 'Despachar'}
                      </button>
                    ) : null}
                    {item.delivery ? (
                      <CourierRowActions
                        token={token}
                        delivery={item.delivery}
                        canWrite={canWrite}
                        onDone={done}
                        onError={fail}
                        onEdit={(delivery) => setEditing({ item, delivery })}
                      />
                    ) : null}
                    {tab === 'out_for_delivery' || tab === 'failed' || item.issues?.length ? (
                      <CustomerContact
                        subscriptionId={item.subscription_id}
                        name={itemName(item)}
                        phone={item.phone}
                        reason={item.issues?.length ? 'address' : (tab === 'failed' ? 'delivery_failed' : undefined)}
                        showLast={false}
                      />
                    ) : null}
                    <Link className="ghost-button" to={`/billing/subscriptions/${item.subscription_id}`}>Assinatura</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {recipientItem ? (
        <RecipientNameDialog
          subscriptionId={recipientItem.subscription_id}
          accountName={recipientItem.account_name}
          onClose={() => setRecipientItem(null)}
          onSaved={(text) => {
            setRecipientItem(null)
            done(text)
          }}
        />
      ) : null}

      <Dialog
        open={batchAt !== null}
        onClose={() => setBatchAt(null)}
        title="Marcar entregues"
        description={`${picked.length === 1 ? '1 entrega' : `${picked.length} entregas`} · o cliente de cada uma recebe o e-mail de entrega`}
        footer={<button type="submit" form="courier-batch-delivered" className="primary-button" disabled={batchBusy || !batchAt}>Marcar entregues</button>}
      >
        <form id="courier-batch-delivered" className="stack" onSubmit={(event) => void closeTogether(event)}>
          <label>
            Entregue em (horário de Brasília)
            <input type="datetime-local" required value={batchAt ?? ''} onChange={(event) => setBatchAt(event.target.value)} />
          </label>
        </form>
      </Dialog>
      <CourierDispatchDialog
        token={token}
        target={dispatching ? { subscriptionId: dispatching.subscription_id, invoiceId: dispatching.invoice_id, name: itemName(dispatching) } : null}
        onClose={() => setDispatching(null)}
        onDone={done}
      />
      <CourierDispatchDialog
        token={token}
        target={editing ? { subscriptionId: editing.item.subscription_id, invoiceId: editing.item.invoice_id, name: itemName(editing.item) } : null}
        editing={editing?.delivery ?? null}
        onClose={() => setEditing(null)}
        onDone={done}
      />
    </PageFrame>
  )
}
