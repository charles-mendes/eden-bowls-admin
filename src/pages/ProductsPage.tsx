import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'

type ProductItem = {
  id: string
  slug: string
  namePt: string
  nameEn: string
  active: boolean
  category: { namePt: string; nameEn: string }
  marketConfigs: Array<{ marketCountry: string; currency: string; active: boolean }>
  variants: Array<{ id: string; sku: string; variantPrices: Array<{ id: string }> }>
  createdAt: string
}

type ProductsResponse = {
  total: number
  page: number
  perPage: number
  items: ProductItem[]
}

export function ProductsPage() {
  const { token } = useAuth()
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [search, setSearch] = useState('')
  const [market, setMarket] = useState('BR')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      setError('')
      try {
        const response = await apiRequest<ProductsResponse>(`/admin/catalog/products${buildQueryString({
          search: search || undefined,
          market: market || undefined,
          page,
          perPage,
        })}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar produtos')
      }
    }

    void load()
  }, [token, search, market, page, perPage])

  return (
    <PageFrame
      title="Produtos"
      description="Lista de produtos, busca por mercado e atalhos para criação/edição."
    >
      <Section title="Filtros" description="Busca textual e recorte por mercado.">
        <FiltersBar>
          <label>
            Busca
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="slug, nome pt ou en" />
          </label>
          <label>
            Mercado
            <input value={market} onChange={(event) => { setMarket(event.target.value.toUpperCase()); setPage(1) }} placeholder="BR" />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

      {error ? <div className="alert">{error}</div> : null}

      <Section title="Produtos cadastrados" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Slug</th>
                <th>Mercados</th>
                <th>Variantes</th>
                <th>Ativo</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="table-link" to={`/catalog/products/${item.id}`}>{item.namePt}</Link>
                    <div className="muted">{item.nameEn}</div>
                  </td>
                  <td>{item.category?.namePt ?? '-'}<div className="muted">{item.category?.nameEn ?? '-'}</div></td>
                  <td>{item.slug}</td>
                  <td>{item.marketConfigs.map((config) => `${config.marketCountry}/${config.currency}`).join(', ') || '-'}</td>
                  <td>{item.variants.length}</td>
                  <td>{item.active ? 'Sim' : 'Não'}</td>
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
