import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate, formatCurrency, formatJson } from '../lib/format'

type OrderDetail = {
  id: string
  status: string
  createdAt: string
  updatedAt: string
  user?: { id: string; email: string }
  checkoutOrder?: {
    items?: Array<{
      quantity: number
      priceCents?: number
      currency?: string
      product?: { namePt: string; slug: string }
      variant?: { sku: string; flavorKey: string; weightLabel: string }
    }>
    shippingSelection?: { methodName?: string; priceCents?: number; currency?: string }
  } | null
  statusHistory?: Array<{
    id: string
    fromStatus: string | null
    toStatus: string
    reason: string | null
    createdAt: string
  }>
}

export function OrderDetailPage() {
  const { token } = useAuth()
  const { orderId } = useParams()
  const [data, setData] = useState<OrderDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token || !orderId) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<OrderDetail>(`/admin/orders/${orderId}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar pedido')
      }
    }

    void load()
  }, [token, orderId])

  return (
    <PageFrame
      title={`Pedido ${orderId ?? ''}`}
      description="Detalhe administrativo com itens do checkout e histórico completo de status."
    >
      {error ? <div className="alert">{error}</div> : null}

      <div className="grid cards-4">
        <MetricCard label="Status" value={data?.status ?? '—'} />
        <MetricCard label="Cliente" value={data?.user?.email ?? '—'} />
        <MetricCard label="Itens" value={data?.checkoutOrder?.items?.length ?? '—'} />
        <MetricCard label="Mudanças" value={data?.statusHistory?.length ?? '—'} />
      </div>

      <Section title="Resumo" description="Identificação e timestamps principais do pedido.">
        <div className="grid cards-2">
          <article className="stat-card">
            <strong>Cliente</strong>
            <span>{data?.user?.email ?? '-'}</span>
            <div className="muted">Criado em {formatDate(data?.createdAt)}</div>
          </article>
          <article className="stat-card">
            <strong>Atualização</strong>
            <span>{data?.status ?? '-'}</span>
            <div className="muted">Atualizado em {formatDate(data?.updatedAt)}</div>
          </article>
        </div>
      </Section>

      <Section title="Checkout" description="Itens, variantes e frete vinculados ao pedido.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Variante</th>
                <th>Quantidade</th>
                <th>Preço</th>
              </tr>
            </thead>
            <tbody>
              {data?.checkoutOrder?.items?.map((item, index) => (
                <tr key={`${item.product?.slug ?? 'item'}-${index}`}>
                  <td>{item.product?.namePt ?? '-'}</td>
                  <td>{item.variant?.sku ?? '-'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.priceCents && item.currency ? formatCurrency(item.priceCents / 100, item.currency) : '-'}</td>
                </tr>
              ))}
              {data?.checkoutOrder?.shippingSelection ? (
                <tr>
                  <td colSpan={2}>Frete</td>
                  <td>{data.checkoutOrder.shippingSelection.methodName ?? '-'}</td>
                  <td>
                    {data.checkoutOrder.shippingSelection.priceCents && data.checkoutOrder.shippingSelection.currency
                      ? formatCurrency(data.checkoutOrder.shippingSelection.priceCents / 100, data.checkoutOrder.shippingSelection.currency)
                      : '-'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Histórico" description="Linha do tempo das transições administrativas do pedido.">
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>De</th>
                <th>Para</th>
                <th>Motivo</th>
                <th>Em</th>
              </tr>
            </thead>
            <tbody>
              {data?.statusHistory?.map((item) => (
                <tr key={item.id}>
                  <td>{item.fromStatus ?? '-'}</td>
                  <td>{item.toStatus}</td>
                  <td><pre>{item.reason ? formatJson(item.reason) : '-'}</pre></td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageFrame>
  )
}