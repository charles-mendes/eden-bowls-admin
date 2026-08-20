import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatCurrency } from '../lib/format'

type ProductVariant = {
  id: string
  sku: string
  name: string
  regularPrice: number | null
  stripeProductId: string | null
  stripePriceId: string | null
  syncStatus: string
  requiresSync: boolean
}

type ProductDetail = {
  id: string
  slug: string
  namePt: string
  nameEn: string
  active: boolean
  planCountry: string | null
  planDays: number | null
  publishBlocked?: boolean
  gaps?: Array<{ variationId: string; currencies: string[] }>
  variants: ProductVariant[]
}

type VariantDraft = {
  key: string
  id: string | null
  sku: string
  name: string
  regularPrice: string
  stripeProductId: string | null
  stripePriceId: string | null
  syncStatus: string
  requiresSync: boolean
}

let newVariantSeq = 0

function toVariantDraft(item: ProductVariant): VariantDraft {
  return {
    key: item.id,
    id: item.id,
    sku: item.sku || '',
    name: item.name || '',
    regularPrice: item.regularPrice == null ? '' : String(item.regularPrice),
    stripeProductId: item.stripeProductId,
    stripePriceId: item.stripePriceId,
    syncStatus: item.syncStatus,
    requiresSync: item.requiresSync,
  }
}

function emptyVariantDraft(): VariantDraft {
  newVariantSeq += 1
  return {
    key: `new-${newVariantSeq}`,
    id: null,
    sku: '',
    name: '',
    regularPrice: '',
    stripeProductId: null,
    stripePriceId: null,
    syncStatus: 'not_synced',
    requiresSync: true,
  }
}

function variantPayload(item: VariantDraft) {
  return {
    ...(item.id ? { id: item.id } : {}),
    sku: item.sku,
    name: item.name,
    regularPrice: item.regularPrice === '' ? null : Number(item.regularPrice),
  }
}

