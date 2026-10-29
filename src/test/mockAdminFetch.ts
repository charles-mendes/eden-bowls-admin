import { vi } from 'vitest'
import type { AdminUser } from '../contexts/AuthContext'
import {
  billingMetrics,
  checkoutDetail,
  checkoutList,
  checkoutMetrics,
  firstPurchasePromoHealth,
  jsonResponse,
  operatorWriteUser,
  productDetail,
  productsList,
  mediaAssets as mediaAssetsFixture,
  type MediaAssetFixture,
  recipeContent as recipeContentFixture,
  recipeList,
  type RecipeListItem,
  promotionCodesList,
  shippingSettings,
  todayOverview,
  staffList,
  staffUser,
  subscriptionItem,
  subscriptionsList,
  syncHealth,
  syncStatus,
  userDetail,
  usersList,
  webhooksList,
  feedbackItem,
  feedbacksList,
  privacyRequestItem,
  privacyRequestsList,
  productionQueueItem,
  productionQueueList,
  stockItemCarne,
  stockMovementSeparation,
  stockOverview,
  userPrivacySnapshot,
  marketConflicts,
  webhookHealth,
} from './fixtures'
import type { WebhookHealthFixture } from './fixtures'
import { checkMockedCall } from './apiContract'

export type FetchCall = {
  url: string
  path: string
  search: string
  method: string
  authorization: string
  body: unknown
}

export const customerInvoice = {
  id: 12,
  invoice_number: 'EB-2026-000418',
  stripe_invoice_id: 'in_test_0',
  stripe_account: 'us',
  locale: 'en-US',
  currency: 'usd',
  total_minor: 14450,
  amount_paid_minor: 14450,
  invoice_status: 'paid',
  billing_reason: 'subscription_cycle',
  issued_at: '2026-09-01T15:00:00.000Z',
  pdf_available: true,
  pdf_generated_at: '2026-09-01T15:00:05.000Z',
  email_to: 'ana@edenbowls.com',
  email_status: 'sent',
  email_sent_at: '2026-09-01T15:00:06.000Z',
  email_attempts: 1,
  email_last_error: null,
  email_next_attempt_at: null,
}

function parseUrl(input: RequestInfo | URL) {
  return new URL(String(input), 'http://admin.local')
}

