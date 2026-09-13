export type PrivacyRequestType = 'access' | 'deletion' | 'correction' | 'portability' | 'opt_out_share'
export type PrivacyRequestStatus = 'open' | 'in_progress' | 'completed' | 'rejected'
export type PrivacyIdentityStatus = 'verified_session' | 'verified_account_email' | 'unverified'
export type PrivacyRequestChannel = 'in_app' | 'email'

export type PrivacyRequestItem = {
  id: number
  userId: number | null
  type: PrivacyRequestType | string
  status: PrivacyRequestStatus | string
  locale: string | null
  market: string
  payload?: Record<string, unknown>
  resultNote: string | null
  dueAt: string | null
  extendedAt: string | null
  extensionReason: string | null
  identityStatus: PrivacyIdentityStatus | string
  identityVerifiedAt: string | null
  channel: PrivacyRequestChannel | string
  resolvedAt: string | null
  resolvedBy: number | null
  createdAt: string | null
  updatedAt: string | null
  overdue?: boolean
}

export type PrivacyRequestsResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: PrivacyRequestItem[]
}

export type UserPrivacySnapshot = {
  marketingOptIn: boolean
  cookiePreferences: { analytics: string | null; ads: string | null }
  consents: Array<{
    id: number
    consentType: string
    status: string
    documentVersion: string | null
    source: string
    createdAt: string | null
  }>
  requests: Array<{
    id: number
    type: string
    status: string
    dueAt: string | null
    identityStatus: string
  }>
}

const TYPE_LABELS: Record<string, string> = {
  access: 'Acesso',
  deletion: 'Exclusão',
  correction: 'Correção',
  portability: 'Portabilidade',
  opt_out_share: 'Opt-out de share',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  completed: 'Concluído',
  rejected: 'Recusado',
}

const IDENTITY_LABELS: Record<string, string> = {
  verified_session: 'Sessão verificada',
  verified_account_email: 'E-mail da conta',
  unverified: 'Não verificado',
}

export function formatPrivacyType(value: string | null | undefined) {
  const raw = String(value || '').trim()
  return TYPE_LABELS[raw] || raw || '—'
}

export function formatPrivacyStatus(value: string | null | undefined) {
  const raw = String(value || '').trim()
  return STATUS_LABELS[raw] || raw || '—'
}

export function formatPrivacyIdentity(value: string | null | undefined) {
  const raw = String(value || '').trim()
  return IDENTITY_LABELS[raw] || raw || '—'
}

export function needsIdentityToComplete(item: Pick<PrivacyRequestItem, 'type' | 'identityStatus'>) {
  return ['access', 'deletion', 'portability'].includes(String(item.type))
    && item.identityStatus === 'unverified'
}

export function isTerminalPrivacyStatus(status: string | null | undefined) {
  return status === 'completed' || status === 'rejected'
}
