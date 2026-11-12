import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { Drawer } from '../components/Drawer'
import { PageFrame } from '../components/PageFrame'
import { RecipeContentSections } from '../components/RecipeContentSections'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { GOODS_ORIGINS } from '../lib/nfe'
import { sessionMarkets } from '../lib/markets'
import {
  LABEL_STATUS_TEXT,
  LIFE_STAGE_LABELS,
  recipeContentFailure,
  recipeContentPath,
  recipeKeyFromName,
  recipePagePath,
  type LifeStage,
  type RecipeContent,
  type RecipeLabelStatus,
  type RecipeSectionAnchor,
} from '../lib/recipeContent'

type ProductVariant = {
  id: string
  sku: string
  name: string
  flavor: string | null
  flavorSlug: string | null
  flavorAliases: string | null
  lifeStage?: LifeStage
  shortLabel?: string | null
  ncm?: string | null
  origin?: number | null
  active?: boolean
  finalImageReady?: boolean
  labelDataReady?: boolean
  regularPrice: number | null
  stripeProductId: string | null
  stripePriceId: string | null
  syncStatus: string
  requiresSync: boolean
  canDelete?: boolean
  recipeKey?: string | null
  recipeImageUrl?: string | null
  recipeLabelStatus?: RecipeLabelStatus
  recipePresentationReady?: boolean
  weight?: string | null
}

type ProductDetail = {
  id: string
  slug: string
  namePt: string
  nameEn: string
  active: boolean
  planCountry: string | null
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
  lifeStage: LifeStage
  shortLabel: string
  ncm: string
  origin: string
  active: boolean
  finalImageReady: boolean
  labelDataReady: boolean
  regularPrice: string
  stripeProductId: string | null
  stripePriceId: string | null
  syncStatus: string
  requiresSync: boolean
  canDelete: boolean
  recipeKey: string | null
  recipeImageUrl: string | null
  recipeLabelStatus: RecipeLabelStatus
  // null while unknown, as for a variation not saved yet.
  recipePresentationReady: boolean | null
  weight: string
}

type VariationDialogState = {
  draft: VariantDraft
  slugLocked: boolean
  // A new variation's recipe follows its flavor slug until the operator edits the recipe field.
  recipeKeyTouched: boolean
}

type MarketRecipe = { key: string; name: string; lifeStage?: LifeStage; variations: Array<{ id: string }> }

// Recipe registered from the variation dialog; the key follows the name until it is edited.
type RecipeCreateForm = { name: string; key: string; keyTouched: boolean; lifeStage: LifeStage }

// Key a missing recipe would take: the recorded key when the market lost it, else the flavor slug,
// else the key of the flavor. Empty while a registered recipe is selected.
function recipeCandidate(draft: VariantDraft, recipes: MarketRecipe[]) {
  const registered = (key: string) => recipes.some((recipe) => recipe.key === key)
  if (draft.recipeKey) return registered(draft.recipeKey) ? '' : draft.recipeKey
  const key = draft.flavorSlug.trim() || recipeKeyFromName(draft.flavor)
  return registered(key) ? '' : key
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
    lifeStage: item.lifeStage ?? 'adult',
    shortLabel: item.shortLabel || '',
    ncm: item.ncm || '',
    origin: String(item.origin ?? 0),
    active: item.active === true,
    finalImageReady: item.finalImageReady === true,
    labelDataReady: item.labelDataReady === true,
    regularPrice: item.regularPrice == null ? '' : String(item.regularPrice),
    stripeProductId: item.stripeProductId,
    stripePriceId: item.stripePriceId,
    syncStatus: item.syncStatus,
    requiresSync: item.requiresSync,
    canDelete: item.canDelete === true,
    recipeKey: item.recipeKey ?? null,
    recipeImageUrl: item.recipeImageUrl ?? null,
    recipeLabelStatus: item.recipeLabelStatus ?? 'missing',
    recipePresentationReady: item.recipePresentationReady ?? null,
    weight: item.weight || '',
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
    lifeStage: 'adult',
    shortLabel: '',
    ncm: '',
    origin: '0',
    active: false,
    finalImageReady: false,
    labelDataReady: false,
    regularPrice: '',
    stripeProductId: null,
    stripePriceId: null,
    syncStatus: 'not_synced',
    requiresSync: true,
    canDelete: true,
    recipeKey: null,
    recipeImageUrl: null,
    recipeLabelStatus: 'missing',
    recipePresentationReady: null,
    weight: '',
  }
}

function syncStatusLabel(status: string) {
  const labels: Record<string, string> = {
    synced: 'Sincronizado',
    not_synced: 'Não sincronizado',
    price_mismatch: 'Preço divergente',
  }
  return labels[status] ?? status
}

type PendingItem = { text: string; section?: RecipeSectionAnchor }

