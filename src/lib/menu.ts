export type MenuItem = {
  label: string
  href: string
  roles?: Array<'admin' | 'operator' | 'readonly'>
}

export const adminMenu: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Onboarding', href: '/onboarding/sessions' },
  { label: 'Produtos', href: '/catalog/products', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Preços', href: '/catalog/pricing', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Billing', href: '/billing', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Regras de negócio', href: '/config/business-rules', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Usuários', href: '/users', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Pedidos', href: '/orders', roles: ['admin', 'operator'] },
]
