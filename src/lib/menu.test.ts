import { describe, expect, it } from 'vitest'
import { groupedMenuItems, visibleMenuItems } from './menu'

describe('admin menu', () => {
  it('hides operational sections from nutritionist-only accounts', () => {
    const hrefs = visibleMenuItems(['nutritionist']).map((item) => item.href)

    expect(hrefs).toEqual(['/nutrition/simulate'])
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
      'Catálogo',
      'Billing',
      'Equipe',
    ])
  })
})
