export type AdminRole = 'admin' | 'operator' | 'nutritionist' | 'readonly' | 'customer'

export const OPERATIONAL_ROLES: AdminRole[] = ['admin', 'operator', 'nutritionist', 'readonly']

const operationalRoleSet = new Set<AdminRole>(OPERATIONAL_ROLES)

export function isOperationalUser(roles: AdminRole[] | undefined | null) {
  return Boolean(roles?.some((role) => operationalRoleSet.has(role)))
}

export function isNutritionistOnly(roles: AdminRole[] | undefined | null) {
  return Boolean(roles?.includes('nutritionist') && !roles.includes('admin') && !roles.includes('operator'))
}

export function getPostLoginPath(roles: AdminRole[], from?: string) {
  if (isNutritionistOnly(roles)) {
    return '/nutrition/simulate'
  }

  if (!from || from === '/login' || from === '/nutrition/simulate') {
    return '/dashboard'
  }

  return from
}
