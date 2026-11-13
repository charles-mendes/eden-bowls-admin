import { describe, expect, it } from 'vitest'
import { distinctPlanTotals, mergeReadablePets, parseCheckoutSnapshots, planDescription } from './checkoutSnapshot'
import { checkoutDetail } from '../test/fixtures'
import { formatCurrency } from './format'

describe('parseCheckoutSnapshots', () => {
  it('turns persisted checkout JSON into operator-facing labels', () => {
    const snapshots = parseCheckoutSnapshots(checkoutDetail)

    expect(snapshots.discount.eligible).toBe(false)
    expect(snapshots.discount.items).toEqual(expect.arrayContaining([
      { label: 'Motivo', value: 'Cliente já possui compra anterior' },
      { label: 'Percentual', value: '0%' },
    ]))
    expect(snapshots.plan.pets[0]).toEqual({
      petName: 'Luna',
      flavors: 'beef × 5, fish × 5',
    })
    expect(snapshots.plan.items).toEqual(expect.arrayContaining([
      { label: 'Prazo', value: '1 mês' },
    ]))
    expect(snapshots.plan.items.some((item) => item.label === 'Recorrência')).toBe(false)
    expect(snapshots.plan.lineItems[0]).toMatchObject({
      petName: 'Luna',
      product: 'beef',
      quantity: '5',
    })
    expect(snapshots.address.lines).toEqual([
      'Rua Aristeu de Castro Fernandes, 941',
      'Apt 1',
      'Maria Antonieta',
      'Pinhais, PR',
      '83331-160',
      'Brasil',
    ])
    expect(snapshots.shipping.items).toEqual(expect.arrayContaining([
      { label: 'Método', value: 'Entrega Eden Bowl' },
      { label: 'Distância', value: '7,37 km' },
    ]))
    expect(snapshots.payment.paymentState).toBe('paid')
  })

  it('keeps sparse snapshots readable without empty noise', () => {
    const snapshots = parseCheckoutSnapshots({
      planSelection: { plan: 'adult' },
      address: { city: 'São Paulo' },
      shipping: { method: 'eden' },
      discount: { eligibilityReason: 'ineligible' },
      lineItems: [{ sku: 'bowl-1' }],
      checkoutReference: { id: 'co_1' },
    })

    expect(snapshots.discount.items).toEqual([
      { label: 'Motivo', value: 'Não elegível' },
    ])
    expect(snapshots.plan.items).toEqual([
      { label: 'Plano', value: 'adult' },
    ])
    expect(snapshots.address.lines).toEqual(['São Paulo'])
    expect(snapshots.shipping.items).toEqual([
      { label: 'Método', value: 'eden' },
    ])
    expect(snapshots.payment.items).toEqual([])
  })

  it('shows full recipe names in billing, with the key only when a line has no name', () => {
    const snapshots = parseCheckoutSnapshots({
      ...checkoutDetail,
      planSelection: {
        ...checkoutDetail.planSelection,
        pets: [{ pet_id: 'pet-1', pet_name: 'Thor', selected_flavors: ['senior-beef', 'turkey', 'mystery'], flavor_weights: [4, 1, 1] }],
        catalog_pricing: {
          currency: 'BRL',
          line_items: [
            { flavor: 'senior-beef', flavor_label: 'Receita de Carne para Cães Sênior', short_label: 'Bovino · Sênior', pet_name: 'Thor', quantity: 4, unit_price: 40, line_total: 160, pack_size_label: '300 g', currency: 'BRL' },
            { flavor: 'turkey', flavor_label: 'Frango', pet_name: 'Thor', quantity: 1, unit_price: 22.5, line_total: 22.5, pack_size_label: '300 g', currency: 'BRL' },
          ],
        },
      },
      lineItems: [
        { flavor: 'senior-beef', flavor_label: 'Receita de Carne para Cães Sênior', pet_name: 'Thor', quantity: 4, unit_price: 40, line_total: 160, pack_size_label: '300 g', currency: 'BRL' },
        { flavor: 'turkey', flavor_label: 'Frango', pet_name: 'Thor', quantity: 1, unit_price: 22.5, line_total: 22.5, pack_size_label: '300 g', currency: 'BRL' },
        { flavor: 'mystery', pet_name: 'Thor', quantity: 1, unit_price: 10, line_total: 10, pack_size_label: '300 g', currency: 'BRL' },
      ],
    })

    expect(snapshots.plan.pets[0]).toEqual({
      petName: 'Thor',
      flavors: 'Receita de Carne para Cães Sênior × 4, Frango × 1, mystery × 1',
    })
    expect(snapshots.plan.lineItems.map((item) => item.product)).toEqual([
      'Receita de Carne para Cães Sênior',
      'Frango',
      'mystery',
    ])
  })

  it('keeps the plan name on a clash and appends snapshot-only pets with an empty flavor cell', () => {
    expect(mergeReadablePets(
      {
        pets: [{
          pet_id: 'pet-1',
          pet_name: 'luna',
          selected_flavors: ['beef'],
          flavor_weights: [5],
        }],
      },
      {
        pets: [
          { id: 'pet-1', name: 'Luna' },
          { id: 'pet-2', name: 'Milo' },
        ],
      },
    )).toEqual([
      { petName: 'luna', flavors: 'beef × 5' },
      { petName: 'Milo', flavors: '' },
    ])
  })
})

