import { ApiRequestError } from './api'
import type { MarketCode } from './markets'

// Company profile, legal documents and automated emails as the API returns them (admin-settings).

export type CompanyProfile = {
  market: MarketCode
  legal_name: string
  tax_id: string
  street: string
  complement: string
  city: string
  state: string
  postal_code: string
  country: string
  support_email: string
  store_url: string
  updated_at?: string | null
}

export type CompanyField = Exclude<keyof CompanyProfile, 'market' | 'updated_at'>

export const COMPANY_FIELDS: Array<{ key: CompanyField; label: string; required: boolean; type?: string }> = [
  { key: 'legal_name', label: 'Razão social', required: true },
  { key: 'tax_id', label: 'CNPJ', required: false },
  { key: 'street', label: 'Endereço', required: true },
  { key: 'complement', label: 'Complemento', required: false },
  { key: 'city', label: 'Cidade', required: true },
  { key: 'state', label: 'Estado', required: true },
  { key: 'postal_code', label: 'CEP', required: true },
  { key: 'country', label: 'País', required: true },
  { key: 'support_email', label: 'E-mail de suporte', required: true, type: 'email' },
  { key: 'store_url', label: 'Site da loja', required: true, type: 'url' },
]

// Tax id and postal code follow the market: CNPJ and CEP in BR, EIN and ZIP code in the US.
export function companyFieldLabel(field: CompanyField, market: MarketCode) {
  if (field === 'tax_id') return market === 'BR' ? 'CNPJ' : 'EIN'
  if (field === 'postal_code') return market === 'BR' ? 'CEP' : 'ZIP code'
  return COMPANY_FIELDS.find((item) => item.key === field)?.label ?? field
}

export type LegalKind = 'privacy' | 'terms'

export const LEGAL_KINDS: Array<{ id: LegalKind; label: string }> = [
  { id: 'privacy', label: 'Política de privacidade' },
  { id: 'terms', label: 'Termos de uso' },
]

export type LegalVersion = { market: MarketCode; kind: LegalKind; version: string; published_at: string | null; body_markdown: string }

export type LegalOverview = {
  market: MarketCode
  kind: LegalKind
  current: LegalVersion | null
  versions: Array<{ version: string; published_at: string | null; published_by: number | null }>
}

export type AutomatedEmailSettings = {
  market: MarketCode
  life_stage_change_enabled: boolean
  announcement_batch_size: number
  announcement_daily_cap: number
  updated_at?: string | null
}

export const BATCH_RANGE = { min: 1, max: 500 }
export const DAILY_CAP_RANGE = { min: 1, max: 5000 }

// Today in the browser timezone, as the `AAAA-MM-DD` id of a new legal version.
export function todayVersion(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Fields listed by a 422 of the API, or none.
export function settingsInvalidFields(error: unknown) {
  if (!(error instanceof ApiRequestError)) return []
  const fields = error.details?.fields
  return Array.isArray(fields) ? fields.map(String) : []
}

const FIELD_NAMES: Record<string, string> = {
  version: 'versão',
  body_markdown: 'texto',
  announcement_batch_size: 'lote por execução',
  announcement_daily_cap: 'limite diário',
  life_stage_change_enabled: 'e-mail de mudança de fase',
}

export function settingsErrorMessage(error: unknown, fallback: string, market: MarketCode = 'BR') {
  if (error instanceof ApiRequestError) {
    const list = settingsInvalidFields(error)
      .map((field) => (COMPANY_FIELDS.some((item) => item.key === field) ? companyFieldLabel(field as CompanyField, market) : FIELD_NAMES[field] ?? field))
      .join(', ')
    if (error.code === 'company_profile_invalid') return `Dados da empresa inválidos: ${list}.`
    if (error.code === 'legal_document_invalid') return `Documento inválido: ${list}. A versão é uma data AAAA-MM-DD e o texto não pode ficar vazio.`
    if (error.code === 'legal_version_taken') return 'Essa versão já existe. Escolha outra data.'
    if (error.code === 'legal_document_not_found') return 'Versão não encontrada.'
    if (error.code === 'automated_email_settings_invalid') return `Configuração inválida: ${list}. O lote vai de 1 a 500, o limite diário de 1 a 5.000 e não pode ser menor que o lote.`
    if (error.status === 403) return 'Sem permissão para esta ação.'
  }
  return error instanceof Error && error.message ? error.message : fallback
}
