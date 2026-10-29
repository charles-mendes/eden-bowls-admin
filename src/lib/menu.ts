import { type AdminRole } from './roles'

export type { AdminRole }

export type MenuGroup = 'Visão geral' | 'Operação' | 'Clientes' | 'Loja' | 'Ferramentas' | 'Administração'

export type MenuItem = {
  label: string
  href: string
  roles: AdminRole[]
  group: MenuGroup
  // Also required when set: the item hides while the API does not grant it yet.
  permission?: string
}

// Grouped by the job: ship orders, look after customers, run the store, run the team.
export const adminMenu: MenuItem[] = [
  { label: 'Hoje', href: '/dashboard', roles: ['admin', 'operator', 'readonly'], group: 'Visão geral' },
  { label: 'Fila de produção', href: '/operations/production', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Estoque', href: '/operations/stock', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Feriados e fechamentos', href: '/operations/delivery-calendar', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Frete', href: '/config/shipping', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Clientes', href: '/users', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Assinantes', href: '/billing', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Produtos', href: '/catalog/products', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Receitas', href: '/catalog/recipes', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Biblioteca de imagens', href: '/catalog/media', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Cupons 1ª compra', href: '/billing/coupons', roles: ['admin', 'operator'], group: 'Loja' },
  { label: 'Feedbacks', href: '/feedbacks', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Simulador nutricional', href: '/nutrition/simulate', roles: ['admin', 'operator', 'veterinarian'], group: 'Ferramentas' },
  { label: 'Parâmetros nutricionais', href: '/nutrition/settings', roles: ['admin', 'operator', 'readonly', 'veterinarian'], group: 'Ferramentas' },
  { label: 'Equipe e papéis', href: '/users/roles', roles: ['admin'], group: 'Administração' },
  { label: 'Privacidade', href: '/privacy/requests', roles: ['admin', 'operator', 'readonly'], group: 'Administração' },
  { label: 'Configurações', href: '/config', roles: ['admin', 'operator', 'readonly'], group: 'Administração' },
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

const INSIGHTS_ITEM: MenuItem = {
  label: 'Visão do negócio',
  href: '/insights',
  roles: ['admin', 'operator', 'readonly'],
  group: 'Visão geral',
  permission: 'reports.read',
}

const REPORTS_ITEM: MenuItem = {
  label: 'Relatórios',
  href: '/reports',
  roles: ['admin', 'operator', 'readonly'],
  group: 'Visão geral',
  permission: 'reports.read',
}

export function visibleMenuItems(roles: AdminRole[], permissions: string[] = []) {
  const roleSet = new Set(roles)
  const permissionSet = new Set(permissions)
  const allowed = (item: MenuItem) => item.roles.some((role) => roleSet.has(role)) && (!item.permission || permissionSet.has(item.permission))
  const items = adminMenu.filter(allowed)
  // Hoje, then Visão do negócio and Relatórios.
  const afterToday = [INSIGHTS_ITEM, REPORTS_ITEM].filter(allowed)
  if (!afterToday.length) return items
  const today = items.findIndex((item) => item.href === '/dashboard')
  if (today === -1) return [...items, ...afterToday]
  return [...items.slice(0, today + 1), ...afterToday, ...items.slice(today + 1)]
}

export function groupedMenuItems(roles: AdminRole[], permissions: string[] = []) {
  const groups: { group: MenuGroup; items: MenuItem[] }[] = []

  for (const item of visibleMenuItems(roles, permissions)) {
    const last = groups[groups.length - 1]
    if (last && last.group === item.group) {
      last.items.push(item)
    } else {
      groups.push({ group: item.group, items: [item] })
    }
  }

  return groups
}