// What an inactive variation still lacks before activation; mirrors the backend refusal list. Items solved
// in the recipe content carry the section that solves them.
function pendingItems(item: VariantDraft, planCountry: string) {
  const pending: PendingItem[] = []
  if (item.regularPrice === '') pending.push({ text: 'preço' })
  if (!item.stripePriceId) pending.push({ text: 'Stripe' })
  if (!item.finalImageReady && !item.recipeImageUrl) pending.push({ text: 'foto', section: 'imagem' })
  if (planCountry === 'US' && !item.labelDataReady && item.recipeLabelStatus !== 'complete') pending.push({ text: 'rótulo', section: 'rotulo' })
  if (item.recipePresentationReady === false) pending.push({ text: 'apresentação', section: 'apresentacao' })
  if (planCountry === 'BR' && !item.ncm.trim()) pending.push({ text: 'NCM' })
  return pending
}

const MISSING_LABELS: Record<string, string> = {
  price: 'preço',
  stripe_price: 'preço no Stripe',
  final_image: 'foto definitiva na loja',
  label_data: 'dados de rótulo no conteúdo da receita',
  presentation: 'apresentação na loja no conteúdo da receita',
  ncm: 'NCM da variação',
}

function variationFailure(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'recipe_not_registered') {
      return 'Esta receita não está mais cadastrada no mercado. Escolha outra ou cadastre em Receitas.'
    }
    if (error.code === 'recipe_publish_refused') {
      const missing = Array.isArray(error.details?.missing) ? error.details.missing as string[] : []
      const items = missing.map((item) => MISSING_LABELS[item] ?? item).join(', ')
      return `Ativação recusada. Falta: ${items}.`
    }
    if (error.code === 'variation_in_active_subscriptions') {
      const count = Number(error.details?.activeSubscriptions) || 0
      const subscriptions = count === 1 ? '1 assinatura ativa' : `${count} assinaturas ativas`
      return `Esta variação está em ${subscriptions} e não pode ser desativada.`
    }
    if (error.code === 'variation_active_locked') {
      return 'Variação ativa não pode ser editada com o produto publicado. Desative a variação antes.'
    }
  }
  return error instanceof Error ? error.message : fallback
}

function variantPayload(item: VariantDraft, planCountry: string) {
  return {
    ...(item.id ? { id: item.id } : {}),
    sku: item.sku,
    name: item.name,
    flavor: item.flavor.trim(),
    ...(item.flavorSlug.trim() ? { flavorSlug: item.flavorSlug.trim() } : {}),
    ...(item.flavorAliases.trim() ? { flavorAliases: item.flavorAliases.trim() } : {}),
    lifeStage: item.lifeStage,
    shortLabel: item.shortLabel.trim(),
    ...(planCountry === 'BR' ? { ncm: item.ncm.trim(), origin: Number(item.origin) } : {}),
    finalImageReady: item.finalImageReady,
    labelDataReady: item.labelDataReady,
    regularPrice: item.regularPrice === '' ? null : Number(item.regularPrice),
    recipeKey: item.recipeKey?.trim() || null,
  }
}

