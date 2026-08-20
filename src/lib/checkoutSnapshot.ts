import {
  formatBoolean,
  formatCheckoutMode,
  formatCountry,
  formatCurrency,
  formatDate,
  formatDeliveryDays,
  formatDiscountDuration,
  formatDiscountReason,
  formatDistanceSource,
  formatFlavor,
  formatFrequency,
  formatNumber,
  formatPaymentState,
  formatPercent,
  formatPostalCode,
  formatStripeStatus,
  formatTermMonths,
} from './format'

export type MetaItem = {
  label: string
  value: string
  hideIfEmpty?: boolean
}

export type PlanLineItem = {
  petName: string
  product: string
  quantity: string
  packSize: string
  unitPrice: string
  lineTotal: string
}

export type PlanPetMix = {
  petName: string
  flavors: string
}

export type CheckoutSnapshots = {
  plan: {
    items: MetaItem[]
    pets: PlanPetMix[]
    lineItems: PlanLineItem[]
    totals: MetaItem[]
  }
  discount: {
    eligible: boolean | null
    items: MetaItem[]
  }
  payment: {
    paymentState: string | null
    items: MetaItem[]
  }
  address: {
    lines: string[]
    items: MetaItem[]
  }
  shipping: {
    items: MetaItem[]
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function readString(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return ''

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'boolean') return value ? 'true' : 'false'
  }

  return ''
}

function readNumber(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return null
}

function readBoolean(record: Record<string, unknown> | null, ...keys: string[]) {
  if (!record) return null

  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'boolean') return value
    if (value === 'true' || value === 1 || value === '1') return true
    if (value === 'false' || value === 0 || value === '0') return false
  }

  return null
}

function displayValue(value: string) {
  return value || '-'
}

function compactItems(items: MetaItem[]) {
  return items.flatMap((item) => {
    if (item.hideIfEmpty && (item.value === '' || item.value === '-')) return []
    return [{ label: item.label, value: item.value }]
  })
}

function parseFlavors(pet: Record<string, unknown>) {
  const selected = asArray(pet.selected_flavors).map((item) => String(item))
  const weights = asArray(pet.flavor_weights)
  if (selected.length) {
    return selected.map((flavor, index) => {
      const quantity = weights[index]
      const amount = typeof quantity === 'number' ? quantity : Number(quantity)
      return Number.isFinite(amount)
        ? `${formatFlavor(flavor)} × ${formatNumber(amount)}`
        : formatFlavor(flavor)
    }).join(', ')
  }

  const nested = asRecord(pet.flavors)
  if (!nested) return '-'

  return Object.entries(nested).map(([flavor, quantity]) => {
    const amount = typeof quantity === 'number' ? quantity : Number(quantity)
    return Number.isFinite(amount)
      ? `${formatFlavor(flavor)} × ${formatNumber(amount)}`
      : formatFlavor(flavor)
  }).join(', ') || '-'
}

function parseLineItems(rawItems: unknown[], fallbackCurrency: string): PlanLineItem[] {
  return rawItems.map((item) => {
    const row = asRecord(item) || {}
    const currency = readString(row, 'currency') || fallbackCurrency || 'BRL'
    const flavor = readString(row, 'flavor')
    const sku = readString(row, 'sku')
    const quantity = readNumber(row, 'quantity')

    return {
      petName: readString(row, 'pet_name', 'petName') || '-',
      product: flavor ? formatFlavor(flavor) : displayValue(sku),
      quantity: quantity === null ? '-' : formatNumber(quantity),
      packSize: readString(row, 'pack_size_label', 'packSizeLabel') || '-',
      unitPrice: formatCurrency(readNumber(row, 'unit_price', 'unitPrice'), currency),
      lineTotal: formatCurrency(readNumber(row, 'line_total', 'lineTotal'), currency),
    }
  })
}

function parsePlanPets(plan: Record<string, unknown> | null): PlanPetMix[] {
  const fromPets = asArray(plan?.pets).flatMap((item) => {
    const pet = asRecord(item)
    if (!pet) return []
    return [{
      petName: readString(pet, 'pet_name', 'name') || 'Unnamed pet',
      flavors: parseFlavors(pet),
    }]
  })

  if (fromPets.length) return fromPets

  return asArray(plan?.flavors_by_pet).flatMap((item) => {
    const pet = asRecord(item)
    if (!pet) return []
    return [{
      petName: readString(pet, 'pet_name', 'name') || 'Unnamed pet',
      flavors: parseFlavors(pet),
    }]
  })
}