export function installAdminFetchMock(profile: AdminUser = operatorWriteUser, options: {
  marketConflicts?: typeof marketConflicts.items
  webhookHealth?: WebhookHealthFixture | { status: number; message: string }
  syncStatus?: Record<string, unknown>
  subscriptionInScope?: boolean
  customerInvoices?: Array<Record<string, unknown>>
  productionInScope?: boolean
  productionQueue?: Array<Record<string, unknown>>
  productionStock?: { shortages: Array<{ flavorKey: string; packSizeGrams: number; onHand: number }>; unsized: number }
  stockItems?: Array<Record<string, unknown>>
  stockUnsized?: Array<Record<string, unknown>>
  stockMovements?: Array<Record<string, unknown>>
  subscriptionSnapshot?: {
    petsSnapshot?: unknown
    planSelection?: unknown
    address?: unknown
    shipping?: unknown
  }
  products?: typeof productsList.items
  product?: typeof productDetail
  catalogDelete?: 'in_use' | 'archive'
  catalogActivation?: 'refused' | 'in_use'
  catalogPatch?: 'locked'
  recipeContent?: typeof recipeContentFixture
  recipes?: RecipeListItem[]
  recipeImage?: 'invalid'
  mediaAssets?: MediaAssetFixture[]
  // Answered before the fixed routes; return undefined to fall through.
  routes?: (call: FetchCall) => Response | undefined
} = {}) {
  const calls: FetchCall[] = []
  let catalogItems = (options.products ?? productsList.items).map((item) => ({
    ...item,
    variants: item.variants.map((variant) => ({ ...variant })),
  }))
  let catalogDetail = {
    ...(options.product ?? productDetail),
    variants: (options.product ?? productDetail).variants.map((item) => ({ ...item })),
  }

  let recipes = (options.recipes ?? recipeList.items).map((item) => ({ ...item, variations: item.variations.map((variation) => ({ ...variation })) }))
  let recipeContent = {
    ...(options.recipeContent ?? recipeContentFixture),
    variations: (options.recipeContent ?? recipeContentFixture).variations.map((item) => ({ ...item })),
  }

  // Image library: assets without their usedBy, and the recipe each market:key links to.
  let mediaAssets = (options.mediaAssets ?? mediaAssetsFixture).map((item) => {
    const asset: Omit<MediaAssetFixture, 'usedBy'> & { usedBy?: unknown } = { ...item }
    delete asset.usedBy
    return asset as Omit<MediaAssetFixture, 'usedBy'>
  })
  const mediaBytes = new Map<number, string>()
  // market:key → linked image id, per kind: the plan thumbnail and the banner of each recipe.
  const links = { plan: new Map<string, number>(), banner: new Map<string, number>() }
  if (recipeContent.planImageAssetId != null) {
    links.plan.set(`${recipeContent.market}:${recipeContent.flavorSlug}`, recipeContent.planImageAssetId)
  }
  if (recipeContent.imageAssetId != null) {
    links.banner.set(`${recipeContent.market}:${recipeContent.flavorSlug}`, recipeContent.imageAssetId)
  }
  const mediaView = (asset: (typeof mediaAssets)[number]) => ({
    ...asset,
    usedBy: [...links[asset.kind].entries()]
      .filter(([, id]) => id === asset.id)
      .map(([link]) => {
        const [market, key] = link.split(':')
        const recipe = recipes.find((item) => item.key === key)
        return { key, name: key === recipeContent.flavorSlug ? recipeContent.name : recipe?.name ?? key, market }
      }),
  })
  const addMediaAsset = (kind: MediaAssetFixture['kind'], market: string, originalFilename: string, imageBase64: string) => {
    const known = mediaAssets.find((asset) => asset.kind === kind && asset.market === market && mediaBytes.get(asset.id) === imageBase64)
    if (known) {
      known.archived = false
      known.archivedAt = null
      return { asset: known, duplicate: true }
    }
    const id = Math.max(100, ...mediaAssets.map((asset) => asset.id)) + 1
    const [width, height] = kind === 'banner' ? [1024, 636] : [400, 400]
    const asset = {
      id, kind, market, url: `/recipe-images/${kind}-${market.toLowerCase()}-${id}.webp`, originalFilename, mimeType: 'image/webp',
      width, height, bytes: 40000, createdAt: '2026-10-28T12:00:00.000Z', archivedAt: null, archived: false,
    }
    mediaAssets = [asset, ...mediaAssets]
    mediaBytes.set(id, imageBase64)
    return { asset, duplicate: false }
  }

  const queueItems = (options.productionQueue ?? [{
    ...productionQueueItem,
    customerProfileInScope: options.productionInScope ?? productionQueueItem.customerProfileInScope,
  }]).map((item) => ({ ...item }))

  const knownStock = new Set(['frango|300', 'carne|500'])
  let stockItems = (options.stockItems ?? stockOverview.items).map((item) => ({ ...item }))
  const stockUnsized = options.stockUnsized ?? stockOverview.unsizedLines
  let stockMovements = (options.stockMovements ?? [stockMovementSeparation]).map((item) => ({ ...item }))
  let nextMovementId = stockMovements.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1

  const refreshStock = (item: Record<string, unknown>) => {
    const onHand = Number(item.onHand)
    const committed = Number(item.committed)
    item.available = onHand - committed
    item.toProduce = Math.max(0, committed - onHand)
    item.belowMinimum = item.minLevel != null && onHand < Number(item.minLevel)
    return item
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseUrl(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const authorization = new Headers(init?.headers).get('Authorization') ?? ''
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const path = url.pathname
    const search = url.search

    calls.push({ url: String(input), path, search, method, authorization, body })
    checkMockedCall(method, path)

    const routed = options.routes?.({ url: String(input), path, search, method, authorization, body })
    if (routed) {
      return routed
    }

    if (path === '/api/v1/auth/token' && method === 'POST') {
      return jsonResponse({ token: 'access-token' })
    }

    if (path === '/api/v1/auth/refresh' && method === 'POST') {
      return jsonResponse({ code: 'refresh_token_invalid', message: 'Authentication is required.' }, 401)
    }

    if (path === '/api/v1/auth/logout' && method === 'POST') {
      return jsonResponse(null, 204)
    }

    if (path === '/api/v1/admin/me' && method === 'GET') {
      return jsonResponse(profile)
    }

    if (path === '/api/v1/admin/users/roles' && method === 'GET') {
      return jsonResponse(staffList)
    }

    if (path === '/api/v1/admin/users' && method === 'GET') {
      return jsonResponse(usersList)
    }

    if (path === '/api/v1/admin/users' && method === 'POST') {
      return jsonResponse({
        id: 'u-lia',
        email: body?.email,
        status: 'pending',
        roles: [body?.role || 'operator'],
        storedRoles: [body?.role || 'operator'],
        inviteMailStatus: 'sent',
        profile: { fullName: body?.name || null, phone: body?.phone || null },
      })
    }

    if (/^\/api\/v1\/admin\/users\/[^/]+\/invite$/.test(path) && method === 'POST') {
      return jsonResponse({ id: 'u-ops', email: 'ops@edenbowls.com', inviteMailStatus: 'sent', status: 'pending', roles: ['operator'] })
    }

    if (/^\/api\/v1\/admin\/users\/[^/]+$/.test(path) && method === 'PATCH' && !path.endsWith('/status') && !path.endsWith('/delivery') && !path.endsWith('/delivery-instructions')) {
      return jsonResponse({ ...userDetail, profile: { ...userDetail.profile, fullName: body?.name || userDetail.profile.fullName } })
    }

    if (/^\/api\/v1\/admin\/users\/[^/]+$/.test(path) && method === 'DELETE') {
      return jsonResponse({ success: true, id: path.split('/').at(-1) })
    }

    if (path === '/api/v1/admin/me/password' && method === 'POST') {
      return jsonResponse({ success: true, mustChangePassword: false })
    }

    if (path.endsWith('/delivery-instructions') && method === 'PATCH') {
      return jsonResponse({ ok: true })
    }

    if (path.endsWith('/delivery') && method === 'PATCH') {
      return jsonResponse({ success: true, data: body })
    }

    if (path.endsWith('/status') && method === 'PATCH') {
      return jsonResponse({ ...userDetail, status: body?.status || 'inactive' })
    }

    if (/^\/api\/v1\/admin\/users\/[^/]+\/roles$/.test(path) && method === 'PUT') {
      const nextRole = typeof body?.role === 'string' ? body.role : ''
      const storedRoles = !nextRole || nextRole === 'customer' ? [] : [nextRole]
      return jsonResponse({
        ...staffUser,
        storedRoles,
        roles: storedRoles.length ? storedRoles : ['customer'],
        lockedByAllowlist: false,
      })
    }

    if (/^\/api\/v1\/admin\/users\/[^/]+\/privacy$/.test(path) && method === 'GET') {
      return jsonResponse(userPrivacySnapshot)
    }

    if (/^\/api\/v1\/admin\/users\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse(userDetail)
    }

    if (path === '/api/v1/admin/onboarding/metrics') {
      return jsonResponse(checkoutMetrics)
    }

    if (path === '/api/v1/admin/onboarding/checkouts' && method === 'GET') {
      return jsonResponse(checkoutList)
    }

    if (path === '/api/v1/admin/onboarding/checkouts.csv' && method === 'GET') {
      return new Response('userId,email\n', {
        status: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8' },
      })
    }

    if (/^\/api\/v1\/admin\/onboarding\/checkouts\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse(checkoutDetail)
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'GET') {
      return jsonResponse({
        ...productsList,
        total: catalogItems.length,
        items: catalogItems,
      })
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'POST') {
      return jsonResponse({
        id: '301',
        slug: 'plano-novo',
        namePt: body?.name || 'Plano novo',
        nameEn: body?.name || 'Plano novo',
        active: false,
        planCountry: body?.planCountry || 'BR',
        planDays: body?.planDays || 30,
        stripeProductId: 'prod_live_301',
        variants: [],
      })
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/variations\/[^/]+$/.test(path) && method === 'DELETE') {
      const variationId = path.split('/').pop() || ''
      catalogDetail = {
        ...catalogDetail,
        variants: catalogDetail.variants.filter((item) => item.id !== variationId),
      }
      catalogItems = catalogItems.map((item) => (
        item.id === catalogDetail.id
          ? {
              ...item,
              variants: catalogDetail.variants.map((variant) => {
                const previous = item.variants.find((row) => row.id === variant.id)
                return {
                  id: variant.id,
                  sku: variant.sku,
                  variantPrices: previous?.variantPrices ?? [],
                  canDelete: previous?.canDelete ?? true,
                }
              }),
            }
          : item
      ))
      return jsonResponse(catalogDetail)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'DELETE') {
      if (options.catalogDelete === 'in_use') {
        catalogItems = catalogItems.map((item) => ({ ...item, canDelete: false }))
        catalogDetail = { ...catalogDetail, canDelete: false }
        return jsonResponse({
          message: 'Product is linked to a subscription and cannot be deleted.',
          details: { code: 'product_in_use' },
        }, 409)
      }
      if (options.catalogDelete === 'archive') {
        return jsonResponse({
          message: 'Unable to archive Stripe product.',
          details: { code: 'stripe_product_archive_failed' },
        }, 502)
      }
      const id = path.split('/').pop() || ''
      catalogItems = catalogItems.filter((item) => item.id !== id)
      return jsonResponse({ deleted: true, id })
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse(catalogDetail)
    }

    if (path === '/api/v1/admin/catalog/recipe-content' && method === 'GET') {
      return jsonResponse({ market: url.searchParams.get('market') || 'BR', items: recipes })
    }

    if (path === '/api/v1/admin/catalog/recipe-content' && method === 'POST') {
      const key = String(body?.key ?? '')
      const name = String(body?.name ?? '').trim()
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(key)) {
        return jsonResponse({ message: 'Recipe key must use lowercase letters, digits and single hyphens.', details: { code: 'recipe_key_invalid' } }, 422)
      }
      if (!name) {
        return jsonResponse({ message: 'Recipe name must have 1 to 120 characters.', details: { code: 'recipe_name_invalid' } }, 422)
      }
      if (recipes.some((item) => item.key === key)) {
        return jsonResponse({ message: 'A recipe with this key already exists in the market.', details: { code: 'recipe_key_taken' } }, 409)
      }
      const lifeStage = body?.lifeStage ?? 'adult'
      recipes = [...recipes, { key, name, lifeStage, imageUrl: null, labelStatus: 'missing', variations: [] }]
      return jsonResponse({ ...recipeContentFixture, flavorSlug: key, name, lifeStage, imageUrl: null, label: null, labelStatus: 'missing', labelMissing: [], variations: [] })
    }

    if (/^\/api\/v1\/admin\/catalog\/recipe-content\/[^/]+$/.test(path) && ['GET', 'PATCH', 'DELETE'].includes(method)) {
      const key = decodeURIComponent(path.split('/').pop() || '')
      const listed = recipes.find((item) => item.key === key)
      const current = key === recipeContent.flavorSlug
        ? recipeContent
        : listed
          ? { ...recipeContentFixture, flavorSlug: key, name: listed.name, lifeStage: listed.lifeStage, imageUrl: listed.imageUrl, label: null, labelStatus: listed.labelStatus, labelMissing: [], variations: listed.variations }
          : null
      if (!current) {
        return jsonResponse({ message: 'Recipe not found.', details: { code: 'recipe_not_found' } }, 404)
      }
      if (method === 'PATCH') {
        const name = body?.name === undefined ? current.name : String(body.name).trim()
        const lifeStage = body?.lifeStage ?? current.lifeStage
        recipes = recipes.map((item) => (item.key === key ? { ...item, name, lifeStage } : item))
        if (key === recipeContent.flavorSlug) recipeContent = { ...recipeContent, name, lifeStage }
        return jsonResponse({ ...current, name, lifeStage })
      }
      if (method === 'DELETE') {
        if (current.variations.length) {
          return jsonResponse({
            message: 'A recipe used by variations cannot be deleted.',
            details: { code: 'recipe_in_use', variations: current.variations.map((item) => ({ id: item.id, sku: item.sku, name: item.name })) },
          }, 409)
        }
        recipes = recipes.filter((item) => item.key !== key)
        return jsonResponse({ deleted: true, market: 'BR', flavorSlug: key })
      }
      return jsonResponse(current)
    }

    if (path === '/api/v1/admin/media' && method === 'GET') {
      const market = url.searchParams.get('market') || 'BR'
      const archived = url.searchParams.get('archived') === 'true'
      const kind = url.searchParams.get('kind') || 'plan'
      return jsonResponse({
        market,
        items: mediaAssets.filter((asset) => asset.kind === kind && asset.market === market && asset.archived === archived).map(mediaView),
      })
    }

    if (path === '/api/v1/admin/media' && method === 'POST') {
      const kind = body?.kind === 'banner' ? 'banner' : 'plan'
      const { asset, duplicate } = addMediaAsset(kind, String(body?.market ?? 'BR'), String(body?.originalFilename ?? ''), String(body?.imageBase64 ?? ''))
      return jsonResponse({ ...mediaView(asset), duplicate }, duplicate ? 200 : 201)
    }

    if (/^\/api\/v1\/admin\/media\/[^/]+\/(archive|restore)$/.test(path) && method === 'POST') {
      const [, , , , , id, action] = path.split('/')
      const asset = mediaAssets.find((item) => item.id === Number(id))
      if (!asset) return jsonResponse({ message: 'Library image not found.' }, 404)
      const usedBy = mediaView(asset).usedBy
      if (action === 'archive' && usedBy.length > 0) {
        return jsonResponse({ message: 'A library image in use cannot be archived.', details: { code: 'media_asset_in_use', usedBy } }, 409)
      }
      asset.archived = action === 'archive'
      asset.archivedAt = asset.archived ? '2026-10-28T12:00:00.000Z' : null
      return jsonResponse(mediaView(asset))
    }

    // Banner (`/image`) and plan thumbnail (`/plan-image`): link a library image by id, or upload one into the
    // library first; DELETE only unlinks. The banner keeps the 409 of a recipe with an active variation.
    const linkMatch = /^\/api\/v1\/admin\/catalog\/recipe-content\/([^/]+)\/(image|plan-image)$/.exec(path)
    if (linkMatch && ['PUT', 'DELETE'].includes(method)) {
      const key = decodeURIComponent(linkMatch[1])
      const kind = linkMatch[2] === 'image' ? 'banner' : 'plan'
      const market = url.searchParams.get('market') || recipeContent.market
      let asset: (typeof mediaAssets)[number] | null = null
      if (method === 'PUT') {
        if (kind === 'banner' && options.recipeImage === 'invalid' && body?.assetId == null) {
          return jsonResponse({
            message: 'Image must be 1024 x 636 pixels.',
            details: { code: 'recipe_image_invalid', reason: 'dimensions', width: 1200, height: 800, expectedWidth: 1024, expectedHeight: 636 },
          }, 422)
        }
        if (body?.assetId != null) {
          asset = mediaAssets.find((item) => item.id === Number(body.assetId)) ?? null
          if (!asset) return jsonResponse({ message: 'Library image not found.' }, 404)
          if (asset.kind !== kind || asset.market !== market) {
            const reason = asset.kind !== kind ? 'kind' : 'market'
            return jsonResponse({ message: 'Wrong library image.', details: { code: 'media_asset_invalid', reason, assetKind: asset.kind, assetMarket: asset.market } }, 422)
          }
          if (asset.archived) {
            return jsonResponse({ message: 'Archived.', details: { code: 'media_asset_archived' } }, 409)
          }
        } else {
          asset = addMediaAsset(kind, market, String(body?.originalFilename ?? `${key}-${kind}`), String(body?.imageBase64 ?? '')).asset
        }
        links[kind].set(`${market}:${key}`, asset.id)
      } else {
        const active = recipeContent.variations.filter((item) => item.active)
        if (kind === 'banner' && key === recipeContent.flavorSlug && active.length) {
          return jsonResponse({
            message: 'The image of a recipe with an active variation cannot be removed.',
            details: { code: 'recipe_content_in_use', activeVariations: active.map((item) => item.id) },
          }, 409)
        }
        links[kind].delete(`${market}:${key}`)
      }
      const linked = kind === 'banner'
        ? { imageUrl: asset ? asset.url : null, imageAssetId: asset ? asset.id : null, imageUpdatedAt: '2026-10-28T12:00:00.000Z' }
        : { planImageUrl: asset ? asset.url : null, planImageAssetId: asset ? asset.id : null, planImageUpdatedAt: '2026-10-28T12:00:00.000Z' }
      if (key === recipeContent.flavorSlug) {
        recipeContent = { ...recipeContent, ...linked }
        return jsonResponse(recipeContent)
      }
      return jsonResponse({ ...recipeContent, flavorSlug: key, market, ...linked })
    }

    if (/^\/api\/v1\/admin\/catalog\/recipe-content\/[^/]+\/presentation$/.test(path) && method === 'PUT') {
      recipeContent = { ...recipeContent, presentation: body?.presentation ?? null, presentationUpdatedAt: '2026-10-27T12:00:00.000Z' }
      return jsonResponse(recipeContent)
    }

    if (/^\/api\/v1\/admin\/catalog\/recipe-content\/[^/]+\/label$/.test(path) && method === 'PUT') {
      const label = body?.label ?? {}
      const missing = [
        ...(label.ingredients?.length ? [] : ['ingredients']),
        ...(label.analysis?.length ? [] : ['analysis']),
        ...(label.energyKg ? [] : ['energyKg']),
        ...(label.energyPackage ? [] : ['energyPackage']),
        ...(recipeContent.market === 'US' && !label.notices?.length ? ['notices'] : []),
      ]
      const active = recipeContent.variations.filter((item) => item.active)
      if (recipeContent.market === 'US' && active.length && missing.length) {
        return jsonResponse({
          message: 'The label of a US recipe with an active variation must stay complete.',
          details: { code: 'recipe_content_in_use', activeVariations: active.map((item) => item.id), missing },
        }, 409)
      }
      recipeContent = {
        ...recipeContent,
        label,
        labelStatus: missing.length ? 'incomplete' : 'complete',
        labelMissing: missing,
      }
      return jsonResponse(recipeContent)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/variations\/[^/]+\/activation$/.test(path) && method === 'POST') {
      if (options.catalogActivation === 'refused') {
        return jsonResponse({
          message: 'Variation cannot be activated: missing stripe_price, final_image, label_data.',
          details: { code: 'recipe_publish_refused', missing: ['stripe_price', 'final_image', 'label_data'] },
        }, 422)
      }
      if (options.catalogActivation === 'in_use') {
        return jsonResponse({
          message: 'Variation is used by 3 active subscriptions and cannot be deactivated.',
          details: { code: 'variation_in_active_subscriptions', activeSubscriptions: 3 },
        }, 409)
      }
      const variationId = path.split('/')[path.split('/').length - 2]
      catalogDetail = {
        ...catalogDetail,
        variants: catalogDetail.variants.map((item) => (item.id === variationId ? { ...item, active: Boolean(body?.active) } : item)),
      }
      return jsonResponse(catalogDetail)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'PATCH' && options.catalogPatch === 'locked' && Array.isArray(body?.variants)) {
      return jsonResponse({
        message: 'Active variations of a published product cannot be edited.',
        details: { code: 'variation_active_locked', variationIds: ['var-1'] },
      }, 409)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'PATCH' && Array.isArray(body?.variants)
      && body.variants.some((item: { recipeKey?: unknown }) => typeof item.recipeKey === 'string' && !recipes.some((recipe) => recipe.key === item.recipeKey))) {
      return jsonResponse({
        message: 'Recipe is not registered in the product market.',
        details: { code: 'recipe_not_registered' },
      }, 422)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'PATCH') {
      const variants = Array.isArray(body?.variants)
        ? body.variants.map((item: { id?: string; sku?: string; name?: string; regularPrice?: number | null }) => {
            const current = catalogDetail.variants.find((row) => row.id === item.id) || {
              stripeProductId: null,
              stripePriceId: null,
              syncStatus: 'not_synced',
              requiresSync: true,
            }
            return { ...current, ...item }
          })
        : catalogDetail.variants
      catalogDetail = {
        ...catalogDetail,
        ...body,
        active: body.active ?? catalogDetail.active,
        variants,
      }
      if (body && Object.prototype.hasOwnProperty.call(body, 'active')) {
        catalogItems = catalogItems.map((item) => (
          item.id === catalogDetail.id ? { ...item, active: Boolean(body.active) } : item
        ))
      }
      return jsonResponse(catalogDetail)
    }

    if (path === '/api/v1/admin/catalog/sync' && method === 'POST') {
      return jsonResponse({ syncJobId: 'job-2', status: 'queued' })
    }

    if (/^\/api\/v1\/admin\/catalog\/sync\/[^/]+$/.test(path) && method === 'POST') {
      return jsonResponse({ status: 'queued', summary: { created: 1, updated: 0 } })
    }

    if (path === '/api/v1/admin/markets/conflicts' && method === 'GET') {
      const items = options.marketConflicts ?? marketConflicts.items
      const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
      const perPage = Math.min(100, Math.max(1, Number(url.searchParams.get('perPage')) || 20))
      return jsonResponse({
        total: items.length,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(items.length / perPage)),
        items: items.slice((page - 1) * perPage, page * perPage),
      })
    }

    if (path === '/api/v1/admin/billing/webhooks/health' && method === 'GET') {
      const health = options.webhookHealth ?? webhookHealth
      if ('status' in health) return jsonResponse({ success: false, message: health.message }, health.status)
      return jsonResponse(health)
    }

    if (path === '/api/v1/admin/catalog/sync/health') {
      return jsonResponse(syncHealth)
    }

    if (path === '/api/v1/admin/catalog/sync/status') {
      return jsonResponse(options.syncStatus ?? syncStatus)
    }

    if (path === '/api/v1/admin/production/queue' && method === 'GET') {
      const productionStatus = url.searchParams.get('productionStatus')
      const items = productionStatus
        ? queueItems.filter((item) => item.productionStatus === productionStatus)
        : queueItems
      return jsonResponse({
        ...productionQueueList,
        total: items.length,
        totalPages: 1,
        items,
      })
    }

    if (/^\/api\/v1\/admin\/production\/queue\/\d+$/.test(path) && method === 'PATCH') {
      const id = Number(path.split('/').pop())
      const item = queueItems.find((entry) => Number(entry.id) === id) ?? { ...productionQueueItem, id }
      item.productionStatus = body?.status || 'in_production'
      item.note = body?.note || null
      return jsonResponse({
        ...item,
        stock: body?.status === 'ready' ? (options.productionStock ?? { shortages: [], unsized: 0 }) : undefined,
      })
    }

    if (path === '/api/v1/admin/stock' && method === 'GET') {
      return jsonResponse({
        market: url.searchParams.get('market') || 'BR',
        windowDays: Number(url.searchParams.get('windowDays') || 7),
        items: stockItems,
        unsizedLines: stockUnsized,
      })
    }

    if (path === '/api/v1/admin/stock/movements' && method === 'GET') {
      const flavorKey = url.searchParams.get('flavorKey')
      const packSizeGrams = url.searchParams.get('packSizeGrams')
      const type = url.searchParams.get('type')
      const page = Number(url.searchParams.get('page') || 1)
      const perPage = Number(url.searchParams.get('perPage') || 20)
      const filtered = stockMovements.filter((item) => (
        (!flavorKey || item.flavorKey === flavorKey)
        && (!packSizeGrams || Number(item.packSizeGrams) === Number(packSizeGrams))
        && (!type || item.type === type)
      ))
      const start = (page - 1) * perPage
      return jsonResponse({
        total: filtered.length,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(filtered.length / perPage)),
        items: filtered.slice(start, start + perPage),
      })
    }

    if (path === '/api/v1/admin/stock/production' && method === 'POST') {
      const key = `${body?.flavorKey}|${body?.packSizeGrams}`
      if (!knownStock.has(key)) {
        return jsonResponse({ message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      }
      const item = stockItems.find((entry) => `${entry.flavorKey}|${entry.packSizeGrams}` === key)
        ?? refreshStock({ ...stockItemCarne, flavorKey: body.flavorKey, packSizeGrams: body.packSizeGrams, onHand: 0 })
      if (!stockItems.includes(item)) stockItems = [...stockItems, item]
      item.onHand = Number(item.onHand) + Number(body.quantity)
      refreshStock(item)
      stockMovements = [{
        id: nextMovementId,
        market: body.market,
        flavorKey: body.flavorKey,
        packSizeGrams: body.packSizeGrams,
        type: 'production',
        quantity: Number(body.quantity),
        reason: null,
        note: body.note || null,
        productionCycleId: null,
        subscriptionId: null,
        actorName: profile.email,
        createdAt: '2026-09-21T08:00:00.000Z',
      }, ...stockMovements]
      nextMovementId += 1
      return jsonResponse(item)
    }

    if (path === '/api/v1/admin/stock/adjustments' && method === 'POST') {
      const key = `${body?.flavorKey}|${body?.packSizeGrams}`
      const item = stockItems.find((entry) => `${entry.flavorKey}|${entry.packSizeGrams}` === key)
      if (!item) {
        return jsonResponse({ message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      }
      item.onHand = Number(item.onHand) + Number(body.quantity)
      refreshStock(item)
      stockMovements = [{
        id: nextMovementId,
        market: body.market,
        flavorKey: body.flavorKey,
        packSizeGrams: body.packSizeGrams,
        type: 'adjustment',
        quantity: Number(body.quantity),
        reason: body.reason,
        note: body.note || null,
        productionCycleId: null,
        subscriptionId: null,
        actorName: profile.email,
        createdAt: '2026-09-21T08:00:00.000Z',
      }, ...stockMovements]
      nextMovementId += 1
      return jsonResponse(item)
    }

    if (path === '/api/v1/admin/stock/minimum' && method === 'PUT') {
      const key = `${body?.flavorKey}|${body?.packSizeGrams}`
      const item = stockItems.find((entry) => `${entry.flavorKey}|${entry.packSizeGrams}` === key)
      if (!item) {
        return jsonResponse({ message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      }
      item.minLevel = body.minLevel
      refreshStock(item)
      return jsonResponse(item)
    }

    if (path === '/api/v1/admin/billing/metrics') {
      return jsonResponse(billingMetrics)
    }

    if (path === '/api/v1/admin/billing/webhooks') {
      return jsonResponse(webhooksList)
    }

    if (path === '/api/v1/admin/billing/subscriptions' && method === 'GET') {
      return jsonResponse(subscriptionsList)
    }

    if (path === '/api/v1/admin/billing/subscriptions/reconcile' && method === 'POST') {
      return jsonResponse({ ok: true })
    }

    if (path === '/api/v1/admin/billing/subscriptions/backfill-links' && method === 'POST') {
      return jsonResponse({ success: true, data: { linked: 2 } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/customer-invoices$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { items: options.customerInvoices ?? [customerInvoice] } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/customer-invoices$/.test(path) && method === 'POST') {
      const stripeInvoiceId = String((body as { stripe_invoice_id?: string } | null)?.stripe_invoice_id || 'in_test_1')
      return jsonResponse({ success: true, data: { ...customerInvoice, id: 13, stripe_invoice_id: stripeInvoiceId, email_status: 'pending', email_sent_at: null } })
    }

    if (/^\/api\/v1\/admin\/billing\/customer-invoices\/[^/]+\/send$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { ...customerInvoice, email_status: 'sent', email_sent_at: '2026-09-02T10:30:00.000Z' } })
    }

    if (/^\/api\/v1\/admin\/billing\/customer-invoices\/[^/]+\/pdf$/.test(path) && method === 'GET') {
      return new Response('%PDF-1.3', { status: 200, headers: { 'Content-Type': 'application/pdf' } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/sync-invoices$/.test(path) && method === 'POST') {
      return jsonResponse({
        success: true,
        data: {
          items: [
            {
              id: 'in_test_1',
              number: 'INV-1001',
              status: 'paid',
              amountPaid: 89.5,
              currency: 'usd',
              createdAt: '2026-08-01T12:00:00.000Z',
            },
          ],
        },
      })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/shipments$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { items: [] } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/shipments$/.test(path) && method === 'POST') {
      return jsonResponse({
        success: true,
        data: {
          reused: false,
          shipment: {
            id: 'ship_1',
            subscription_id: 'sub-row-1',
            stripe_invoice_id: body?.invoice_id || 'in_test_1',
            ups_shipment_id: '1Z999',
            tracking_number: '1Z999AA10123456784',
            service_code: '03',
            label_format: 'GIF',
            has_label: true,
            quoted_shipping_cost: 12.9,
            ups_monetary_value: 14.2,
            status: 'created',
            shipped_at: '2026-08-02T12:00:00.000Z',
            created_at: '2026-08-02T12:00:00.000Z',
            updated_at: '2026-08-02T12:00:00.000Z',
          },
        },
      })
    }

    if (/^\/api\/v1\/admin\/shipments\/[^/]+\/void$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { shipment: { id: 'ship_1', status: 'voided' } } })
    }

    if (/^\/api\/v1\/admin\/shipments\/[^/]+\/refresh-tracking$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { shipment: { id: 'ship_1', tracking_number: '1Z999' } } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse({
        ...subscriptionItem,
        stripeSubscriptionId: subscriptionItem.providerSubscriptionId,
        stripeCustomerId: 'cus_1',
        planLabel: 'Adult 1m',
        stripePriceId: 'price_1',
        currentPeriodEnd: '2026-09-01T12:00:00.000Z',
        cancelAtPeriodEnd: false,
        dashboardUrl: 'https://dashboard.stripe.com/sub_123',
        stripeAccount: 'us',
        petsSnapshot: {},
        planSelection: {},
        shipping: {},
        address: {},
        ...(options.subscriptionSnapshot ?? {}),
        ...(options.subscriptionInScope === undefined ? {} : { customerProfileInScope: options.subscriptionInScope }),
      })
    }

    if (path === '/api/v1/admin/today' && method === 'GET') {
      const only = profile.markets?.length === 1 ? profile.markets[0] : ''
      const inScope = (market: string) => !only || market === only
      return jsonResponse({
        success: true,
        data: {
          ...todayOverview,
          items: todayOverview.items.filter((item) => inScope(item.market)),
          closedDays: todayOverview.closedDays.filter((day) => inScope(day.market)),
        },
      })
    }

    if (path === '/api/v1/admin/shipping/settings' && method === 'GET') {
      return jsonResponse(shippingSettings)
    }

    if (path === '/api/v1/admin/shipping/settings' && method === 'PUT') {
      return jsonResponse(shippingSettings)
    }

    if (path === '/api/v1/admin/shipping/test' && method === 'POST') {
      const country = body?.country === 'US' ? 'US' : 'BR'
      if (country === 'US') {
        return jsonResponse({
          success: true,
          data: {
            country: 'US',
            quote_mode: 'ups',
            fixed: null,
            ups: {
              environment: 'cie',
              destination: { city: 'San Francisco', state: 'CA', zipcode: '94105' },
              steps: [
                { key: 'oauth', label: 'Autenticação OAuth', status: 'ok', detail: 'Token emitido pela UPS sandbox (CIE).', ms: 120 },
                { key: 'destination', label: 'Cidade e estado do ZIP', status: 'ok', detail: 'San Francisco, CA 94105', ms: 80 },
                { key: 'origin', label: 'Endereço da sede (XAV)', status: 'skipped', detail: 'O sandbox da UPS só valida endereços de NY e CA.' },
                { key: 'rating', label: 'Cotação com prazo (Shoptimeintransit)', status: 'ok', detail: '2 serviço(s) cotado(s).', ms: 340 },
              ],
              rates: [
                { service_code: '03', label: 'UPS Ground', amount: 18.45, currency: 'USD', delivery_days: 4, allowed: true },
                { service_code: '01', label: 'UPS Next Day Air', amount: 72.1, currency: 'USD', delivery_days: 1, allowed: false },
              ],
              selected: { service_code: '03', label: 'UPS Ground', amount: 18.45, currency: 'USD', delivery_days: 4 },
            },
          },
        })
      }
      return jsonResponse({
        success: true,
        data: {
          distance: 8.2,
          shipping: 12.5,
          delivery_days: 1,
          distance_source: 'osrm',
          destination: { city: 'São Paulo', state: 'SP', zipcode: '01310-100' },
          breakdown: { minimum_applied: false },
        },
      })
    }

    if (path === '/api/v1/admin/shipping/headquarters/validate' && method === 'POST') {
      const address = (body?.address || {}) as Record<string, string>
      if (body?.country === 'BR') {
        return jsonResponse({
          success: true,
          data: {
            valid: true,
            country: 'BR',
            address: { ...address, city: 'São Paulo', state: 'SP', zipcode: '01310-100', neighborhood: 'Bela Vista' },
            location: { lat: -23.5652, lng: -46.6514, precision: 'address' },
            errors: {},
            warnings: [],
          },
        })
      }
      return jsonResponse({
        success: true,
        data: {
          valid: false,
          country: 'US',
          address,
          errors: { state: 'O ZIP 33101 é de FL.' },
          warnings: [],
        },
      })
    }

    if (path === '/api/v1/onboarding/zipcode/lookup' && method === 'POST') {
      return jsonResponse({
        success: true,
        data: { status: 'found', street: 'Avenida Paulista', neighborhood: 'Bela Vista', city: 'São Paulo', state: 'SP' },
      })
    }

    if (path === '/api/v1/admin/stripe/first-purchase-promos' && method === 'GET') {
      return jsonResponse(firstPurchasePromoHealth)
    }

    if (path === '/api/v1/admin/stripe/first-purchase-promos' && method === 'PUT') {
      return jsonResponse({
        ...firstPurchasePromoHealth,
        mapping: {
          1: body?.[1] || firstPurchasePromoHealth.mapping[1],
          3: body?.[3] || firstPurchasePromoHealth.mapping[3],
          6: body?.[6] || firstPurchasePromoHealth.mapping[6],
        },
      })
    }

    if (path === '/api/v1/admin/stripe/first-purchase-promos/sync' && method === 'POST') {
      return jsonResponse({
        ...firstPurchasePromoHealth,
        slots: { 1: { promotion_code_id: 'promo_1m', coupon_id: 'coupon_1', active: true, source: 'stored' } },
        missing_in_stripe: [],
        inactive: [],
      })
    }

    if (path === '/api/v1/admin/stripe/first-purchase-coupons' && method === 'POST') {
      return jsonResponse({
        success: true,
        data: {
          created: true,
          mapped: true,
          coupon_id: 'coupon_new',
          promotion_code_id: 'promo_new',
          code: body?.code,
          percent_off: 10,
          health: firstPurchasePromoHealth,
        },
      })
    }

    if (path === '/api/v1/admin/stripe/promotion-codes' && method === 'GET') {
      return jsonResponse(promotionCodesList)
    }

    if (path === '/api/v1/admin/nutrition/recipes' && method === 'GET') {
      return jsonResponse({
        success: true,
        data: {
          market: url.searchParams.get('market') || 'BR',
          items: [
            { key: 'pork', name: 'Suíno', life_stage: 'adult', energy_kcal_kg: 1200 },
            { key: 'fish', name: 'Peixe', life_stage: 'adult', energy_kcal_kg: null },
            { key: 'puppy-beef', name: 'Filhote carne e frango', life_stage: 'puppy', energy_kcal_kg: 1500 },
          ],
        },
      })
    }

    if (path === '/api/v1/admin/nutrition/simulate' && method === 'POST') {
      return jsonResponse({
        success: true,
        data: {
          energia_kcal_dia: 900,
          quantidade_g_dia: 250,
          refeicoes: 2,
          quantidade_por_refeicao: 125,
          fator_aplicado: 1.4,
          porte: 'médio',
          especie: 'cão',
          nem_kcal_kg: body?.recipe_key === 'puppy-beef' ? 1500 : 1200,
          nem_source: body?.recipe_key ? 'recipe' : 'life_stage_average',
          recipe_key: body?.recipe_key ?? null,
          parameter_set: body?.parameter_set === 'draft' ? { id: 2, status: 'draft' } : { id: 1, status: 'published' },
          display: { daily: '250 g', weight: '20 kg' },
        },
      })
    }

    if (path === '/api/v1/admin/feedbacks' && method === 'GET') {
      return jsonResponse(feedbacksList)
    }

    if (path === '/api/v1/admin/feedbacks' && method === 'POST') {
      return jsonResponse({
        ...feedbackItem,
        id: 2,
        name: body?.name || 'Novo cliente',
        category: body?.category || 'tutor',
        country: body?.country || 'BR',
        place: body?.place || '',
        comment: body?.comment || '',
        active: body?.active ?? true,
      })
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+\/active$/.test(path) && method === 'PATCH') {
      return jsonResponse({ ...feedbackItem, active: Boolean(body?.active) })
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+$/.test(path) && method === 'GET') {
      return jsonResponse(feedbackItem)
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+$/.test(path) && method === 'PATCH') {
      return jsonResponse({ ...feedbackItem, ...body })
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+$/.test(path) && method === 'DELETE') {
      return jsonResponse({ deleted: true, id: Number(path.split('/').pop()) })
    }

    if (path === '/api/v1/admin/privacy/requests' && method === 'GET') {
      return jsonResponse(privacyRequestsList)
    }

    if (path === '/api/v1/admin/privacy/requests' && method === 'POST') {
      return jsonResponse({
        ...privacyRequestItem,
        id: 42,
        userId: Number(body?.userId) || 77,
        type: body?.type || 'correction',
        market: body?.market || 'BR',
      })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/in-progress$/.test(path) && method === 'POST') {
      return jsonResponse({ ...privacyRequestItem, status: 'in_progress' })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/extend$/.test(path) && method === 'POST') {
      return jsonResponse({
        ...privacyRequestItem,
        extendedAt: '2026-01-06T00:00:00.000Z',
        extensionReason: body?.reason || 'need more time',
        dueAt: '2026-02-04T00:00:00.000Z',
        overdue: false,
      })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/complete$/.test(path) && method === 'POST') {
      if (privacyRequestItem.identityStatus === 'unverified' && ['access', 'deletion', 'portability'].includes(String(privacyRequestItem.type))) {
        return jsonResponse({ success: false, message: 'Identity must be verified before completing this request.' }, 422)
      }
      return jsonResponse({ ...privacyRequestItem, status: 'completed' })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/reject$/.test(path) && method === 'POST') {
      return jsonResponse({ ...privacyRequestItem, status: 'rejected', resultNote: body?.note || 'Rejected.' })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/send-verification$/.test(path) && method === 'POST') {
      return jsonResponse({ sent: true, to: 'ana@edenbowls.com' })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/verify-identity$/.test(path) && method === 'POST') {
      return jsonResponse({
        ...privacyRequestItem,
        identityStatus: 'verified_account_email',
        identityVerifiedAt: '2026-01-06T00:00:00.000Z',
      })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+\/export$/.test(path) && method === 'GET') {
      return jsonResponse({ exportedAt: '2026-01-06T00:00:00.000Z', profile: { email: 'ana@edenbowls.com' } })
    }

    if (/^\/api\/v1\/admin\/privacy\/requests\/\d+$/.test(path) && method === 'GET') {
      return jsonResponse(privacyRequestItem)
    }

    if (path === '/api/v1/breeds') {
      return jsonResponse({ success: true, data: { items: [{ name: 'Vira-lata', slug: 'vira-lata' }] } })
    }

    return jsonResponse({ message: `unmocked ${method} ${path}` }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)

  return { fetchMock, calls }
}

export function findCall(calls: FetchCall[], method: string, pathIncludes: string) {
  return calls.find((call) => call.method === method && call.path.includes(pathIncludes) && !call.path.endsWith('/me'))
}
