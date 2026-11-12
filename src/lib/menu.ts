import { type AdminRole } from './roles'
import { type MarketCode } from './markets'

export type { AdminRole }

export type MenuGroup = 'Operação' | 'Clientes' | 'Loja' | 'Negócio' | 'Ferramentas' | 'Administração'

export type MenuItem = {
  label: string
  href: string
  roles: AdminRole[]
  group: MenuGroup
  // Also required when set: the item hides while the API does not grant it yet.
  permission?: string
  // Shown only to sessions that work in one of these markets; unset means every market.
  markets?: MarketCode[]
}

// Grouped by the job, daily work first: ship orders, look after customers, run the store, read the numbers, run the team.
// Hoje opens Operação: it is the day's checklist and the panel's landing page.
export const adminMenu: MenuItem[] = [
  { label: 'Hoje', href: '/dashboard', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Fila de produção', href: '/operations/production', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Etiquetas UPS', href: '/operations/labels', roles: ['admin', 'operator', 'readonly'], group: 'Operação', markets: ['US'] },
  { label: 'Entregas Brasil', href: '/operations/courier', roles: ['admin', 'operator', 'readonly'], group: 'Operação', permission: 'shipping.read', markets: ['BR'] },
  { label: 'Exceções de mercado', href: '/operations/market-exceptions', roles: ['admin', 'operator', 'readonly'], group: 'Operação', permission: 'shipping.read' },
  { label: 'Estoque', href: '/operations/stock', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Notas fiscais', href: '/operations/nfe', roles: ['admin', 'operator', 'readonly'], group: 'Operação', markets: ['BR'] },
  { label: 'Feriados e fechamentos', href: '/operations/delivery-calendar', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Frete', href: '/config/shipping', roles: ['admin', 'operator', 'readonly'], group: 'Operação' },
  { label: 'Clientes', href: '/users', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Assinantes', href: '/billing', roles: ['admin', 'operator', 'readonly'], group: 'Clientes' },
  { label: 'Produtos', href: '/catalog/products', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Plano', href: '/catalog/plan', roles: ['admin', 'operator', 'readonly'], group: 'Loja', permission: 'catalog.read' },
  { label: 'Cupons 1ª compra', href: '/billing/coupons', roles: ['admin', 'operator'], group: 'Loja' },
  { label: 'Feedbacks', href: '/feedbacks', roles: ['admin', 'operator', 'readonly'], group: 'Loja' },
  { label: 'Visão do negócio', href: '/insights', roles: ['admin', 'operator', 'readonly'], group: 'Negócio', permission: 'reports.read' },
  { label: 'Relatórios', href: '/reports', roles: ['admin', 'operator', 'readonly'], group: 'Negócio', permission: 'reports.read' },
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

// An empty market list means the session is not scoped (or not known yet), so every item shows.
export function visibleMenuItems(roles: AdminRole[], permissions: string[] = [], markets: MarketCode[] = []) {
  const roleSet = new Set(roles)
  const permissionSet = new Set(permissions)
  const inMarket = (item: MenuItem) => !markets.length || !item.markets || item.markets.some((market) => markets.includes(market))
  const allowed = (item: MenuItem) => item.roles.some((role) => roleSet.has(role)) && (!item.permission || permissionSet.has(item.permission)) && inMarket(item)
  return adminMenu.filter(allowed)
}

export function groupedMenuItems(roles: AdminRole[], permissions: string[] = [], markets: MarketCode[] = []) {
  const groups: { group: MenuGroup; items: MenuItem[] }[] = []

  for (const item of visibleMenuItems(roles, permissions, markets)) {
    const last = groups[groups.length - 1]
    if (last && last.group === item.group) {
      last.items.push(item)
    } else {
      groups.push({ group: item.group, items: [item] })
    }
  }

  return groups
}
