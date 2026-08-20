import type { AdminUser } from '../contexts/AuthContext'

export function jsonResponse(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const WRITE_PERMISSIONS = [
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
] as const

export const operatorUser: AdminUser = {
  userId: 'u-operator',
  email: 'ops@edenbowls.com',
  roles: ['operator'],
  permissions: ['onboarding.read', 'shipping.read', 'catalog.read', 'users.read'],
}

export const operatorWriteUser: AdminUser = {
  userId: 'u-operator-write',
  email: 'ops.write@edenbowls.com',
  roles: ['operator'],
  permissions: WRITE_PERMISSIONS.filter((permission) => permission !== 'users.roles.write'),
}

export const adminUser: AdminUser = {
  userId: 'u-admin',
  email: 'admin@edenbowls.com',
  roles: ['admin'],
  permissions: [...WRITE_PERMISSIONS],
}

export const nutritionistUser: AdminUser = {
  userId: 'u-nutritionist',
  email: 'nutri@edenbowls.com',
  roles: ['nutritionist'],
  permissions: ['nutrition.simulate'],
}

export const customerUser: AdminUser = {
  userId: 'u-customer',
  email: 'client@edenbowls.com',
  roles: ['customer'],
  permissions: [],
}

export const readonlyUser: AdminUser = {
  userId: 'u-readonly',
  email: 'read@edenbowls.com',
  roles: ['readonly'],
  permissions: ['onboarding.read', 'catalog.read', 'users.read', 'billing.subscribers.read'],
}

export const checkoutItem = {
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

export const checkoutList = {
  total: 1,
  page: 1,
  perPage: 20,
  totalPages: 1,
  items: [checkoutItem],
}

export const checkoutMetrics = {
  totalCheckouts: 4,
  linkedToStripe: 3,
  stripeActive: 2,
  withSimplified: 1,
  generatedAt: '2026-08-19T12:00:00.000Z',
}

export const checkoutDetail = {
  userId: 'u-ana',
  email: 'ana@edenbowls.com',
  displayName: 'Ana Costa',
  activationStatus: 'active',
  empty: false,
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  subscriptions: [
    { id: 'sub-row-1', stripeSubscriptionId: 'sub_123', status: 'active', currentPeriodEnd: '2026-09-01T12:00:00.000Z', cancelAtPeriodEnd: false, planLabel: 'Adult 1m' },
  ],
  pets: [{ id: 'pet-1', name: 'Luna', breed: 'Vira-lata', ageYears: 4, ageMonths: 0, weightInput: 12, weightUnit: 'kg', activityLevel: 'BAIXO', petCondition: 'ADEQUADO', neutered: true }],
  recurrence: { frequency: 'every_4_weeks' },
  planSelection: {
    pets: [{ pet_id: 'pet-1', enabled: true, pet_name: 'Luna', flavor_weights: [5, 5], selected_flavors: ['beef', 'fish'] }],
    country: 'BR',
    currency: 'BRL',
    updated_at: '2026-08-19T02:11:04.327Z',
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
    quoted_at: '2026-08-19T02:27:18.786Z',
    delivery_days: 2,
    estimate_label: '2 business days',
    distance_source: 'osrm',
  },
  discount: { promotionCodeId: null, percent: 0, eligibilityReason: 'HAS_PREVIOUS_PURCHASE', amountPaid: null },
  lineItems: [
    { flavor: 'beef', pet_name: 'Luna', quantity: 5, line_total: 225, unit_price: 45, pack_size_label: '500 g', currency: 'BRL' },
    { flavor: 'fish', pet_name: 'Luna', quantity: 5, line_total: 325, unit_price: 65, pack_size_label: '500 g', currency: 'BRL' },
  ],
  checkoutReference: {
    total: 557,
    status: 'incomplete',
    billing: { email: 'ana@edenbowls.com', first_name: 'Ana', last_name: 'Costa', phone: '' },
    currency: 'BRL',
    subtotal: 557,
    checkout_mode: 'subscription_first',
    payment_state: 'paid',
    shipping_total: 7,
    has_payment_method: true,
    stripe_customer_id: 'cus_123',
    discount_eligibility: { reason: 'HAS_PREVIOUS_PURCHASE', eligible: false, validated: true },
    stripe_discount_amount: 0,
    stripe_subscription_id: 'sub_123',
    payment_acknowledged_at: '2026-08-19T02:27:34.178Z',
    stripe_discount_percent: 0,
    discount_applied_percent: 0,
    stripe_payment_intent_id: 'pi_123',
    stripe_subscription_status: 'incomplete',
    stripe_payment_intent_status: 'succeeded',
  },
  paymentReference: { id: 'pi_1' },
}

export const userItem = {
  id: 'u-ana',
  email: 'ana@edenbowls.com',
  status: 'active',
  createdAt: '2026-08-01T12:00:00.000Z',
  roles: ['customer'],
  profile: { fullName: 'Ana Costa', phone: '11999999999' },
}

export const usersList = {
  total: 1,
  page: 1,
  perPage: 20,
  totalPages: 1,
  items: [userItem],
}

export const userDetail = {
  ...userItem,
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

export const productItem = {
  id: 'prod-1',
  slug: 'bowl-adulto',
  namePt: 'Bowl Adulto',
  nameEn: 'Adult Bowl',
  active: true,
  category: { namePt: 'Alimentação', nameEn: 'Food' },
  marketConfigs: [{ marketCountry: 'BR', currency: 'BRL', active: true }],
  variants: [{ id: 'var-1', sku: 'BOWL-1', variantPrices: [{ id: 'price-1' }] }],
  createdAt: '2026-08-01T12:00:00.000Z',
}

export const productsList = {
  total: 1,
  page: 1,
  perPage: 20,
  items: [productItem],
}

export const productDetail = {
  id: 'prod-1',
  slug: 'bowl-adulto',
  namePt: 'Bowl Adulto',
  nameEn: 'Adult Bowl',
  active: false,
  planCountry: 'BR',
  planDays: 28,
  publishBlocked: false,
  gaps: [],
  variants: [
    {
      id: 'var-1',
      sku: 'BOWL-1',
      name: 'Frango 1kg',
      regularPrice: 89.9,
      stripeProductId: 'prod_stripe',
      stripePriceId: 'price_stripe',
      syncStatus: 'mapped',
      requiresSync: false,
    },
  ],
}

export const subscriptionItem = {
  id: 'sub-row-1',
  providerSubscriptionId: 'sub_123',
  status: 'active',
  autoRenew: true,
  nextBillingAt: '2026-09-01T12:00:00.000Z',
  createdAt: '2026-08-01T12:00:00.000Z',
  user: { id: 'u-ana', email: 'ana@edenbowls.com' },
  term: { marketCountry: 'BR', months: 1 },
}

export const subscriptionsList = {
  total: 1,
  page: 1,
  perPage: 20,
  items: [subscriptionItem],
}

export const webhooksList = {
  total: 1,
  page: 1,
  perPage: 20,
  items: [
    {
      id: 'wh-1',
      eventId: 'evt_1',
      eventType: 'invoice.paid',
      state: 'processed',
      attempts: 1,
      processedAt: '2026-08-19T12:00:00.000Z',
    },
  ],
}

export const billingMetrics = {
  total: 10,
  active: 8,
  canceling: 1,
  pastDue: 0,
  canceled30d: 1,
  renewing7d: 2,
}

export const syncHealth = {
  market: 'BR',
  currency: 'BRL',
  totalExpected: 10,
  totalMapped: 10,
  gaps: [],
}

export const syncStatus = {
  syncJobId: 'job-1',
  status: 'idle',
  scope: 'catalog',
  summary: { scope: 'catalog', created: 0, updated: 0 },
}

export const shippingSettings = {
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
}

export const staffUser = {
  id: 'u-ops',
  email: 'ops@edenbowls.com',
  displayName: 'Operador',
  profile: { fullName: 'Operador' },
  storedRoles: ['operator'],
  roles: ['operator'],
  lockedByAllowlist: false,
}

export const staffList = {
  total: 1,
  page: 1,
  perPage: 50,
  totalPages: 1,
  items: [staffUser],
  bootstrapEmails: ['admin@edenbowls.com'],
}

export const firstPurchasePromoHealth = {
  complete: true,
  missing_terms: [],
  mapping: { 1: 'promo_1m', 3: 'promo_3m', 6: 'promo_6m' },
  misconfig_count: 0,
}

export const promotionCodesList = {
  success: true,
  data: {
    items: [
      {
        id: 'promo_1m',
        code: 'FIRST_1M',
        coupon_id: 'coupon_1',
        percent_off: 10,
        duration: 'once',
        active: true,
        slot: 1,
        dashboard_url: 'https://dashboard.stripe.com/test/promotion_codes/promo_1m',
      },
      {
        id: 'promo_open',
        code: 'OPEN',
        coupon_id: 'coupon_open',
        percent_off: 5,
        duration: null,
        active: true,
        slot: null,
        dashboard_url: 'https://dashboard.stripe.com/test/promotion_codes/promo_open',
      },
    ],
  },
}
