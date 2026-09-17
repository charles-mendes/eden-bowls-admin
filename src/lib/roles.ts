export type AdminRole = 'admin' | 'operator' | 'nutritionist' | 'readonly' | 'customer'

export const OPERATIONAL_ROLES: AdminRole[] = ['admin', 'operator', 'nutritionist', 'readonly']

export const ROLE_OPTIONS = [
  { value: 'customer', label: 'Sem acesso ao painel' },
  { value: 'nutritionist', label: 'Nutricionista' },
  { value: 'readonly', label: 'Somente leitura' },
  { value: 'operator', label: 'Operador' },
  { value: 'admin', label: 'Admin' },
] as const

export const PANEL_ROLE_OPTIONS = ROLE_OPTIONS.filter((option) => option.value !== 'customer')

const operationalRoleSet = new Set<AdminRole>(OPERATIONAL_ROLES)

export function roleLabel(role: string) {
  return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}

export function primaryRole(roles: string[] | undefined) {
  if (!roles || roles.length === 0) return 'customer'
  if (roles.includes('admin')) return 'admin'
  if (roles.includes('operator')) return 'operator'
  if (roles.includes('readonly')) return 'readonly'
  if (roles.includes('nutritionist')) return 'nutritionist'
  return 'customer'
}

export function isOperationalUser(roles: AdminRole[] | undefined | null) {
  return Boolean(roles?.some((role) => operationalRoleSet.has(role)))
}

export function isNutritionistOnly(roles: AdminRole[] | undefined | null) {
  return Boolean(roles?.includes('nutritionist') && !roles.includes('admin') && !roles.includes('operator'))
}

export function getPostLoginPath(roles: AdminRole[], from?: string, options?: { mustChangePassword?: boolean }) {
  if (options?.mustChangePassword) {
    return '/account/password'
  }
  if (isNutritionistOnly(roles)) {
    return '/nutrition/simulate'
  }

  if (!from || from === '/login' || from === '/nutrition/simulate') {
    return '/dashboard'
  }

  return from
}
