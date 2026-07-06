import { useEffect, useState } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'

type PricingItem = {
  id: string
  variantId: string
  currency: string
  regularPrice: number
  salePrice: number | null
  saleFrom: string | null
  saleTo: string | null
  source: string
  createdAt: string
  product: { slug: string; namePt: string; nameEn: string }
}

type PricingResponse = {
  total: number
  page: number
  perPage: number
  items: PricingItem[]
}

export function PricingPage() {
  const { token } = useAuth()
  const [data, setData] = useState<PricingResponse | null>(null)
  const [market, setMarket] = useState('BR')
  const [currency, setCurrency] = useState('BRL')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setError('')
      try {
        const response = await apiRequest<PricingResponse>(`/admin/catalog/pricing${buildQueryString({
          market: market || undefined,
          currency: currency || undefined,
          page,
          perPage,
        })}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar preços')
      }
    }

    void load()
  }, [token, market, currency, page, perPage])

  return (
    <PageFrame
      title="Preços"
      description="Listagem e manutenção dos preços por variante, moeda e promoção."
    >
      <Section title="Filtros" description="Conjunto mínimo para navegar por mercado e moeda.">
        <FiltersBar>
          <label>
            Mercado
            <input value={market} onChange={(event) => { setMarket(event.target.value.toUpperCase()); setPage(1) }} />
          </label>
          <label>
            Moeda
            <input value={currency} onChange={(event) => { setCurrency(event.target.value.toUpperCase()); setPage(1) }} />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

      {error ? <div className="alert">{error}</div> : null}

      <Section title="Preços por variante" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Variante</th>
                <th>Moeda</th>
                <th>Preço regular</th>
                <th>Promoção</th>
                <th>Fonte</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.product.namePt}</strong>
                    <div className="muted">{item.product.slug}</div>
                  </td>
                  <td>{item.variantId}</td>
                  <td>{item.currency}</td>
                  <td>{formatCurrency(item.regularPrice, item.currency)}</td>
                  <td>{item.salePrice !== null ? <><strong>{formatCurrency(item.salePrice, item.currency)}</strong><div className="muted">{formatDate(item.saleFrom)} → {formatDate(item.saleTo)}</div></> : '-'}</td>
                  <td>{item.source}</td>
                  <td>{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager page={data?.page ?? page} totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / (data?.perPage ?? perPage)))} onPrev={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => current + 1)} />
      </Section>
    </PageFrame>
  )
}
