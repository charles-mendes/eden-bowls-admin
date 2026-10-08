import { describe, expect, it } from 'vitest'
import { activeMenuHref, groupedMenuItems, visibleMenuItems } from './menu'

describe('admin menu', () => {
  it('hides operational sections from nutritionist-only accounts', () => {
    const hrefs = visibleMenuItems(['nutritionist']).map((item) => item.href)

    expect(hrefs).toEqual(['/nutrition/simulate'])
  })

  it('shows Produção to operator and readonly, not nutritionist', () => {
    expect(visibleMenuItems(['admin']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['operator']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['readonly']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['nutritionist']).map((item) => item.href)).not.toContain('/operations/production')
  })

  it('keeps role assignment exclusive to admin', () => {
    const operatorHrefs = visibleMenuItems(['operator']).map((item) => item.href)
    const adminHrefs = visibleMenuItems(['admin']).map((item) => item.href)

    expect(operatorHrefs).not.toContain('/users/roles')
    expect(adminHrefs).toContain('/users/roles')
  })

  it('does not show write-heavy items to readonly', () => {
    const hrefs = visibleMenuItems(['readonly']).map((item) => item.href)

    expect(hrefs).toContain('/dashboard')
    expect(hrefs).toContain('/onboarding/sessions')
    expect(hrefs).toContain('/operations/production')
    expect(hrefs).toContain('/feedbacks')
    expect(hrefs).toContain('/privacy/requests')
    expect(hrefs).not.toContain('/config/shipping')
    expect(hrefs).not.toContain('/billing/coupons')
    expect(hrefs).not.toContain('/orders')
  })

  it('keeps a single operational checkout screen', () => {
    const hrefs = visibleMenuItems(['admin', 'operator']).map((item) => item.href)

    expect(hrefs).toContain('/onboarding/sessions')
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
})
