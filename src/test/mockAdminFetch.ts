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
  recipeContent as recipeContentFixture,
  recipeImageUrl,
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

export const blingConnectionState = { connected: true }
export const nfeDetailState: { override: Record<string, unknown> } = { override: {} }

export const nfeSummary = {
  id: 5,
  status: 'error',
  customer_name: 'Ana Souza',
  customer_email: 'ana@example.com',
  customer_document: '52998224725',
  total_minor: 15000,
  currency: 'brl',
  nfe_number: '158',
  nfe_series: '1',
  access_key: '35251234',
  last_error: 'Escopo ausente',
  attempts: 1,
  created_at: '2026-10-30T12:00:00.000Z',
  authorized_at: null,
  bling_situacao: 4,
  bling_situacao_label: 'Rejeitada',
  imported: false,
  can_retry: true,
  can_edit: true,
}

export const nfeDetail = {
  ...nfeSummary,
  user_id: 7,
  stripe_account: 'br',
  stripe_subscription_id: 'sub_nfe_1',
  stripe_invoice_id: 'in_nfe_1',
  bling_contact_id: 9001,
  bling_order_id: 9002,
  bling_nfe_id: 9003,
  protocol: null,
  customer_address: { street: 'Rua A', number: '1', city: 'São Paulo', state: 'SP', zipcode: '01001000' },
  request_payload: { order: { numeroLoja: 'in_nfe_1' } },
  response_payload: { order: { id: 9002 } },
  danfe_url: 'https://bling.example/danfe',
  pdf_url: null,
  xml_url: null,
  next_attempt_at: null,
  submitted_at: null,
  updated_at: '2026-10-30T12:00:00.000Z',
  missing_fields: [] as string[],
  address_issue: null as Record<string, unknown> | null,
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
  labelIssues?: Array<{ code: string }>
  subscriptionMarket?: string
  customerInvoices?: Array<Record<string, unknown>>
  productionInScope?: boolean
  productionQueue?: Array<Record<string, unknown>>
  productionMetrics?: { today: number; tomorrow: number; upcoming: number; overdue: number }
  productionStock?: { shortages: Array<{ flavorKey: string; packSizeGrams: number; onHand: number }>; unsized: number }
  // production-block-preview: the answer, or a status for an error.
  // PM-10: a PATCH of these queue ids fails with this message.
  productionPatchFailures?: Record<number, string>
  blockPreview?: { charged: boolean; chargeMovesTo: string | null; preparationDay: string | null } | { status: number; code: string }
  stockItems?: Array<Record<string, unknown>>
  stockUnsized?: Array<Record<string, unknown>>
  stockCatalog?: Array<Record<string, unknown>>
  stockWithoutWeight?: Array<Record<string, unknown>>
  stockMovements?: Array<Record<string, unknown>>
  subscriptionSnapshot?: {
    petsSnapshot?: unknown
    planSelection?: unknown
    address?: unknown
    shipping?: unknown
    courier_issues?: string[] | null
    account_name?: string | null
    delivery_instructions?: string | null
    delivery_instructions_source?: 'subscription' | 'profile' | null
  }
  // subscription-detail-workflow: fields of GET /admin/billing/subscriptions/:id to replace (status, cancel, ...).
  subscriptionOverrides?: Record<string, unknown>
  // customer-subscriptions-operational-links: the subscriptions of GET /admin/users/:userId.
  customerSubscriptions?: Array<Record<string, unknown>>
  products?: typeof productsList.items
  product?: typeof productDetail
  catalogDelete?: 'in_use' | 'archive'
  catalogActivation?: 'refused' | 'in_use'
  catalogPatch?: 'locked'
  recipeContent?: typeof recipeContentFixture
  recipeImage?: 'invalid'
  contacts?: Array<Record<string, unknown>>
  contactError?: { status: number; code: string; field?: string }
  paidCycles?: Array<Record<string, unknown>>
  marketExceptions?: Array<Record<string, unknown>>
  // The subscription detail's shipping market (shipment-market) and address problem (delivery-address-issues).
  marketException?: boolean
  addressIssue?: Record<string, unknown> | null
  // ups-pickup: the pickups GET /admin/shipments/pickups returns.
  upsPickups?: Array<Record<string, unknown>>
  // ups-dry-ice-declaration: the GET and PUT /admin/shipping/settings answer, and a refused PUT.
  shippingSettings?: typeof shippingSettings
  shippingSettingsSaveError?: { status: number; code: string; message: string }
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

  // plan-settings: plan days and large-pack limit of each market.
  const planSettings: Record<string, { market: string; planDays: number; largePackLimit: number; updatedAt: string | null }> = {
    BR: { market: 'BR', planDays: 30, largePackLimit: 8, updatedAt: null },
    US: { market: 'US', planDays: 30, largePackLimit: 8, updatedAt: null },
  }

  let recipeContent = {
    ...(options.recipeContent ?? recipeContentFixture),
    variations: (options.recipeContent ?? recipeContentFixture).variations.map((item) => ({ ...item })),
  }
  // The product detail carries its content as the API annotates it; a content save reaches both.
  const productContent = () => ({
    code: recipeContent.flavorSlug,
    name: recipeContent.name,
    lifeStage: recipeContent.lifeStage,
    flavorAliases: recipeContent.flavorAliases ?? '',
    shortLabel: recipeContent.shortLabel ?? '',
    imageUrl: recipeContent.imageUrl,
    planImageUrl: recipeContent.planImageUrl ?? null,
    labelStatus: recipeContent.labelStatus,
    labelMissing: recipeContent.labelMissing,
    presentationReady: Boolean(recipeContent.presentation),
    label: recipeContent.label,
    presentation: recipeContent.presentation,
  })
  const detailWithContent = () => (catalogDetail.content === null ? catalogDetail : { ...catalogDetail, content: productContent() })

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

  let contacts = (options.contacts ?? []).map((item) => ({ ...item }))
  let nextContactId = contacts.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1

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

    if (/^\/api\/v1\/admin\/users\/[^/]+\/delivery-instructions$/.test(path) && method === 'PATCH') {
      return jsonResponse({ ok: true })
    }

    if (path.endsWith('/fiscal') && method === 'PATCH') {
      return jsonResponse({ success: true })
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
      return jsonResponse(options.customerSubscriptions ? { ...userDetail, subscriptions: options.customerSubscriptions } : userDetail)
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

    if (path === '/api/v1/admin/catalog/plan-settings') {
      const market = (url.searchParams.get('market') || '').toUpperCase()
      if (!planSettings[market]) return jsonResponse({ message: 'Choose one market.', code: 'market_required' }, 400)
      if (method === 'PUT') {
        planSettings[market] = { ...planSettings[market], planDays: Number(body?.planDays), largePackLimit: Number(body?.largePackLimit), updatedAt: '2026-11-12T12:00:00.000Z' }
      }
      return jsonResponse(planSettings[market])
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'GET') {
      const code = url.searchParams.get('code')
      const listMarket = url.searchParams.get('market')
      const items = catalogItems
        .filter((item) => !code || item.content?.code === code)
        .filter((item) => !listMarket || item.planCountry === listMarket)
      return jsonResponse({
        ...productsList,
        total: items.length,
        items,
      })
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'POST') {
      const code = String(body?.code ?? '')
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(code)) {
        return jsonResponse({ message: 'Product code must use lowercase letters, digits and single hyphens.', details: { code: 'recipe_key_invalid' } }, 422)
      }
      if (catalogItems.some((item) => item.planCountry === body?.planCountry && item.content?.code === code)) {
        return jsonResponse({ message: 'A product with this code already exists in the market.', details: { code: 'product_code_taken' } }, 409)
      }
      return jsonResponse({
        id: '301',
        slug: `${code}-${String(body?.planCountry || 'BR').toLowerCase()}`,
        namePt: body?.name || 'Plano novo',
        nameEn: body?.name || 'Plano novo',
        active: false,
        planCountry: body?.planCountry || 'BR',
        stripeProductId: 'prod_live_301',
        variants: [],
        content: { code, name: body?.name, lifeStage: body?.lifeStage ?? 'adult', flavorAliases: '', shortLabel: '', imageUrl: null, planImageUrl: null, labelStatus: 'missing', labelMissing: [], presentationReady: false },
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
      return jsonResponse(detailWithContent())
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
      return jsonResponse(detailWithContent())
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/image$/.test(path) && method === 'PUT') {
      if (options.recipeImage === 'invalid') {
        return jsonResponse({
          message: 'Image must be 1024 x 636 pixels, or close enough to be resized to it.',
          details: { code: 'recipe_image_invalid', reason: 'dimensions', width: 800, height: 800, expectedWidth: 1024, expectedHeight: 636, maxUpscale: 1.25, maxCrop: 0.15 },
        }, 422)
      }
      recipeContent = { ...recipeContent, imageUrl: recipeImageUrl, imageUpdatedAt: '2026-10-23T12:00:00.000Z' }
      return jsonResponse(recipeContent)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/image$/.test(path) && method === 'DELETE') {
      const active = recipeContent.variations.filter((item) => item.active)
      if (active.length) {
        return jsonResponse({
          message: 'The image of a product with an active variation cannot be removed.',
          details: { code: 'recipe_content_in_use', activeVariations: active.map((item) => item.id) },
        }, 409)
      }
      recipeContent = { ...recipeContent, imageUrl: null }
      return jsonResponse(recipeContent)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/plan-image$/.test(path) && ['PUT', 'DELETE'].includes(method)) {
      recipeContent = method === 'PUT'
        ? { ...recipeContent, planImageUrl: '/recipe-images/recipe-br-turkey-plan-1.webp', planImageUpdatedAt: '2026-10-27T12:00:00.000Z' }
        : { ...recipeContent, planImageUrl: null }
      return jsonResponse(recipeContent)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/presentation$/.test(path) && method === 'PUT') {
      recipeContent = { ...recipeContent, presentation: body?.presentation ?? null, presentationUpdatedAt: '2026-10-27T12:00:00.000Z' }
      return jsonResponse(recipeContent)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/label$/.test(path) && method === 'PUT') {
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
      return jsonResponse(detailWithContent())
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'PATCH' && options.catalogPatch === 'locked' && Array.isArray(body?.variants)) {
      return jsonResponse({
        message: 'Active variations of a published product cannot be edited.',
        details: { code: 'variation_active_locked', variationIds: ['var-1'] },
      }, 409)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'PATCH' && Array.isArray(body?.variants)
      && body.variants.some((item: { id?: string; weight?: string }) => item.weight && catalogDetail.variants.some((row) => row.id !== item.id && (row as { weight?: string | null }).weight === item.weight))) {
      return jsonResponse({
        message: 'Another variation of this product already has this weight.',
        details: { code: 'variation_weight_taken', weight: body.variants[0].weight },
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
      const { name, lifeStage, flavorAliases, shortLabel, ...rest } = body ?? {}
      recipeContent = {
        ...recipeContent,
        ...(name !== undefined ? { name } : {}),
        ...(lifeStage !== undefined ? { lifeStage } : {}),
        ...(flavorAliases !== undefined ? { flavorAliases } : {}),
        ...(shortLabel !== undefined ? { shortLabel } : {}),
      }
      catalogDetail = {
        ...catalogDetail,
        ...rest,
        ...(name !== undefined ? { namePt: name, nameEn: name } : {}),
        active: body.active ?? catalogDetail.active,
        variants,
      }
      if (body && Object.prototype.hasOwnProperty.call(body, 'active')) {
        catalogItems = catalogItems.map((item) => (
          item.id === catalogDetail.id ? { ...item, active: Boolean(body.active) } : item
        ))
      }
      return jsonResponse(detailWithContent())
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
      const due = url.searchParams.get('due')
      const items = queueItems
        .filter((item) => !productionStatus || item.productionStatus === productionStatus)
        .filter((item) => !due || item.dueBucket === due)
        // queue-overdue-filter-matches-metric: due=overdue lists ready rows only when Pronto is asked for.
        .filter((item) => due !== 'overdue' || productionStatus === 'ready' || item.productionStatus !== 'ready')
      return jsonResponse({
        ...productionQueueList,
        metrics: options.productionMetrics ?? productionQueueList.metrics,
        total: items.length,
        totalPages: 1,
        items,
      })
    }

    if (/^\/api\/v1\/admin\/production\/queue\/\d+\/block-preview$/.test(path) && method === 'GET') {
      const preview = options.blockPreview ?? { charged: false, chargeMovesTo: null, preparationDay: null }
      if ('status' in preview) {
        return jsonResponse({ success: false, message: 'Falha na prévia', code: preview.code }, preview.status)
      }
      return jsonResponse(preview)
    }

    if (/^\/api\/v1\/admin\/production\/queue\/\d+$/.test(path) && method === 'PATCH') {
      const id = Number(path.split('/').pop())
      const failure = options.productionPatchFailures?.[id]
      if (failure) return jsonResponse({ success: false, message: failure }, 409)
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
        catalog: options.stockCatalog ?? [],
        variationsWithoutWeight: options.stockWithoutWeight ?? [],
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

    if (path === '/api/v1/admin/stock/counts' && method === 'POST') {
      const key = `${body?.flavorKey}|${body?.packSizeGrams}`
      const item = stockItems.find((entry) => `${entry.flavorKey}|${entry.packSizeGrams}` === key)
      if (!item) {
        return jsonResponse({ message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      }
      const quantity = Number(body.countedQuantity) - Number(item.onHand)
      item.onHand = Number(body.countedQuantity)
      refreshStock(item)
      stockMovements = [{
        id: nextMovementId,
        market: body.market,
        flavorKey: body.flavorKey,
        packSizeGrams: body.packSizeGrams,
        type: 'adjustment',
        quantity,
        reason: 'count',
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
              // Stripe's amount_paid, in minor units.
              amountPaid: 8950,
              currency: 'usd',
              createdAt: '2026-08-01T12:00:00.000Z',
            },
          ],
        },
      })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/contacts$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { items: contacts } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/contacts$/.test(path) && method === 'POST') {
      if (options.contactError) {
        const { status, code, field } = options.contactError
        return jsonResponse({ code, message: 'Contato recusado.', details: { code, ...(field ? { field } : {}) } }, status)
      }
      const contact = {
        id: nextContactId++,
        subscription_id: decodeURIComponent(path.split('/')[6]),
        channel: 'whatsapp',
        reason: body?.reason,
        outcome: body?.outcome,
        note: body?.note || null,
        actor_email: profile.email,
        created_at: new Date().toISOString(),
      }
      contacts = [contact, ...contacts]
      return jsonResponse({ success: true, data: { contact } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/paid-cycles$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { items: options.paidCycles ?? [] } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/shipments$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { items: [], label_issues: options.labelIssues ?? [] } })
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
            tracking_url: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
            tracking_status: 'in_transit',
            tracking_description: 'Departed from facility',
            delivered_at: null,
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

    if (/^\/api\/v1\/admin\/shipments\/[^/]+\/label$/.test(path) && method === 'GET') {
      return new Response('GIF89a', { status: 200, headers: { 'Content-Type': 'image/gif' } })
    }

    if (/^\/api\/v1\/admin\/shipments\/[^/]+\/void$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { shipment: { id: 'ship_1', status: 'voided' } } })
    }

    if (/^\/api\/v1\/admin\/shipments\/[^/]+\/refresh-tracking$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { shipment: { id: 'ship_1', tracking_number: '1Z999' } } })
    }

    // delivery-instructions: the operator sets or clears the instructions of one subscription.
    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/delivery-instructions$/.test(path) && method === 'PATCH') {
      const text = String((body as { delivery_instructions?: string } | null)?.delivery_instructions || '').trim()
      if ([...text].length > 200) {
        return jsonResponse({ success: false, message: 'Invalid delivery instructions.', details: { code: 'invalid_delivery_instructions', field: 'delivery_instructions' } }, 422)
      }
      const id = path.split('/')[6]
      return jsonResponse({ success: true, data: { subscription_id: id, delivery_instructions: text || null } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse({
        ...subscriptionItem,
        term: { ...subscriptionItem.term, marketCountry: options.subscriptionMarket ?? subscriptionItem.term.marketCountry },
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
        shipment_market: options.marketException ? null : 'US',
        market_exception: Boolean(options.marketException),
        address_issue: options.addressIssue ?? null,
        ...(options.subscriptionSnapshot ?? {}),
        ...(options.subscriptionInScope === undefined ? {} : { customerProfileInScope: options.subscriptionInScope }),
        ...(options.subscriptionOverrides ?? {}),
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

    if (path === '/api/v1/admin/shipments/pickups' && method === 'GET') {
      return jsonResponse({ success: true, data: { items: options.upsPickups ?? [], from: '2026-11-02' } })
    }

    if (path === '/api/v1/admin/shipping/settings' && method === 'GET') {
      return jsonResponse(options.shippingSettings ?? shippingSettings)
    }

    if (path === '/api/v1/admin/shipping/settings' && method === 'PUT') {
      if (options.shippingSettingsSaveError) {
        const { status, code, message } = options.shippingSettingsSaveError
        return jsonResponse({ code, message, details: { code } }, status)
      }
      return jsonResponse(options.shippingSettings ?? shippingSettings)
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

    if (path === '/api/v1/admin/market-exceptions' && method === 'GET') {
      return jsonResponse({ success: true, data: { items: options.marketExceptions ?? [], truncated: false } })
    }

    if (path === '/api/v1/admin/nfe' && method === 'GET') {
      return jsonResponse({ success: true, data: { items: [nfeSummary], total: 1, page: 1, perPage: 20, totalPages: 1 } })
    }

    if (/^\/api\/v1\/admin\/nfe\/\d+$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { ...nfeDetail, ...nfeDetailState.override } })
    }

    if (/^\/api\/v1\/admin\/nfe\/\d+\/customer$/.test(path) && method === 'PATCH') {
      return jsonResponse({ success: true, data: { ...nfeDetail, customer_name: 'Ana Correta' } })
    }

    if (/^\/api\/v1\/admin\/nfe\/\d+\/email$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { ...nfeDetail, ...nfeDetailState.override, email_status: 'pending' } })
    }
    if (/^\/api\/v1\/admin\/nfe\/\d+\/retry$/.test(path) && method === 'POST') {
      return jsonResponse({ success: true, data: { ...nfeDetail, status: 'pending', can_retry: false } })
    }

    if (/^\/api\/v1\/admin\/billing\/subscriptions\/[^/]+\/nfe$/.test(path) && method === 'GET') {
      return jsonResponse({ success: true, data: { items: [nfeSummary] } })
    }

    if (path === '/api/v1/admin/bling/connection' && method === 'GET') {
      return jsonResponse({ success: true, data: { configured: true, connected: blingConnectionState.connected } })
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