export function ProductDetailPage() {
  const { token, hasPermission } = useAuth()
  const { productId } = useParams()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [planCountry, setPlanCountry] = useState('BR')
  const [planDays, setPlanDays] = useState(28)
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const canWrite = hasPermission('catalog.write')
  const canEdit = Boolean(canWrite && data && !data.active)
  const currency = planCountry === 'US' ? 'USD' : 'BRL'

  const applyProduct = (product: ProductDetail) => {
    setData(product)
    setPlanCountry(product.planCountry || 'BR')
    setPlanDays(product.planDays || 28)
    setVariants(product.variants.map(toVariantDraft))
  }

  const load = async () => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, { token })
      applyProduct(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar produto')
    }
  }

  useEffect(() => {
    void load()
  }, [token, productId])

  const persistDraft = () => {
    if (variants.some((item) => !item.id && !item.sku.trim() && !item.name.trim())) {
      setError('Nova variação precisa de nome ou SKU.')
      return null
    }
    return {
      planCountry,
      planDays,
      variants: variants.map(variantPayload),
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !productId || !canEdit) return
    const payload = persistDraft()
    if (!payload) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: payload,
      })
      applyProduct(response)
      setError('')
      setMessage('Produto atualizado.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar')
    }
  }

  const togglePublish = async (active: boolean) => {
    if (!token || !productId) return
    const body = active
      ? persistDraft()
      : { active: false as const }
    if (!body) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: active ? { ...body, active: true } : body,
      })
      applyProduct(response)
      setError('')
      setMessage(response.publishBlocked ? 'Publish bloqueado: faltam prices Stripe.' : (active ? 'Publicado.' : 'Voltou para rascunho.'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no publish')
    }
  }

  const sync = async () => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<{ status: string; summary?: { created?: number; updated?: number; skipped?: unknown[] } }>(`/admin/catalog/sync/${productId}`, {
        token,
        method: 'POST',
      })
      setError('')
      setMessage(`Sync ${response.status}. created=${response.summary?.created ?? 0} updated=${response.summary?.updated ?? 0}`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no sync')
    }
  }

  const updateVariant = (key: string, patch: Partial<VariantDraft>) => {
    setVariants((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  }

  return (
    <PageFrame title={data?.namePt ?? 'Produto'} description="País, dias, variações e guard de publish sem price mapeado.">
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}
      {data?.gaps?.length ? <div className="alert">Gaps: {data.gaps.map((item) => `${item.variationId} ${item.currencies.join('/')}`).join(', ')}</div> : null}

      <form className="stack" onSubmit={save}>
        <div className="editor-card">
          <div className="form-toolbar">
            <div className="form-grid">
              <label>
                País do plano
                <select value={planCountry} disabled={!canEdit} onChange={(event) => setPlanCountry(event.target.value)}>
                  <option value="BR">BR / BRL</option>
                  <option value="US">US / USD</option>
                </select>
              </label>
              <label>
                Duração (dias)
                <input type="number" min={1} value={planDays} disabled={!canEdit} onChange={(event) => setPlanDays(Number(event.target.value))} />
              </label>
            </div>
            {canWrite ? (
              <div className="inline-actions">
                <button className="primary-button" type="submit" disabled={!canEdit}>Salvar</button>
              </div>
            ) : null}
          </div>
          {canWrite && data?.active ? (
            <p className="muted">Produto publicado. Volte para rascunho para editar país, duração, preços e variações.</p>
          ) : null}
        </div>

        <Section
          title="Variações"
          description={canEdit
            ? 'SKU, nome e preço da variação. Salvar grava o rascunho. Publicar grava, sincroniza o Stripe e ativa.'
            : 'Mapeamento Stripe e status de sync. Edição só em rascunho.'}
          actions={canEdit ? (
            <button className="ghost-button" type="button" onClick={() => setVariants((current) => [...current, emptyVariantDraft()])}>
              Adicionar variação
            </button>
          ) : null}
        >
          <div className="table-shell table-scroll">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nome</th>
                  <th>Preço ({currency})</th>
                  <th>Stripe product</th>
                  <th>Stripe price</th>
                  <th>Status</th>
                  {canEdit ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6}>
                      {canEdit
                        ? 'Nenhuma variação. Use Adicionar variação para criar SKU, nome e preço.'
                        : 'Nenhuma variação cadastrada.'}
                    </td>
                  </tr>
                ) : variants.map((item) => (
                  <tr key={item.key}>
                    <td>
                      {canEdit ? (
                        <input aria-label="SKU" value={item.sku} onChange={(event) => updateVariant(item.key, { sku: event.target.value })} placeholder="SKU" />
                      ) : item.sku || '-'}
                    </td>
                    <td>
                      {canEdit ? (
                        <input aria-label="Nome" value={item.name} onChange={(event) => updateVariant(item.key, { name: event.target.value })} placeholder="Nome" />
                      ) : item.name || '-'}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          aria-label="Preço"
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.regularPrice}
                          onChange={(event) => updateVariant(item.key, { regularPrice: event.target.value })}
                          placeholder="0.00"
                        />
                      ) : formatCurrency(item.regularPrice === '' ? null : Number(item.regularPrice), currency)}
                    </td>
                    <td>{item.stripeProductId ?? '-'}</td>
                    <td>{item.stripePriceId ?? '-'}</td>
                    <td className={item.requiresSync ? 'warning-text' : undefined}>
                      {item.syncStatus}{item.requiresSync ? ' · requires_sync' : ''}
                    </td>
                    {canEdit ? (
                      <td>
                        {item.id ? null : (
                          <button className="ghost-button" type="button" onClick={() => setVariants((current) => current.filter((row) => row.key !== item.key))}>
                            Remover
                          </button>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </form>

      <Section title="Publicação e sync">
        <div className="inline-actions">
          {canWrite ? (
            <button className="ghost-button" type="button" onClick={() => void togglePublish(!data?.active)}>
              {data?.active ? 'Voltar para rascunho' : 'Publicar'}
            </button>
          ) : null}
          {hasPermission('catalog.sync') ? (
            <button className="primary-button" type="button" onClick={() => void sync()}>Sincronizar Stripe</button>
          ) : null}
        </div>
        <p className="muted">Ativo: {data?.active ? 'sim' : 'não'} · slug {data?.slug}</p>
      </Section>
    </PageFrame>
  )
}
