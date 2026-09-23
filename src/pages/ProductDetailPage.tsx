import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { sessionMarkets } from '../lib/markets'

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
  canDelete?: boolean
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
  canDelete?: boolean
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
  canDelete: boolean
}

type VariationDialogState = {
  draft: VariantDraft
  slugLocked: boolean
}

let newVariantSeq = 0

function catalogDeleteFailure(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError && (error.code === 'product_in_use' || error.code === 'variation_in_use')) {
    return { inUse: true, message: 'Este produto já está em assinaturas e não pode ser excluído.' }
  }
  if (error instanceof ApiRequestError && error.status === 502) {
    return { inUse: false, message: 'Não foi possível arquivar o produto na Stripe. O cadastro foi mantido.' }
  }
  return { inUse: false, message: error instanceof Error ? error.message : fallback }
}

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
    canDelete: item.canDelete === true,
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
    canDelete: true,
  }
}

function syncStatusLabel(status: string, requiresSync: boolean) {
  const labels: Record<string, string> = {
    synced: 'Sincronizado',
    not_synced: 'Não sincronizado',
    price_mismatch: 'Preço divergente',
  }
  const label = labels[status] ?? status
  return requiresSync ? `${label} · precisa sincronizar` : label
}

function planDaysField(value: number | null) {
  return value != null && value > 0 ? String(value) : ''
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
  const { token, user, hasPermission } = useAuth()
  const { productId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [planCountry, setPlanCountry] = useState('BR')
  const [planDays, setPlanDays] = useState('')
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [deletingKey, setDeletingKey] = useState('')
  const [variationDialog, setVariationDialog] = useState<VariationDialogState | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [savingVariation, setSavingVariation] = useState(false)

  const canWrite = hasPermission('catalog.write')
  const canSync = hasPermission('catalog.sync')
  const canEdit = Boolean(canWrite && data && !data.active)
  const currency = planCountry === 'US' ? 'USD' : 'BRL'
  const countryOptions = sessionMarkets(user)
  const savedCountry = data?.planCountry || 'BR'
  const savedDays = planDaysField(data?.planDays ?? null)
  const planDirty = Boolean(canEdit && (planCountry !== savedCountry || planDays !== savedDays))

  useEffect(() => {
    if (!planDirty) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [planDirty])

  const applyProduct = (product: ProductDetail) => {
    setData(product)
    setPlanCountry(product.planCountry || 'BR')
    setPlanDays(planDaysField(product.planDays))
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

  const planPayload = () => {
    const parsedDays = planDays.trim() === '' ? null : Number(planDays)
    if (parsedDays != null && (!Number.isFinite(parsedDays) || parsedDays <= 0)) {
      setError('Duração precisa ser maior que zero.')
      return null
    }
    return {
      planCountry,
      ...(parsedDays == null ? {} : { planDays: parsedDays }),
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !productId || !canEdit) return
    const payload = planPayload()
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
    if (!active) {
      const confirmed = window.confirm(
        data?.canDelete === false
          ? 'Este produto já está em assinaturas. Desativar tira ele da loja e mantém o cadastro e a cobrança atual. Deseja desativar?'
          : 'Desativar tira este produto da loja e mantém o cadastro. Deseja desativar?',
      )
      if (!confirmed) return
    }
    const body = active
      ? planPayload()
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
      setMessage(response.publishBlocked ? 'Publicação bloqueada: faltam preços na Stripe.' : (active ? 'Publicado.' : 'Voltou para rascunho.'))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao publicar')
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
      const created = response.summary?.created ?? 0
      const updated = response.summary?.updated ?? 0
      const createdLabel = created === 1 ? '1 preço criado' : `${created} preços criados`
      const updatedLabel = updated === 1 ? '1 atualizado' : `${updated} atualizados`
      setMessage(`Stripe sincronizado. ${createdLabel}, ${updatedLabel}.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao sincronizar')
    }
  }

  const openVariationDialog = (draft: VariantDraft) => {
    setDialogError('')
    setVariationDialog({
      draft,
      slugLocked: Boolean(draft.id && draft.flavorSlug),
    })
  }

  const updateDialogDraft = (patch: Partial<VariantDraft>) => {
    setVariationDialog((current) => {
      if (!current) return current
      const next = { ...current.draft, ...patch }
      if (patch.flavor != null && !current.draft.id && !current.slugLocked && patch.flavorSlug == null) {
        const sibling = variants.find((row) => (
          row.key !== current.draft.key
          && row.flavor.trim().toLowerCase() === patch.flavor!.trim().toLowerCase()
          && row.flavorSlug
        ))
        next.flavorSlug = sibling?.flavorSlug || suggestFlavorSlug(patch.flavor)
      }
      return { ...current, draft: next }
    })
  }

  const closeVariationDialog = () => {
    if (savingVariation) return
    setVariationDialog(null)
    setDialogError('')
  }

  const saveVariation = async () => {
    if (!token || !productId || !variationDialog || savingVariation) return
    const draft = variationDialog.draft
    if (!draft.id && !draft.sku.trim() && !draft.name.trim()) {
      setDialogError('Nova variação precisa de nome ou SKU.')
      return
    }
    try {
      setSavingVariation(true)
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: { variants: [variantPayload(draft)] },
      })
      applyProduct(response)
      setVariationDialog(null)
      setDialogError('')
      setError('')
      setMessage(draft.id ? 'Variação atualizada.' : 'Variação adicionada.')
    } catch (requestError) {
      setDialogError(requestError instanceof Error ? requestError.message : 'Falha ao salvar variação')
    } finally {
      setSavingVariation(false)
    }
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
      const failure = catalogDeleteFailure(requestError, 'Falha ao excluir variação')
      setError(failure.message)
      if (failure.inUse) {
        await load()
      }
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
      const failure = catalogDeleteFailure(requestError, 'Falha ao excluir produto')
      setError(failure.message)
      setDeletingKey('')
      if (failure.inUse) {
        await load()
      }
    }
  }

  const gapText = data?.gaps?.length
    ? data.gaps.map((item) => {
      const match = data.variants.find((variant) => variant.id === item.variationId)
      const name = match?.name?.trim() || match?.sku?.trim() || 'variação'
      return item.currencies.length ? `${name} (${item.currencies.join('/')})` : name
    }).join(', ')
    : ''

  return (
    <PageFrame
      title={data?.namePt ?? 'Produto'}
      description="País, duração, variações e sincronização com o Stripe."
      actions={(
        <div className="inline-actions">
          {data ? (
            <span className={data.active ? 'badge-success' : 'badge-warning'}>
              {data.active ? 'Publicado' : 'Rascunho'}
            </span>
          ) : null}
          <Link className="ghost-button" to="/catalog/products">Voltar</Link>
        </div>
      )}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}
      {gapText ? <div className="alert">Publicação bloqueada: faltam preços Stripe para {gapText}.</div> : null}

      <form className="stack" onSubmit={save}>
        <div className="editor-card">
          <div className="form-toolbar">
            <div className="form-grid">
              <label>
                País do plano
                <select value={planCountry} disabled={!canEdit} onChange={(event) => setPlanCountry(event.target.value)}>
                  {countryOptions.map((country) => (
                    <option key={country} value={country}>{country === 'US' ? 'US / USD' : 'BR / BRL'}</option>
                  ))}
                </select>
              </label>
              <label>
                Duração (dias)
                <input type="number" min={1} value={planDays} disabled={!canEdit} onChange={(event) => setPlanDays(event.target.value)} />
              </label>
            </div>
            {canWrite && data ? (
              <div className="inline-actions">
                <button className="primary-button" type="submit" disabled={!canEdit}>Salvar</button>
              </div>
            ) : null}
          </div>
          {planDirty ? <p className="muted">País e duração alterados. Salve antes de sair.</p> : null}
          {canWrite && data?.active ? (
            <p className="muted">Produto publicado. Volte para rascunho para editar país, duração, preços e variações.</p>
          ) : null}
        </div>

        <Section title="Publicação e sincronização" description={data ? `Slug ${data.slug}` : 'Carregando o produto.'}>
          {data ? (
            <div className="inline-actions">
              {canWrite ? (
                <button className="ghost-button" type="button" onClick={() => void togglePublish(!data.active)}>
                  {data.active ? 'Desativar' : 'Publicar'}
                </button>
              ) : null}
              {canWrite && data.canDelete === true ? (
                <button
                  className="danger-button"
                  type="button"
                  disabled={deletingKey === 'product'}
                  onClick={() => void deleteProduct()}
                >
                  {deletingKey === 'product' ? 'Excluindo…' : 'Excluir produto'}
                </button>
              ) : null}
              {canSync ? (
                <button className="primary-button" type="button" onClick={() => void sync()}>Sincronizar Stripe</button>
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section
          title="Variações"
          description={canEdit
            ? 'Edite uma variação por vez. O slug não muda depois de gravado. Stripe cobra; o nome na loja vem do sabor.'
            : 'Sabor, slug, mapeamento Stripe e status de sync. Edição só em rascunho; exclusão pode ser feita agora.'}
          actions={canEdit ? (
            <button className="ghost-button" type="button" onClick={() => openVariationDialog(emptyVariantDraft())}>
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
                  <th>Produto Stripe</th>
                  <th>Preço Stripe</th>
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
                ) : variants.map((item) => {
                  const label = item.name || item.sku || item.id || 'nova'
                  return (
                  <tr key={item.key}>
                    <td>{item.sku || '-'}</td>
                    <td>{item.name || '-'}</td>
                    <td>{item.flavor || '-'}</td>
                    <td>{item.flavorSlug || '-'}</td>
                    <td>{item.flavorAliases || '-'}</td>
                    <td>{formatCurrency(item.regularPrice === '' ? null : Number(item.regularPrice), currency)}</td>
                    <td>{item.stripeProductId ?? '-'}</td>
                    <td>{item.stripePriceId ?? '-'}</td>
                    <td className={item.requiresSync ? 'warning-text' : undefined}>
                      {syncStatusLabel(item.syncStatus, item.requiresSync)}
                    </td>
                    {canWrite ? (
                      <td>
                        <div className="table-actions">
                          {canEdit && item.id ? (
                            <button
                              className="ghost-button"
                              type="button"
                              aria-label={`Editar variação ${label}`}
                              onClick={() => openVariationDialog(item)}
                            >
                              Editar
                            </button>
                          ) : null}
                          {item.id && item.canDelete ? (
                            <button
                              className="danger-button"
                              type="button"
                              aria-label={`Excluir variação ${label}`}
                              disabled={deletingKey === item.key}
                              onClick={() => void deleteVariation(item)}
                            >
                              {deletingKey === item.key ? 'Excluindo…' : 'Excluir'}
                            </button>
                          ) : item.id ? (
                            <span className="muted">Variação em uso numa assinatura.</span>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      </form>

      <Dialog
        open={variationDialog != null}
        title={variationDialog?.draft.id ? 'Editar variação' : 'Nova variação'}
        description="SKU, nome, sabor e preço. O slug não muda depois de gravado."
        onClose={closeVariationDialog}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeVariationDialog} disabled={savingVariation}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void saveVariation()} disabled={savingVariation} aria-label="Salvar variação">
              {savingVariation ? 'Salvando…' : 'Salvar'}
            </button>
          </>
        )}
      >
        {variationDialog ? (
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); void saveVariation() }}>
            {dialogError ? <div className="alert">{dialogError}</div> : null}
            <label>
              SKU
              <input aria-label="SKU" value={variationDialog.draft.sku} onChange={(event) => updateDialogDraft({ sku: event.target.value })} placeholder="SKU" />
            </label>
            <label>
              Nome
              <input aria-label="Nome" value={variationDialog.draft.name} onChange={(event) => updateDialogDraft({ name: event.target.value })} placeholder="Nome" />
            </label>
            <label>
              Sabor
              <input aria-label="Sabor" value={variationDialog.draft.flavor} onChange={(event) => updateDialogDraft({ flavor: event.target.value })} placeholder="Ex.: Frango" />
            </label>
            <label>
              Slug do sabor
              <input
                aria-label="Slug do sabor"
                value={variationDialog.draft.flavorSlug}
                disabled={variationDialog.slugLocked}
                onChange={(event) => updateDialogDraft({ flavorSlug: event.target.value })}
                placeholder="turkey"
              />
            </label>
            <label>
              Aliases do sabor
              <input
                aria-label="Aliases do sabor"
                value={variationDialog.draft.flavorAliases}
                onChange={(event) => updateDialogDraft({ flavorAliases: event.target.value })}
                placeholder="chicken, frango"
              />
            </label>
            <label>
              Preço ({currency})
              <input
                aria-label="Preço"
                type="number"
                min={0}
                step="0.01"
                value={variationDialog.draft.regularPrice}
                onChange={(event) => updateDialogDraft({ regularPrice: event.target.value })}
                placeholder="0.00"
              />
            </label>
          </form>
        ) : null}
      </Dialog>
    </PageFrame>
  )
}
