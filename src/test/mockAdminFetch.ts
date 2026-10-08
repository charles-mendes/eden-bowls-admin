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
  userPrivacySnapshot,
  marketConflicts,
} from './fixtures'

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
  subscriptionInScope?: boolean
  customerInvoices?: Array<Record<string, unknown>>
  productionInScope?: boolean
  productionQueue?: Array<Record<string, unknown>>
  subscriptionSnapshot?: {
    petsSnapshot?: unknown
    planSelection?: unknown
    address?: unknown
    shipping?: unknown
  }
  products?: typeof productsList.items
  product?: typeof productDetail
  catalogDelete?: 'in_use' | 'archive'
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

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseUrl(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const authorization = new Headers(init?.headers).get('Authorization') ?? ''
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const path = url.pathname
    const search = url.search

    calls.push({ url: String(input), path, search, method, authorization, body })

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
      return jsonResponse({ items: options.marketConflicts ?? marketConflicts.items })
    }

    if (path === '/api/v1/admin/catalog/sync/health') {
      return jsonResponse(syncHealth)
    }

    if (path === '/api/v1/admin/catalog/sync/status') {
      return jsonResponse(syncStatus)
    }

    if (path === '/api/v1/admin/production/queue' && method === 'GET') {
      const productionStatus = url.searchParams.get('productionStatus')
      const items = options.productionQueue
        ? options.productionQueue
        : productionStatus && productionStatus !== productionQueueItem.productionStatus
          ? []
          : [{
            ...productionQueueItem,
            customerProfileInScope: options.productionInScope ?? productionQueueItem.customerProfileInScope,
          }]
      return jsonResponse({
        ...productionQueueList,
        total: items.length,
        totalPages: 1,
        items,
      })
    }

    if (/^\/api\/v1\/admin\/production\/queue\/\d+$/.test(path) && method === 'PATCH') {
      return jsonResponse({
        ...productionQueueItem,
        productionStatus: body?.status || 'in_production',
        note: body?.note || null,
      })
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
          nem_kcal_kg: 3600,
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
