import { type AdminRole } from './roles'

export type { AdminRole }

export type MenuGroup = 'Visão geral' | 'Operação' | 'Catálogo' | 'Billing' | 'Equipe'

export type MenuItem = {
  label: string
  href: string
  roles: AdminRole[]
  group: MenuGroup
}

export const adminMenu: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard', roles: ['admin', 'operator', 'readonly'], group: 'Visão geral' },
  { label: 'Simulador nutricional', href: '/nutrition/simulate', roles: ['admin', 'operator', 'nutritionist'], group: 'Operação' },
  { label: 'Onboarding 360', href: '/onboarding/sessions', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Checkouts', href: '/orders', roles: ['admin', 'operator'], group: 'Operação' },
  { label: 'Frete', href: '/config/shipping', roles: ['admin', 'operator'], group: 'Operação' },
  { label: 'Produtos', href: '/catalog/products', roles: ['admin', 'operator', 'readonly'], group: 'Catálogo' },
  { label: 'Assinantes', href: '/billing', roles: ['admin', 'operator', 'readonly'], group: 'Billing' },
  { label: 'Cupons 1ª compra', href: '/billing/coupons', roles: ['admin', 'operator'], group: 'Billing' },
  { label: 'Clientes', href: '/users', roles: ['admin', 'operator', 'readonly'], group: 'Equipe' },
  { label: 'Papéis', href: '/users/roles', roles: ['admin'], group: 'Equipe' },
]

export function visibleMenuItems(roles: AdminRole[]) {
  const roleSet = new Set(roles)
  return adminMenu.filter((item) => item.roles.some((role) => roleSet.has(role)))
}

export function groupedMenuItems(roles: AdminRole[]) {
  const groups: { group: MenuGroup; items: MenuItem[] }[] = []

  for (const item of visibleMenuItems(roles)) {
    const last = groups[groups.length - 1]
    if (last && last.group === item.group) {
      last.items.push(item)
    } else {
      groups.push({ group: item.group, items: [item] })
    }
  }

  return groups
}
