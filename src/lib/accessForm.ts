import { isStaffAccount } from './accountStatus'
import { staffMarketRequired, type MarketCode } from './markets'
import { primaryRole } from './roles'

export type AccessForm = {
  name: string
  email: string
  phone: string
  role: string
  market: MarketCode | ''
}

export type AccessAccount = {
  email: string
  status: string
  roles?: string[]
  storedRoles?: string[]
  lockedByAllowlist?: boolean
  markets?: MarketCode[]
  inviteMailStatus?: string | null
  inviteExpired?: boolean
  profile: { fullName: string | null; phone: string | null } | null
}

export const emptyAccessForm: AccessForm = { name: '', email: '', phone: '', role: '', market: '' }

// What each panel role can do, shown under the role picker.
export const ROLE_HINTS: Record<string, string> = {
  veterinarian: 'Acessa só o simulador nutricional.',
  readonly: 'Vê as telas do painel sem alterar nada.',
  operator: 'Opera pedidos, produção, catálogo e clientes do mercado escolhido.',
  admin: 'Acesso total, inclusive equipe e papéis, nos dois mercados.',
}

export function panelRoleOf(account: AccessAccount) {
  const role = primaryRole(account.storedRoles?.length ? account.storedRoles : account.roles)
  return role === 'customer' ? '' : role
}

export function accessFormFrom(account: AccessAccount): AccessForm {
  const markets = account.markets
  return {
    name: account.profile?.fullName ?? '',
    email: account.email,
    phone: account.profile?.phone ?? '',
    role: panelRoleOf(account),
    market: markets?.includes('US') && !markets.includes('BR') ? 'US' : markets?.includes('BR') ? 'BR' : '',
  }
}

export function inviteNeedsResend(account: AccessAccount) {
  return account.inviteMailStatus === 'failed' || Boolean(account.inviteExpired) || (account.status === 'pending' && isStaffAccount(account.roles))
}

export function accessFormError(form: AccessForm, isNew: boolean) {
  if (isNew && !form.email.trim()) return 'Informe um e-mail válido.'
  if (!form.name.trim()) return 'Informe o nome.'
  if (isNew && !form.role) return 'Selecione um papel.'
  if (form.role && staffMarketRequired(form.role) && form.market !== 'BR' && form.market !== 'US') return 'Informe o mercado.'
  return ''
}

// A customer saved without a role keeps store-only access: the body omits `role`.
export function accessRoleBody(form: AccessForm) {
  if (!form.role) return {}
  return staffMarketRequired(form.role) ? { role: form.role, market: form.market } : { role: form.role }
}
