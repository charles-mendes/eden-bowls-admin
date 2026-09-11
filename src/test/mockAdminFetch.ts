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
} from './fixtures'

export type FetchCall = {
  url: string
  path: string
  search: string
  method: string
  authorization: string
  body: unknown
}

function parseUrl(input: RequestInfo | URL) {
  return new URL(String(input), 'http://admin.local')
}

export function installAdminFetchMock(profile: AdminUser = operatorWriteUser) {
  const calls: FetchCall[] = []
  let catalogItems = productsList.items.map((item) => ({ ...item, variants: [...item.variants] }))
  let catalogDetail = {
    ...productDetail,
    variants: productDetail.variants.map((item) => ({ ...item })),
  }

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseUrl(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const authorization = new Headers(init?.headers).get('Authorization') ?? ''
    const body = init?.body ? JSON.parse(String(init.body)) : null
    const path = url.pathname
    const search = url.search

    calls.push({ url: String(input), path, search, method, authorization, body })

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
      return jsonResponse(catalogDetail)
    }

    if (path === '/api/v1/admin/catalog/sync' && method === 'POST') {
      return jsonResponse({ syncJobId: 'job-2', status: 'queued' })
    }

    if (/^\/api\/v1\/admin\/catalog\/sync\/[^/]+$/.test(path) && method === 'POST') {
      return jsonResponse({ status: 'queued', summary: { created: 1, updated: 0 } })
    }

    if (path === '/api/v1/admin/catalog/sync/health') {
      return jsonResponse(syncHealth)
    }

    if (path === '/api/v1/admin/catalog/sync/status') {
      return jsonResponse(syncStatus)
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
        petsSnapshot: {},
        planSelection: {},
        shipping: {},
        address: {},
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
            shipping: 18.45,
            delivery_days: 4,
            currency: 'USD',
            label: 'UPS Ground',
            carrier: 'UPS',
            source: 'ups',
          },
        })
      }
      return jsonResponse({
        success: true,
        data: { distance: 8.2, shipping: 12.5, delivery_days: 2, distance_source: 'haversine' },
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
