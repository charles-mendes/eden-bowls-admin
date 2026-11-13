import { useEffect, useState, type FormEvent } from 'react'
import { Dialog } from '../components/Dialog'
import { Link, useNavigate } from 'react-router-dom'
import { CatalogPricesSection } from '../components/CatalogPricesSection'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest, buildQueryString } from '../lib/api'
import { defaultMarket, hasBothMarkets, sessionMarkets, type MarketCode } from '../lib/markets'
import { MarketSelect } from '../components/MarketSelect'
import {
  LABEL_STATUS_TEXT,
  LIFE_STAGE_LABELS,
  productCodeFromName,
  type LifeStage,
  type RecipeLabelStatus,
} from '../lib/recipeContent'

type ProductItem = {
  id: string
  slug: string
  namePt: string
  nameEn: string
  active: boolean
  category: { namePt: string; nameEn: string }
  planCountry?: string | null
  marketConfigs: Array<{ marketCountry: string; currency: string; active: boolean }>
  variants: Array<{ id: string; sku: string; active?: boolean; variantPrices?: Array<{ id: string }> }>
  createdAt: string
  canDelete?: boolean
  // Recipe of the product (product-is-recipe); null for a product without content.
  content?: { code: string; lifeStage: LifeStage; imageUrl: string | null; labelStatus: RecipeLabelStatus } | null
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

type CreateForm = { name: string; planCountry: string; code: string; codeTouched: boolean; lifeStage: LifeStage }

const emptyCreateForm: CreateForm = { name: '', planCountry: 'BR', code: '', codeTouched: false, lifeStage: 'adult' }

function createFailure(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'product_code_taken') return 'Este mercado já tem um produto com esse código. Escolha outro código.'
    if (error.code === 'recipe_key_invalid' || error.code === 'product_code_invalid') {
      return 'O código usa só letras minúsculas, números e hífens, por exemplo senior-cordeiro.'
    }
    if (error.code === 'product_name_invalid') return 'Informe um nome de até 120 caracteres.'
  }
  return error instanceof Error ? error.message : 'Falha ao criar produto'
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
  const [lifeStage, setLifeStage] = useState<LifeStage | ''>('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [form, setForm] = useState<CreateForm>(emptyCreateForm)
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [noImage, setNoImage] = useState(false)
  const [labelIncomplete, setLabelIncomplete] = useState(false)
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
        lifeStage: lifeStage || undefined,
        noImage: noImage || undefined,
        labelIncomplete: labelIncomplete || undefined,
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
  }, [token, user, search, scopedMarket, lifeStage, noImage, labelIncomplete, page, perPage])

  const openCreate = () => {
    setCreateError('')
    setForm((current) => ({ ...emptyCreateForm, planCountry: current.planCountry }))
    setCreateOpen(true)
  }

  const closeCreate = () => {
    if (creating) return
    setCreateOpen(false)
    setCreateError('')
  }

  const createProduct = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !canWrite || creating) return
    const name = form.name.trim()
    const code = form.code.trim()
    if (!name) {
      setCreateError('Informe o nome do produto.')
      return
    }
    if (!code) {
      setCreateError('Informe o código do produto.')
      return
    }

    try {
      setCreating(true)
      setCreateError('')
      const created = await apiRequest<CreatedProduct>('/admin/catalog/products', {
        token,
        method: 'POST',
        body: { name, planCountry: form.planCountry, code, lifeStage: form.lifeStage },
      })
      setCreateOpen(false)
      setForm((current) => ({ ...emptyCreateForm, planCountry: current.planCountry }))
      navigate(`/catalog/products/${created.id}`)
    } catch (requestError) {
      setCreateError(createFailure(requestError))
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

  // Every filter runs on the API, so the total and the pages match the list.
  const visibleItems = data?.items ?? []

  return (
    <PageFrame
      title="Produtos"
      description="Cada produto é uma receita de um mercado. As variações são os tamanhos de pack, com preço na Stripe."
      actions={canWrite ? (
        <button className="primary-button" type="button" onClick={openCreate}>Novo produto</button>
      ) : null}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <CatalogPricesSection />

      <Section title="Filtros">
        <FiltersBar className="products-filters">
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
            allLabel="Todos"
            onChange={(value) => { setMarket(value); setPage(1) }}
          />
          <label>
            Fase
            <select
              aria-label="Filtrar por fase"
              value={lifeStage}
              onChange={(event) => { setLifeStage(event.target.value as LifeStage | ''); setPage(1) }}
            >
              <option value="">Todas</option>
              {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
                <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
              ))}
            </select>
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
          <div className="filter-checks">
            <label className="checkbox-field">
              <input type="checkbox" checked={noImage} onChange={(event) => { setNoImage(event.target.checked); setPage(1) }} />
              Sem imagem
            </label>
            <label className="checkbox-field">
              <input type="checkbox" checked={labelIncomplete} onChange={(event) => { setLabelIncomplete(event.target.checked); setPage(1) }} />
              Rótulo incompleto
            </label>
          </div>
        </FiltersBar>
      </Section>

      <Section title="Produtos cadastrados" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll products-table-shell">
          <table className="products-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Mercado</th>
                <th>Fase</th>
                <th>Variações</th>
                <th>Imagem</th>
                <th>Rótulo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr><td colSpan={8} className="muted">{data ? 'Nenhum produto com esses filtros.' : 'Carregando.'}</td></tr>
              ) : null}
              {visibleItems.map((item) => (
                <tr key={item.id}>
                  <td className="products-cell-name">
                    <Link className="table-link" to={`/catalog/products/${item.id}`}>{item.namePt}</Link>
                    <div className="muted mono">{item.content?.code ?? item.slug}</div>
                  </td>
                  <td data-label="Mercado">{item.planCountry ?? (item.marketConfigs.map((config) => config.marketCountry).join(', ') || '-')}</td>
                  <td data-label="Fase">{item.content ? LIFE_STAGE_LABELS[item.content.lifeStage] : '-'}</td>
                  <td data-label="Variações" aria-label={`${item.variants.filter((variant) => variant.active).length} de ${item.variants.length} variações ativas`}>
                    {item.variants.filter((variant) => variant.active).length}/{item.variants.length}
                  </td>
                  <td data-label="Imagem">
                    <span className={item.content?.imageUrl ? 'badge-success' : 'badge-neutral'}>
                      {item.content?.imageUrl ? 'Com imagem' : 'Sem imagem'}
                    </span>
                  </td>
                  <td data-label="Rótulo">
                    {item.content ? (
                      <span className={item.content.labelStatus === 'complete' ? 'badge-success' : item.content.labelStatus === 'incomplete' ? 'badge-warning' : 'badge-neutral'}>
                        {LABEL_STATUS_TEXT[item.content.labelStatus]}
                      </span>
                    ) : '-'}
                  </td>
                  <td data-label="Status">
                    <span className={item.active ? 'badge-success' : 'badge-warning'}>
                      {item.active ? 'Publicado' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="products-cell-actions">
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
                        <span className="muted" title="Produto vinculado a assinatura. Não pode ser excluído.">Vinculado a assinatura</span>
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

      <Dialog
        open={createOpen}
        title="Novo produto"
        description="Cada produto é uma receita. Código e mercado não mudam depois de criados."
        onClose={closeCreate}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeCreate} disabled={creating}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void createProduct()} disabled={creating}>
              {creating ? 'Criando…' : 'Criar produto'}
            </button>
          </>
        )}
      >
        <form className="access-form" onSubmit={createProduct}>
          {createError ? <div className="alert" role="alert">{createError}</div> : null}
          <div className="access-fields">
            <label className="access-field-wide">
              Nome
              <input
                aria-label="Nome"
                value={form.name}
                maxLength={120}
                placeholder="Ex.: Receita de Cordeiro"
                onChange={(event) => {
                  const name = event.target.value
                  setForm((current) => ({ ...current, name, code: current.codeTouched ? current.code : productCodeFromName(name) }))
                }}
              />
            </label>
            <label>
              Mercado
              <select
                aria-label="Mercado do produto"
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
              Fase de vida
              <select
                aria-label="Fase de vida"
                value={form.lifeStage}
                onChange={(event) => setForm((current) => ({ ...current, lifeStage: event.target.value as LifeStage }))}
              >
                {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
                  <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
                ))}
              </select>
            </label>
            <label className="access-field-wide">
              Código
              <input
                className="mono"
                aria-label="Código"
                aria-describedby="product-code-hint"
                value={form.code}
                maxLength={64}
                onChange={(event) => {
                  const code = event.target.value
                  setForm((current) => ({ ...current, code, codeTouched: true }))
                }}
              />
              <span id="product-code-hint" className="access-hint">
                Letras minúsculas, números e hífens. Identifica a receita na loja e no Stripe; não muda depois.
              </span>
            </label>
          </div>
        </form>
      </Dialog>
    </PageFrame>
  )
}
