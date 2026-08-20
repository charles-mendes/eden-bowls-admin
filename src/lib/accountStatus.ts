const STAFF_ROLES = new Set(['admin', 'operator', 'nutritionist', 'readonly'])

export function isStaffAccount(roles: string[] | undefined) {
  return (roles || []).some((role) => STAFF_ROLES.has(role))
}

export function isDeactivatedStatus(status: string | undefined) {
  return status === 'inactive' || status === 'suspended' || status === 'banned'
}

export function canToggleCustomerStatus(status: string | undefined) {
  return status !== 'pending'
}

export function accountStatusLabel(status: string | undefined) {
  if (isDeactivatedStatus(status)) return 'Desativada'
  if (status === 'pending') return 'Pendente'
  return 'Ativa'
}

export function accountStatusBadgeClass(status: string | undefined) {
  if (isDeactivatedStatus(status)) return 'badge-error'
  if (status === 'pending') return 'badge-warning'
  return 'badge-success'
}
