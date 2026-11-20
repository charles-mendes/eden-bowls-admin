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
  'system.health.read',
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
    ...WRITE_PERMISSIONS.filter((permission) => permission !== 'users.roles.write' && permission !== 'users.access.write' && permission !== 'system.health.read'),
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
  permissions: ['onboarding.read', 'shipping.read', 'catalog.read', 'users.read', 'billing.subscribers.read', 'feedbacks.read', 'production.read', 'market.br'],
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
  subscriptions: [
    { id: 'sub-row-1', stripeSubscriptionId: 'sub_123', stripeAccount: 'br', status: 'active', currentPeriodEnd: '2026-09-01T12:00:00.000Z', cancelAtPeriodEnd: false, planLabel: 'Adult 1m' },
  ],
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

type OperatingDay = { weekday: number; open: boolean; opensAt: string; closesAt: string }

type CalendarState = {
  rows: CalendarRow[]
  history: Array<Record<string, unknown>>
  syncs: Array<Record<string, unknown>>
  week: Record<'BR' | 'US', OperatingDay[]>
  nextId: number
}

const weekOf = (open: number[]): OperatingDay[] => [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, open: open.includes(weekday), opensAt: '09:00', closesAt: '20:00' }))

// Closing Saturday in Brazil reaches three deliveries, one of each outcome; any other change moves nothing.
function weekImpact(market: 'BR' | 'US', before: OperatingDay[], after: OperatingDay[]) {
  const saturdayCloses = market === 'BR' && before[5]?.open && !after[5]?.open
  if (!saturdayCloses) return []
  return [
    { stripeSubscriptionId: 'sub_ana', ledgerId: 42, userId: 7, deliveryId: 'current', chargeAt: '2027-01-23T03:00:00.000Z', preparationDay: '2027-01-23', deliveryDate: '2027-01-23', newPreparationDay: '2027-01-25', newDeliveryDate: '2027-01-25', outcome: 'moved', lockReason: null, move: 'stripe_sync' },
    { stripeSubscriptionId: 'sub_bia', ledgerId: 43, userId: 8, deliveryId: 'current', chargeAt: '2027-01-23T17:30:00.000Z', preparationDay: '2027-01-23', deliveryDate: '2027-01-23', newPreparationDay: '2027-01-25', newDeliveryDate: '2027-01-25', outcome: 'moved_charge_kept', lockReason: 'past_editable_until', move: 'projection_only' },
    { stripeSubscriptionId: 'sub_cris', ledgerId: 44, userId: 9, deliveryId: 'current', chargeAt: null, preparationDay: '2027-01-23', deliveryDate: '2027-01-23', newPreparationDay: '2027-01-23', newDeliveryDate: '2027-01-23', outcome: 'kept', lockReason: 'paid', move: 'projection_only' },
  ]
}