export function ProductDetailPage() {
  const { token, user, hasPermission } = useAuth()
  const { productId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [planCountry, setPlanCountry] = useState('BR')
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // Variation feedback renders inside the Variações card, next to the row that triggered it.
  const [variationNotice, setVariationNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [deletingKey, setDeletingKey] = useState('')
  const [variationDialog, setVariationDialog] = useState<VariationDialogState | null>(null)
  const [dialogError, setDialogError] = useState('')
  const [savingVariation, setSavingVariation] = useState(false)
  const [togglingKey, setTogglingKey] = useState('')
  const [recipeCreate, setRecipeCreate] = useState<RecipeCreateForm | null>(null)
  const [creatingRecipe, setCreatingRecipe] = useState(false)
  const [recipeNotice, setRecipeNotice] = useState('')
  // Recipe content side panel of a variation, opened on a section when a pending item asks for it.
  const [contentPanel, setContentPanel] = useState<{ recipeKey: string; section: RecipeSectionAnchor | null } | null>(null)
  const [panelContent, setPanelContent] = useState<RecipeContent | null>(null)
  const [panelError, setPanelError] = useState('')
  const panelDirty = useRef(false)
  const panelRequest = useRef(0)
  const panelScrolled = useRef('')

  const canWrite = hasPermission('catalog.write')
  const canSync = hasPermission('catalog.sync')
  const canEdit = Boolean(canWrite && data && !data.active)
  // A published product keeps active variations locked; inactive ones stay editable.
  const canAddVariation = Boolean(canWrite && data)
  const canEditVariation = (item: VariantDraft) => Boolean(canWrite && data && (!data.active || !item.active))
  const currency = planCountry === 'US' ? 'USD' : 'BRL'
  const countryOptions = sessionMarkets(user)
  const savedCountry = data?.planCountry || 'BR'
  // Plan days and the large-pack limit are market settings (Loja > Plano); the product keeps only its country.
  const planDirty = Boolean(canEdit && planCountry !== savedCountry)

  useEffect(() => {
    if (!planDirty) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [planDirty])

  const notifyVariation = (tone: 'success' | 'error', text: string) => {
    setMessage('')
    setError('')
    setVariationNotice({ tone, text })
  }

  const [marketRecipes, setMarketRecipes] = useState<MarketRecipe[]>([])

  // Recipe keys already used in the market, offered in the variation dialog; the field works without them.
  const loadMarketRecipes = async (market: string | null): Promise<MarketRecipe[]> => {
    if (!token || !market) return []
    try {
      const response = await apiRequest<{ items: MarketRecipe[] }>(
        `/admin/catalog/recipe-content?market=${encodeURIComponent(market)}`,
        { token },
      )
      setMarketRecipes(response.items)
      return response.items
    } catch {
      setMarketRecipes([])
      return []
    }
  }

  useEffect(() => {
    if (canWrite) void loadMarketRecipes(data?.planCountry ?? null)
  }, [token, canWrite, data?.planCountry])

  // keepPlanFields leaves typed and unsaved plan fields on screen, for a reload that did not save them.
  const applyProduct = (product: ProductDetail, { keepPlanFields = false }: { keepPlanFields?: boolean } = {}) => {
    setData(product)
    if (!keepPlanFields) {
      setPlanCountry(product.planCountry || 'BR')
    }
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

  // After the side panel saves recipe content: badges, life stage and pending items follow, the plan fields
  // typed and not saved stay.
  const refreshProduct = async () => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, { token })
      applyProduct(response, { keepPlanFields: planDirty })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar produto')
    }
  }

  // The panel always works on the market saved on the product, never on an unsaved plan country.
  const openContentPanel = (recipeKey: string, section: RecipeSectionAnchor | null = null) => {
    if (!token) return
    const request = ++panelRequest.current
    panelDirty.current = false
    panelScrolled.current = ''
    setPanelContent(null)
    setPanelError('')
    setContentPanel({ recipeKey, section })
    apiRequest<RecipeContent>(recipeContentPath(recipeKey, savedCountry), { token })
      .then((content) => { if (panelRequest.current === request) setPanelContent(content) })
      .catch((requestError) => {
        if (panelRequest.current === request) setPanelError(recipeContentFailure(requestError, 'Falha ao carregar o conteúdo da receita.'))
      })
  }

  const closeContentPanel = () => {
    if (panelDirty.current && !window.confirm('Descartar as alterações não salvas do conteúdo da receita?')) return
    panelRequest.current += 1
    panelDirty.current = false
    setContentPanel(null)
    setPanelContent(null)
    setPanelError('')
    void refreshProduct()
  }

  const onPanelDirty = useCallback((dirty: boolean) => {
    panelDirty.current = dirty
  }, [])

  const onPanelSaved = (content: RecipeContent) => {
    setPanelContent(content)
    void refreshProduct()
  }

  // The life stage of the dialog comes from the market recipes, so they reload with the product.
  const onPanelLifeStageSaved = (content: RecipeContent) => {
    onPanelSaved(content)
    void loadMarketRecipes(savedCountry)
  }

  useEffect(() => {
    const section = contentPanel?.section
    if (!panelContent || !section || panelScrolled.current === section) return
    panelScrolled.current = section
    document.getElementById(section)?.scrollIntoView?.({ block: 'start' })
  }, [panelContent, contentPanel])

  const planPayload = () => ({ planCountry })

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !productId || !canEdit) return
    const payload = planPayload()
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: payload,
      })
      applyProduct(response)
      setError('')
      setVariationNotice(null)
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
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: active ? { ...body, active: true } : body,
      })
      applyProduct(response)
      setError('')
      setVariationNotice(null)
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
      setVariationNotice(null)
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
    setRecipeCreate(null)
    setRecipeNotice('')
    setVariationDialog({
      draft,
      slugLocked: Boolean(draft.id && draft.flavorSlug),
      recipeKeyTouched: Boolean(draft.id),
    })
  }

  // ?variation=<id> (from a recipe page) scrolls to that variation, highlights it and opens it when editable.
  const [searchParams] = useSearchParams()
  const focusVariationId = searchParams.get('variation')
  const focusedVariation = useRef<string | null>(null)
  useEffect(() => {
    if (!data || !focusVariationId || focusedVariation.current === focusVariationId) return
    const item = variants.find((row) => row.id === focusVariationId)
    if (!item) return
    focusedVariation.current = focusVariationId
    document.getElementById(`variation-${focusVariationId}`)?.scrollIntoView?.({ block: 'center' })
    if (canEditVariation(item)) openVariationDialog(item)
  }, [data, variants, focusVariationId])

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
      const recipeKeyTouched = current.recipeKeyTouched || patch.recipeKey !== undefined
      // A new variation starts on the registered recipe of its suggested slug, or on no recipe.
      if (!recipeKeyTouched && (patch.flavor != null || patch.flavorSlug != null)) {
        const sibling = variants.find((row) => row.key !== current.draft.key && row.flavorSlug && row.flavorSlug === next.flavorSlug)
        const suggested = sibling?.recipeKey || next.flavorSlug.trim()
        next.recipeKey = marketRecipes.some((recipe) => recipe.key === suggested) ? suggested : null
      }
      // A variation linked to a recipe follows the recipe's life stage.
      const linked = marketRecipes.find((recipe) => recipe.key === next.recipeKey)
      if (linked?.lifeStage) next.lifeStage = linked.lifeStage
      return { ...current, draft: next, recipeKeyTouched }
    })
  }

  const openRecipeCreate = (draft: VariantDraft, key: string) => {
    setRecipeNotice('')
    setRecipeCreate({
      name: draft.flavor.trim() || draft.name.trim(),
      key,
      // A recorded key is kept as is; a suggested one follows the name.
      keyTouched: Boolean(draft.recipeKey),
      lifeStage: draft.lifeStage,
    })
  }

  const selectRecipe = (recipe: MarketRecipe, notice: string) => {
    // The list update lands after this patch, so the life stage of the recipe goes in the patch itself.
    updateDialogDraft({ recipeKey: recipe.key, ...(recipe.lifeStage ? { lifeStage: recipe.lifeStage } : {}) })
    setRecipeCreate(null)
    setDialogError('')
    setRecipeNotice(notice)
  }

  // Registers the recipe in the market saved on the product, never in an unsaved plan country.
  const createRecipe = async () => {
    const market = data?.planCountry
    if (!token || !market || !recipeCreate || creatingRecipe) return
    const key = recipeCreate.key.trim()
    try {
      setCreatingRecipe(true)
      const created = await apiRequest<RecipeContent>(`/admin/catalog/recipe-content?market=${encodeURIComponent(market)}`, {
        token,
        method: 'POST',
        body: { key, name: recipeCreate.name.trim(), lifeStage: recipeCreate.lifeStage },
      })
      const recipe: MarketRecipe = { key: created.flavorSlug, name: created.name, lifeStage: created.lifeStage, variations: [] }
      setMarketRecipes((current) => [...current.filter((item) => item.key !== recipe.key), recipe])
      selectRecipe(recipe, 'Receita cadastrada. Salve a variação para vincular. Imagem, rótulo e apresentação ficam em Conteúdo, na tabela de variações.')
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.code === 'recipe_key_taken') {
        const existing = (await loadMarketRecipes(market)).find((item) => item.key === key)
        if (existing) {
          selectRecipe(existing, 'A receita já existia e foi selecionada. Salve a variação para vincular.')
          return
        }
      }
      setRecipeNotice('')
      setDialogError(recipeContentFailure(requestError, 'Falha ao cadastrar a receita.'))
    } finally {
      setCreatingRecipe(false)
    }
  }

  const closeVariationDialog = () => {
    if (savingVariation || creatingRecipe) return
    // A recipe registered in the dialog stays in the market even when the variation is not saved.
    setVariationDialog(null)
    setRecipeCreate(null)
    setRecipeNotice('')
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
        body: { variants: [variantPayload(draft, planCountry)] },
      })
      applyProduct(response)
      setVariationDialog(null)
      setDialogError('')
      notifyVariation('success', draft.id ? 'Variação atualizada.' : 'Variação adicionada.')
      void loadMarketRecipes(response.planCountry)
    } catch (requestError) {
      setDialogError(variationFailure(requestError, 'Falha ao salvar variação'))
    } finally {
      setSavingVariation(false)
    }
  }

  const toggleVariation = async (item: VariantDraft) => {
    if (!token || !productId || !canWrite || !item.id) return
    const label = item.name.trim() || item.sku.trim() || item.id
    const active = !item.active
    try {
      setTogglingKey(item.key)
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}/variations/${item.id}/activation`, {
        token,
        method: 'POST',
        body: { active },
      })
      applyProduct(response)
      notifyVariation('success', active ? `Variação "${label}" ativada.` : `Variação "${label}" desativada.`)
    } catch (requestError) {
      notifyVariation('error', variationFailure(requestError, active ? 'Falha ao ativar variação' : 'Falha ao desativar variação'))
    } finally {
      setTogglingKey('')
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
      notifyVariation('success', `Variação "${label}" excluída.`)
    } catch (requestError) {
      const failure = catalogDeleteFailure(requestError, 'Falha ao excluir variação')
      notifyVariation('error', failure.message)
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

  const activeCount = variants.filter((item) => item.active).length
  const pendingSyncCount = variants.filter((item) => item.requiresSync).length
  const draft = variationDialog?.draft ?? null
  const linkedRecipe = draft?.recipeKey ? marketRecipes.find((recipe) => recipe.key === draft.recipeKey) ?? null : null
  const recipeKeyCandidate = draft && canWrite && data?.planCountry ? recipeCandidate(draft, marketRecipes) : ''
  // Enter in the recipe fields registers the recipe instead of submitting the variation form.
  const createOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    void createRecipe()
  }

  return (
    <PageFrame
      eyebrow="Catálogo · Produto"
      title={data?.namePt ?? 'Produto'}
      description={data ? `${data.nameEn} · slug ${data.slug}` : 'Carregando o produto.'}
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

      <form className="stack product-detail" onSubmit={save}>
        <Section
          title="Publicação e sincronização"
          description={data?.active
            ? 'O produto está na loja. Desativar tira da loja e mantém o cadastro.'
            : 'Rascunho: não aparece na loja. Publique quando as variações estiverem prontas.'}
          actions={data && (canWrite || canSync) ? (
            <div className="inline-actions">
              {canSync ? (
                <button className="ghost-button" type="button" onClick={() => void sync()}>Sincronizar Stripe</button>
              ) : null}
              {canWrite ? (
                <button
                  className={data.active ? 'ghost-button' : 'primary-button'}
                  type="button"
                  onClick={() => void togglePublish(!data.active)}
                >
                  {data.active ? 'Desativar' : 'Publicar'}
                </button>
              ) : null}
            </div>
          ) : null}
        >
          {data ? (
            <dl className="meta-grid">
              <div className="meta-item">
                <dt>Variações ativas</dt>
                <dd>{activeCount} de {variants.length}</dd>
              </div>
              <div className="meta-item">
                <dt>Pendentes no Stripe</dt>
                <dd className={pendingSyncCount ? 'warning-text' : undefined}>
                  {pendingSyncCount === 0 ? 'Nenhuma' : pendingSyncCount === 1 ? '1 variação' : `${pendingSyncCount} variações`}
                </dd>
              </div>
              <div className="meta-item">
                <dt>Moeda</dt>
                <dd>{currency}</dd>
              </div>
            </dl>
          ) : null}
        </Section>

        <Section
          title="Plano"
          description={data?.active
            ? 'O país só muda em rascunho.'
            : 'País da assinatura deste produto.'}
        >
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
            </div>
            {canWrite && data ? (
              <div className="inline-actions">
                <button className="primary-button" type="submit" disabled={!canEdit}>Salvar</button>
              </div>
            ) : null}
          </div>
          <p className="field-hint">
            Duração do plano e limite do pacote pequeno valem para o mercado inteiro: <Link className="link-button" to={`/catalog/plan?market=${encodeURIComponent(savedCountry)}`}>Loja › Plano</Link>.
          </p>
          {planDirty ? <p className="field-hint warning-text">País alterado. Salve antes de sair.</p> : null}
        </Section>

        <Section
          title="Variações"
          description={canWrite && data?.active
            ? 'Produto publicado. Variações inativas podem ser adicionadas e editadas; ative cada uma quando estiver pronta. Para editar uma variação ativa, desative-a antes.'
            : 'Variação nova entra inativa. Ative cada uma depois das confirmações. O slug do sabor não muda depois de gravado.'}
          actions={canAddVariation ? (
            <button className="primary-button" type="button" onClick={() => openVariationDialog(emptyVariantDraft())}>
              Adicionar variação
            </button>
          ) : null}
        >
          {variationNotice ? (
            <div className={variationNotice.tone === 'error' ? 'alert' : 'success'} role={variationNotice.tone === 'error' ? 'alert' : 'status'}>
              {variationNotice.text}
            </div>
          ) : null}
          <div className="table-shell table-scroll variation-table">
            <table>
              <thead>
                <tr>
                  <th>Variação</th>
                  <th>Sabor</th>
                  <th>Linha</th>
                  <th className="numeric">Preço ({currency})</th>
                  <th>Stripe</th>
                  <th>Conteúdo</th>
                  <th>Situação</th>
                  {canWrite ? <th><span className="sr-only">Ações</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={canWrite ? 8 : 7} className="muted">
                      {canAddVariation
                        ? 'Nenhuma variação. Use Adicionar variação para criar SKU, nome e preço.'
                        : 'Nenhuma variação cadastrada.'}
                    </td>
                  </tr>
                ) : variants.map((item) => {
                  const label = item.name || item.sku || item.id || 'nova'
                  const editable = canEditVariation(item)
                  const pending = item.active ? [] : pendingItems(item, planCountry)
                  const recipeKey = item.recipeKey
                  return (
                    <tr
                      key={item.key}
                      id={item.id ? `variation-${item.id}` : undefined}
                      className={item.id && item.id === focusVariationId ? 'row-focused' : undefined}
                    >
                      <td>
                        <div className="cell-stack">
                          <strong>{item.name || 'Sem nome'}</strong>
                          <span className="cell-meta mono">{item.sku || 'Sem SKU'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span>{item.flavor || '-'}</span>
                          {item.flavorSlug || item.flavorAliases ? (
                            <span className="cell-meta">
                              {[item.flavorSlug, item.flavorAliases].filter(Boolean).join(' · ')}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>{LIFE_STAGE_LABELS[item.lifeStage]}</td>
                      <td className="numeric">{formatCurrency(item.regularPrice === '' ? null : Number(item.regularPrice), currency)}</td>
                      <td>
                        <div className="cell-stack">
                          <span className={item.syncStatus === 'synced' && !item.requiresSync ? 'badge-success' : 'badge-warning'}>
                            {syncStatusLabel(item.syncStatus)}
                          </span>
                          {item.requiresSync ? <span className="cell-meta warning-text">Precisa sincronizar</span> : null}
                          {item.stripePriceId ? (
                            <span className="cell-meta mono" title={[item.stripeProductId, item.stripePriceId].filter(Boolean).join(' · ')}>
                              {item.stripePriceId}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {item.recipeKey ? (
                          <div className="cell-stack">
                            <span className="cell-meta mono" title="Receita (conteúdo)">{item.recipeKey}</span>
                            <span className={item.recipeImageUrl ? 'badge-success' : 'badge-neutral'}>
                              {item.recipeImageUrl ? 'Imagem cadastrada' : 'Sem imagem'}
                            </span>
                            <span className={item.recipeLabelStatus === 'complete' ? 'badge-success' : item.recipeLabelStatus === 'incomplete' ? 'badge-warning' : 'badge-neutral'}>
                              {LABEL_STATUS_TEXT[item.recipeLabelStatus]}
                            </span>
                            {item.id && recipeKey ? (
                              <button
                                className="link-button"
                                type="button"
                                aria-label={`Conteúdo da receita de ${label}`}
                                onClick={() => openContentPanel(recipeKey)}
                              >
                                Conteúdo
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="cell-meta">Sem receita vinculada</span>
                        )}
                      </td>
                      <td>
                        <div className="cell-stack">
                          <span className={item.active ? 'badge-success' : 'badge-neutral'}>{item.active ? 'Ativa' : 'Inativa'}</span>
                          {pending.length ? (
                            <span className="cell-meta">
                              Pendente:{' '}
                              {pending.map((entry, index) => {
                                const section = entry.section
                                return (
                                  <Fragment key={entry.text}>
                                    {index ? ', ' : ''}
                                    {section && item.id && recipeKey ? (
                                      <button
                                        className="link-button inline-link-button"
                                        type="button"
                                        aria-label={`Abrir ${entry.text} de ${label}`}
                                        onClick={() => openContentPanel(recipeKey, section)}
                                      >
                                        {entry.text}
                                      </button>
                                    ) : entry.text}
                                  </Fragment>
                                )
                              })}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {canWrite ? (
                        <td>
                          <div className="cell-stack cell-actions">
                            {item.id ? (
                              <div className="table-actions">
                                <button
                                  className="ghost-button"
                                  type="button"
                                  aria-label={`Editar variação ${label}`}
                                  disabled={!editable}
                                  title={editable ? undefined : 'Desative a variação para editar.'}
                                  onClick={() => openVariationDialog(item)}
                                >
                                  Editar
                                </button>
                                <button
                                  className="ghost-button"
                                  type="button"
                                  aria-label={`${item.active ? 'Desativar' : 'Ativar'} variação ${label}`}
                                  disabled={togglingKey === item.key}
                                  onClick={() => void toggleVariation(item)}
                                >
                                  {item.active ? 'Desativar' : 'Ativar'}
                                </button>
                                {item.canDelete ? (
                                  <button
                                    className="danger-button"
                                    type="button"
                                    aria-label={`Excluir variação ${label}`}
                                    disabled={deletingKey === item.key}
                                    onClick={() => void deleteVariation(item)}
                                  >
                                    {deletingKey === item.key ? 'Excluindo…' : 'Excluir'}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                            {item.id && !editable ? <span className="cell-meta">Ativa e publicada: desative para editar.</span> : null}
                            {item.id && !item.canDelete ? <span className="cell-meta">Variação em uso numa assinatura.</span> : null}
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

        {canWrite && data?.canDelete === true ? (
          <Section title="Excluir produto" description="Remove o produto e as variações do cadastro local. Não pode ser desfeito.">
            <div className="inline-actions">
              <button
                className="danger-button"
                type="button"
                disabled={deletingKey === 'product'}
                onClick={() => void deleteProduct()}
              >
                {deletingKey === 'product' ? 'Excluindo…' : 'Excluir produto'}
              </button>
            </div>
          </Section>
        ) : null}
      </form>

      <Dialog
        open={draft != null}
        title={draft?.id ? 'Editar variação' : 'Nova variação'}
        description={draft?.id ? (draft.name || draft.sku) : 'Entra inativa. Ative depois das confirmações.'}
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
        {variationDialog && draft ? (
          <form className="access-form" onSubmit={(event) => { event.preventDefault(); void saveVariation() }}>
            {dialogError ? <div className="alert">{dialogError}</div> : null}
            <fieldset className="access-group">
              <legend>Identificação</legend>
              <div className="access-fields">
                <label>
                  SKU
                  <input aria-label="SKU" value={draft.sku} onChange={(event) => updateDialogDraft({ sku: event.target.value })} placeholder="BOWL-FRANGO-1KG" />
                </label>
                <label>
                  Preço ({currency})
                  <input
                    aria-label="Preço"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.regularPrice}
                    onChange={(event) => updateDialogDraft({ regularPrice: event.target.value })}
                    placeholder="0.00"
                  />
                </label>
                <label className="access-field-wide">
                  Nome
                  <input aria-label="Nome" value={draft.name} onChange={(event) => updateDialogDraft({ name: event.target.value })} placeholder="Frango 1kg" />
                </label>
                <label className="access-field-wide">
                  Nome curto <span className="access-optional">fila de produção</span>
                  <input
                    aria-label="Nome curto"
                    value={draft.shortLabel}
                    maxLength={64}
                    onChange={(event) => updateDialogDraft({ shortLabel: event.target.value })}
                    placeholder="Ex.: Bovino · Sênior"
                  />
                </label>
              </div>
            </fieldset>

            {planCountry === 'BR' ? (
              <fieldset className="access-group">
                <legend>Dados fiscais</legend>
                <div className="access-fields">
                  <label>
                    NCM <span className="access-optional">8 dígitos, definido pelo contador</span>
                    <input aria-label="NCM" value={draft.ncm} maxLength={10} inputMode="numeric" onChange={(event) => updateDialogDraft({ ncm: event.target.value })} placeholder="0000.00.00" />
                  </label>
                  <label>
                    Origem da mercadoria
                    <select aria-label="Origem da mercadoria" value={draft.origin} onChange={(event) => updateDialogDraft({ origin: event.target.value })}>
                      {GOODS_ORIGINS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </fieldset>
            ) : null}

            <fieldset className="access-group">
              <legend>Sabor e linha</legend>
              <div className="access-fields">
                <label>
                  Sabor
                  <input aria-label="Sabor" value={draft.flavor} onChange={(event) => updateDialogDraft({ flavor: event.target.value })} placeholder="Ex.: Frango" />
                </label>
                <label>
                  Linha
                  <select
                    aria-label="Linha"
                    aria-describedby={linkedRecipe?.lifeStage ? 'life-stage-hint' : undefined}
                    value={linkedRecipe?.lifeStage ?? draft.lifeStage}
                    disabled={Boolean(linkedRecipe?.lifeStage)}
                    onChange={(event) => updateDialogDraft({ lifeStage: event.target.value as LifeStage })}
                  >
                    {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
                      <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
                    ))}
                  </select>
                  {linkedRecipe?.lifeStage ? (
                    <span id="life-stage-hint" className="access-hint">
                      Vem da receita {linkedRecipe.name}.{' '}
                      <button
                        className="link-button inline-link-button"
                        type="button"
                        disabled={savingVariation || creatingRecipe}
                        onClick={() => {
                          const key = linkedRecipe.key
                          closeVariationDialog()
                          openContentPanel(key, 'fase')
                        }}
                      >
                        Editar fase
                      </button>
                    </span>
                  ) : null}
                </label>
                <label>
                  Slug do sabor
                  <input
                    aria-label="Slug do sabor"
                    value={draft.flavorSlug}
                    disabled={variationDialog.slugLocked}
                    onChange={(event) => updateDialogDraft({ flavorSlug: event.target.value })}
                    placeholder="turkey"
                  />
                  {variationDialog.slugLocked ? <span className="access-hint">Gravado. Não muda mais.</span> : null}
                </label>
                <label>
                  Aliases do sabor <span className="access-optional">opcional</span>
                  <input
                    aria-label="Aliases do sabor"
                    value={draft.flavorAliases}
                    onChange={(event) => updateDialogDraft({ flavorAliases: event.target.value })}
                    placeholder="chicken, frango"
                  />
                </label>
                <label className="access-field-wide">
                  Receita (conteúdo) <span className="access-optional">imagem e rótulo</span>
                  <select
                    aria-label="Receita (conteúdo)"
                    aria-describedby="recipe-key-hint"
                    value={draft.recipeKey ?? ''}
                    onChange={(event) => updateDialogDraft({ recipeKey: event.target.value || null })}
                  >
                    <option value="">Sem receita</option>
                    {draft.recipeKey && !marketRecipes.some((recipe) => recipe.key === draft.recipeKey) ? (
                      <option value={draft.recipeKey}>{draft.recipeKey}</option>
                    ) : null}
                    {marketRecipes.map((recipe) => (
                      <option key={recipe.key} value={recipe.key}>{recipe.name} · {recipe.key}</option>
                    ))}
                  </select>
                  <span id="recipe-key-hint" className="access-hint">
                    Variações do mercado com a mesma receita usam a mesma imagem e o mesmo rótulo.
                  </span>
                </label>
                {recipeNotice ? (
                  <p className="access-field-wide success" role="status">{recipeNotice}</p>
                ) : null}
                {recipeKeyCandidate && !recipeCreate ? (
                  <div className="access-field-wide">
                    <button className="link-button" type="button" onClick={() => openRecipeCreate(draft, recipeKeyCandidate)}>
                      Criar receita {recipeKeyCandidate}
                    </button>
                  </div>
                ) : null}
                {recipeCreate ? (
                  <div className="access-field-wide recipe-create" role="group" aria-label="Nova receita">
                    <p className="access-hint">
                      A receita é cadastrada agora no mercado {data?.planCountry} e continua em Receitas mesmo que você não salve a variação.
                    </p>
                    <div className="access-fields">
                      <label className="access-field-wide">
                        Nome da receita
                        <input
                          aria-label="Nome da receita"
                          value={recipeCreate.name}
                          maxLength={120}
                          onKeyDown={createOnEnter}
                          onChange={(event) => {
                            const name = event.target.value
                            setRecipeCreate((current) => current && ({ ...current, name, key: current.keyTouched ? current.key : recipeKeyFromName(name) }))
                          }}
                        />
                      </label>
                      <label>
                        Chave da receita
                        <input
                          className="mono"
                          aria-label="Chave da receita"
                          aria-describedby="recipe-create-key-hint"
                          value={recipeCreate.key}
                          maxLength={64}
                          onKeyDown={createOnEnter}
                          onChange={(event) => {
                            const key = event.target.value
                            setRecipeCreate((current) => current && ({ ...current, key, keyTouched: true }))
                          }}
                        />
                        <span id="recipe-create-key-hint" className="access-hint">Letras minúsculas, números e hífens. Não muda depois de cadastrada.</span>
                      </label>
                      <label>
                        Fase da receita
                        <select
                          aria-label="Fase da receita"
                          value={recipeCreate.lifeStage}
                          onChange={(event) => {
                            const lifeStage = event.target.value as LifeStage
                            setRecipeCreate((current) => current && ({ ...current, lifeStage }))
                          }}
                        >
                          {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
                            <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="inline-actions">
                      <button className="primary-button" type="button" disabled={creatingRecipe} onClick={() => void createRecipe()}>
                        {creatingRecipe ? 'Cadastrando…' : 'Cadastrar e vincular'}
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        aria-label="Cancelar nova receita"
                        disabled={creatingRecipe}
                        onClick={() => setRecipeCreate(null)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </fieldset>

            <fieldset className="access-group">
              <legend>Confirmações para ativar</legend>
              {draft.recipeImageUrl ? (
                <p className="access-hint">Imagem cadastrada em Conteúdo da receita. Não precisa de confirmação.</p>
              ) : (
                <div className="readiness-item">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      aria-describedby="final-image-hint"
                      checked={draft.finalImageReady}
                      onChange={(event) => updateDialogDraft({ finalImageReady: event.target.checked })}
                    />
                    Foto definitiva já está na loja
                  </label>
                  <p id="final-image-hint" className="access-hint">
                    Só para imagem no código da loja. Marque depois que a foto final do design substituir a provisória. Ou cadastre a imagem em Conteúdo da receita, que dispensa esta confirmação.
                  </p>
                </div>
              )}
              {draft.recipeLabelStatus === 'complete' ? (
                <p className="access-hint">Rótulo completo cadastrado em Conteúdo da receita. Não precisa de confirmação.</p>
              ) : (
                <div className="readiness-item">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      aria-describedby="label-data-hint"
                      checked={draft.labelDataReady}
                      onChange={(event) => updateDialogDraft({ labelDataReady: event.target.checked })}
                    />
                    Dados de rótulo já estão na página da receita
                  </label>
                  <p id="label-data-hint" className="access-hint">
                    Só para rótulo no código da loja: ingredientes, níveis de garantia, kcal e avisos.{' '}
                    {planCountry === 'US' ? 'Obrigatório para ativar nos EUA.' : 'Opcional no Brasil; obrigatório para ativar nos EUA.'}
                    {' '}Um rótulo completo em Conteúdo da receita dispensa esta confirmação.
                  </p>
                </div>
              )}
            </fieldset>
          </form>
        ) : null}
      </Dialog>

      <Drawer
        open={contentPanel != null}
        title={panelContent ? `Conteúdo da receita ${panelContent.name}` : 'Conteúdo da receita'}
        description={contentPanel ? `Receita ${contentPanel.recipeKey} · mercado ${savedCountry}` : undefined}
        onRequestClose={closeContentPanel}
        notice={panelContent && contentPanel ? (
          <div className="warning drawer-shared" role="note">
            <p>
              Este conteúdo vale para {panelContent.variations.length === 1 ? '1 variação' : `${panelContent.variations.length} variações`} do
              mercado {savedCountry} com a receita {contentPanel.recipeKey}
              {panelContent.variations.some((variation) => variation.productId !== data?.id) ? ', inclusive de outros produtos' : ''}.
              {' '}Mudar a fase muda a linha de todas.
            </p>
            {panelContent.variations.length ? (
              <ul className="drawer-shared-list">
                {panelContent.variations.map((variation) => (
                  <li key={variation.id}>
                    {variation.name || variation.sku}
                    <span className="cell-meta">
                      {' · '}{variation.productName || 'Produto'}{variation.productId === data?.id ? ' (este produto)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <Link className="link-button" to={recipePagePath(savedCountry, contentPanel.recipeKey)}>Abrir página da receita</Link>
          </div>
        ) : null}
      >
        {panelError ? <div className="alert" role="alert">{panelError}</div> : null}
        {panelContent && contentPanel ? (
          <div className="stack">
            <RecipeContentSections
              key={contentPanel.recipeKey}
              token={token}
              market={savedCountry}
              recipeKey={contentPanel.recipeKey}
              content={panelContent}
              canWrite={canWrite}
              onSaved={onPanelSaved}
              onLifeStageSaved={onPanelLifeStageSaved}
              onDirtyChange={onPanelDirty}
            />
          </div>
        ) : !panelError ? <p className="muted">Carregando o conteúdo da receita.</p> : null}
      </Drawer>
    </PageFrame>
  )
}
