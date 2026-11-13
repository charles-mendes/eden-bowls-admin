import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { PageFrame } from '../components/PageFrame'
import { ProductReadiness, productReadinessSteps, type ReadinessTarget } from '../components/ProductReadiness'
import { RecipeContentSections, type ContentSection } from '../components/RecipeContentSections'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { ApiRequestError, apiRequest } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { GOODS_ORIGINS } from '../lib/nfe'
import {
  LIFE_STAGE_LABELS,
  RECIPE_SECTION_ANCHORS,
  type LifeStage,
  type RecipeContent,
  type RecipeLabel,
  type RecipeLabelStatus,
  type RecipePresentation,
  type RecipeSectionAnchor,
} from '../lib/recipeContent'

type ProductVariant = {
  id: string
  sku: string
  name: string
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
  recipeImageUrl?: string | null
  recipeLabelStatus?: RecipeLabelStatus
  recipePresentationReady?: boolean
  weight?: string | null
}

// The product's recipe content as the product detail carries it (product-is-recipe).
type ProductContent = {
  code: string
  name: string
  lifeStage: LifeStage
  flavorAliases: string
  shortLabel: string
  imageUrl: string | null
  imageUpdatedAt?: string | null
  planImageUrl: string | null
  planImageUpdatedAt?: string | null
  labelStatus: RecipeLabelStatus
  labelMissing: string[]
  presentationReady: boolean
  label?: Partial<RecipeLabel> | null
  labelUpdatedAt?: string | null
  presentation?: RecipePresentation | null
  presentationUpdatedAt?: string | null
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
  content?: ProductContent | null
}

type VariantDraft = {
  key: string
  id: string | null
  sku: string
  name: string
  weight: string
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
  recipeImageUrl: string | null
  recipeLabelStatus: RecipeLabelStatus
  // null while unknown, as for a variation not saved yet.
  recipePresentationReady: boolean | null
}

type GeneralForm = { name: string; flavorAliases: string; shortLabel: string; lifeStage: LifeStage }

type TabId = 'geral' | 'apresentacao' | 'imagens' | 'rotulo' | 'variacoes'

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'geral', label: 'Dados gerais' },
  { id: 'apresentacao', label: 'Apresentação' },
  { id: 'imagens', label: 'Imagens' },
  { id: 'rotulo', label: 'Rótulo' },
  { id: 'variacoes', label: 'Variações' },
]

// Content sections each tab holds; Dados gerais and Variações have none.
const TAB_SECTIONS: Partial<Record<TabId, ContentSection[]>> = {
  apresentacao: ['presentation'],
  imagens: ['image', 'planImage'],
  rotulo: ['label'],
}

// Tab that holds each section anchor (operations/catalog-recipe-content).
const ANCHOR_TAB: Record<RecipeSectionAnchor, TabId> = {
  fase: 'geral',
  apresentacao: 'apresentacao',
  imagem: 'imagens',
  miniatura: 'imagens',
  rotulo: 'rotulo',
}

