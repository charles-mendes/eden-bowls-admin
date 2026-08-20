export type AdminRole = 'admin' | 'operator' | 'nutritionist' | 'readonly' | 'customer'

export type MenuItem = {
  label: string
  href: string
  roles: AdminRole[]
}

export const adminMenu: MenuItem[] = [
  { label: 'Dashboard', href: '/dashboard', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Simulador nutricional', href: '/nutrition/simulate', roles: ['admin', 'operator', 'nutritionist'] },
  { label: 'Onboarding 360', href: '/onboarding/sessions', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Frete', href: '/config/shipping', roles: ['admin', 'operator'] },
  { label: 'Produtos', href: '/catalog/products', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Preços', href: '/catalog/pricing', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Assinantes', href: '/billing', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Cupons 1ª compra', href: '/billing/coupons', roles: ['admin', 'operator'] },
  { label: 'Clientes', href: '/users', roles: ['admin', 'operator', 'readonly'] },
  { label: 'Checkouts', href: '/orders', roles: ['admin', 'operator'] },
]
