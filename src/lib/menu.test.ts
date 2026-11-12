import { describe, expect, it } from 'vitest'
import { activeMenuHref, groupedMenuItems, visibleMenuItems } from './menu'

describe('admin menu', () => {
  it('hides operational sections from veterinarian-only accounts', () => {
    const hrefs = visibleMenuItems(['veterinarian']).map((item) => item.href)

    expect(hrefs).toEqual(['/nutrition/simulate', '/nutrition/settings'])
  })

  it('Veterinarian has no settings: Configurações is for admin, operator and readonly', () => {
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/config')
    for (const role of ['admin', 'operator', 'readonly'] as const) {
      expect(visibleMenuItems([role]).map((item) => item.href)).toContain('/config')
    }
  })

  it('keeps Frete active, not Configurações, on the shipping page', () => {
    expect(activeMenuHref('/config/shipping', visibleMenuItems(['admin']))).toBe('/config/shipping')
    expect(activeMenuHref('/config', visibleMenuItems(['admin']))).toBe('/config')
  })

  it('shows Produção to operator and readonly, not veterinarian', () => {
    expect(visibleMenuItems(['admin']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['operator']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['readonly']).map((item) => item.href)).toContain('/operations/production')
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/operations/production')
  })

  it('shows Etiquetas UPS to admin, operator and readonly, not veterinarian', () => {
    for (const role of ['admin', 'operator', 'readonly'] as const) {
      expect(visibleMenuItems([role]).map((item) => item.href)).toContain('/operations/labels')
    }
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/operations/labels')
  })

  it('Operator sees Estoque', () => {
    expect(visibleMenuItems(['operator']).map((item) => item.href)).toContain('/operations/stock')
    expect(visibleMenuItems(['admin']).map((item) => item.href)).toContain('/operations/stock')
    expect(visibleMenuItems(['readonly']).map((item) => item.href)).toContain('/operations/stock')
  })

  it('shows Notas fiscais to admin, operator and readonly, not to the veterinarian', () => {
    for (const role of ['admin', 'operator', 'readonly'] as const) {
      expect(visibleMenuItems([role]).map((item) => item.href)).toContain('/operations/nfe')
    }
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/operations/nfe')
  })

  it('Veterinarian does not see Estoque', () => {
    expect(visibleMenuItems(['veterinarian']).map((item) => item.href)).not.toContain('/operations/stock')
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

  it('has no Receitas item: recipes are products', () => {
    for (const role of ['admin', 'operator', 'readonly'] as const) {
      expect(visibleMenuItems([role]).map((item) => item.href)).not.toContain('/catalog/recipes')
    }
  })

  it('shows Plano in Loja for catalog readers', () => {
    for (const role of ['admin', 'operator', 'readonly'] as const) {
      const loja = groupedMenuItems([role], ['catalog.read']).find((group) => group.group === 'Loja')
      expect(loja?.items.map((item) => item.href)).toContain('/catalog/plan')
    }
    expect(visibleMenuItems(['operator'], []).map((item) => item.href)).not.toContain('/catalog/plan')
    expect(visibleMenuItems(['veterinarian'], ['catalog.read']).map((item) => item.href)).not.toContain('/catalog/plan')
  })

  it('lists Visão do negócio and Relatórios in Negócio, below Loja, only with reports.read', () => {
    const groupsOf = (roles: Parameters<typeof groupedMenuItems>[0], permissions: string[]) => groupedMenuItems(roles, permissions)
    const negocio = (roles: Parameters<typeof groupedMenuItems>[0], permissions: string[]) =>
      groupsOf(roles, permissions).find((group) => group.group === 'Negócio')?.items.map((item) => item.href)

    for (const role of ['admin', 'operator', 'readonly'] as const) {
      expect(negocio([role], ['reports.read'])).toEqual(['/insights', '/reports'])
      const names = groupsOf([role], ['reports.read']).map((group) => group.group)
      expect(names.indexOf('Negócio')).toBe(names.indexOf('Loja') + 1)
      expect(negocio([role], [])).toBeUndefined()
    }

    const vet = visibleMenuItems(['veterinarian'], ['reports.read']).map((item) => item.href)
    expect(vet).not.toContain('/insights')
    expect(vet).not.toContain('/reports')
  })

  it('orders Operação by the day of work in each market, with Hoje first', () => {
    const operacao = (markets: ('BR' | 'US')[]) =>
      groupedMenuItems(['operator'], ['shipping.read', 'reports.read'], markets)[0]
    const br = operacao(['BR'])
    const us = operacao(['US'])

    expect(br.group).toBe('Operação')
    expect(br.items.map((item) => item.label)).toEqual([
      'Hoje', 'Fila de produção', 'Entregas Brasil', 'Exceções de mercado', 'Estoque', 'Notas fiscais', 'Feriados e fechamentos', 'Frete',
    ])
    expect(us.group).toBe('Operação')
    expect(us.items.map((item) => item.label)).toEqual([
      'Hoje', 'Fila de produção', 'Etiquetas UPS', 'Exceções de mercado', 'Estoque', 'Feriados e fechamentos', 'Frete',
    ])
  })

  it('shows UPS labels only to US sessions and the Brazil screens only to BR sessions', () => {
    const hrefs = (markets: ('BR' | 'US')[]) => visibleMenuItems(['operator'], ['shipping.read'], markets).map((item) => item.href)
    expect(hrefs(['BR'])).toEqual(expect.arrayContaining(['/operations/courier', '/operations/nfe']))
    expect(hrefs(['BR'])).not.toContain('/operations/labels')
    expect(hrefs(['US'])).toContain('/operations/labels')
    expect(hrefs(['US'])).not.toContain('/operations/courier')
    expect(hrefs(['US'])).not.toContain('/operations/nfe')
    expect(hrefs([])).toEqual(expect.arrayContaining(['/operations/labels', '/operations/courier', '/operations/nfe']))
    expect(groupedMenuItems(['operator'], ['shipping.read'], ['BR']).flatMap((group) => group.items).map((item) => item.href)).not.toContain('/operations/labels')
  })

  it('shows Exceções de mercado only with shipping.read, in every market', () => {
    const hrefs = (permissions: string[], markets: ('BR' | 'US')[] = []) => visibleMenuItems(['operator'], permissions, markets).map((item) => item.href)
    expect(hrefs(['shipping.read'])).toContain('/operations/market-exceptions')
    expect(hrefs(['shipping.read'], ['US'])).toContain('/operations/market-exceptions')
    expect(hrefs(['shipping.read'], ['BR'])).toContain('/operations/market-exceptions')
    expect(hrefs([])).not.toContain('/operations/market-exceptions')
  })
})
