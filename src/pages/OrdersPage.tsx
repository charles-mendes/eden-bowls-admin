import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate } from '../lib/format'

type OrderItem = {
  id: string
  status: string
  createdAt: string
  updatedAt: string
  user?: { id: string; email: string }
  checkoutOrder?: {
    items?: Array<{ quantity: number; priceCents?: number; currency?: string; product?: { namePt: string; slug: string } }>
    shippingSelection?: { methodName?: string; priceCents?: number; currency?: string }
  } | null
}

type OrdersResponse = {
  total: number
  page: number
  perPage: number
  items: OrderItem[]
}

const orderStatuses = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled']

const nextStatusByCurrent: Record<string, string> = {
  new: 'confirmed',
  confirmed: 'preparing',
  preparing: 'shipped',
  shipped: 'delivered',
  delivered: 'delivered',
  cancelled: 'cancelled',
}

export function OrdersPage() {
  const { token } = useAuth()
  const [data, setData] = useState<OrdersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrderId, setSelectedOrderId] = useState('')
  const [targetStatus, setTargetStatus] = useState('confirmed')
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const openQuickStatus = (order: OrderItem) => {
    setSelectedOrderId(order.id)
    setTargetStatus(nextStatusByCurrent[order.status] ?? 'confirmed')
    setMessage(`Pedido ${order.id} pronto para alteração de status.`)
  }

  const loadOrders = async () => {
    if (!token) return

    try {
      setError('')
      const response = await apiRequest<OrdersResponse>(`/admin/orders?${new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        ...(statusFilter ? { status: statusFilter } : {}),
      }).toString()}`, { token })
      setData(response)
      if (!selectedOrderId && response.items[0]) {
        setSelectedOrderId(response.items[0].id)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar pedidos')
    }
  }

  useEffect(() => {
    void loadOrders()
  }, [token, page, perPage, statusFilter])

  const submitStatus = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || !selectedOrderId) return

    try {
      setError('')
      setMessage('')
      await apiRequest(`/admin/orders/${selectedOrderId}/status`, {
        token,
        method: 'PATCH',
        body: {
          toStatus: targetStatus,
          reason: reason || undefined,
        },
      })
      setMessage('Status do pedido atualizado.')
      await loadOrders()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar status')
    }
  }

  return (
    <PageFrame
      title="Pedidos"
      description="Área para consultas e ação administrativa de status de pedidos."
    >
      <Section title="Filtros" description="Use paginação e status para localizar o pedido alvo.">
        <FiltersBar>
          <label>
            Status
            <input value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} placeholder="confirmed" />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>

        {error ? <div className="alert">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}

        <div className="grid cards-2">
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Status</th>
                  <th>Itens</th>
                  <th>Shipping</th>
                  <th>Criado em</th>
                    <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => (
                  <tr key={item.id} className={selectedOrderId === item.id ? 'selected-row' : ''} onClick={() => setSelectedOrderId(item.id)}>
                    <td><Link className="table-link" to={`/orders/${item.id}`}>{item.id}</Link></td>
                    <td>{item.user?.email ?? '-'}</td>
                    <td>{item.status}</td>
                    <td>{item.checkoutOrder?.items?.length ?? 0}</td>
                    <td>{item.checkoutOrder?.shippingSelection?.methodName ?? '-'}</td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div className="inline-actions">
                        <Link className="ghost-button" to={`/orders/${item.id}`}>Ver detalhe</Link>
                        <button className="ghost-button" type="button" onClick={(event) => { event.stopPropagation(); openQuickStatus(item) }}>
                          Mudar status
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form className="editor-card" onSubmit={submitStatus}>
            <h3>Atualizar status</h3>
            <div className="muted-panel">Pedido selecionado: {selectedOrderId || 'nenhum'}</div>
            <label>
              Novo status
              <select value={targetStatus} onChange={(event) => setTargetStatus(event.target.value)}>
                {orderStatuses.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Motivo
              <textarea rows={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contexto da mudança" />
            </label>
            <button className="primary-button" type="submit" disabled={!selectedOrderId}>Salvar status</button>
            <div className="muted">Os detalhes do pedido permanecem na API; esta tela atua sobre a transição administrativa.</div>
          </form>
        </div>

        <Pager
          page={data?.page ?? page}
          totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / (data?.perPage ?? perPage)))}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