describe('parseCheckoutSnapshots recipient', () => {
  it('shows who receives the box when the address has one', () => {
    const snapshots = parseCheckoutSnapshots({ address: { street: 'Rua A', city: 'São Paulo', recipient_name: 'João Lima' } })
    expect(snapshots.address.items).toEqual(expect.arrayContaining([{ label: 'Quem recebe', value: 'João Lima' }]))
  })

  it('shows no recipient row for a subscription from before the field', () => {
    const snapshots = parseCheckoutSnapshots({ address: { street: 'Rua A', city: 'São Paulo' } })
    expect(snapshots.address.items.some((item) => item.label === 'Quem recebe')).toBe(false)
  })
  describe('total: products plus freight', () => {
    const brl = (value: number) => formatCurrency(value, 'BRL')
    const lines = [
      { quantity: 15, unit_price: 45, line_total: 675 },
      { quantity: 9, unit_price: 42.5, line_total: 382.5 },
      { quantity: 6, unit_price: 45, line_total: 270 },
    ]

    it('adds the plan subtotal and the saved freight, without a float tail', () => {
      const snapshots = parseCheckoutSnapshots({
        planSelection: { catalog_pricing: { currency: 'BRL', subtotal: 1327.5, line_items: lines } },
        shipping: { label: 'Entrega Eden Bowl', cost: 2.47, total: 2.47 },
      })
      expect(snapshots.total.items).toEqual([
        { label: 'Produtos', value: brl(1327.5) },
        { label: 'Frete', value: brl(2.47) },
        { label: 'Total (produtos + frete)', value: brl(1329.97) },
      ])
    })

    it('sums the lines when the copy has no subtotal', () => {
      const snapshots = parseCheckoutSnapshots({
        planSelection: { catalog_pricing: { currency: 'BRL', line_items: lines } },
        shipping: { cost: 2.47 },
      })
      expect(snapshots.total.items[0]).toEqual({ label: 'Produtos', value: brl(1327.5) })
      expect(snapshots.total.items[2]).toEqual({ label: 'Total (produtos + frete)', value: brl(1329.97) })
    })

    it('shows no total without the freight, and nothing without a product value', () => {
      const noFreight = parseCheckoutSnapshots({ planSelection: { catalog_pricing: { subtotal: 550 } }, shipping: null })
      expect(noFreight.total.items).toEqual([
        { label: 'Produtos', value: brl(550) },
        { label: 'Frete', value: 'Não registrado' },
      ])
      expect(parseCheckoutSnapshots({ shipping: { cost: 7 } }).total.items).toEqual([])
    })
  })
})

describe('planDescription', () => {
  const planSelection = {
    subscription_term_months: 1,
    pets: [{ pet_id: 'pet-1', pet_name: 'chocolate', selected_flavors: ['beef'], flavor_weights: [1] }],
    catalog_pricing: {
      currency: 'BRL',
      line_items: [
        { flavor: 'beef', pet_name: 'chocolate', quantity: 15 },
        { flavor: 'chicken', pet_name: 'chocolate', quantity: 9 },
        { flavor: 'pork', pet_name: 'chocolate', quantity: 6 },
      ],
    },
  }

  it('describes the fallback label from the checkout copy', () => {
    expect(planDescription({ planLabel: 'Plan #6', planSelection })).toBe('Plano de 1 mês · 1 pet (chocolate) · 30 pacotes')
  })

  it('keeps a real stored label', () => {
    expect(planDescription({ planLabel: 'Plano Família', planSelection })).toBe('Plano Família')
  })

  it('uses the contract term when the page has it', () => {
    expect(planDescription({ planLabel: null, planSelection, termMonths: 6 })).toBe('Plano de 6 meses · 1 pet (chocolate) · 30 pacotes')
  })

  it('falls back to the label when the copy has nothing to say', () => {
    expect(planDescription({ planLabel: 'Plan #6', planSelection: null })).toBe('Plan #6')
  })
})

describe('distinctPlanTotals', () => {
  it('keeps only the subtotal when the first invoice is the same value', () => {
    expect(distinctPlanTotals([
      { label: 'Subtotal do plano', value: 'R$ 1.327,50' },
      { label: '1ª fatura (plano)', value: 'R$ 1.327,50' },
    ])).toEqual([{ label: 'Subtotal do plano', value: 'R$ 1.327,50' }])
  })

  it('keeps both when the first invoice has a discount', () => {
    const items = [
      { label: 'Subtotal do plano', value: 'R$ 1.327,50' },
      { label: '1ª fatura (plano)', value: 'R$ 1.194,75' },
    ]
    expect(distinctPlanTotals(items)).toEqual(items)
  })
})
