import type { NutritionAuditEvent } from './nutritionSettings'

export type BrCenter = {
  name: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zipcode: string
  lat: number
  lng: number
  version?: string
}

export type UsShipFrom = {
  name: string
  street: string
  street2: string
  city: string
  state: string
  zipcode: string
  country: string
  // UPS asks for it on the pickup (ups-pickup); a label buys without it.
  phone: string
}

// One shipping box (shipping-boxes). `max_packs` counts packs of any size; the API splits each order into boxes.
export type ShippingBox = {
  label: string
  length_in: number
  width_in: number
  height_in: number
  empty_weight_kg: number
  max_packs: number
}

export type ShippingBoxKey = 'starter' | 'monthly'

export const SHIPPING_BOX_KEYS: ShippingBoxKey[] = ['starter', 'monthly']

export type ShippingSettings = {
  br: {
    enabled: boolean
    label: string
    center: BrCenter
    rule: {
      per_km: number
      road_factor: number
      min_fee: number
      max_fee: number | null
      max_distance_km: number
      km_per_day: number
      min_days: number
      max_days: number
      // Business days from preparation to delivery, 0 (same day) to 3.
      delivery_days: number
    }
  }
  us: {
    enabled: boolean
    cost: number
    carrier: string
    delivery: string
    label: string
    quote_mode: 'fixed' | 'ups'
    fallback_enabled: boolean
    ship_from: UsShipFrom
    // dry_ice_kg: dry ice in each box, declared to UPS as UN1845 (ups-dry-ice-declaration).
    package: { weight_lb: number; length_in: number; width_in: number; height_in: number; dry_ice_kg: number }
    boxes: Record<ShippingBoxKey, ShippingBox>
    allowed_service_codes: string[]
    // Business days of UPS transit the insulated box accepts; a longer quote makes the address unavailable.
    max_transit_days: number
    // Whether new US checkouts charge the shipping quote (customer-shipping-charge). Off: the company pays it.
    charge_shipping: boolean
    // On: the UPS test environment (CIE) gets quotes and labels without the dry ice declaration, because CIE drops
    // UPS Ground for a package with dry ice. Production UPS always gets it. dry_ice_kg is kept as is.
    skip_dry_ice_in_test: boolean
    // Changes of the switch, newest first, read from the admin audit log. Not sent on save.
    charge_shipping_history: ChargeShippingEvent[]
  }
}

export type ChargeShippingEvent = { enabled: boolean; actor_email: string | null; changed_at: string }

// The US market's time zone: the switch history shows New York time, whatever the browser's.
export const US_MARKET_TIME_ZONE = 'America/New_York'

// The switch history in the shape of the panel's edit log.
export function chargeHistoryEvents(history: ChargeShippingEvent[]): NutritionAuditEvent[] {
  return history.map((event, index) => ({
    id: index + 1,
    actorUserId: null,
    actorEmail: event.actor_email,
    action: event.enabled ? 'shipping.us.charge.enable' : 'shipping.us.charge.disable',
    metadata: { enabled: event.enabled },
    createdAt: event.changed_at,
  }))
}

export function describeChargeEvent(event: NutritionAuditEvent) {
  return { title: event.metadata.enabled ? 'Cobrança ligada' : 'Cobrança desligada', details: [] as string[] }
}

export type HeadquartersValidation = {
  valid: boolean
  country: 'BR' | 'US'
  address: Record<string, string>
  errors: Record<string, string>
  warnings: string[]
  location?: { lat: number; lng: number; precision: 'address' | 'zipcode'; label?: string }
  ups?: { status: string; reason?: string; candidates: Array<Record<string, string>> }
}

export type UpsSimulation = {
  environment: string
  steps: Array<{ key: string; label: string; status: 'ok' | 'error' | 'warning' | 'skipped'; detail?: string; ms?: number }>
  destination: { city: string; state: string; zipcode: string } | null
  rates: Array<{ service_code: string; label: string; amount: number; currency: string; delivery_days: number | null; allowed: boolean }>
  selected: { service_code: string; label: string; amount: number; currency: string; delivery_days: number | null } | null
}

export const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export const US_STATES: Array<[string, string]> = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'], ['FL', 'Florida'],
  ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'], ['IN', 'Indiana'],
  ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'],
  ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'], ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'], ['NC', 'North Carolina'], ['ND', 'North Dakota'],
  ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'], ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
]

export const UPS_SERVICES: Array<[string, string]> = [
  ['03', 'UPS Ground'],
  ['12', 'UPS 3 Day Select'],
  ['02', 'UPS 2nd Day Air'],
  ['59', 'UPS 2nd Day Air A.M.'],
  ['13', 'UPS Next Day Air Saver'],
  ['01', 'UPS Next Day Air'],
  ['14', 'UPS Next Day Air Early'],
]

