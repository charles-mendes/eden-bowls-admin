import { describe, expect, it } from 'vitest'
import { activeMenuHref, groupedMenuItems, visibleMenuItems } from './menu'

describe('admin menu', () => {
  it('hides operational sections from veterinarian-only accounts', () => {
    const hrefs = visibleMenuItems(['veterinarian']).map((item) => item.href)

    expect(hrefs).toEqual(['/nutrition/simulate'])
  })

  it('shows Produção to operator and readonly, not veterinarian', () => {
    expect(visibleMenuItems(['admin']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['operator']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['readonly']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/operations/production')
  })

  it('keeps role assignment exclusive to admin', () => {
    const operatorHrefs = visibleMenuItems(['operator']).map((item) => item.href)
    const adminHrefs = visibleMenuItems(['admin']).map((item) => item.href)

    expect(operatorHrefs).not.toContain('/users/roles')
    expect(adminHrefs).toContain('/users/roles')
  })

  it('shows readonly the read screens, including the shipping simulator, but not write-heavy items', () => {
    const hrefs = visibleMenuItems(['readonly']).map((item) => item.href)

    expect(hrefs).toContain('/dashboard')
    expect(hrefs).toContain('/operations/production')
    expect(hrefs).toContain('/feedbacks')
    expect(hrefs).toContain('/privacy/requests')
    expect(hrefs).toContain('/config/shipping')
    expect(hrefs).not.toContain('/billing/coupons')
    expect(hrefs).not.toContain('/orders')
  })

  it('keeps checkout screens out of the menu: checkouts live in the customer detail', () => {
    const hrefs = visibleMenuItems(['admin', 'operator']).map((item) => item.href)

    expect(hrefs).not.toContain('/onboarding/sessions')
    expect(hrefs).not.toContain('/orders')
  })

  it('groups visible items without dropping hrefs', () => {
    const items = visibleMenuItems(['admin'])
    const groups = groupedMenuItems(['admin'])
    const groupedHrefs = groups.flatMap((group) => group.items.map((item) => item.href))

    expect(groupedHrefs).toEqual(items.map((item) => item.href))
    expect(groups.map((group) => group.group)).toEqual([
      'Visão geral',
      'Operação',
      'Clientes',
      'Loja',
      'Ferramentas',
      'Administração',
    ])
  })

  it('activates only the most specific menu item', () => {
    const items = visibleMenuItems(['admin'])

    expect(activeMenuHref('/billing/coupons', items)).toBe('/billing/coupons')
    expect(activeMenuHref('/billing/subscriptions/12', items)).toBe('/billing')
    expect(activeMenuHref('/users/roles', items)).toBe('/users/roles')
    expect(activeMenuHref('/users/u-1', items)).toBe('/users')
    expect(activeMenuHref('/billingx', items)).toBe('')
  })

  it('shows Receitas next to Produtos in Loja for admin, operator and readonly', () => {
    for (const role of ['admin', 'operator', 'readonly'] as const) {
      const loja = groupedMenuItems([role]).find((group) => group.group === 'Loja')
      const hrefs = loja?.items.map((item) => item.href) ?? []
      expect(hrefs.indexOf('/catalog/recipes')).toBe(hrefs.indexOf('/catalog/products') + 1)
    }
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/catalog/recipes')
    expect(activeMenuHref('/catalog/recipes/BR/beef', visibleMenuItems(['operator']))).toBe('/catalog/recipes')
  })
})
