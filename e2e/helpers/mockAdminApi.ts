import type { Page, Route } from '@playwright/test'

type Profile = {
  userId: string
  email: string
  roles: string[]
  permissions: string[]
}

export type CapturedAdminRequest = {
  method: string
  path: string
  search: string
  authorization: string
  body: unknown
}

type MockAdminApiOptions = {
  profile?: Profile
  tokenStatus?: number
}

const WRITE_PERMISSIONS = [
  'nutrition.simulate',
  'onboarding.read',
  'shipping.read',
  'shipping.write',
  'catalog.read',
  'catalog.write',
  'catalog.sync',
  'checkout.read',
  'billing.subscribers.read',
  'billing.subscribers.sync',
  'billing.coupons.write',
  'users.read',
  'users.delivery.write',
  'users.roles.write',
]

const operatorProfile: Profile = {
  userId: 'u-operator',
  email: 'ops@edenbowls.com',
  roles: ['operator'],
  permissions: ['onboarding.read', 'shipping.read', 'catalog.read', 'users.read'],
}

const operatorWriteProfile: Profile = {
  userId: 'u-operator-write',
  email: 'ops.write@edenbowls.com',
  roles: ['operator'],
  permissions: WRITE_PERMISSIONS.filter((permission) => permission !== 'users.roles.write'),
}

const adminProfile: Profile = {
  userId: 'u-admin',
  email: 'admin@edenbowls.com',
  roles: ['admin'],
  permissions: WRITE_PERMISSIONS,
}

const readonlyProfile: Profile = {
  userId: 'u-readonly',
  email: 'read@edenbowls.com',
  roles: ['readonly'],
  permissions: ['onboarding.read', 'catalog.read', 'users.read', 'billing.subscribers.read'],
}

const checkoutItem = {
  userId: 'u-ana',
  email: 'ana@edenbowls.com',
  displayName: 'Ana Costa',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdAt: '2026-08-01T12:00:00.000Z',
  petCount: 1,
  subscriptionCount: 1,
  stripeStatus: 'active',
  stripeSubscriptionId: 'sub_123',
  frequency: 'every_4_weeks',
  termMonths: 1,
}

const checkoutDetail = {
  ...checkoutItem,
  activationStatus: 'active',
  empty: false,
  subscriptions: [
    { id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'active', currentPeriodEnd: '2026-09-01T12:00:00.000Z', cancelAtPeriodEnd: false, planLabel: 'Adult 1m' },
  ],
  pets: [{ id: 'pet-1', name: 'Luna', breed: 'Vira-lata', ageYears: 4, ageMonths: 0, weightInput: 12, weightUnit: 'kg', activityLevel: 'BAIXO', petCondition: 'ADEQUADO', neutered: true }],
  recurrence: { frequency: 'every_4_weeks' },
  planSelection: { plan: 'adult' },
  address: { city: 'São Paulo' },
  shipping: { method: 'eden' },
  discount: { promotionCodeId: null, eligibilityReason: 'ineligible' },
  lineItems: [{ sku: 'bowl-1' }],
  checkoutReference: { id: 'co_1' },
  paymentReference: { id: 'pi_1' },
}

