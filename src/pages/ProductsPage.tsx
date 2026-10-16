import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CatalogPricesSection } from '../components/CatalogPricesSection'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { defaultMarket, hasBothMarkets, sessionMarkets, type MarketCode } from '../lib/markets'
import { MarketSelect } from '../components/MarketSelect'

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
  canDelete?: boolean
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

const DEACTIVATE_CONFIRM = 'Este produto já está em assinaturas. Desativar tira ele da loja e mantém o cadastro e a cobrança atual. Deseja desativar?'
const IN_USE_MESSAGE = 'Este produto já está em assinaturas e não pode ser excluído.'
const ARCHIVE_FAILED_MESSAGE = 'Não foi possível arquivar o produto na Stripe. O cadastro foi mantido.'

function deleteFailure(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && (error.code === 'product_in_use' || error.code === 'variation_in_use')) {
    return { inUse: true, message: IN_USE_MESSAGE }
  }
  if (error instanceof ApiRequestError && error.status === 502) {
    return { inUse: false, message: ARCHIVE_FAILED_MESSAGE }
  }
  return { inUse: false, message: error instanceof Error ? error.message : fallback }
}

const emptyCreateForm = {
  name: '',
  planCountry: 'BR',
  planDays: 30,
  variantName: '',
  variantSku: '',
  variantFlavor: '',
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
  const { token, user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const bothMarkets = hasBothMarkets(user)
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
  const scopedMarket = bothMarkets ? market : (defaultMarket(user) ?? '')
  const planCountries = sessionMarkets(user)

  useEffect(() => {
    const next = defaultMarket(user)
    if (!next) return
    setForm((current) => {
      const allowed = sessionMarkets(user)
      if (allowed.includes(current.planCountry as MarketCode)) return current
      return { ...current, planCountry: next }
    })
  }, [user])

  const load = async () => {
    if (!token || !user) return
    setError('')
    try {
      const response = await apiRequest<ProductsResponse>(`/admin/catalog/products${buildQueryString({
        search: search || undefined,
        market: scopedMarket || undefined,
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
  }, [token, user, search, scopedMarket, page, perPage])

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
    const variantFlavor = form.variantFlavor.trim()
    const variants = variantName || variantSku || variantFlavor || form.variantPrice
      ? [{
          name: variantName,
          sku: variantSku,
          flavor: variantFlavor,
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
      const failure = deleteFailure(requestError, 'Falha ao excluir produto')
      if (failure.inUse) {
        await load()
      }
      setError(failure.message)
    } finally {
      setDeletingId('')
    }
  }

  const deactivateProduct = async (item: ProductItem) => {
    if (!token || !canWrite) return
    const confirmed = window.confirm(DEACTIVATE_CONFIRM)
    if (!confirmed) return

    try {
      setDeletingId(item.id)
      setError('')
      await apiRequest(`/admin/catalog/products/${item.id}`, {
        token,
        method: 'PATCH',
        body: { active: false },
      })
      setMessage(`Produto "${item.namePt}" desativado.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao desativar produto')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <PageFrame
      title="Produtos"
      description="Planos à venda na loja, suas variações (sabor e peso) e os preços na Stripe."
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <CatalogPricesSection />

      <Section title="Filtros">
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
          <MarketSelect
            user={user}
            value={scopedMarket}
            includeAll
            allLabel="Selecionar"
            onChange={(value) => { setMarket(value); setPage(1) }}
          />
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
                <th>Status</th>
                <th>Criado em</th>
                <th>Ações</th>
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
                  <td>
                    <span className={item.active ? 'badge-success' : 'badge-warning'}>
                      {item.active ? 'Publicado' : 'Rascunho'}
                    </span>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link className="ghost-button" to={`/catalog/products/${item.id}`}>Detalhes</Link>
                      {canWrite && item.canDelete === true ? (
                        <button
                          className="danger-button"
                          type="button"
                          aria-label={`Excluir produto ${item.namePt}`}
                          disabled={deletingId === item.id}
                          onClick={() => void deleteProduct(item)}
                        >
                          {deletingId === item.id ? 'Excluindo…' : 'Excluir'}
                        </button>
                      ) : null}
                      {canWrite && item.canDelete !== true && item.active ? (
                        <button
                          className="danger-button"
                          type="button"
                          aria-label={`Desativar produto ${item.namePt}`}
                          disabled={deletingId === item.id}
                          onClick={() => void deactivateProduct(item)}
                        >
                          {deletingId === item.id ? 'Desativando…' : 'Desativar'}
                        </button>
                      ) : null}
                      {canWrite && item.canDelete !== true && !item.active ? (
                        <span className="muted">Produto vinculado a assinatura. Não pode ser excluído.</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager page={data?.page ?? page} totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / (data?.perPage ?? perPage)))} onPrev={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => current + 1)} />
      </Section>

      {canWrite ? (
        <details className="section-card create-panel">
          <summary>
            <strong>Novo produto</strong>
            <span className="muted">Nasce como rascunho e já ganha um produto na Stripe. As variações são adicionadas no detalhe.</span>
          </summary>
          <form className="stack" onSubmit={createProduct}>
            <div className="form-grid">
              <label>
                Nome
                <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Plano Adulto BR" required />
              </label>
              <label>
                País do plano
                <select
                  value={form.planCountry}
                  disabled={!bothMarkets}
                  onChange={(event) => setForm((current) => ({ ...current, planCountry: event.target.value }))}
                >
                  {(planCountries.length ? planCountries : ['BR']).map((country) => (
                    <option key={country} value={country}>{country === 'US' ? 'US / USD' : 'BR / BRL'}</option>
                  ))}
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
                Sabor
                <input value={form.variantFlavor} onChange={(event) => setForm((current) => ({ ...current, variantFlavor: event.target.value }))} placeholder="Ex.: Beef" />
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
        </details>
      ) : null}
    </PageFrame>
  )
}
