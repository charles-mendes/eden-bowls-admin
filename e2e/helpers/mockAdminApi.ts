import type { Page, Route } from '@playwright/test'

type Profile = {
  userId: string
  email: string
  roles: string[]
  permissions: string[]
  markets?: Array<'BR' | 'US'>
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
  'users.status.write',
  'users.roles.write',
  'users.access.write',
  'feedbacks.read',
  'feedbacks.write',
  'production.read',
  'production.write',
]

const operatorProfile: Profile = {
  userId: 'u-operator',
  email: 'ops@edenbowls.com',
  roles: ['operator'],
  markets: ['BR'],
  permissions: ['onboarding.read', 'shipping.read', 'catalog.read', 'users.read', 'feedbacks.read', 'production.read', 'market.br'],
}

const operatorWriteProfile: Profile = {
  userId: 'u-operator-write',
  email: 'ops.write@edenbowls.com',
  roles: ['operator'],
  markets: ['BR'],
  permissions: [
    ...WRITE_PERMISSIONS.filter((permission) => permission !== 'users.roles.write' && permission !== 'users.access.write'),
    'market.br',
  ],
}

const adminProfile: Profile = {
  userId: 'u-admin',
  email: 'admin@edenbowls.com',
  roles: ['admin'],
  markets: ['BR', 'US'],
  permissions: [...WRITE_PERMISSIONS, 'market.br', 'market.us'],
}