const confirmedMovesOf = (impact: ReturnType<typeof weekImpact>) => impact
  .filter((item) => item.outcome !== 'kept')
  .map((item) => ({ stripeSubscriptionId: item.stripeSubscriptionId, deliveryId: item.deliveryId, newPreparationDay: item.newPreparationDay }))

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
    week: { BR: weekOf([1, 2, 3, 4, 5, 6]), US: weekOf([1, 2, 3, 4, 5]) },
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
  if (path === `${base}/week` && method === 'GET') {
    await fulfillJson(route, { market, timeZone: market === 'BR' ? 'America/Sao_Paulo' : 'America/New_York', days: state.week[market] })
    return true
  }
  if (path === `${base}/week/preview` && method === 'POST') {
    const after = input.days as OperatingDay[]
    const impact = weekImpact(market, state.week[market], after)
    await fulfillJson(route, { market, timeZone: market === 'BR' ? 'America/Sao_Paulo' : 'America/New_York', before: state.week[market], after, impact, confirmedMoves: confirmedMovesOf(impact) })
    return true
  }
  if (path === `${base}/week` && method === 'PUT') {
    const after = input.days as OperatingDay[]
    const impact = weekImpact(market, state.week[market], after)
    const expected = JSON.stringify(confirmedMovesOf(impact))
    if (JSON.stringify(input.confirmedMoves ?? []) !== expected) {
      await fulfillJson(route, { message: 'As entregas afetadas mudaram desde a prévia. Veja o impacto de novo.', details: { code: 'week_impact_changed', confirmedMoves: JSON.parse(expected) } }, 409)
      return true
    }
    audit('delivery_calendar.week_update', {
      closedOn: null, before: state.week[market], after, syncIds: [],
      impact: impact.map((item) => ({ stripeSubscriptionId: item.stripeSubscriptionId, deliveryId: item.deliveryId, previousPreparationDay: item.preparationDay, newPreparationDay: item.newPreparationDay, outcome: item.outcome, move: item.move })),
    })
    state.week[market] = after
    await fulfillJson(route, { market, timeZone: market === 'BR' ? 'America/Sao_Paulo' : 'America/New_York', days: after, impact, syncIds: [], auditEventId: state.history.length })
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

type StockItem = {
  flavorKey: string
  packSizeGrams: number
  onHand: number
  minLevel: number | null
  committed: number
  committedAwaitingPayment: number
  available: number
  toProduce: number
  belowMinimum: boolean
}

type StockState = {
  items: StockItem[]
  movements: Array<Record<string, unknown>>
  nextId: number
}

function stockState(): StockState {
  return {
    items: [
      {
        flavorKey: 'frango', packSizeGrams: 300, onHand: 40, minLevel: 20, committed: 55,
        committedAwaitingPayment: 10, available: -15, toProduce: 15, belowMinimum: true,
      },
      {
        flavorKey: 'carne', packSizeGrams: 500, onHand: 10, minLevel: null, committed: 0,
        committedAwaitingPayment: 0, available: 10, toProduce: 0, belowMinimum: false,
      },
    ],
    movements: [{
      id: 1, market: 'BR', flavorKey: 'frango', packSizeGrams: 300, type: 'separation', quantity: -3,
      reason: null, note: null, productionCycleId: 9, subscriptionId: 123, actorName: null,
      createdAt: '2026-09-20T08:00:00.000Z',
    }],
    nextId: 2,
  }
}

function refreshStockItem(item: StockItem) {
  item.available = item.onHand - item.committed
  item.toProduce = Math.max(0, item.committed - item.onHand)
  item.belowMinimum = item.minLevel != null && item.onHand < item.minLevel
  return item
}

async function handlePackStock(route: Route, method: string, path: string, url: URL, body: unknown, state: StockState) {
  if (!path.startsWith('/api/v1/admin/stock')) return false
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const known = new Set(['frango|300', 'carne|500'])

  if (path === '/api/v1/admin/stock' && method === 'GET') {
    await fulfillJson(route, {
      market: url.searchParams.get('market') || 'BR',
      windowDays: Number(url.searchParams.get('windowDays') || 7),
      items: state.items,
      unsizedLines: [],
    })
    return true
  }

  if (path === '/api/v1/admin/stock/movements' && method === 'GET') {
    const flavorKey = url.searchParams.get('flavorKey')
    const packSizeGrams = url.searchParams.get('packSizeGrams')
    const type = url.searchParams.get('type')
    const page = Number(url.searchParams.get('page') || 1)
    const perPage = Number(url.searchParams.get('perPage') || 20)
    const filtered = state.movements.filter((item) => (
      (!flavorKey || item.flavorKey === flavorKey)
      && (!packSizeGrams || Number(item.packSizeGrams) === Number(packSizeGrams))
      && (!type || item.type === type)
    ))
    await fulfillJson(route, {
      total: filtered.length,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(filtered.length / perPage)),
      items: filtered.slice((page - 1) * perPage, page * perPage),
    })
    return true
  }

  if (path === '/api/v1/admin/stock/production' && method === 'POST') {
    const key = `${input.flavorKey}|${input.packSizeGrams}`
    if (!known.has(key)) {
      await fulfillJson(route, { message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      return true
    }
    let item = state.items.find((entry) => `${entry.flavorKey}|${entry.packSizeGrams}` === key)
    if (!item) {
      item = refreshStockItem({
        flavorKey: String(input.flavorKey), packSizeGrams: Number(input.packSizeGrams), onHand: 0, minLevel: null,
        committed: 0, committedAwaitingPayment: 0, available: 0, toProduce: 0, belowMinimum: false,
      })
      state.items.push(item)
    }
    item.onHand += Number(input.quantity)
    refreshStockItem(item)
    state.movements.unshift({
      id: state.nextId, market: input.market, flavorKey: input.flavorKey, packSizeGrams: input.packSizeGrams,
      type: 'production', quantity: Number(input.quantity), reason: null, note: input.note || null,
      productionCycleId: null, subscriptionId: null, actorName: 'ops.write@edenbowls.com', createdAt: '2026-09-21T08:00:00.000Z',
    })
    state.nextId += 1
    await fulfillJson(route, item)
    return true
  }

  if (path === '/api/v1/admin/stock/counts' && method === 'POST') {
    const item = state.items.find((entry) => entry.flavorKey === input.flavorKey && entry.packSizeGrams === Number(input.packSizeGrams))
    if (!item) {
      await fulfillJson(route, { message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      return true
    }
    const quantity = Number(input.countedQuantity) - item.onHand
    item.onHand = Number(input.countedQuantity)
    refreshStockItem(item)
    state.movements.unshift({
      id: state.nextId, market: input.market, flavorKey: input.flavorKey, packSizeGrams: input.packSizeGrams,
      type: 'adjustment', quantity, reason: 'count', note: input.note || null,
      productionCycleId: null, subscriptionId: null, actorName: 'ops.write@edenbowls.com', createdAt: '2026-09-21T08:00:00.000Z',
    })
    state.nextId += 1
    await fulfillJson(route, item)
    return true
  }

  if (path === '/api/v1/admin/stock/adjustments' && method === 'POST') {
    const item = state.items.find((entry) => entry.flavorKey === input.flavorKey && entry.packSizeGrams === Number(input.packSizeGrams))
    if (!item) {
      await fulfillJson(route, { message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      return true
    }
    item.onHand += Number(input.quantity)
    refreshStockItem(item)
    state.movements.unshift({
      id: state.nextId, market: input.market, flavorKey: input.flavorKey, packSizeGrams: input.packSizeGrams,
      type: 'adjustment', quantity: Number(input.quantity), reason: input.reason, note: input.note || null,
      productionCycleId: null, subscriptionId: null, actorName: 'ops.write@edenbowls.com', createdAt: '2026-09-21T08:00:00.000Z',
    })
    state.nextId += 1
    await fulfillJson(route, item)
    return true
  }

  if (path === '/api/v1/admin/stock/minimum' && method === 'PUT') {
    const item = state.items.find((entry) => entry.flavorKey === input.flavorKey && entry.packSizeGrams === Number(input.packSizeGrams))
    if (!item) {
      await fulfillJson(route, { message: 'Unknown stock item.', details: { code: 'stock_item_unknown' } }, 422)
      return true
    }
    item.minLevel = input.minLevel == null ? null : Number(input.minLevel)
    refreshStockItem(item)
    await fulfillJson(route, item)
    return true
  }

  return false
}

const trailError = { http_status: null, error_code: null, error_message: null, stripe_code: null, stripe_type: null, stripe_param: null }
const trailEvent = { action: null, pet_id: null, subscription_id: null, stripe_event_id: null, stripe_event_type: null, ...trailError }
const purchaseErrorStep = {
  id: 1, area: 'checkout', step: 'zipcode_lookup', action: null, outcome: 'failed', pet_id: null, subscription_id: null, stripe_event_id: null, stripe_event_type: null,
  http_status: 422, error_code: 'invalid_zipcode', error_message: 'CEP inválido.', stripe_code: null, stripe_type: null, stripe_param: null, created_at: '2026-11-18T12:00:00Z',
}
const purchaseErrorRows = {
  br: [{
    kind: 'attempt', occurred_at: '2026-11-18T12:00:00Z', market: 'br', user_id: 'u-ana', email: 'ana.carolina.de.souza.martins@example.com', area: 'checkout', step: 'zipcode_lookup', action: null,
    attempt_status: 'paid', stripe_event_type: null, http_status: 422, error_code: 'invalid_zipcode', error_message: 'CEP inválido.', stripe_code: null, stripe_type: null, stripe_param: null,
    attempt: { id: 1 }, events: [purchaseErrorStep, { ...purchaseErrorStep, id: 2, step: 'payment_intent_ack', outcome: 'ok', http_status: 200, error_code: null, error_message: null }],
  }],
  us: [{
    kind: 'webhook', occurred_at: '2026-11-18T10:00:00Z', market: 'us', user_id: null, email: null, area: 'webhook', step: 'customer_not_resolved', action: null,
    attempt_status: null, stripe_event_type: 'invoice.payment_failed', http_status: null, error_code: 'customer_not_resolved', error_message: null, stripe_code: null, stripe_type: null, stripe_param: null,
    attempt: null, events: [],
  }],
}

const purchaseTrailAttempts = {
  br: [
    {
      id: 1, market: 'br', area: 'checkout', status: 'failed', final_step: 'confirm_card_payment', attempt_id: 'att_9f2c', term_months: 3, currency: 'BRL',
      promotion_code_id: 'promo_1Pr3', subscription_id: 'sub_1Qx', stripe_account: 'br', started_at: '2026-11-18T13:02:00Z', finished_at: '2026-11-18T13:09:00Z',
      ...trailError, http_status: null, error_code: 'card_declined', error_message: 'Seu cartão foi recusado.', stripe_code: 'card_declined', stripe_type: 'card_error',
      events: [
        { ...trailEvent, id: 1, area: 'onboarding', step: 'pet', action: 'create', outcome: 'ok', pet_id: 31, created_at: '2026-11-18T13:02:00Z' },
        { ...trailEvent, id: 2, area: 'plan', step: 'plan_selection', outcome: 'ok', created_at: '2026-11-18T13:04:00Z' },
        { ...trailEvent, id: 3, area: 'checkout', step: 'zipcode_lookup', outcome: 'failed', http_status: 422, error_code: 'invalid_zipcode', error_message: 'CEP inválido.', created_at: '2026-11-18T13:05:00Z' },
        { ...trailEvent, id: 4, area: 'checkout', step: 'address', outcome: 'ok', created_at: '2026-11-18T13:06:00Z' },
        { ...trailEvent, id: 5, area: 'checkout', step: 'subscription_checkout', outcome: 'ok', created_at: '2026-11-18T13:08:00Z' },
        { ...trailEvent, id: 6, area: 'checkout', step: 'confirm_card_payment', outcome: 'failed', error_code: 'card_declined', error_message: 'Seu cartão foi recusado.', stripe_code: 'card_declined', stripe_type: 'card_error', created_at: '2026-11-18T13:09:00Z' },
      ],
    },
    {
      id: 2, market: 'br', area: 'subscription', status: 'completed', final_step: 'delivery_skip', attempt_id: null, term_months: null, currency: 'BRL',
      promotion_code_id: null, subscription_id: 'sub_0Ab', stripe_account: 'br', started_at: '2026-11-10T09:00:00Z', finished_at: '2026-11-10T09:00:00Z', ...trailError,
      events: [{ ...trailEvent, id: 7, area: 'subscription', step: 'delivery_skip', outcome: 'ok', subscription_id: 'sub_0Ab', created_at: '2026-11-10T09:00:00Z' }],
    },
  ],
  us: [],
}
const purchaseTrailConfigEvents = [
  { id: 1, market: 'br', stripe_account: 'br', actor_admin_id: 7, action: 'first_purchase_coupon.create', target_ref: 'term_3', outcome: 'ok', error_code: null, created_at: '2026-11-17T18:00:00Z' },
  { id: 2, market: 'br', stripe_account: 'br', actor_admin_id: 7, action: 'shipping_settings.update', target_ref: null, outcome: 'failed', error_code: 'invalid_fee', created_at: '2026-11-16T10:00:00Z' },
]

// Reports (admin-reports-drilldown): the revenue tab of the US and the details of gross revenue.
async function handleReports(route: Route, method: string, path: string, url: URL) {
  if (!path.startsWith('/api/v1/admin/reports') || method !== 'GET') return false
  const market = url.searchParams.get('market') ?? 'US'
  const from = url.searchParams.get('from') ?? '2026-10-20'
  const to = url.searchParams.get('to') ?? '2026-11-18'
  const previous = url.searchParams.get('period') === 'previous'
  const period = { from, to, timezone: 'America/New_York', granularity: 'week', partialToday: false, previous: { from: '2026-09-20', to: '2026-10-19' } }

  if (path === '/api/v1/admin/reports/revenue') {
    await fulfillJson(route, {
      market,
      currency: 'USD',
      period,
      generatedAt: '2026-11-19T12:00:00Z',
      kpis: {
        grossRevenue: { value: 229500, previous: 114750 },
        paidInvoices: { value: 2, previous: 1 },
        averageTicket: { value: 114750, previous: 114750 },
        firstPurchaseRevenue: { value: 229500, previous: 114750 },
        renewalRevenue: { value: 0, previous: 0 },
      },
      estimatedMrr: { value: 114750, previous: null, estimated: true, trialingSubscriptions: 0, unpricedSubscriptions: 0 },
      excludedInvoices: 0,
      series: [
        { key: '2026-10-19', from: '2026-10-20', to: '2026-10-25', partial: true, revenue: 114750, invoices: 1 },
        { key: '2026-11-02', from: '2026-11-02', to: '2026-11-08', partial: false, revenue: 114750, invoices: 1 },
      ],
    })
    return true
  }

  if (path === '/api/v1/admin/reports/details') {
    const records = previous
      ? [{ id: 3, type: 'invoices', reference: 'EB-2026-000003', date: '2026-10-02T15:00:00Z', description: 'Primeira compra · USD', group: { key: 'subscription_create', label: 'Primeira compra' }, link: '/billing/subscriptions/41', contribution: 114750, customer: { name: 'Carla Dias', link: '/users/6' } }]
      : [
        { id: 1, type: 'invoices', reference: 'EB-2026-000001', date: '2026-10-21T15:00:00Z', description: 'Primeira compra · USD', group: { key: 'subscription_create', label: 'Primeira compra' }, link: '/billing/subscriptions/42', contribution: 114750, customer: { name: 'Ana Souza', link: '/users/7' } },
        { id: 2, type: 'invoices', reference: 'EB-2026-000002', date: '2026-11-05T15:00:00Z', description: 'Primeira compra · USD', group: { key: 'subscription_create', label: 'Primeira compra' }, link: '/billing/subscriptions/43', contribution: 114750, customer: { name: 'Bia Lima', link: '/users/8' } },
      ]
    const total = records.reduce((sum, record) => sum + record.contribution, 0)
    await fulfillJson(route, {
      report: 'revenue',
      indicator: url.searchParams.get('indicator'),
      source: { report: 'revenue', indicator: url.searchParams.get('indicator') },
      label: 'Faturamento bruto',
      title: 'Faturamento bruto',
      description: 'Soma do valor pago das faturas do período.',
      kind: 'money',
      contributionKind: 'money',
      market,
      currency: 'USD',
      pointInTime: false,
      hasPrevious: true,
      window: previous
        ? { from: '2026-09-20', to: '2026-10-19', timezone: 'America/New_York', previous: true, bucket: null }
        : { from, to, timezone: 'America/New_York', previous: false, bucket: null },
      value: total,
      criteria: ['Mercado EUA (US): conta Stripe us, moeda USD.', 'Faturas de cliente com status pago (paid), da conta Stripe do mercado.', 'Data do pagamento dentro da janela, no fuso America/New_York.'],
      formula: { expression: `Soma do valor pago de ${records.length} fatura(s)`, terms: [{ label: 'Faturas', value: records.length, kind: 'count' }], result: total },
      groups: [{ key: 'subscription_create', label: 'Primeira compra', count: records.length, contribution: total }],
      totals: { count: records.length, contribution: total },
      excluded: [],
      reconciliation: { reportValue: total, recordsValue: total, matches: true },
      records: { items: records, page: 1, perPage: 50, total: records.length },
      generatedAt: '2026-11-19T12:00:00Z',
    })
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
  const stock = stockState()
  // delivery-instructions: sub-row-1 starts with the profile text at the same place.
  const subscriptionInstructions: { text: string | null; source: 'subscription' | 'profile' | null } = { text: 'Interfone 12', source: 'profile' }
  // plan-settings: plan days and large-pack limit of each market.
  const planSettings: Record<string, { market: string; planDays: number; largePackLimit: number; updatedAt: string | null }> = {
    BR: { market: 'BR', planDays: 30, largePackLimit: 8, updatedAt: null },
    US: { market: 'US', planDays: 30, largePackLimit: 8, updatedAt: null },
  }
  const catalog = {
    items: [{
      id: 'prod-1',
      slug: 'bowl-adulto',
      namePt: 'Bowl Adulto',
      nameEn: 'Adult Bowl',
      active: true,
      category: { namePt: 'Alimentação', nameEn: 'Food' },
      marketConfigs: [{ marketCountry: 'BR', currency: 'BRL', active: true }],
      planCountry: 'BR',
      variants: [{ id: 'var-1', sku: 'BOWL-1', active: false, variantPrices: [{ id: 'price-1' }] }],
      createdAt: '2026-08-01T12:00:00.000Z',
      canDelete: true,
      content: { code: 'turkey', name: 'Frango', lifeStage: 'adult', imageUrl: null, labelStatus: 'missing' },
    }] as Array<Record<string, unknown>>,
    detail: {
      id: 'prod-1',
      slug: 'bowl-adulto',
      namePt: 'Bowl Adulto',
      nameEn: 'Adult Bowl',
      active: false,
      planCountry: 'BR',
      canDelete: true,
      variants: [{ id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', weight: '1kg', regularPrice: 89.9, stripeProductId: 'prod_stripe', stripePriceId: 'price_stripe', syncStatus: 'synced', requiresSync: false, canDelete: true, recipeImageUrl: null as string | null, recipeLabelStatus: 'missing', recipePresentationReady: true }] as Array<Record<string, unknown>>,
    } as Record<string, unknown> & { id: string; variants: Array<Record<string, unknown>> },
  }
  // Content of prod-1 (product-is-recipe); the detail carries it and the content routes save it.
  let recipeContent: Record<string, unknown> = {
    productId: 'prod-1',
    market: 'BR',
    flavorSlug: 'turkey',
    name: 'Frango',
    imageUrl: null,
    imageUpdatedAt: null,
    label: null,
    labelUpdatedAt: null,
    labelStatus: 'missing',
    labelMissing: [],
    presentation: null,
    variations: [{ id: 'var-1', name: 'Frango 1kg', sku: 'BOWL-1', active: false }],
  }
  // Image library (plan-image-library): one BR banner and one BR plan thumbnail, and the image prod-1 links to.
  const library = {
    assets: [
      { id: 41, kind: 'banner', market: 'BR', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', originalFilename: 'receita-frango-pt.png', mimeType: 'image/webp', width: 1024, height: 636, bytes: 120000, createdAt: '2026-10-28T10:00:00.000Z', archivedAt: null as string | null, archived: false },
      { id: 21, kind: 'plan', market: 'BR', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', originalFilename: 'adulto-frango_400.png', mimeType: 'image/webp', width: 400, height: 400, bytes: 41000, createdAt: '2026-10-28T10:00:00.000Z', archivedAt: null as string | null, archived: false },
    ],
    links: { banner: null as number | null, plan: null as number | null },
  }
  const mediaView = (asset: (typeof library.assets)[number]) => ({
    ...asset,
    usedBy: library.links[asset.kind as 'banner' | 'plan'] === asset.id ? [{ productId: 'prod-1', key: 'turkey', name: 'Frango', market: 'BR' }] : [],
  })
  const detailWithContent = () => ({
    ...catalog.detail,
    content: {
      code: recipeContent.flavorSlug,
      name: recipeContent.name,
      lifeStage: 'adult',
      flavorAliases: '',
      shortLabel: '',
      imageUrl: recipeContent.imageUrl,
      imageAssetId: recipeContent.imageAssetId ?? null,
      planImageUrl: recipeContent.planImageUrl ?? null,
      planImageAssetId: recipeContent.planImageAssetId ?? null,
      labelStatus: recipeContent.labelStatus,
      labelMissing: recipeContent.labelMissing,
      presentationReady: Boolean(recipeContent.presentation),
      label: recipeContent.label,
      presentation: recipeContent.presentation,
    },
  })

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const method = request.method().toUpperCase()
    const url = new URL(request.url())
    const path = url.pathname
    const authorization = request.headers().authorization ?? ''
    let body: unknown
    try {
      body = method === 'GET' ? null : request.postDataJSON()
    } catch {
      body = null
    }

    captured.push({ method, path, search: url.search, authorization, body })

    if (await handleDeliveryCalendar(route, method, path, url, body, calendar, profile)) {
      return
    }

    if (await handlePackStock(route, method, path, url, body, stock)) {
      return
    }

    if (await handleReports(route, method, path, url)) {
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

    // customer-purchase-trail: one market per answer, as the API does.
    if (path === '/api/v1/admin/users/u-ana/purchase-trail' && method === 'GET') {
      const market = url.searchParams.get('market') === 'us' ? 'us' : 'br'
      await fulfillJson(route, { success: true, data: { user_id: 1, market, attempts: purchaseTrailAttempts[market], unlinked_events: [], next_before: null } })
      return
    }

    // purchase-error-monitor: failures of one market.
    if (path === '/api/v1/admin/purchase-trail/errors' && method === 'GET') {
      const market = url.searchParams.get('market') === 'us' ? 'us' : 'br'
      await fulfillJson(route, { success: true, data: { market, from: '2026-11-12T00:00:00.000Z', to: '2026-11-20T00:00:00.000Z', rows: purchaseErrorRows[market], next_before: null } })
      return
    }

    if (path === '/api/v1/admin/purchase-trail/config-events' && method === 'GET') {
      const market = url.searchParams.get('market') === 'us' ? 'us' : 'br'
      await fulfillJson(route, { success: true, data: { market, events: market === 'br' ? purchaseTrailConfigEvents.filter((event) => url.searchParams.get('outcome') !== 'failed' || event.outcome === 'failed') : [], next_before: null } })
      return
    }

    if (path === '/api/v1/admin/onboarding/checkouts/u-ana' && method === 'GET') {
      await fulfillJson(route, checkoutDetail)
      return
    }

    if (path === '/api/v1/admin/catalog/plan-settings') {
      const market = (url.searchParams.get('market') || '').toUpperCase()
      if (market !== 'BR' && market !== 'US') {
        await fulfillJson(route, { message: 'Choose one market.', code: 'market_required' }, 400)
        return
      }
      if (method === 'PUT') {
        planSettings[market] = { market, planDays: Number(body?.planDays), largePackLimit: Number(body?.largePackLimit), updatedAt: '2026-11-12T12:00:00.000Z' }
      }
      await fulfillJson(route, planSettings[market])
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
      if (body?.code === 'turkey') {
        await fulfillJson(route, { message: 'A product with this code already exists in the market.', details: { code: 'product_code_taken' } }, 409)
        return
      }
      await fulfillJson(route, {
        id: '301',
        slug: `${body?.code}-br`,
        namePt: body?.name || 'Plano novo',
        nameEn: body?.name || 'Plano novo',
        active: false,
        planCountry: body?.planCountry || 'BR',
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
      await fulfillJson(route, detailWithContent())
      return
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').pop() || ''
      catalog.items = catalog.items.filter((item) => item.id !== id)
      await fulfillJson(route, { deleted: true, id })
      return
    }

    if (path === '/api/v1/admin/media' && method === 'GET') {
      const market = url.searchParams.get('market') || 'BR'
      const kind = url.searchParams.get('kind') || 'plan'
      const archived = url.searchParams.get('archived') === 'true'
      await fulfillJson(route, {
        market,
        items: library.assets.filter((asset) => asset.market === market && asset.kind === kind && asset.archived === archived).map(mediaView),
      })
      return
    }

    if (path === '/api/v1/admin/media' && method === 'POST') {
      const id = Math.max(...library.assets.map((asset) => asset.id)) + 1
      const kind = body?.kind === 'banner' ? 'banner' : 'plan'
      const asset = {
        id, kind, market: String(body?.market ?? 'BR'), url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', originalFilename: String(body?.originalFilename ?? ''),
        mimeType: 'image/webp', width: kind === 'banner' ? 1024 : 400, height: kind === 'banner' ? 636 : 400, bytes: 1, createdAt: '2026-10-28T12:00:00.000Z', archivedAt: null, archived: false,
      }
      library.assets = [asset, ...library.assets]
      await fulfillJson(route, { ...mediaView(asset), duplicate: false }, 201)
      return
    }

    if (/^\/api\/v1\/admin\/media\/[^/]+\/(archive|restore)$/.test(path) && method === 'POST') {
      const [, , , , , id, action] = path.split('/')
      const asset = library.assets.find((item) => item.id === Number(id))
      if (!asset) {
        await fulfillJson(route, { message: 'Library image not found.' }, 404)
        return
      }
      asset.archived = action === 'archive'
      asset.archivedAt = asset.archived ? '2026-10-28T12:00:00.000Z' : null
      await fulfillJson(route, mediaView(asset))
      return
    }

    // Banner and plan thumbnail of prod-1: a library image by id, or an upload that goes into the library first.
    const imageLink = /^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/(image|plan-image)$/.exec(path)
    if (imageLink && ['PUT', 'DELETE'].includes(method)) {
      const kind = imageLink[1] === 'image' ? 'banner' : 'plan'
      let assetId: number | null = null
      if (method === 'PUT') {
        assetId = body?.assetId != null ? Number(body.assetId) : Math.max(...library.assets.map((asset) => asset.id)) + 1
        if (body?.assetId == null) {
          library.assets = [{
            id: assetId, kind, market: 'BR', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', originalFilename: String(body?.originalFilename ?? ''),
            mimeType: 'image/webp', width: kind === 'banner' ? 1024 : 400, height: kind === 'banner' ? 636 : 400, bytes: 1, createdAt: '2026-10-28T12:00:00.000Z', archivedAt: null, archived: false,
          }, ...library.assets]
        }
      }
      library.links[kind] = assetId
      const url = assetId == null ? null : library.assets.find((asset) => asset.id === assetId)?.url ?? null
      recipeContent = kind === 'banner'
        ? { ...recipeContent, imageUrl: url, imageAssetId: assetId, imageUpdatedAt: '2026-10-23T12:00:00.000Z' }
        : { ...recipeContent, planImageUrl: url, planImageAssetId: assetId, planImageUpdatedAt: '2026-10-23T12:00:00.000Z' }
      await fulfillJson(route, recipeContent)
      return
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+\/content\/label$/.test(path) && method === 'PUT') {
      const label = (body as { label?: Record<string, unknown> } | null)?.label ?? {}
      const filled = (value: unknown) => (Array.isArray(value) ? value.length > 0 : Boolean(value))
      const missing = ['ingredients', 'analysis', 'energyKg', 'energyPackage'].filter((field) => !filled(label[field]))
      recipeContent = { ...recipeContent, label, labelStatus: missing.length ? 'incomplete' : 'complete', labelMissing: missing }
      await fulfillJson(route, recipeContent)
      return
    }

    if (/^\/api\/v1\/admin\/catalog\/products\/[^/]+$/.test(path) && method === 'GET') {
      const id = path.split('/').pop() || 'prod-1'
      if (id === 'prod-1') {
        await fulfillJson(route, detailWithContent())
        return
      }
      await fulfillJson(route, {
        id,
        slug: 'plano-novo',
        namePt: 'Plano novo',
        nameEn: 'Plano novo',
        active: false,
        planCountry: 'BR',
        stripeProductId: 'prod_live_301',
        variants: [],
        content: { code: 'cordeiro', name: 'Plano novo', lifeStage: 'adult', flavorAliases: '', shortLabel: '', imageUrl: null, planImageUrl: null, labelStatus: 'missing', labelMissing: [], presentationReady: false },
      })
      return
    }

    if (path === '/api/v1/admin/catalog/products/prod-1' && method === 'PATCH') {
      const currentVariant = catalog.detail.variants[0] || { id: 'var-1', sku: 'BOWL-1', name: 'Frango 1kg', regularPrice: 89.9, stripeProductId: 'prod_stripe', stripePriceId: 'price_stripe', syncStatus: 'synced', requiresSync: false }
      const variants = Array.isArray(body?.variants)
        ? body.variants.map((item: { id?: string }) => ({ ...currentVariant, ...item }))
        : catalog.detail.variants
      if (typeof body?.name === 'string') recipeContent = { ...recipeContent, name: body.name }
      catalog.detail = {
        ...catalog.detail,
        ...(typeof body?.name === 'string' ? { namePt: body.name, nameEn: body.name } : {}),
        active: body?.active ?? catalog.detail.active,
        variants,
      }
      await fulfillJson(route, detailWithContent())
      return
    }

    if (path === '/api/v1/admin/catalog/sync' && method === 'POST') {
      await fulfillJson(route, { syncJobId: 'job-2', status: 'queued' })
      return
    }

    if (path === '/api/v1/admin/markets/conflicts' && method === 'GET') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
        items: [{ userId: 'u-ana', email: 'ana@edenbowls.com', profileMarket: 'BR', stripeAccount: 'us' }],
      })
      return
    }

    if (path === '/api/v1/admin/billing/webhooks/health' && method === 'GET') {
      await fulfillJson(route, {
        generatedAt: '2026-10-08T12:00:00.000Z',
        staleAfterHours: 72,
        accounts: [
          { account: 'br', status: 'attention', lastEventAt: '2026-10-08T09:00:00.000Z', lastEventType: 'invoice.payment_failed', failedLast24h: 2, pendingOverdue: 0 },
          { account: 'us', status: 'ok', lastEventAt: '2026-10-08T11:30:00.000Z', lastEventType: 'invoice.paid', failedLast24h: 0, pendingOverdue: 0 },
        ],
      })
      return
    }

    if (path.startsWith('/api/v1/admin/catalog/sync/health')) {
      await fulfillJson(route, { market: 'BR', currency: 'BRL', totalExpected: 10, totalMapped: 10, gaps: [] })
      return
    }

    if (path === '/api/v1/admin/catalog/sync/status') {
      const brRun = { syncJobId: 'sync_12', status: 'completed', scope: 'market', market: 'BR', currency: 'BRL', summary: { created: 1, updated: 0, skipped: [] }, error: null, createdAt: '2026-10-08T10:00:00.000Z', updatedAt: '2026-10-08T10:01:00.000Z' }
      await fulfillJson(route, { ...brRun, byMarket: { BR: brRun } })
      return
    }

    if (path === '/api/v1/admin/today' && method === 'GET') {
      await fulfillJson(route, {
        success: true,
        data: {
          generatedAt: '2026-10-07T12:00:00.000Z',
          timezone: 'America/Sao_Paulo',
          today: '2026-10-07',
          totals: { overdue: 0, today: 1, tomorrow: 0 },
          byMarket: { BR: { overdue: 0, today: 1, tomorrow: 0 }, US: { overdue: 0, today: 0, tomorrow: 0 } },
          truncated: false,
          total: 1,
          items: [{
            id: 1, market: 'BR', dueBucket: 'today', dueLabel: 'Hoje', displayName: 'Ana Ledger', email: 'ana@edenbowls.com',
            city: 'São Paulo', flavorMix: 'beef × 2', packCount: 2, packSizeLabel: '500 g',
            productionStatus: 'to_prepare', paymentState: 'paid', note: null, upsLabel: null,
          }],
          closedDays: [],
        },
      })
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
          stockCoverage: 'short',
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
        delivery_instructions: subscriptionInstructions.text,
        delivery_instructions_source: subscriptionInstructions.source,
      })
      return
    }

    // delivery-instructions: the operator writes the instructions of this subscription.
    if (path === '/api/v1/admin/billing/subscriptions/sub-row-1/delivery-instructions' && method === 'PATCH') {
      const text = String((body as { delivery_instructions?: string } | null)?.delivery_instructions || '').trim()
      if ([...text].length > 200) {
        await fulfillJson(route, { message: 'Invalid delivery instructions.', details: { code: 'invalid_delivery_instructions', field: 'delivery_instructions' } }, 422)
        return
      }
      subscriptionInstructions.text = text || null
      subscriptionInstructions.source = text ? 'subscription' : null
      await fulfillJson(route, { success: true, data: { subscription_id: 'sub-row-1', delivery_instructions: text || null } })
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
        terms: [
          { subscription_term_months: 1, discount_percent: 10 },
          { subscription_term_months: 3, discount_percent: 25 },
          { subscription_term_months: 6, discount_percent: 40 },
        ],
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
  veterinarian: {
    userId: 'u-veterinarian',
    email: 'nutri@edenbowls.com',
    roles: ['veterinarian'],
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
  reports: {
    ...adminProfile,
    userId: 'u-reports',
    permissions: [...adminProfile.permissions, 'reports.read', 'reports.export', 'billing.subscribers.read'],
  },
}
