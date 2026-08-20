import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  variants: Array<{ id: string; sku: string; variantPrices?: Array<{ id: string }> }>
  createdAt: string
}

type ProductsResponse = {
  total: number
  page: number
  perPage: number
  items: ProductItem[]
}

type CreatedProduct = {
  id: string
  namePt: string
  slug: string
  planCountry: string | null
  planDays: number | null
  stripeProductId?: string | null
  variants: Array<{ id: string }>
}

const emptyCreateForm = {
  name: '',
  planCountry: 'BR',
  planDays: 30,
  variantName: '',
  variantSku: '',
  variantPrice: '',
}

function FilterClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="filter-clear" aria-label={label} onClick={onClear}>
      ×
    </button>
  )
}

export function ProductsPage() {
  const { token, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<ProductsResponse | null>(null)
  const [search, setSearch] = useState('')
  const [market, setMarket] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [form, setForm] = useState(emptyCreateForm)
  const canWrite = hasPermission('catalog.write')

  const load = async () => {
    if (!token) return
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

  useEffect(() => {
    void load()
  }, [token, search, market, page, perPage])

  const createProduct = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !canWrite) return
    const name = form.name.trim()
    if (!name) {
      setError('Nome do produto é obrigatório.')
      return
    }

    const variantName = form.variantName.trim()
    const variantSku = form.variantSku.trim()
    const variants = variantName || variantSku || form.variantPrice
      ? [{
          name: variantName,
          sku: variantSku,
          regularPrice: form.variantPrice === '' ? null : Number(form.variantPrice),
        }]
      : undefined

    if (variants && !variantName && !variantSku) {
      setError('A variação inicial precisa de nome ou SKU.')
      return
    }

    try {
      setCreating(true)
      setError('')
      const created = await apiRequest<CreatedProduct>('/admin/catalog/products', {
        token,
        method: 'POST',
        body: {
          name,
          planCountry: form.planCountry,
          planDays: form.planDays,
          ...(variants ? { variants } : {}),
        },
      })
      setForm(emptyCreateForm)
      setMessage(created.stripeProductId
        ? 'Produto criado e vinculado no Stripe. Adicione variações no detalhe.'
        : 'Produto criado. Adicione variações no detalhe e sincronize o Stripe.')
      navigate(`/catalog/products/${created.id}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar produto')
    } finally {
      setCreating(false)
    }
  }

  const deleteProduct = async (item: ProductItem) => {
    if (!token || !canWrite) return
    const count = item.variants.length
    const confirmed = window.confirm(
      `Excluir o produto "${item.namePt}" e ${count} variação(ões)? Isso remove o cadastro local e não pode ser desfeito.`,
    )
    if (!confirmed) return

    try {
      setDeletingId(item.id)
      setError('')
      await apiRequest<{ deleted: boolean }>(`/admin/catalog/products/${item.id}`, {
        token,
        method: 'DELETE',
      })
      setMessage(`Produto "${item.namePt}" excluído.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir produto')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <PageFrame
      title="Produtos"
      description="Crie o produto já no Stripe; no detalhe você adiciona as variações."
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      {canWrite ? (
        <Section title="Novo produto" description="Cria em rascunho, vincula um Product no Stripe e abre o detalhe para as variações.">
          <form className="stack" onSubmit={createProduct}>
            <div className="form-grid">
              <label>
                Nome
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Plano Adulto BR" required />
              </label>
              <label>
                País do plano
                <select value={form.planCountry} onChange={(event) => setForm((current) => ({ ...current, planCountry: event.target.value }))}>
                  <option value="BR">BR / BRL</option>
                  <option value="US">US / USD</option>
                </select>
              </label>
              <label>
                Duração (dias)
                <input type="number" min={1} value={form.planDays} onChange={(event) => setForm((current) => ({ ...current, planDays: Number(event.target.value) }))} />
              </label>
            </div>
            <p className="muted">Variação inicial (opcional). Depois você cria as demais no detalhe do produto.</p>
            <div className="form-grid">
              <label>
                SKU da variação
                <input value={form.variantSku} onChange={(event) => setForm((current) => ({ ...current, variantSku: event.target.value }))} placeholder="ADULTO-300" />
              </label>
              <label>
                Nome da variação
                <input value={form.variantName} onChange={(event) => setForm((current) => ({ ...current, variantName: event.target.value }))} placeholder="Frango 300g" />
              </label>
              <label>
                Preço
                <input type="number" min={0} step="0.01" value={form.variantPrice} onChange={(event) => setForm((current) => ({ ...current, variantPrice: event.target.value }))} placeholder="0.00" />
              </label>
            </div>
            <div className="inline-actions">
              <button className="primary-button" type="submit" disabled={creating}>{creating ? 'Criando…' : 'Criar produto'}</button>
            </div>
          </form>
        </Section>
      ) : null}

      <Section title="Filtros" description="A lista abre sem filtro. Preencha busca ou mercado quando quiser recortar.">
        <FiltersBar>
          <label>
            Busca
            <span className="filter-field">
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                placeholder="slug, nome pt ou en"
              />
              {search ? (
                <FilterClearButton label="Limpar busca" onClear={() => { setSearch(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Mercado
            <span className="filter-field">
              <select value={market} onChange={(event) => { setMarket(event.target.value); setPage(1) }}>
                <option value="">Selecionar</option>
                <option value="BR">BR</option>
                <option value="US">US</option>
              </select>
              {market ? (
                <FilterClearButton label="Limpar mercado" onClear={() => { setMarket(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

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
                {canWrite ? <th>Ações</th> : null}
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
                  {canWrite ? (
                    <td>
                      <button
                        className="danger-button"
                        type="button"
                        aria-label={`Excluir produto ${item.namePt}`}
                        disabled={deletingId === item.id}
                        onClick={() => void deleteProduct(item)}
                      >
                        {deletingId === item.id ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </td>
                  ) : null}
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