const readonlyProfile: Profile = {
  userId: 'u-readonly',
  email: 'read@edenbowls.com',
  roles: ['readonly'],
  markets: ['BR'],
  permissions: ['onboarding.read', 'catalog.read', 'users.read', 'billing.subscribers.read', 'feedbacks.read', 'production.read', 'market.br'],
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
  planSelection: {
    pets: [{ pet_id: 'pet-1', enabled: true, pet_name: 'Luna', flavor_weights: [5, 5], selected_flavors: ['beef', 'fish'] }],
    country: 'BR',
    currency: 'BRL',
    catalog_pricing: {
      currency: 'BRL',
      subtotal: 550,
      line_items: [
        { flavor: 'beef', pet_name: 'Luna', quantity: 5, line_total: 225, unit_price: 45, pack_size_label: '500 g', currency: 'BRL' },
        { flavor: 'fish', pet_name: 'Luna', quantity: 5, line_total: 325, unit_price: 65, pack_size_label: '500 g', currency: 'BRL' },
      ],
      discounted_first_month_total: 550,
    },
    subscription_term_months: 1,
  },
  address: {
    city: 'Pinhais',
    phone: '(41) 99890-5819',
    state: 'PR',
    number: '941',
    street: 'Rua Aristeu de Castro Fernandes',
    country: 'BR',
    zipcode: '83331160',
    complement: 'Apt 1',
    neighborhood: 'Maria Antonieta',
    delivery_instructions: 'Coloca perto da porta',
  },
  shipping: {
    cost: 7,
    label: 'Entrega Eden Bowl',
    total: 7,
    per_km: 0.95,
    zipcode: '83331-160',
    distance: 7.37,
    delivery_days: 2,
    distance_source: 'osrm',
  },
  discount: { promotionCodeId: null, percent: 0, eligibilityReason: 'HAS_PREVIOUS_PURCHASE' },
  lineItems: [
    { flavor: 'beef', pet_name: 'Luna', quantity: 5, line_total: 225, unit_price: 45, pack_size_label: '500 g', currency: 'BRL' },
  ],
  checkoutReference: {
    total: 557,
    billing: { email: 'ana@edenbowls.com', first_name: 'Ana', last_name: 'Costa' },
    currency: 'BRL',
    payment_state: 'paid',
    shipping_total: 7,
    has_payment_method: true,
    discount_eligibility: { reason: 'HAS_PREVIOUS_PURCHASE', eligible: false, validated: true },
    stripe_discount_amount: 0,
    stripe_subscription_id: 'sub_123',
    stripe_subscription_status: 'incomplete',
    stripe_payment_intent_status: 'succeeded',
  },
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

type CalendarRow = {
  id: number
  market: 'BR' | 'US'
  closedOn: string
  label: string
  origin: string
  type: 'national' | 'regional' | 'carrier' | 'adhoc'
  active: boolean
  closesPreparation: boolean
  closesPickup: boolean
  closesDelivery: boolean
}

type CalendarState = {
  rows: CalendarRow[]
  history: Array<Record<string, unknown>>
  syncs: Array<Record<string, unknown>>
  nextId: number
}

function calendarState(): CalendarState {
  const national = (id: number, closedOn: string, label: string, origin = 'fixed'): CalendarRow => ({
    id, market: 'BR', closedOn, label, origin, type: 'national', active: true,
    closesPreparation: true, closesPickup: true, closesDelivery: true,
  })
  return {
    rows: [
      national(1, '2027-01-01', 'Confraternização Universal'),
      national(2, '2027-02-08', 'Carnaval (segunda)', 'movable'),
      national(3, '2027-12-25', 'Natal'),
    ],
    history: [],
    syncs: [
      { id: 11, stripeSubscriptionId: 'sub_late', market: 'BR', auditEventId: 1, expectedTrialEnd: '2027-02-08T03:00:00.000Z', targetTrialEnd: '2027-02-10T03:00:00.000Z', foundTrialEnd: '2027-02-15T03:00:00.000Z', status: 'conflict', attempts: 1, lastError: null, createdAt: '2027-01-20T12:00:00.000Z' },
      { id: 12, stripeSubscriptionId: 'sub_down', market: 'BR', auditEventId: 1, expectedTrialEnd: '2027-02-08T03:00:00.000Z', targetTrialEnd: '2027-02-10T03:00:00.000Z', foundTrialEnd: null, status: 'failed', attempts: 8, lastError: 'Stripe timeout', createdAt: '2027-01-20T12:00:00.000Z' },
    ],
    nextId: 100,
  }
}

// Previews by date: 2027-03-29 moves two deliveries, 2027-03-30 hits a delivery in production.
function calendarAffected(closedOn: string) {
  if (closedOn === '2027-03-29') {
    return [
      { stripeSubscriptionId: 'sub_ana', ledgerId: 42, userId: 7, deliveryId: 'current', preparationDay: '2027-03-29', deliveryDate: '2027-03-29', newPreparationDay: '2027-03-31', newDeliveryDate: '2027-03-31', locked: false, lockReason: null, move: 'stripe_sync', expectedTrialEnd: '2027-03-29T03:00:00.000Z', targetTrialEnd: '2027-03-31T03:00:00.000Z' },
      { stripeSubscriptionId: 'sub_bia', ledgerId: 43, userId: 8, deliveryId: 'current', preparationDay: '2027-03-29', deliveryDate: '2027-03-29', newPreparationDay: '2027-03-31', newDeliveryDate: '2027-03-31', locked: false, lockReason: null, move: 'projection_only' },
    ]
  }
  if (closedOn === '2027-03-30') {
    return [
      { stripeSubscriptionId: 'sub_cris', ledgerId: 44, userId: 9, deliveryId: 'current', preparationDay: '2027-03-30', deliveryDate: '2027-03-30', newPreparationDay: '2027-03-31', newDeliveryDate: '2027-03-31', locked: true, lockReason: 'in_production', move: 'projection_only' },
    ]
  }
  return []
}

async function handleDeliveryCalendar(route: Route, method: string, path: string, url: URL, body: unknown, state: CalendarState, profile: Profile) {
  const base = '/api/v1/admin/delivery-calendar'
  if (!path.startsWith(base)) return false
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const market = String(url.searchParams.get('market') || input.market || 'BR') as 'BR' | 'US'
  const year = Number(url.searchParams.get('year') || 2027)
  const audit = (action: string, metadata: Record<string, unknown>) => {
    state.history.unshift({ id: state.history.length + 1, actorUserId: 1, actorEmail: profile.email, action, createdAt: '2027-01-20T12:00:00.000Z', metadata: { market, ...metadata } })
  }
  const values = (row: CalendarRow | null) => row ? { active: row.active, closesPreparation: row.closesPreparation, closesPickup: row.closesPickup, closesDelivery: row.closesDelivery } : null

  if (path === base && method === 'GET') {
    await fulfillJson(route, { market, year, items: state.rows.filter((row) => row.market === market && row.closedOn.startsWith(`${year}-`)) })
    return true
  }
  if (path === `${base}/history` && method === 'GET') {
    await fulfillJson(route, { market, year, items: state.history.filter((item) => (item.metadata as { market: string }).market === market) })
    return true
  }
  if (path === `${base}/syncs` && method === 'GET') {
    const mine = state.syncs.filter((item) => item.market === market)
    await fulfillJson(route, { market, delayMinutes: 15, delayed: [], problems: mine.filter((item) => item.status === 'failed' || item.status === 'conflict') })
    return true
  }
  if (path === `${base}/alerts` && method === 'GET') {
    await fulfillJson(route, { market, upsCalendar: market === 'US' ? { coveredThrough: '2027-12-31', missingYear: 2028, daysLeft: 80, warn: true } : null })
    return true
  }
  if (path === `${base}/preview` && method === 'POST') {
    const existing = input.id != null ? state.rows.find((row) => row.id === Number(input.id)) : null
    const closedOn = String(existing ? existing.closedOn : input.closedOn)
    const turnsOn = !existing || (input.active === true && !existing.active)
    await fulfillJson(route, { market, change: { ...(existing || {}), ...input }, affected: turnsOn ? calendarAffected(closedOn) : [], shortNotice: closedOn === '2027-01-22' })
    return true
  }
  if (path === base && method === 'POST') {
    const affected = calendarAffected(String(input.closedOn))
    const locked = affected.filter((item) => item.locked)
    if (locked.length > 0) {
      await fulfillJson(route, { message: 'Há entregas travadas nessa data. Resolva-as antes de fechar o dia.', details: { code: 'delivery_locked', subscriptions: locked.map((item) => ({ stripeSubscriptionId: item.stripeSubscriptionId, deliveryId: item.deliveryId, lockReason: item.lockReason })) } }, 409)
      return true
    }
    const row: CalendarRow = {
      id: state.nextId++, market, closedOn: String(input.closedOn), label: String(input.label), origin: input.type === 'adhoc' ? 'one_off' : String(input.type),
      type: input.type as CalendarRow['type'], active: true,
      closesPreparation: Boolean(input.closesPreparation), closesPickup: Boolean(input.closesPickup), closesDelivery: Boolean(input.closesDelivery),
    }
    state.rows.push(row)
    audit('delivery_calendar.create', {
      closedOn: row.closedOn, type: row.type, label: row.label, before: null, after: values(row),
      moved: affected.map((item) => ({ stripeSubscriptionId: item.stripeSubscriptionId, deliveryId: item.deliveryId, previousPreparationDay: item.preparationDay, newPreparationDay: item.newPreparationDay, move: item.move })),
    })
    await fulfillJson(route, { market, row, affected, syncIds: [], auditEventId: state.history.length })
    return true
  }
  const idMatch = path.match(/^\/api\/v1\/admin\/delivery-calendar\/(\d+)$/)
  if (idMatch && (method === 'PATCH' || method === 'DELETE')) {
    const row = state.rows.find((item) => item.id === Number(idMatch[1]))
    if (!row) {
      await fulfillJson(route, { message: 'Linha não encontrada.', details: { code: 'not_found' } }, 404)
      return true
    }
    const before = values(row)
    if (method === 'DELETE') {
      if (row.type === 'national') {
        await fulfillJson(route, { message: 'Feriado nacional não pode ser removido. Desative-o.', details: { code: 'national_not_removable' } }, 422)
        return true
      }
      state.rows = state.rows.filter((item) => item.id !== row.id)
      audit('delivery_calendar.remove', { closedOn: row.closedOn, type: row.type, label: row.label, before, after: null, moved: [] })
      await fulfillJson(route, { market, removed: row })
      return true
    }
    Object.assign(row, Object.fromEntries(Object.entries(input).filter(([key]) => ['active', 'closesPreparation', 'closesPickup', 'closesDelivery'].includes(key))))
    const action = before && before.active !== row.active ? (row.active ? 'delivery_calendar.activate' : 'delivery_calendar.deactivate') : 'delivery_calendar.update'
    audit(action, { closedOn: row.closedOn, type: row.type, label: row.label, before, after: values(row), moved: [] })
    await fulfillJson(route, { market, row, affected: [], syncIds: [], auditEventId: state.history.length })
    return true
  }
  const resend = path.match(/^\/api\/v1\/admin\/delivery-calendar\/syncs\/(\d+)\/resend$/)
  if (resend && method === 'POST') {
    const sync = state.syncs.find((item) => item.id === Number(resend[1]))
    if (!sync) {
      await fulfillJson(route, { message: 'Sincronização não encontrada.', details: { code: 'not_found' } }, 404)
      return true
    }
    audit('delivery_calendar.sync_resend', { closedOn: '2027-02-08', syncId: sync.id, stripeSubscriptionId: sync.stripeSubscriptionId, previousStatus: sync.status, expectedTrialEnd: sync.expectedTrialEnd, foundTrialEnd: sync.foundTrialEnd, targetTrialEnd: sync.targetTrialEnd })
    sync.status = 'pending'
    await fulfillJson(route, { market, syncId: sync.id, status: 'pending', auditEventId: state.history.length })
    return true
  }
  return false
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
  const calendar = calendarState()
  const catalog = {
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
      canDelete: true,
    }],
    detail: {
      id: 'prod-1',
      slug: 'bowl-adulto',
      namePt: 'Bowl Adulto',
      nameEn: 'Adult Bowl',
      active: false,
      planCountry: 'BR',
      planDays: 28,
      canDelete: true,
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', flavor: 'Frango', regularPrice: 89.9, stripeProductId: 'prod_stripe', stripePriceId: 'price_stripe', syncStatus: 'synced', requiresSync: false, canDelete: true }],
    },
  }

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const url = new URL(request.url())
    const path = url.pathname
    const authorization = request.headers().authorization ?? ''
    let body: unknown = null
    try {
      body = method === 'GET' ? null : request.postDataJSON()
    } catch {
      body = null
    }

    captured.push({ method, path, search: url.search, authorization, body })

    if (await handleDeliveryCalendar(route, method, path, url, body, calendar, profile)) {
      return
    }

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

    if (/^\/api\/v1\/admin\/users\/[^/]+\/roles$/.test(path) && method === 'PUT') {
      const payload = (body || {}) as { role?: string; market?: string }
      await fulfillJson(route, {
        id: path.split('/')[5],
        email: 'ops@edenbowls.com',
        roles: [payload.role || 'operator'],
        storedRoles: [payload.role || 'operator'],
        markets: payload.market ? [payload.market] : ['BR', 'US'],
        lockedByAllowlist: false,
        profile: { fullName: 'Operador' },
      })
      return
    }

    if (path === '/api/v1/admin/users/roles') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 50,
        totalPages: 1,
        items: [{ id: 'u-ops', email: 'ops@edenbowls.com', storedRoles: ['operator'], roles: ['operator'], markets: ['BR'], lockedByAllowlist: false, profile: { fullName: 'Operador' } }],
        bootstrapEmails: ['admin@edenbowls.com'],
      })
      return
    }

    if (path === '/api/v1/admin/users' && method === 'GET') {
      await fulfillJson(route, { total: 1, page: 1, perPage: 20, totalPages: 1, items: [userDetail] })
      return
    }

    if (path === '/api/v1/admin/users' && method === 'POST') {
      const payload = (body || {}) as { name?: string; email?: string; role?: string }
      await fulfillJson(route, {
        id: 'u-lia',
        email: payload.email,
        status: 'pending',
        roles: [payload.role || 'operator'],
        inviteMailStatus: 'sent',
        profile: { fullName: payload.name || null, phone: null },
      })
      return
    }

    if (path === '/api/v1/admin/users/u-ana/delivery-instructions' && method === 'PATCH') {
      await fulfillJson(route, { ok: true })
      return
    }

    if (path === '/api/v1/admin/users/u-ana/delivery' && method === 'PATCH') {
      await fulfillJson(route, { success: true, data: body })
      return
    }

    if (path === '/api/v1/admin/users/u-ana/status' && method === 'PATCH') {
      await fulfillJson(route, { ...userDetail, status: (body as { status?: string } | null)?.status || 'inactive' })
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
        total: catalog.items.length,
        page: 1,
        perPage: 20,
        items: catalog.items,
      })
      return
    }

    if (path === '/api/v1/admin/catalog/products' && method === 'POST') {
      await fulfillJson(route, {
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
      return
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/variations\/[^/]+$/.test(path) && method === 'DELETE') {
      const variationId = path.split('/').pop() || ''
      catalog.detail = {
        ...catalog.detail,
        variants: catalog.detail.variants.filter((item) => item.id !== variationId),
      }
      catalog.items = catalog.items.map((item) => (
        item.id === catalog.detail.id
          ? { ...item, variants: catalog.detail.variants.map((variant) => ({ id: variant.id, sku: variant.sku, variantPrices: [] })) }
          : item
      ))
      await fulfillJson(route, catalog.detail)
      return
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() || ''
      catalog.items = catalog.items.filter((item) => item.id !== id)
      await fulfillJson(route, { deleted: true, id })
      return
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'GET') {
      const id = path.split('/').pop() || 'prod-1'
      if (id === 'prod-1') {
        await fulfillJson(route, catalog.detail)
        return
      }
      await fulfillJson(route, {
        id,
        slug: 'plano-novo',
        namePt: 'Plano novo',
        nameEn: 'Plano novo',
        active: false,
        planCountry: 'BR',
        planDays: 30,
        stripeProductId: 'prod_live_301',
        variants: [],
      })
      return
    }

    if (path === '/api/v1/admin/catalog/products/prod-1' && method === 'PATCH') {
      const currentVariant = catalog.detail.variants[0] || { id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9, stripeProductId: 'prod_stripe', stripePriceId: 'price_stripe', syncStatus: 'synced', requiresSync: false }
      const variants = Array.isArray(body?.variants)
        ? body.variants.map((item: { id?: string }) => ({ ...currentVariant, ...item }))
        : catalog.detail.variants
      catalog.detail = {
        ...catalog.detail,
        active: body?.active ?? catalog.detail.active,
        planCountry: body?.planCountry ?? catalog.detail.planCountry,
        planDays: body?.planDays ?? catalog.detail.planDays,
        variants,
      }
      await fulfillJson(route, catalog.detail)
      return
    }

    if (path === '/api/v1/admin/catalog/sync' && method === 'POST') {
      await fulfillJson(route, { syncJobId: 'job-2', status: 'queued' })
      return
    }

    if (path === '/api/v1/admin/markets/conflicts' && method === 'GET') {
      await fulfillJson(route, {
        items: [{ userId: 'u-ana', email: 'ana@edenbowls.com', profileMarket: 'BR', stripeAccount: 'us' }],
      })
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

    if (path === '/api/v1/admin/production/queue' && method === 'GET') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
        metrics: { today: 1, tomorrow: 0, upcoming: 0, overdue: 0 },
        items: [{
          id: 42,
          userId: 'u-ana',
          stripeSubscriptionId: 'sub_123',
          currentPeriodEnd: '2026-09-20T08:00:00.000Z',
          daysUntil: 0,
          dueBucket: 'today',
          dueLabel: 'Vence hoje',
          displayName: 'WordPress Name',
          customerName: 'Ana Ledger',
          email: 'ana@edenbowls.com',
          flavorMix: 'beef × 2, turkey × 1',
          packCount: 3,
          packSizeLabel: '500 g',
          planLabel: 'Plano adulto',
          termMonths: 1,
          country: 'BR',
          city: 'São Paulo',
          stripeStatus: 'active',
          productionStatus: 'to_prepare',
          note: null,
          subtotal: 189.9,
          currency: 'BRL',
          stripeAccount: 'br',
          dense: false,
          customerProfileInScope: true,
          lineItems: [
            { flavor: 'beef', quantity: 2, packSize: '500 g', petName: 'Luna' },
            { flavor: 'turkey', quantity: 1, packSize: '500 g', petName: 'Luna' },
          ],
        }],
      })
      return
    }

    if (/^\/api\/v1\/admin\/production\/queue\/\d+$/.test(path) && method === 'PATCH') {
      const payload = (body || {}) as { status?: string; note?: string }
      await fulfillJson(route, {
        id: 42,
        userId: 'u-ana',
        stripeSubscriptionId: 'sub_123',
        currentPeriodEnd: '2026-09-20T08:00:00.000Z',
        daysUntil: 0,
        dueBucket: 'today',
        dueLabel: 'Vence hoje',
        displayName: 'WordPress Name',
        customerName: 'Ana Ledger',
        email: 'ana@edenbowls.com',
        flavorMix: 'beef × 2, turkey × 1',
        packCount: 3,
        packSizeLabel: '500 g',
        planLabel: 'Plano adulto',
        termMonths: 1,
        country: 'BR',
        city: 'São Paulo',
        stripeStatus: 'active',
        productionStatus: payload.status || 'in_production',
        note: payload.note || null,
        subtotal: 189.9,
        currency: 'BRL',
        stripeAccount: 'br',
        dense: false,
        customerProfileInScope: true,
        lineItems: [
          { flavor: 'beef', quantity: 2, packSize: '500 g', petName: 'Luna' },
          { flavor: 'turkey', quantity: 1, packSize: '500 g', petName: 'Luna' },
        ],
      })
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
        customerProfileInScope: true,
        petsSnapshot: {},
        planSelection: {},
        shipping: {},
        address: {},
      })
      return
    }

    if (path === '/api/v1/admin/billing/subscriptions/sub-row-1/customer-invoices' && method === 'GET') {
      await fulfillJson(route, {
        success: true,
        data: {
          items: [{
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
          }],
        },
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

    if (path === '/api/v1/admin/stripe/first-purchase-promos' && method === 'GET') {
      await fulfillJson(route, {
        complete: true,
        missing_terms: [],
        mapping: { 1: 'promo_1m', 3: 'promo_3m', 6: 'promo_6m' },
        misconfig_count: 0,
      })
      return
    }

    if (path === '/api/v1/admin/stripe/first-purchase-promos' && method === 'PUT') {
      await fulfillJson(route, {
        complete: true,
        missing_terms: [],
        mapping: body || { 1: 'promo_1m', 3: 'promo_3m', 6: 'promo_6m' },
        misconfig_count: 0,
      })
      return
    }

    if (path === '/api/v1/admin/stripe/first-purchase-promos/sync' && method === 'POST') {
      await fulfillJson(route, {
        complete: true,
        missing_terms: [],
        mapping: { 1: 'promo_1m', 3: 'promo_3m', 6: 'promo_6m' },
        misconfig_count: 0,
        slots: { 1: { promotion_code_id: 'promo_1m', coupon_id: 'coupon_1', active: true, source: 'stored' } },
        missing_in_stripe: [],
        inactive: [],
      })
      return
    }

    if (path === '/api/v1/admin/stripe/first-purchase-coupons' && method === 'POST') {
      await fulfillJson(route, {
        success: true,
        data: { created: true, mapped: true, coupon_id: 'coupon_new', promotion_code_id: 'promo_new', code: 'FIRST_1M', percent_off: 10 },
      })
      return
    }

    if (path === '/api/v1/admin/stripe/promotion-codes' && method === 'GET') {
      await fulfillJson(route, {
        success: true,
        data: {
          items: [{
            id: 'promo_1m',
            code: 'FIRST_1M',
            coupon_id: 'coupon_1',
            percent_off: 10,
            duration: 'once',
            active: true,
            slot: 1,
            dashboard_url: 'https://dashboard.stripe.com/test/promotion_codes/promo_1m',
          }],
        },
      })
      return
    }

    if (path === '/api/v1/admin/feedbacks' && method === 'GET') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
        items: [{
          id: 1,
          name: 'João Silva',
          category: 'tutor',
          country: 'BR',
          photo: '',
          place: 'São Paulo',
          comment: 'O pelo do meu golden nunca esteve tão bonito.',
          active: true,
          createdAt: '2026-08-20T12:00:00.000Z',
          updatedAt: '2026-08-20T12:00:00.000Z',
        }],
      })
      return
    }

    if (path === '/api/v1/admin/feedbacks' && method === 'POST') {
      const payload = (body || {}) as { name?: string; category?: string; country?: string; place?: string; comment?: string; active?: boolean }
      await fulfillJson(route, {
        id: 2,
        name: payload.name || 'Novo cliente',
        category: payload.category || 'tutor',
        country: payload.country || 'BR',
        place: payload.place || '',
        photo: '',
        comment: payload.comment || '',
        active: payload.active ?? true,
        createdAt: '2026-08-24T12:00:00.000Z',
        updatedAt: '2026-08-24T12:00:00.000Z',
      })
      return
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+\/active$/.test(path) && method === 'PATCH') {
      await fulfillJson(route, {
        id: Number(path.split('/')[5]),
        name: 'João Silva',
        category: 'tutor',
        country: 'BR',
        photo: '',
        place: 'São Paulo',
        comment: 'O pelo do meu golden nunca esteve tão bonito.',
        active: Boolean((body as { active?: boolean } | null)?.active),
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-24T12:00:00.000Z',
      })
      return
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+$/.test(path) && method === 'GET') {
      await fulfillJson(route, {
        id: Number(path.split('/').pop()),
        name: 'João Silva',
        category: 'tutor',
        country: 'BR',
        photo: '',
        place: 'São Paulo',
        comment: 'O pelo do meu golden nunca esteve tão bonito.',
        active: true,
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-20T12:00:00.000Z',
      })
      return
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+$/.test(path) && method === 'PATCH') {
      await fulfillJson(route, {
        id: Number(path.split('/').pop()),
        name: (body as { name?: string } | null)?.name || 'João Silva',
        category: (body as { category?: string } | null)?.category || 'tutor',
        country: (body as { country?: string } | null)?.country || 'BR',
        place: (body as { place?: string } | null)?.place || 'São Paulo',
        photo: '',
        comment: (body as { comment?: string } | null)?.comment || 'O pelo do meu golden nunca esteve tão bonito.',
        active: (body as { active?: boolean } | null)?.active ?? true,
        createdAt: '2026-08-20T12:00:00.000Z',
        updatedAt: '2026-08-24T12:00:00.000Z',
      })
      return
    }

    if (/^\/api\/v1\/admin\/feedbacks\/\d+$/.test(path) && method === 'DELETE') {
      await fulfillJson(route, { deleted: true, id: Number(path.split('/').pop()) })
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
    markets: ['US'],
    permissions: ['nutrition.simulate', 'market.us'],
  },
  customer: {
    userId: 'u-customer',
    email: 'client@edenbowls.com',
    roles: ['customer'],
    permissions: [],
  },
  readonly: readonlyProfile,
}
