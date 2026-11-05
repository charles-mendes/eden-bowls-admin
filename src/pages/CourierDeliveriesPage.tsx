import { OtherMarketNotice } from '../components/OtherMarketNotice'
import { isOutsideMarket } from '../lib/markets'
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import {
  CourierDispatchDialog,
  CourierRowActions,
  CourierStatusBadge,
  CourierSummary,
  courierStageText,
} from '../components/shipping/CourierDelivery'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  productionLabel,
  subscriptionStatusLabel,
  type CourierQueue,
  type CourierQueueItem,
} from '../lib/courierDeliveries'

type TabId = 'to_dispatch' | 'out_for_delivery' | 'failed' | 'delivered'

// `aba` is the tab's name in the URL, so Hoje can open the list on the right tab.
const TABS: Array<{ id: TabId; aba: string; label: string; empty: string }> = [
  { id: 'to_dispatch', aba: 'a_despachar', label: 'A despachar', empty: 'Nenhum pedido pago esperando saída.' },
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

export function CourierDeliveriesPage() {
  const { token, hasPermission, user } = useAuth()
  const otherMarket = isOutsideMarket(user, 'BR')
  // Wait for the session: its markets decide whether this screen loads at all.
  const sessionReady = Boolean(user)
  const canWrite = hasPermission('shipping.write')
  const [data, setData] = useState<CourierQueue | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab: TabId = (TABS.find((option) => option.aba === searchParams.get('aba')) ?? TABS[0]).id
  const setTab = (next: TabId) => {
    const aba = (TABS.find((option) => option.id === next) ?? TABS[0]).aba
    setSearchParams(aba === 'a_despachar' ? new URLSearchParams() : new URLSearchParams({ aba }), { replace: true })
  }
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [dispatching, setDispatching] = useState<CourierQueueItem | null>(null)

  const load = useCallback(async () => {
    if (!token || !sessionReady || otherMarket) return
    try {
      const response = await apiRequest<{ data: CourierQueue }>('/admin/courier-deliveries/queue', { token })
      setData(response.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar as entregas')
    }
  }, [token, sessionReady, otherMarket])

  useEffect(() => {
    void load()
  }, [load])

  const done = (text: string) => {
    setDispatching(null)
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

  const items = data ? data[tab] : []
  const current = TABS.find((option) => option.id === tab) ?? TABS[0]

  if (otherMarket) return <OtherMarketNotice title="Entregas Brasil" market="BR" />

  return (
    <PageFrame
      title="Entregas Brasil"
      description="Pedidos pagos do Brasil entregues por Uber, motoboy ou entregador próprio. Registre a saída, depois marque entregue ou falha. Nenhuma transportadora é chamada."
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}
      {message ? <div className="success" role="status">{message}</div> : null}
      {data?.truncated ? <div className="warning">A lista "A despachar" mostra os 200 primeiros pedidos.</div> : null}

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
            {data && data[option.id].length ? <span className="page-tab-flag">{data[option.id].length}</span> : null}
          </button>
        ))}
      </div>

      <div id="courier-panel" role="tabpanel" aria-labelledby={`courier-tab-${tab}`} className="table-shell table-scroll">
        <table>
          <thead>
            <tr>
              <th>Quem recebe</th>
              <th>Bairro e cidade</th>
              <th>Entrega</th>
              <th>Preparo</th>
              <th>Assinatura</th>
              <th>{tab === 'to_dispatch' ? 'Fatura' : 'Entrega registrada'}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {!data ? <tr><td colSpan={7}>Carregando…</td></tr> : null}
            {data && !items.length ? <tr><td colSpan={7}>{current.empty}</td></tr> : null}
            {items.map((item) => (
              <tr key={`${tab}-${item.invoice_id}`}>
                <td><strong>{itemName(item)}</strong></td>
                <td>
                  {[item.neighborhood, item.city].filter(Boolean).join(' · ') || '—'}
                  {item.zipcode ? <div className="muted">{item.zipcode}</div> : null}
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
                    </>
                  ) : <span className="muted">{item.invoice_id}</span>}
                </td>
                <td>
                  <div className="inline-actions">
                    {canWrite && (tab === 'to_dispatch' || tab === 'failed') ? (
                      <button type="button" className="primary-button" onClick={() => setDispatching(item)}>
                        {tab === 'failed' ? 'Despachar de novo' : 'Despachar'}
                      </button>
                    ) : null}
                    {item.delivery ? (
                      <CourierRowActions token={token} delivery={item.delivery} canWrite={canWrite} onDone={done} onError={fail} />
                    ) : null}
                    <Link className="ghost-button" to={`/billing/subscriptions/${item.subscription_id}`}>Assinatura</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CourierDispatchDialog
        token={token}
        target={dispatching ? { subscriptionId: dispatching.subscription_id, invoiceId: dispatching.invoice_id, name: itemName(dispatching) } : null}
        onClose={() => setDispatching(null)}
        onDone={done}
      />
    </PageFrame>
  )
}
