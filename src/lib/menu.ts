import { type AdminRole } from './roles'

export type { AdminRole }

export type MenuGroup = 'Visão geral' | 'Operação' | 'Clientes' | 'Loja' | 'Ferramentas' | 'Administração'

export type MenuItem = {
  label: string
  href: string
  roles: AdminRole[]
  group: MenuGroup
}

// Grouped by the job: ship orders, look after customers, run the store, run the team.
export const adminMenu: MenuItem[] = [
  { label: 'Hoje', href: '/dashboard', roles: ['admin', 'operator', 'readonly'], group: 'Visão geral' },
  { label: 'Produção', href: '/operations/production', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Calendário de entregas', href: '/operations/delivery-calendar', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Frete', href: '/config/shipping', roles: ['admin', 'operator'], group: 'Operação' },
  { label: 'Clientes', href: '/users', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Assinantes', href: '/billing', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Onboarding 360', href: '/onboarding/sessions', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Produtos', href: '/catalog/products', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Cupons 1ª compra', href: '/billing/coupons', roles: ['admin', 'operator'], group: 'Loja' },
  { label: 'Feedbacks', href: '/feedbacks', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Simulador nutricional', href: '/nutrition/simulate', roles: ['admin', 'operator', 'nutritionist'], group: 'Ferramentas' },
  { label: 'Equipe e papéis', href: '/users/roles', roles: ['admin'], group: 'Administração' },
  { label: 'Privacidade', href: '/privacy/requests', roles: ['admin', 'operator', 'readonly'], group: 'Administração' },
]

// The longest menu href that prefixes the path, so a list and its sub-page are never both active.
export function activeMenuHref(pathname: string, items: MenuItem[]) {
  let best = ''
  for (const item of items) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`)
    if (matches && item.href.length > best.length) best = item.href
  }
  return best
}

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