const userDetail = {
  id: 'u-ana',
  email: 'ana@edenbowls.com',
  status: 'active',
  createdAt: '2026-08-01T12:00:00.000Z',
  roles: ['customer'],
  profile: { fullName: 'Ana Costa', phone: '11999999999' },
  lockedByAllowlist: false,
  delivery: {
    address: 'Rua Augusta 100',
    complement: 'ap 12',
    city: 'São Paulo',
    state: 'SP',
    zipCode: '01310-100',
    deliveryInstructions: 'Deixar na portaria',
  },
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function installAdminApiMocks(page: Page, options: MockAdminApiOptions = {}) {
  const profile = options.profile ?? operatorProfile
  const tokenStatus = options.tokenStatus ?? 200
  const captured: CapturedAdminRequest[] = []

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const url = new URL(request.url())
    const path = url.pathname
    const authorization = request.headers().authorization ?? ''
    const body = method === 'GET' ? null : request.postDataJSON()

    captured.push({ method, path, search: url.search, authorization, body })

    if (path === '/api/v1/auth/token' && method === 'POST') {
      if (tokenStatus !== 200) {
        await fulfillJson(route, { code: 'invalid_credentials', message: 'Invalid username or password' }, tokenStatus)
        return
      }

      if (!body?.username || !body.password) {
        await fulfillJson(route, { message: 'username and password are required' }, 400)
        return
      }

      await fulfillJson(route, { token: 'e2e-access-token' })
      return
    }

    if (path === '/api/v1/admin/me' && method === 'GET') {
      if (!authorization.startsWith('Bearer ')) {
        await fulfillJson(route, { message: 'Unauthorized' }, 401)
        return
      }
      await fulfillJson(route, profile)
      return
    }

    if (path === '/api/v1/admin/users/roles') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 50,
        totalPages: 1,
        items: [{ id: 'u-ops', email: 'ops@edenbowls.com', storedRoles: ['operator'], roles: ['operator'], lockedByAllowlist: false, profile: { fullName: 'Operador' } }],
        bootstrapEmails: ['admin@edenbowls.com'],
      })
      return
    }

    if (path === '/api/v1/admin/users' && method === 'GET') {
      await fulfillJson(route, { total: 1, page: 1, perPage: 20, totalPages: 1, items: [userDetail] })
      return
    }

    if (path === '/api/v1/admin/users/u-ana/delivery-instructions' && method === 'PATCH') {
      await fulfillJson(route, { ok: true })
      return
    }

    if (path === '/api/v1/admin/users/u-ana' && method === 'GET') {
      await fulfillJson(route, userDetail)
      return
    }

    if (path === '/api/v1/admin/onboarding/metrics') {
      await fulfillJson(route, {
        totalCheckouts: 4,
        linkedToStripe: 3,
        stripeActive: 2,
        withSimplified: 1,
        generatedAt: '2026-08-19T12:00:00.000Z',
      })
      return
    }

    if (path === '/api/v1/admin/onboarding/checkouts' && method === 'GET') {
      await fulfillJson(route, { total: 1, page: 1, perPage: 20, totalPages: 1, items: [checkoutItem] })
      return
    }

    if (path === '/api/v1/admin/onboarding/checkouts/u-ana' && method === 'GET') {
      await fulfillJson(route, checkoutDetail)
      return
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'GET') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 20,
        items: [{
          id: 'prod-1',
          slug: 'bowl-adulto',
          namePt: 'Bowl Adulto',
          nameEn: 'Adult Bowl',
          active: true,
          category: { namePt: 'Alimentação', nameEn: 'Food' },
          marketConfigs: [{ marketCountry: 'BR', currency: 'BRL', active: true }],
          variants: [{ id: 'var-1', sku: 'BOWL-1', variantPrices: [{ id: 'price-1' }] }],
          createdAt: '2026-08-01T12:00:00.000Z',
        }],
      })
      return
    }

    if (path === '/api/v1/admin/catalog/products/prod-1' && method === 'GET') {
      await fulfillJson(route, {
        id: 'prod-1',
        slug: 'bowl-adulto',
        namePt: 'Bowl Adulto',
        nameEn: 'Adult Bowl',
        active: false,
        planCountry: 'BR',
        planDays: 28,
        variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9, stripeProductId: 'prod_stripe', stripePriceId: 'price_stripe', syncStatus: 'mapped', requiresSync: false }],
      })
      return
    }

    if (path === '/api/v1/admin/catalog/products/prod-1' && method === 'PATCH') {
      await fulfillJson(route, {
        id: 'prod-1',
        slug: 'bowl-adulto',
        namePt: 'Bowl Adulto',
        nameEn: 'Adult Bowl',
        active: body?.active ?? false,
        planCountry: body?.planCountry ?? 'BR',
        planDays: body?.planDays ?? 28,
        variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9, stripeProductId: 'prod_stripe', stripePriceId: 'price_stripe', syncStatus: 'mapped', requiresSync: false }],
      })
      return
    }

    if (path === '/api/v1/admin/catalog/sync' && method === 'POST') {
      await fulfillJson(route, { syncJobId: 'job-2', status: 'queued' })
      return
    }

    if (path.startsWith('/api/v1/admin/catalog/sync/health')) {
      await fulfillJson(route, { market: 'BR', currency: 'BRL', totalExpected: 10, totalMapped: 10, gaps: [] })
      return
    }

    if (path === '/api/v1/admin/catalog/sync/status') {
      await fulfillJson(route, { syncJobId: 'job-1', status: 'idle', summary: { scope: 'catalog' } })
      return
    }

    if (path === '/api/v1/admin/billing/metrics') {
      await fulfillJson(route, { total: 10, active: 8, canceling: 1, pastDue: 0, canceled30d: 1, renewing7d: 2 })
      return
    }

    if (path === '/api/v1/admin/billing/webhooks') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 20,
        items: [{ id: 'wh-1', eventId: 'evt_1', eventType: 'invoice.paid', state: 'processed', attempts: 1, processedAt: '2026-08-19T12:00:00.000Z' }],
      })
      return
    }

    if (path === '/api/v1/admin/billing/subscriptions' && method === 'GET') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 20,
        items: [{
          id: 'sub-row-1',
          providerSubscriptionId: 'sub_123',
          status: 'active',
          autoRenew: true,
          nextBillingAt: '2026-09-01T12:00:00.000Z',
          createdAt: '2026-08-01T12:00:00.000Z',
          user: { id: 'u-ana', email: 'ana@edenbowls.com' },
          term: { marketCountry: 'BR', months: 1 },
        }],
      })
      return
    }

    if (path === '/api/v1/admin/billing/subscriptions/sub-row-1' && method === 'GET') {
      await fulfillJson(route, {
        id: 'sub-row-1',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_1',
        status: 'active',
        planLabel: 'Adult 1m',
        stripePriceId: 'price_1',
        currentPeriodEnd: '2026-09-01T12:00:00.000Z',
        cancelAtPeriodEnd: false,
        dashboardUrl: 'https://dashboard.stripe.com/sub_123',
        user: { id: 'u-ana', email: 'ana@edenbowls.com' },
        petsSnapshot: {},
        planSelection: {},
        shipping: {},
        address: {},
      })
      return
    }

    if (path === '/api/v1/admin/shipping/settings') {
      await fulfillJson(route, {
        success: true,
        data: {
          settings: {
            br: {
              enabled: true,
              label: 'Entrega Eden Bowl',
              center: { name: 'CD SP', street: '', city: 'São Paulo', state: 'SP', zipcode: '01310-100', lat: -23.55, lng: -46.63 },
              rule: { per_km: 0.95, road_factor: 1.3, min_fee: 0, max_fee: null, max_distance_km: 500, km_per_day: 80, min_days: 2, max_days: 10 },
            },
            us: { enabled: true, cost: 12.9, carrier: 'FedEx', delivery: '3–5 business days', label: 'FedEx 3–5 business days' },
          },
        },
      })
      return
    }

    if (path.startsWith('/api/v1/breeds')) {
      await fulfillJson(route, { success: true, data: { items: [] } })
      return
    }

    await fulfillJson(route, { message: `unmocked ${method} ${path}` }, 404)
  })

  return { captured }
}

export async function openAuthed(page: Page, path: string, profile: Profile = operatorWriteProfile) {
  const mocks = await installAdminApiMocks(page, { profile })
  await page.addInitScript(() => {
    localStorage.setItem('eden-bowls-admin-token', 'e2e-access-token')
  })
  await page.goto(path)
  return mocks
}

export const e2eProfiles = {
  operator: operatorProfile,
  operatorWrite: operatorWriteProfile,
  admin: adminProfile,
  nutritionist: {
    userId: 'u-nutritionist',
    email: 'nutri@edenbowls.com',
    roles: ['nutritionist'],
    permissions: ['nutrition.simulate'],
  },
  customer: {
    userId: 'u-customer',
    email: 'client@edenbowls.com',
    roles: ['customer'],
    permissions: [],
  },
  readonly: readonlyProfile,
}