function anchorOf(hash: string): RecipeSectionAnchor | null {
  const value = decodeURIComponent(hash.replace(/^#/, ''))
  return (RECIPE_SECTION_ANCHORS as readonly string[]).includes(value) ? value as RecipeSectionAnchor : null
}

const DISCARD_CONFIRM = 'Descartar as alterações não salvas do conteúdo?'

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

function toVariantDraft(item: ProductVariant): VariantDraft {
  return {
    key: item.id,
    id: item.id,
    sku: item.sku || '',
    name: item.name || '',
    weight: item.weight || '',
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
    recipeImageUrl: item.recipeImageUrl ?? null,
    recipeLabelStatus: item.recipeLabelStatus ?? 'missing',
    recipePresentationReady: item.recipePresentationReady ?? null,
  }
}

function emptyVariantDraft(): VariantDraft {
  newVariantSeq += 1
  return {
    key: `new-${newVariantSeq}`,
    id: null,
    sku: '',
    name: '',
    weight: '',
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
    recipeImageUrl: null,
    recipeLabelStatus: 'missing',
    recipePresentationReady: null,
  }
}

function generalFormOf(product: ProductDetail): GeneralForm {
  return {
    name: product.content?.name ?? product.namePt,
    flavorAliases: product.content?.flavorAliases ?? '',
    shortLabel: product.content?.shortLabel ?? '',
    lifeStage: product.content?.lifeStage ?? 'adult',
  }
}

// The content of the product in the shape of the content routes, for the content sections.
function sectionContent(product: ProductDetail): RecipeContent | null {
  const content = product.content
  if (!content) return null
  return {
    productId: product.id,
    market: product.planCountry || 'BR',
    flavorSlug: content.code,
    name: content.name,
    lifeStage: content.lifeStage,
    flavorAliases: content.flavorAliases,
    shortLabel: content.shortLabel,
    imageUrl: content.imageUrl,
    imageUpdatedAt: content.imageUpdatedAt ?? null,
    planImageUrl: content.planImageUrl,
    planImageUpdatedAt: content.planImageUpdatedAt ?? null,
    label: content.label ?? null,
    labelUpdatedAt: content.labelUpdatedAt ?? null,
    labelStatus: content.labelStatus,
    labelMissing: content.labelMissing,
    presentation: content.presentation ?? null,
    presentationUpdatedAt: content.presentationUpdatedAt ?? null,
  }
}

// What a content route answered, folded into the product content until the product reloads.
function withSavedContent(content: ProductContent, saved: RecipeContent): ProductContent {
  return {
    ...content,
    imageUrl: saved.imageUrl,
    imageUpdatedAt: saved.imageUpdatedAt,
    planImageUrl: saved.planImageUrl ?? null,
    planImageUpdatedAt: saved.planImageUpdatedAt ?? null,
    label: saved.label,
    labelUpdatedAt: saved.labelUpdatedAt,
    labelStatus: saved.labelStatus,
    labelMissing: saved.labelMissing,
    presentation: saved.presentation ?? null,
    presentationUpdatedAt: saved.presentationUpdatedAt ?? null,
    presentationReady: Boolean(saved.presentation),
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

// "300g" reads "300 g", "10.6oz" reads "10.6 oz".
function weightText(weight: string) {
  const match = /^(\d+(?:[.,]\d+)?)\s*([a-z]+)$/i.exec(weight.trim())
  return match ? `${match[1]} ${match[2].toLowerCase()}` : weight.trim()
}

type PendingItem = { text: string; section?: RecipeSectionAnchor }

// What an inactive variation still lacks before activation; mirrors the backend refusal list. Items solved
// in the product content carry the section (and so the tab) that solves them.
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

// An active variation without weight has no pack size: the stock cannot list it.
function needsWeight(item: VariantDraft) {
  return Boolean(item.id && item.active && !item.weight.trim())
}

const MISSING_LABELS: Record<string, string> = {
  price: 'preço',
  stripe_price: 'preço no Stripe',
  final_image: 'foto definitiva na loja',
  label_data: 'dados de rótulo (aba Rótulo)',
  presentation: 'apresentação da receita na loja (aba Apresentação)',
  ncm: 'NCM da variação',
}

function variationFailure(error: unknown, fallback: string, weight = '') {
  if (error instanceof ApiRequestError) {
    if (error.code === 'variation_weight_taken') {
      const taken = String(error.details?.weight ?? weight)
      return `Este produto já tem uma variação de ${weightText(taken)}. Use outro peso.`
    }
    if (error.code === 'variation_weight_invalid') {
      return 'Informe o peso como 300g ou 10.6oz.'
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

function generalFailure(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'product_name_invalid') return 'Informe um nome de até 120 caracteres.'
    if (error.code === 'product_aliases_invalid') return 'Os aliases passam de 512 caracteres.'
    if (error.code === 'product_short_label_invalid') return 'O nome na fila de produção tem no máximo 64 caracteres.'
    if (error.code === 'product_life_stage_invalid') return 'Escolha a fase de vida.'
    if (error.code === 'product_identity_locked') return 'Código e mercado não mudam depois de criados.'
  }
  return error instanceof Error ? error.message : 'Falha ao salvar'
}

// Pack fields of one variation; flavor, code, life stage and short name come from the product.
function variantPayload(item: VariantDraft, planCountry: string) {
  return {
    ...(item.id ? { id: item.id } : {}),
    sku: item.sku,
    name: item.name,
    weight: item.weight.trim(),
    ...(planCountry === 'BR' ? { ncm: item.ncm.trim(), origin: Number(item.origin) } : {}),
    finalImageReady: item.finalImageReady,
    labelDataReady: item.labelDataReady,
    regularPrice: item.regularPrice === '' ? null : Number(item.regularPrice),
  }
}

export function ProductDetailPage() {
  const { token, hasPermission } = useAuth()
  const { productId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [data, setData] = useState<ProductDetail | null>(null)
  const [general, setGeneral] = useState<GeneralForm>({ name: '', flavorAliases: '', shortLabel: '', lifeStage: 'adult' })
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [generalError, setGeneralError] = useState('')
  const [savingGeneral, setSavingGeneral] = useState(false)
  // Variation feedback renders inside the Variações tab; a refusal may point to the tab that solves it.
  const [variationNotice, setVariationNotice] = useState<{ tone: 'success' | 'error'; text: string; tab?: TabId } | null>(null)
  const [deletingKey, setDeletingKey] = useState('')
  const [variationDraft, setVariationDraft] = useState<VariantDraft | null>(null)
  // Weight of an active variation saved without it. The API accepts it alone even while the variation is locked.
  const [weightDraft, setWeightDraft] = useState<{ item: VariantDraft; weight: string } | null>(null)
  const [weightError, setWeightError] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  // Shown where the warning was, so the confirmation is on screen whatever the scroll.
  const [weightSaved, setWeightSaved] = useState('')
  const [dialogError, setDialogError] = useState('')
  const [savingVariation, setSavingVariation] = useState(false)
  const [togglingKey, setTogglingKey] = useState('')
  const [tab, setTab] = useState<TabId>(() => {
    const anchor = anchorOf(location.hash)
    return anchor ? ANCHOR_TAB[anchor] : 'geral'
  })
  // Unsaved content in the open tab (presentation, label, a chosen image), reported by its sections.
  const contentDirty = useRef(false)
  const [contentDirtyState, setContentDirtyState] = useState(false)
  const scrolledAnchor = useRef('')

  const canWrite = hasPermission('catalog.write')
  const canSync = hasPermission('catalog.sync')
  // A published product keeps active variations locked; inactive ones stay editable.
  const canAddVariation = Boolean(canWrite && data)
  const canEditVariation = (item: VariantDraft) => Boolean(canWrite && data && (!data.active || !item.active))
  const planCountry = data?.planCountry || 'BR'
  const currency = planCountry === 'US' ? 'USD' : 'BRL'
  const savedGeneral = data ? generalFormOf(data) : null
  const generalDirty = Boolean(canWrite && savedGeneral && JSON.stringify(general) !== JSON.stringify(savedGeneral))

  useEffect(() => {
    if (!generalDirty && !contentDirtyState) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [generalDirty, contentDirtyState])

  const onContentDirty = useCallback((dirty: boolean) => {
    contentDirty.current = dirty
    setContentDirtyState(dirty)
  }, [])

  const notifyVariation = (tone: 'success' | 'error', text: string, noticeTab?: TabId) => {
    setWeightSaved('')
    setMessage('')
    setError('')
    setVariationNotice({ tone, text, tab: noticeTab })
  }

  // keepGeneral leaves typed and unsaved general fields on screen, for a reload that did not save them.
  const applyProduct = (product: ProductDetail, { keepGeneral = false }: { keepGeneral?: boolean } = {}) => {
    setData(product)
    if (!keepGeneral) setGeneral(generalFormOf(product))
    setVariants(product.variants.map(toVariantDraft))
  }

  const load = async ({ keepGeneral = false }: { keepGeneral?: boolean } = {}) => {
    if (!token || !productId) return
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, { token })
      applyProduct(response, { keepGeneral })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar produto')
    }
  }

  useEffect(() => {
    void load()
  }, [token, productId])

  // An anchor in the URL opens its tab and scrolls to the section once the product has loaded.
  useEffect(() => {
    const anchor = anchorOf(location.hash)
    if (!anchor) return
    setTab(ANCHOR_TAB[anchor])
    scrolledAnchor.current = ''
  }, [location.hash])

  useEffect(() => {
    const anchor = anchorOf(location.hash)
    if (!data || !anchor || scrolledAnchor.current === anchor || ANCHOR_TAB[anchor] !== tab) return
    scrolledAnchor.current = anchor
    document.getElementById(anchor)?.scrollIntoView?.({ block: 'start' })
  }, [data, tab, location.hash])

  const openTab = (next: TabId, anchor?: RecipeSectionAnchor) => {
    if (next !== tab) {
      if (contentDirty.current && !window.confirm(DISCARD_CONFIRM)) return false
      contentDirty.current = false
      setContentDirtyState(false)
      setTab(next)
    }
    if (anchor) {
      requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView?.({ block: 'start' }))
    }
    return true
  }

  const moveTabFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    const index = TABS.findIndex((option) => option.id === tab)
    const next = TABS[(index + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]
    if (openTab(next.id)) document.getElementById(`product-tab-${next.id}`)?.focus()
  }

  const leavePage = (event: MouseEvent<HTMLAnchorElement>) => {
    if ((generalDirty || contentDirty.current) && !window.confirm('Sair sem salvar as alterações?')) event.preventDefault()
  }

  // After a content tab saves: badges and pending items follow, the general fields typed and not saved stay.
  const onContentSaved = (saved: RecipeContent) => {
    setData((current) => (current?.content ? { ...current, content: withSavedContent(current.content, saved) } : current))
    void load({ keepGeneral: generalDirty })
  }

  const saveGeneral = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !productId || !canWrite || !data || savingGeneral) return
    try {
      setSavingGeneral(true)
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: {
          name: general.name.trim(),
          flavorAliases: general.flavorAliases.trim(),
          shortLabel: general.shortLabel.trim(),
          lifeStage: general.lifeStage,
        },
      })
      applyProduct(response)
      setError('')
      setGeneralError('')
      setVariationNotice(null)
      setMessage('Dados gerais salvos.')
    } catch (requestError) {
      setGeneralError(generalFailure(requestError))
    } finally {
      setSavingGeneral(false)
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
    try {
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: { active },
      })
      applyProduct(response, { keepGeneral: generalDirty })
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
      await load({ keepGeneral: generalDirty })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao sincronizar')
    }
  }

  const openVariationDialog = (draft: VariantDraft) => {
    setDialogError('')
    setVariationDraft(draft)
  }

  const openWeightDialog = (item: VariantDraft) => {
    setWeightSaved('')
    setWeightError('')
    setWeightDraft({ item, weight: '' })
  }

  // ?variation=<id> opens the Variações tab on that variation, highlights it and opens it when editable.
  // With &campo=peso (link from Estoque) a variation without weight opens straight on the weight.
  const [searchParams] = useSearchParams()
  const focusVariationId = searchParams.get('variation')
  const focusField = searchParams.get('campo')
  const focusedVariation = useRef<string | null>(null)
  useEffect(() => {
    if (!data || !focusVariationId || focusedVariation.current === focusVariationId) return
    const item = variants.find((row) => row.id === focusVariationId)
    if (!item) return
    focusedVariation.current = focusVariationId
    setTab('variacoes')
    requestAnimationFrame(() => document.getElementById(`variation-${focusVariationId}`)?.scrollIntoView?.({ block: 'center' }))
    if (focusField === 'peso' && canWrite && needsWeight(item)) openWeightDialog(item)
    else if (canEditVariation(item)) openVariationDialog(item)
  }, [data, variants, focusVariationId, focusField, canWrite])

  const closeWeightDialog = () => {
    if (savingWeight) return
    setWeightDraft(null)
    setWeightError('')
  }

  const saveWeight = async () => {
    if (!token || !productId || !weightDraft || savingWeight) return
    const weight = weightDraft.weight.trim()
    if (!weight) {
      setWeightError(`Informe o peso, como ${planCountry === 'US' ? '10.6oz' : '300g'}.`)
      return
    }
    try {
      setSavingWeight(true)
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}`, {
        token,
        method: 'PATCH',
        body: { variants: [{ id: weightDraft.item.id, weight }] },
      })
      applyProduct(response, { keepGeneral: generalDirty })
      setWeightDraft(null)
      setWeightError('')
      setVariationNotice(null)
      setWeightSaved(`Peso salvo. ${weightDraft.item.name || weightDraft.item.sku || 'A variação'} já aparece no Estoque.`)
    } catch (requestError) {
      setWeightError(variationFailure(requestError, 'Falha ao salvar o peso', weight))
    } finally {
      setSavingWeight(false)
    }
  }

  const updateDraft = (patch: Partial<VariantDraft>) => {
    setVariationDraft((current) => (current ? { ...current, ...patch } : current))
  }

  const closeVariationDialog = () => {
    if (savingVariation) return
    setVariationDraft(null)
    setDialogError('')
  }

  const saveVariation = async () => {
    if (!token || !productId || !variationDraft || savingVariation) return
    const draft = variationDraft
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
      applyProduct(response, { keepGeneral: generalDirty })
      setVariationDraft(null)
      setDialogError('')
      notifyVariation('success', draft.id ? 'Variação atualizada.' : 'Variação adicionada.')
    } catch (requestError) {
      setDialogError(variationFailure(requestError, 'Falha ao salvar variação', draft.weight))
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
      applyProduct(response, { keepGeneral: generalDirty })
      notifyVariation('success', active ? `Variação "${label}" ativada.` : `Variação "${label}" desativada.`)
    } catch (requestError) {
      const missing = requestError instanceof ApiRequestError && Array.isArray(requestError.details?.missing)
        ? requestError.details.missing as string[]
        : []
      notifyVariation(
        'error',
        variationFailure(requestError, active ? 'Falha ao ativar variação' : 'Falha ao desativar variação'),
        missing.includes('presentation') ? 'apresentacao' : undefined,
      )
    } finally {
      setTogglingKey('')
    }
  }

  const deleteVariation = async (item: VariantDraft) => {
    if (!token || !productId || !canWrite || !item.id) return
    const label = item.name.trim() || item.sku.trim() || item.id
    const confirmed = window.confirm(`Excluir a variação "${label}"? Isso remove o cadastro local e não pode ser desfeito.`)
    if (!confirmed) return

    try {
      setDeletingKey(item.key)
      const response = await apiRequest<ProductDetail>(`/admin/catalog/products/${productId}/variations/${item.id}`, {
        token,
        method: 'DELETE',
      })
      applyProduct(response, { keepGeneral: generalDirty })
      notifyVariation('success', `Variação "${label}" excluída.`)
    } catch (requestError) {
      const failure = catalogDeleteFailure(requestError, 'Falha ao excluir variação')
      notifyVariation('error', failure.message)
      if (failure.inUse) {
        await load({ keepGeneral: generalDirty })
      }
    } finally {
      setDeletingKey('')
    }
  }

  const deleteProduct = async () => {
    if (!token || !productId || !canWrite || !data) return
    const count = data.variants.length
    const confirmed = window.confirm(
      `Excluir o produto "${data.namePt}" e ${count} variação(ões)? Isso remove o cadastro local, o conteúdo e as imagens da receita e não pode ser desfeito.`,
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
        await load({ keepGeneral: generalDirty })
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

  const pendingSyncCount = variants.filter((item) => item.requiresSync).length
  const withoutWeight = variants.filter(needsWeight)
  const content = data?.content ?? null
  const contentForSections = data ? sectionContent(data) : null
  const draft = variationDraft
  const tabSections = TAB_SECTIONS[tab]
  const readinessSteps = data ? productReadinessSteps({
    published: data.active,
    planCountry,
    content: content ? { imageUrl: content.imageUrl, presentationReady: content.presentationReady, labelStatus: content.labelStatus, labelMissing: content.labelMissing ?? [] } : null,
    variations: variants.filter((item) => item.id).map((item) => ({
      label: item.weight ? weightText(item.weight) : item.name || item.sku || 'variação',
      active: item.active,
      // The Stripe price is created when the variation activates, so it is not a step for the operator.
      missing: pendingItems(item, planCountry).filter((entry) => !entry.section && entry.text !== 'Stripe').map((entry) => entry.text),
      finalImageReady: item.finalImageReady,
      labelDataReady: item.labelDataReady,
    })),
  }) : []
  const publishIsNext = readinessSteps.find((step) => !step.done)?.id === 'published'
  // What each tab still lacks for the store, from the same steps as the checklist.
  const tabPending = (id: TabId) => readinessSteps.some((step) => !step.done && step.target === id)
  const openReadiness = (target: ReadinessTarget) => {
    if (target === 'publicar') {
      void togglePublish(true)
      return
    }
    const anchor = target === 'imagens' ? 'imagem' : target === 'variacoes' ? undefined : target
    if (openTab(target, anchor) && !anchor) {
      requestAnimationFrame(() => document.getElementById(`product-tab-${target}`)?.scrollIntoView?.({ block: 'start' }))
    }
  }

  return (
    <PageFrame
      eyebrow={<Link className="page-back-link" to="/catalog/products" onClick={leavePage}>← Produtos</Link>}
      title={data?.namePt ?? 'Produto'}
      description={data ? `${content ? `Código ${content.code}` : `slug ${data.slug}`} · mercado ${planCountry} · ${currency}` : 'Carregando o produto.'}
      actions={data ? (
        // Status and the actions that change it live in one place: the header.
        <div className="inline-actions product-head-actions">
          <span className={data.active ? 'badge-success' : 'badge-warning'}>
            {data.active ? 'Publicado' : 'Rascunho'}
          </span>
          {pendingSyncCount ? (
            <span className="badge-warning">
              {pendingSyncCount === 1 ? '1 variação pendente no Stripe' : `${pendingSyncCount} variações pendentes no Stripe`}
            </span>
          ) : null}
          {canSync ? (
            <button className="ghost-button" type="button" onClick={() => void sync()}>Sincronizar Stripe</button>
          ) : null}
          {canWrite ? (
            <button
              // Highlighted only when publishing is what is left to do.
              className={!data.active && publishIsNext ? 'primary-button' : 'ghost-button'}
              type="button"
              title={data.active ? 'Tira da loja e mantém o cadastro.' : undefined}
              onClick={() => void togglePublish(!data.active)}
            >
              {data.active ? 'Desativar' : 'Publicar'}
            </button>
          ) : null}
        </div>
      ) : null}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}
      {gapText ? <div className="alert">Publicação bloqueada: faltam preços Stripe para {gapText}.</div> : null}
      {weightSaved ? (
        <div className="success weight-warning" role="status">
          <span>{weightSaved}</span>
          {/* Came from the Estoque warning: the way back to the variations still without weight. */}
          {focusField === 'peso' ? <Link className="ghost-button" to="/operations/stock">Voltar ao Estoque</Link> : null}
        </div>
      ) : null}
      {withoutWeight.length ? (
        <div className="warning weight-warning" role="status">
          <span>
            <strong>Fora do estoque:</strong>{' '}
            {withoutWeight.length === 1
              ? `a variação ativa ${withoutWeight[0].name || withoutWeight[0].sku || ''} está sem peso.`
              : `${withoutWeight.length} variações ativas estão sem peso.`}
            {' '}O estoque conta packs por peso.
          </span>
          {canWrite ? (
            <button className="ghost-button" type="button" onClick={() => { setTab('variacoes'); openWeightDialog(withoutWeight[0]) }}>
              Informar peso
            </button>
          ) : null}
        </div>
      ) : null}

      {data ? <ProductReadiness steps={readinessSteps} onOpen={openReadiness} canPublish={canWrite} /> : null}

      <div className="page-tabs" role="tablist" aria-label="Produto" onKeyDown={moveTabFocus}>
        {TABS.map((option) => (
          <button
            key={option.id}
            id={`product-tab-${option.id}`}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`product-panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={tab === option.id ? 'page-tab active' : 'page-tab'}
            onClick={() => openTab(option.id)}
          >
            {option.label}
            {/* The checklist already says it to screen readers; the tab name stays the label. */}
            {data && tabPending(option.id) ? <span className="page-tab-flag" aria-hidden="true">pendente</span>
              : data && option.id === 'variacoes' ? <span className="page-tab-count" aria-hidden="true">{variants.filter((item) => item.id).length}</span>
                : null}
          </button>
        ))}
      </div>

      {tab === 'geral' ? (
        <div id="product-panel-geral" role="tabpanel" aria-labelledby="product-tab-geral" className="stack">
          <form onSubmit={saveGeneral}>
            <Section
              title="Dados gerais"
              description="Valem para todas as variações. Código e mercado são definidos na criação e não mudam."
              actions={canWrite && data ? (
                <button className="primary-button" type="submit" disabled={savingGeneral || !generalDirty}>
                  {savingGeneral ? 'Salvando…' : 'Salvar'}
                </button>
              ) : null}
            >
              {generalError ? <div className="alert" role="alert">{generalError}</div> : null}
              {data ? (
                <>
                                    <div className="form-grid">
                    <label>
                      Nome
                      <input
                        aria-label="Nome do produto"
                        value={general.name}
                        maxLength={120}
                        readOnly={!canWrite}
                        onChange={(event) => setGeneral((current) => ({ ...current, name: event.target.value }))}
                      />
                    </label>
                    <label id="fase">
                      Fase de vida
                      <select
                        aria-label="Fase de vida"
                        aria-describedby="life-stage-hint"
                        value={general.lifeStage}
                        disabled={!canWrite}
                        onChange={(event) => setGeneral((current) => ({ ...current, lifeStage: event.target.value as LifeStage }))}
                      >
                        {(Object.keys(LIFE_STAGE_LABELS) as LifeStage[]).map((stage) => (
                          <option key={stage} value={stage}>{LIFE_STAGE_LABELS[stage]}</option>
                        ))}
                      </select>
                      <span id="life-stage-hint" className="access-hint">Mudar a fase muda a linha de todas as variações deste produto.</span>
                    </label>
                    <label>
                      Aliases
                      <input
                        aria-label="Aliases"
                        value={general.flavorAliases}
                        maxLength={512}
                        readOnly={!canWrite}
                        placeholder="chicken, frango"
                        onChange={(event) => setGeneral((current) => ({ ...current, flavorAliases: event.target.value }))}
                      />
                      <span className="access-hint">Opcional, separados por vírgula.</span>
                    </label>
                    <label>
                      Nome na fila de produção
                      <input
                        aria-label="Nome na fila de produção"
                        value={general.shortLabel}
                        maxLength={64}
                        readOnly={!canWrite}
                        placeholder="Ex.: Bovino · Sênior"
                        onChange={(event) => setGeneral((current) => ({ ...current, shortLabel: event.target.value }))}
                      />
                    </label>
                  </div>
                  <p className="field-hint">
                    Duração do plano e limite do pacote pequeno valem para o mercado inteiro: <Link className="link-button" to={`/catalog/plan?market=${encodeURIComponent(planCountry)}`}>Loja › Plano</Link>.
                  </p>
                  {generalDirty ? <p className="field-hint warning-text" role="status">Dados gerais alterados. Salve antes de sair.</p> : null}
                </>
              ) : <p className="muted">Carregando o produto.</p>}
            </Section>
          </form>

          {canWrite && data?.canDelete === true ? (
            <Section title="Excluir produto" description="Remove o produto, as variações e o conteúdo da receita do cadastro local. Não pode ser desfeito.">
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
        </div>
      ) : null}

      {tabSections ? (
        <div id={`product-panel-${tab}`} role="tabpanel" aria-labelledby={`product-tab-${tab}`} className="stack">
          {!data ? <p className="muted">Carregando o produto.</p> : null}
          {data && !contentForSections ? (
            <div className="alert" role="alert">Este produto não tem conteúdo de receita.</div>
          ) : null}
          {data && contentForSections ? (
            <RecipeContentSections
              key={tab}
              token={token}
              productId={data.id}
              market={planCountry}
              content={contentForSections}
              canWrite={canWrite}
              onSaved={onContentSaved}
              onDirtyChange={onContentDirty}
              sections={tabSections}
            />
          ) : null}
        </div>
      ) : null}

      {tab === 'variacoes' ? (
        <div id="product-panel-variacoes" role="tabpanel" aria-labelledby="product-tab-variacoes">
          <Section
            title="Variações"
            description={canWrite && data?.active
              ? 'Produto publicado. Variações inativas podem ser adicionadas e editadas; ative cada uma quando estiver pronta. Para editar uma variação ativa, desative-a antes.'
              : 'Cada variação é um tamanho de pack desta receita. Variação nova entra inativa; ative cada uma depois das confirmações.'}
            actions={canAddVariation ? (
              <button className="primary-button" type="button" onClick={() => openVariationDialog(emptyVariantDraft())}>
                Adicionar variação
              </button>
            ) : null}
          >
            {variationNotice ? (
              <div className={variationNotice.tone === 'error' ? 'alert' : 'success'} role={variationNotice.tone === 'error' ? 'alert' : 'status'}>
                {variationNotice.text}
                {variationNotice.tab ? (
                  <>
                    {' '}
                    <button className="link-button inline-link-button" type="button" onClick={() => openTab(variationNotice.tab!)}>
                      Abrir {TABS.find((option) => option.id === variationNotice.tab)?.label}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="table-shell table-scroll variation-table">
              {/* One card per variation on phones (stack-table). */}
              <table className="stack-table">
                <thead>
                  <tr>
                    <th>Variação</th>
                    <th>Peso</th>
                    <th className="numeric">Preço ({currency})</th>
                    <th>Stripe</th>
                    <th>Situação</th>
                    {canWrite ? <th><span className="sr-only">Ações</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {variants.length === 0 ? (
                    <tr>
                      <td colSpan={canWrite ? 6 : 5} className="muted">
                        {canAddVariation
                          ? 'Nenhuma variação. Use Adicionar variação para criar o primeiro tamanho de pack.'
                          : 'Nenhuma variação cadastrada.'}
                      </td>
                    </tr>
                  ) : variants.map((item) => {
                    const label = item.name || item.sku || item.id || 'nova'
                    const editable = canEditVariation(item)
                    const pending = item.active ? [] : pendingItems(item, planCountry)
                    return (
                      <tr
                        key={item.key}
                        id={item.id ? `variation-${item.id}` : undefined}
                        className={item.id && item.id === focusVariationId ? 'row-focused' : undefined}
                      >
                        <td className="stack-table-title">
                          <div className="cell-stack">
                            <strong>{item.name || 'Sem nome'}</strong>
                            <span className="cell-meta mono">{item.sku || 'Sem SKU'}</span>
                          </div>
                        </td>
                        <td data-label="Peso">
                          {item.weight ? weightText(item.weight) : needsWeight(item) ? (
                            <span className="badge-warning" title="Sem peso, a variação fica fora do Estoque.">Sem peso</span>
                          ) : '-'}
                        </td>
                        <td className="numeric" data-label={`Preço (${currency})`}>{formatCurrency(item.regularPrice === '' ? null : Number(item.regularPrice), currency)}</td>
                        <td data-label="Stripe">
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
                        <td data-label="Situação">
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
                                      {section ? (
                                        <button
                                          className="link-button inline-link-button"
                                          type="button"
                                          aria-label={`Abrir ${entry.text} de ${label}`}
                                          onClick={() => openTab(ANCHOR_TAB[section], section)}
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
                                  {needsWeight(item) ? (
                                    <button
                                      className="primary-button"
                                      type="button"
                                      aria-label={`Informar peso de ${label}`}
                                      onClick={() => openWeightDialog(item)}
                                    >
                                      Informar peso
                                    </button>
                                  ) : null}
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
        </div>
      ) : null}

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
        {draft ? (
          <form className="access-form" onSubmit={(event) => { event.preventDefault(); void saveVariation() }}>
            {dialogError ? <div className="alert" role="alert">{dialogError}</div> : null}
            <dl className="meta-grid" aria-label="Receita do produto">
              <div className="meta-item">
                <dt>Sabor</dt>
                <dd>{content?.name ?? data?.namePt ?? '-'}</dd>
              </div>
              <div className="meta-item">
                <dt>Código</dt>
                <dd className="mono">{content?.code ?? '-'}</dd>
              </div>
              <div className="meta-item">
                <dt>Fase</dt>
                <dd>{content ? LIFE_STAGE_LABELS[content.lifeStage] : '-'}</dd>
              </div>
            </dl>
            <p className="access-hint">Sabor, código, fase e nome na fila de produção vêm do produto, em Dados gerais.</p>
            <fieldset className="access-group">
              <legend>Pack</legend>
              <div className="access-fields">
                <label>
                  SKU
                  <input aria-label="SKU" value={draft.sku} onChange={(event) => updateDraft({ sku: event.target.value })} placeholder="BOWL-FRANGO-300" />
                </label>
                <label>
                  Peso
                  <input aria-label="Peso" value={draft.weight} maxLength={32} onChange={(event) => updateDraft({ weight: event.target.value })} placeholder={planCountry === 'US' ? '10.6oz' : '300g'} />
                </label>
                <label className="access-field-wide">
                  Nome
                  <input aria-label="Nome" value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} placeholder="Frango 300g" />
                </label>
                <label>
                  Preço ({currency})
                  <input
                    aria-label="Preço"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.regularPrice}
                    onChange={(event) => updateDraft({ regularPrice: event.target.value })}
                    placeholder="0.00"
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
                    <input aria-label="NCM" value={draft.ncm} maxLength={10} inputMode="numeric" onChange={(event) => updateDraft({ ncm: event.target.value })} placeholder="0000.00.00" />
                  </label>
                  <label>
                    Origem da mercadoria
                    <select aria-label="Origem da mercadoria" value={draft.origin} onChange={(event) => updateDraft({ origin: event.target.value })}>
                      {GOODS_ORIGINS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              </fieldset>
            ) : null}

            <fieldset className="access-group">
              <legend>Confirmações para ativar</legend>
              {content?.imageUrl ? (
                <p className="access-hint">Imagem cadastrada na aba Imagens. Não precisa de confirmação.</p>
              ) : (
                <div className="readiness-item">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      aria-describedby="final-image-hint"
                      checked={draft.finalImageReady}
                      onChange={(event) => updateDraft({ finalImageReady: event.target.checked })}
                    />
                    Foto definitiva já está na loja
                  </label>
                  <p id="final-image-hint" className="access-hint">
                    Só para imagem no código da loja. Ou cadastre a imagem na aba Imagens, que dispensa esta confirmação.
                  </p>
                </div>
              )}
              {content?.labelStatus === 'complete' ? (
                <p className="access-hint">Rótulo completo na aba Rótulo. Não precisa de confirmação.</p>
              ) : (
                <div className="readiness-item">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      aria-describedby="label-data-hint"
                      checked={draft.labelDataReady}
                      onChange={(event) => updateDraft({ labelDataReady: event.target.checked })}
                    />
                    Dados de rótulo já estão na página da receita
                  </label>
                  <p id="label-data-hint" className="access-hint">
                    Só para rótulo no código da loja: ingredientes, níveis de garantia, kcal e avisos.{' '}
                    {planCountry === 'US' ? 'Obrigatório para ativar nos EUA.' : 'Opcional no Brasil; obrigatório para ativar nos EUA.'}
                    {' '}Um rótulo completo na aba Rótulo dispensa esta confirmação.
                  </p>
                </div>
              )}
            </fieldset>
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={weightDraft != null}
        title="Informar peso"
        description={weightDraft ? [weightDraft.item.name, weightDraft.item.sku ? `SKU ${weightDraft.item.sku}` : ''].filter(Boolean).join(' · ') : undefined}
        onClose={closeWeightDialog}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeWeightDialog} disabled={savingWeight}>Cancelar</button>
            <button className="primary-button" type="submit" form="variation-weight-form" disabled={savingWeight}>
              {savingWeight ? 'Salvando…' : 'Salvar peso'}
            </button>
          </>
        )}
      >
        {weightDraft ? (
          <form id="variation-weight-form" className="access-form" onSubmit={(event) => { event.preventDefault(); void saveWeight() }}>
            {weightError ? <div className="alert" role="alert">{weightError}</div> : null}
            <label className="closure-field">
              Peso
              <input
                aria-label="Peso"
                value={weightDraft.weight}
                maxLength={32}
                onChange={(event) => setWeightDraft((current) => (current ? { ...current, weight: event.target.value } : current))}
                placeholder={planCountry === 'US' ? '10.6oz' : '300g'}
              />
            </label>
            <p className="access-hint">
              Sem peso, esta variação fica fora do Estoque.
              {weightDraft.item.active && data?.active ? ' Só o peso é salvo e a variação continua ativa. Depois, o peso só muda desativando a variação.' : ''}
            </p>
          </form>
        ) : null}
      </Dialog>
    </PageFrame>
  )
}