function parseAddressLines(address: Record<string, unknown> | null) {
  if (!address) return []

  const street = readString(address, 'street', 'address_line1', 'address')
  const number = readString(address, 'number')
  const streetLine = [street, number].filter(Boolean).join(', ')
  const complement = readString(address, 'complement', 'address_line2')
  const neighborhood = readString(address, 'neighborhood')
  const city = readString(address, 'city')
  const state = readString(address, 'state')
  const cityLine = [city, state].filter(Boolean).join(', ')
  const postal = formatPostalCode(readString(address, 'postal_code', 'zipcode', 'zipCode', 'zip_code'))

  return [streetLine, complement, neighborhood, cityLine, postal === '-' ? '' : postal, formatCountry(readString(address, 'country'))]
    .filter((line) => line && line !== '-')
}

export function parseCheckoutSnapshots(input: {
  recurrence?: unknown
  planSelection?: unknown
  address?: unknown
  shipping?: unknown
  discount?: {
    promotionCodeId?: string | null
    percent?: number | null
    duration?: string | null
    amountPaid?: number | null
    eligibilityReason?: string | null
  }
  lineItems?: unknown[]
  checkoutReference?: unknown
} | null): CheckoutSnapshots {
  const plan = asRecord(input?.planSelection)
  const checkout = asRecord(input?.checkoutReference)
  const address = asRecord(input?.address)
  const shipping = asRecord(input?.shipping)
  const billing = asRecord(checkout?.billing)
  const eligibility = asRecord(checkout?.discount_eligibility)
  const catalog = asRecord(plan?.catalog_pricing)
  const recurrence = asRecord(input?.recurrence)
  const currencyLabel = readString(catalog, 'currency')
    || readString(plan, 'currency')
    || readString(checkout, 'currency')
  const currency = currencyLabel || 'BRL'
  const rawLineItems = asArray(input?.lineItems).length
    ? asArray(input?.lineItems)
    : asArray(catalog?.line_items)
  const eligible = readBoolean(eligibility, 'eligible')
  const reason = readString(eligibility, 'reason') || input?.discount?.eligibilityReason || ''
  const percent = readNumber(checkout, 'discount_applied_percent', 'stripe_discount_percent', 'discount_percent')
    ?? input?.discount?.percent
    ?? null
  const discountAmount = readNumber(checkout, 'stripe_discount_amount', 'discount_amount')
  const duration = readString(checkout, 'stripe_discount_duration', 'discount_duration') || input?.discount?.duration || ''
  const promotionCodeId = readString(checkout, 'stripe_promotion_code_id', 'promotion_code_id')
    || input?.discount?.promotionCodeId
    || ''
  const billingName = [readString(billing, 'first_name'), readString(billing, 'last_name')].filter(Boolean).join(' ')
  const deliveryDays = readNumber(shipping, 'delivery_days', 'transit_business_days')
  const estimateLabel = deliveryDays !== null
    ? formatDeliveryDays(deliveryDays)
    : readString(shipping, 'estimate_label')

  return {
    plan: {
      items: compactItems([
        { label: 'Prazo', value: formatTermMonths(readNumber(plan, 'subscription_term_months')), hideIfEmpty: true },
        { label: 'Recorrência', value: formatFrequency(readString(recurrence, 'frequency')), hideIfEmpty: true },
        { label: 'Mercado', value: formatCountry(readString(plan, 'country') || readString(address, 'country')), hideIfEmpty: true },
        { label: 'Moeda', value: displayValue(currencyLabel), hideIfEmpty: true },
        { label: 'Plano', value: readString(plan, 'plan'), hideIfEmpty: true },
      ]),
      pets: parsePlanPets(plan),
      lineItems: parseLineItems(rawLineItems, currency),
      totals: compactItems([
        { label: 'Subtotal do plano', value: formatCurrency(readNumber(catalog, 'subtotal'), currency), hideIfEmpty: true },
        { label: '1ª fatura (plano)', value: formatCurrency(readNumber(catalog, 'discounted_first_month_total'), currency), hideIfEmpty: true },
      ]),
    },
    discount: {
      eligible,
      items: compactItems([
        { label: 'Motivo', value: formatDiscountReason(reason) },
        { label: 'Validado', value: formatBoolean(readBoolean(eligibility, 'validated')), hideIfEmpty: true },
        { label: 'Cupom', value: displayValue(promotionCodeId), hideIfEmpty: true },
        { label: 'Percentual', value: formatPercent(percent), hideIfEmpty: true },
        { label: 'Duração', value: formatDiscountDuration(duration), hideIfEmpty: true },
        { label: 'Valor do desconto', value: formatCurrency(discountAmount, currency), hideIfEmpty: true },
        { label: 'Pago na Stripe', value: formatCurrency(input?.discount?.amountPaid ?? null, currency), hideIfEmpty: true },
      ]),
    },
    payment: {
      paymentState: readString(checkout, 'payment_state') || null,
      items: compactItems([
        { label: 'Status da assinatura', value: formatStripeStatus(readString(checkout, 'stripe_subscription_status', 'status')), hideIfEmpty: true },
        { label: 'Intent', value: formatPaymentState(readString(checkout, 'stripe_payment_intent_status')), hideIfEmpty: true },
        { label: 'Modo', value: formatCheckoutMode(readString(checkout, 'checkout_mode')), hideIfEmpty: true },
        { label: 'Método salvo', value: formatBoolean(readBoolean(checkout, 'has_payment_method')), hideIfEmpty: true },
        { label: 'Total cobrado', value: formatCurrency(readNumber(checkout, 'total'), currency), hideIfEmpty: true },
        { label: 'Subtotal', value: formatCurrency(readNumber(checkout, 'subtotal'), currency), hideIfEmpty: true },
        { label: 'Frete', value: formatCurrency(readNumber(checkout, 'shipping_total', 'shipping_total_with_tax'), currency), hideIfEmpty: true },
        { label: 'Faturamento', value: displayValue(billingName), hideIfEmpty: true },
        { label: 'E-mail', value: displayValue(readString(billing, 'email')), hideIfEmpty: true },
        { label: 'Telefone', value: displayValue(readString(billing, 'phone')), hideIfEmpty: true },
        { label: 'Customer Stripe', value: displayValue(readString(checkout, 'stripe_customer_id')), hideIfEmpty: true },
        { label: 'Assinatura Stripe', value: displayValue(readString(checkout, 'stripe_subscription_id')), hideIfEmpty: true },
        { label: 'Payment intent', value: displayValue(readString(checkout, 'stripe_payment_intent_id')), hideIfEmpty: true },
        { label: 'Confirmado em', value: formatDate(readString(checkout, 'payment_acknowledged_at')), hideIfEmpty: true },
      ]),
    },
    address: {
      lines: parseAddressLines(address),
      items: compactItems([
        { label: 'Telefone', value: displayValue(readString(address, 'phone')), hideIfEmpty: true },
        { label: 'Instruções', value: displayValue(readString(address, 'delivery_instructions', 'deliveryInstructions')), hideIfEmpty: true },
      ]),
    },
    shipping: {
      items: compactItems([
        { label: 'Método', value: displayValue(readString(shipping, 'label', 'method', 'method_id')) },
        { label: 'Custo', value: formatCurrency(readNumber(shipping, 'total', 'cost'), currency), hideIfEmpty: true },
        { label: 'Distância', value: readNumber(shipping, 'distance') === null ? '-' : `${formatNumber(readNumber(shipping, 'distance'))} km`, hideIfEmpty: true },
        { label: 'Tarifa', value: readNumber(shipping, 'per_km') === null ? '-' : `${formatCurrency(readNumber(shipping, 'per_km'), currency)}/km`, hideIfEmpty: true },
        { label: 'Prazo', value: displayValue(estimateLabel), hideIfEmpty: true },
        { label: 'CEP cotado', value: formatPostalCode(readString(shipping, 'zipcode')), hideIfEmpty: true },
        { label: 'Origem da rota', value: formatDistanceSource(readString(shipping, 'distance_source')), hideIfEmpty: true },
        { label: 'Cotado em', value: formatDate(readString(shipping, 'quoted_at', 'selected_at')), hideIfEmpty: true },
      ]),
    },
  }
}

export function discountBadgeClass(eligible: boolean | null) {
  if (eligible === true) return 'badge-success'
  if (eligible === false) return 'badge-warning'
  return 'badge-info'
}

export function discountBadgeLabel(eligible: boolean | null) {
  if (eligible === true) return 'Elegível'
  if (eligible === false) return 'Não elegível'
  return 'Não aplicável'
}

export function paymentBadgeClass(paymentState: string | null) {
  const raw = String(paymentState || '').toLowerCase()
  if (raw === 'paid' || raw === 'succeeded') return 'badge-success'
  if (raw === 'failed' || raw === 'sync_error') return 'badge-error'
  if (raw) return 'badge-warning'
  return 'badge-info'
}
