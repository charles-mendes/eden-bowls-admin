import { vi } from 'vitest'
import type { AdminUser } from '../contexts/AuthContext'
import {
  billingMetrics,
  checkoutDetail,
  checkoutList,
  checkoutMetrics,
  jsonResponse,
  operatorWriteUser,
  productDetail,
  productsList,
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

    if (/^\/api\/v1\/admin\/users\/[^/]+\/roles$/.test(path) && method === 'PUT') {
      return jsonResponse({ ...staffUser, storedRoles: [body.role], roles: [body.role] })
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

    if (/^\/api\/v1\/admin\/onboarding\/checkouts\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse(checkoutDetail)
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'GET') {
      return jsonResponse(productsList)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'GET') {
      return jsonResponse(productDetail)
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'PATCH') {
      return jsonResponse({ ...productDetail, ...body, active: body.active ?? productDetail.active })
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
      return jsonResponse({ success: true, data: { items: [] } })
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
      return jsonResponse({
        success: true,
        data: { distance: 8.2, shipping: 12.5, delivery_days: 2, distance_source: 'haversine' },
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
          nem_kcal_kg: 3600,
          display: { daily: '250 g', weight: '20 kg' },
        },
      })
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
