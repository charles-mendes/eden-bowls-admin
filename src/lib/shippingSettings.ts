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
}

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
    package: { weight_lb: number; length_in: number; width_in: number; height_in: number }
    allowed_service_codes: string[]
  }
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
    rule: { per_km: 0.95, road_factor: 1.3, min_fee: 0, max_fee: null, max_distance_km: 50, km_per_day: 80, min_days: 2, max_days: 10 },
  },
  us: {
    enabled: true,
    cost: 12.9,
    carrier: 'FedEx',
    delivery: '3–5 business days',
    label: 'FedEx 3–5 business days',
    quote_mode: 'fixed',
    fallback_enabled: true,
    ship_from: { name: '', street: '', street2: '', city: '', state: '', zipcode: '', country: 'US' },
    package: { weight_lb: 10, length_in: 12, width_in: 12, height_in: 12 },
    allowed_service_codes: ['03'],
  },
})

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
      allowed_service_codes: Array.isArray(us?.allowed_service_codes) && us.allowed_service_codes.length
        ? us.allowed_service_codes
        : base.us.allowed_service_codes,
      quote_mode: us?.quote_mode === 'ups' ? 'ups' : 'fixed',
    },
  }
}

export function brHeadquartersReady(center: BrCenter) {
  return Boolean(center.zipcode && center.street && center.city && (center.lat !== 0 || center.lng !== 0))
}

export function usHeadquartersReady(shipFrom: UsShipFrom) {
  return Boolean(shipFrom.zipcode && shipFrom.street && shipFrom.city && shipFrom.state)
}

export function formatMoney(value: number, currency: 'BRL' | 'USD') {
  return new Intl.NumberFormat(currency === 'BRL' ? 'pt-BR' : 'en-US', { style: 'currency', currency }).format(value)
}
