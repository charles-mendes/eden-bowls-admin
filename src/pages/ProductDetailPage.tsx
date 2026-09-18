import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatCurrency } from '../lib/format'

type ProductVariant = {
  id: string
  sku: string
  name: string
  flavor: string | null
  flavorSlug: string | null
  flavorAliases: string | null
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
  flavor: string
  flavorSlug: string
  flavorAliases: string
  regularPrice: string
  stripeProductId: string | null
  stripePriceId: string | null
  syncStatus: string
  requiresSync: boolean
}

let newVariantSeq = 0

function suggestFlavorSlug(label: string) {
  return String(label || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toVariantDraft(item: ProductVariant): VariantDraft {
  return {
    key: item.id,
    id: item.id,
    sku: item.sku || '',
    name: item.name || '',
    flavor: item.flavor || '',
    flavorSlug: item.flavorSlug || '',
    flavorAliases: item.flavorAliases || '',
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
    flavor: '',
    flavorSlug: '',
    flavorAliases: '',
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
    flavor: item.flavor.trim(),
    ...(item.flavorSlug.trim() ? { flavorSlug: item.flavorSlug.trim() } : {}),
    ...(item.flavorAliases.trim() ? { flavorAliases: item.flavorAliases.trim() } : {}),
    regularPrice: item.regularPrice === '' ? null : Number(item.regularPrice),
  }
}

export function ProductDetailPage() {
  const { token, hasPermission } = useAuth()
  const { productId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [planCountry, setPlanCountry] = useState('BR')
  const [planDays, setPlanDays] = useState(28)
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [deletingKey, setDeletingKey] = useState('')

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
    setVariants((current) => current.map((item) => {
      if (item.key !== key) return item
      const next = { ...item, ...patch }
      const slugLocked = Boolean(item.id && item.flavorSlug)
      if (patch.flavor != null && !item.id && !slugLocked && patch.flavorSlug == null) {
        const sibling = current.find((row) => (
          row.key !== key
          && row.flavor.trim().toLowerCase() === patch.flavor.trim().toLowerCase()
          && row.flavorSlug
        ))
        next.flavorSlug = sibling?.flavorSlug || suggestFlavorSlug(patch.flavor)
      }
      return next
    }))
  }

  const deleteVariation = async (item: VariantDraft) => {
    if (!token || !productId || !canWrite) return
    if (!item.id) {
      setVariants((current) => current.filter((row) => row.key !== item.key))
      return
    }

    const label = item.name.trim() || item.sku.trim() || item.id
    const confirmed = window.confirm(`Excluir a variação "${label}"? Isso remove o cadastro local e não pode ser desfeito.`)
    if (!confirmed) return

    try {
      setDeletingKey(item.key)
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}/variations/${item.id}`, {
        token,
        method: 'DELETE',
      })
      applyProduct(response)
      setError('')
      setMessage(`Variação "${label}" excluída.`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir variação')
    } finally {
      setDeletingKey('')
    }
  }

  const deleteProduct = async () => {
    if (!token || !productId || !canWrite || !data) return
    const count = data.variants.length
    const confirmed = window.confirm(
      `Excluir o produto "${data.namePt}" e ${count} variação(ões)? Isso remove o cadastro local e não pode ser desfeito.`,
    )
    if (!confirmed) return

    try {
      setDeletingKey('product')
      await apiRequest(`/admin/catalog/products/${productId}`, { token, method: 'DELETE' })
      navigate('/catalog/products')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir produto')
      setDeletingKey('')
    }
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
            ? 'Label livre, slug estável compartilhado entre gramaturas e preço. O slug não muda depois de gravado. Stripe cobra; o nome na loja vem do sabor.'
            : 'Sabor, slug, mapeamento Stripe e status de sync. Edição só em rascunho; exclusão pode ser feita agora.'}
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
                  <th>Sabor</th>
                  <th>Slug</th>
                  <th>Aliases</th>
                  <th>Preço ({currency})</th>
                  <th>Stripe product</th>
                  <th>Stripe price</th>
                  <th>Status</th>
                  {canWrite ? <th></th> : null}
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 10 : 9}>
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
                          aria-label="Sabor"
                          value={item.flavor}
                          onChange={(event) => updateVariant(item.key, { flavor: event.target.value })}
                          placeholder="Ex.: Frango"
                        />
                      ) : item.flavor || '-'}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          aria-label="Slug do sabor"
                          value={item.flavorSlug}
                          disabled={Boolean(item.id && item.flavorSlug)}
                          onChange={(event) => updateVariant(item.key, { flavorSlug: event.target.value })}
                          placeholder="turkey"
                        />
                      ) : item.flavorSlug || '-'}
                    </td>
                    <td>
                      {canEdit ? (
                        <input
                          aria-label="Aliases do sabor"
                          value={item.flavorAliases}
                          onChange={(event) => updateVariant(item.key, { flavorAliases: event.target.value })}
                          placeholder="chicken, frango"
                        />
                      ) : item.flavorAliases || '-'}
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
                    {canWrite ? (
                      <td>
                        {item.id ? (
                          <button
                            className="danger-button"
                            type="button"
                            aria-label={`Excluir variação ${item.name || item.sku || item.id}`}
                            disabled={deletingKey === item.key}
                            onClick={() => void deleteVariation(item)}
                          >
                            {deletingKey === item.key ? 'Excluindo…' : 'Excluir'}
                          </button>
                        ) : (
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
          {canWrite ? (
            <button
              className="danger-button"
              type="button"
              disabled={deletingKey === 'product'}
              onClick={() => void deleteProduct()}
            >
              {deletingKey === 'product' ? 'Excluindo…' : 'Excluir produto'}
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