export const emptySettings = (): ShippingSettings => ({
  br: {
    enabled: true,
    label: 'Entrega Eden Bowl',
    center: { name: 'CD', street: '', number: '', complement: '', neighborhood: '', city: '', state: '', zipcode: '', lat: 0, lng: 0 },
    rule: { per_km: 0.95, road_factor: 1.3, min_fee: 0, max_fee: null, max_distance_km: 50, km_per_day: 80, min_days: 2, max_days: 10, delivery_days: 0 },
  },
  us: {
    enabled: true,
    cost: 12.9,
    carrier: 'FedEx',
    delivery: '3–5 business days',
    label: 'FedEx 3–5 business days',
    quote_mode: 'fixed',
    fallback_enabled: true,
    ship_from: { name: '', street: '', street2: '', city: '', state: '', zipcode: '', country: 'US', phone: '' },
    package: { weight_lb: 10, length_in: 12, width_in: 12, height_in: 12, dry_ice_kg: 0.5 },
    // The client's boxes, as the API seeds them on deploy.
    boxes: {
      starter: { label: 'Starter Box', length_in: 14, width_in: 12, height_in: 8, empty_weight_kg: 1, max_packs: 10 },
      monthly: { label: 'Caixa mensal', length_in: 18, width_in: 14, height_in: 12, empty_weight_kg: 1.5, max_packs: 30 },
    },
    allowed_service_codes: ['03'],
    max_transit_days: 1,
    charge_shipping: false,
    skip_dry_ice_in_test: false,
    charge_shipping_history: [],
  },
})

// The Brazil delivery times the API accepts: the same day as preparation, or 1 to 3 business days after it.
export const BR_DELIVERY_DAYS = [0, 1, 2, 3] as const

export function brDeliveryLabel(days: number): string {
  if (!days) return 'Mesmo dia'
  return days === 1 ? '1 dia útil' : `${days} dias úteis`
}

export function mergeSettings(input: Partial<ShippingSettings> | undefined): ShippingSettings {
  const base = emptySettings()
  const br = input?.br
  const us = input?.us
  return {
    br: {
      ...base.br,
      ...(br || {}),
      center: { ...base.br.center, ...(br?.center || {}) },
      rule: { ...base.br.rule, ...(br?.rule || {}) },
    },
    us: {
      ...base.us,
      ...(us || {}),
      ship_from: { ...base.us.ship_from, ...(us?.ship_from || {}) },
      package: { ...base.us.package, ...(us?.package || {}) },
      boxes: {
        starter: { ...base.us.boxes.starter, ...(us?.boxes?.starter || {}) },
        monthly: { ...base.us.boxes.monthly, ...(us?.boxes?.monthly || {}) },
      },
      allowed_service_codes: Array.isArray(us?.allowed_service_codes) && us.allowed_service_codes.length
        ? us.allowed_service_codes
        : base.us.allowed_service_codes,
      quote_mode: us?.quote_mode === 'ups' ? 'ups' : 'fixed',
      charge_shipping: us?.charge_shipping === true,
      skip_dry_ice_in_test: us?.skip_dry_ice_in_test === true,
      charge_shipping_history: Array.isArray(us?.charge_shipping_history) ? us.charge_shipping_history : [],
    },
  }
}

export function brHeadquartersReady(center: BrCenter) {
  return Boolean(center.zipcode && center.street && center.city && (center.lat !== 0 || center.lng !== 0))
}

// The phone digits of a market without the country code: US 10 (area code and number; no area code starts
// with 1, so a leading 1 is the country code), BR 10 or 11 (DDD and number; a leading 55 past 11 is the country code).
export function phoneDigits(market: 'BR' | 'US', raw: string | undefined) {
  let digits = String(raw || '').replace(/\D/g, '')
  if (market === 'US') {
    if (digits.startsWith('1')) digits = digits.slice(1)
    return digits.slice(0, 10)
  }
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2)
  return digits.slice(0, 11)
}

// The phone as it is typed, in the market layout: US (561) 674-6117, BR (41) 3333-4444 or (41) 99890-5819.
export function formatPhone(market: 'BR' | 'US', raw: string | undefined) {
  const digits = phoneDigits(market, raw)
  if (!digits) return ''
  const area = digits.slice(0, market === 'US' ? 3 : 2)
  const rest = digits.slice(area.length)
  if (!rest) return `(${area}`
  const split = market === 'US' ? 3 : rest.length > 8 ? 5 : 4
  const head = rest.slice(0, split)
  const tail = rest.slice(split)
  return tail ? `(${area}) ${head}-${tail}` : `(${area}) ${head}`
}

// The US phone UPS takes on the pickup: empty, or the 10 digits (area code and number).
export function usPhoneInvalid(phone: string | undefined) {
  const digits = phoneDigits('US', phone)
  return digits.length > 0 && digits.length !== 10
}

export const US_PHONE_INVALID_TEXT = 'O telefone precisa de 10 dígitos (código de área e número), como (561) 674-6117.'

export function usHeadquartersReady(shipFrom: UsShipFrom) {
  return Boolean(shipFrom.zipcode && shipFrom.street && shipFrom.city && shipFrom.state)
}

export function formatMoney(value: number, currency: 'BRL' | 'USD') {
  return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency }).format(value)
}
