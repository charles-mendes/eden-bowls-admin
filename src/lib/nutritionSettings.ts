import { ApiRequestError } from './api'
import type { MarketCode } from './markets'

// Life-stage limits, giant breeds and energy factors as the API returns them (nutrition-settings).

export type SizeClass = 'small' | 'medium' | 'large' | 'giant'

export const SIZE_CLASSES: SizeClass[] = ['small', 'medium', 'large', 'giant']

export const SIZE_CLASS_LABELS: Record<SizeClass, string> = {
  small: 'Pequeno',
  medium: 'Médio',
  large: 'Grande',
  giant: 'Gigante',
}

export type SizeClassLimit = {
  sizeClass: SizeClass
  adultFromMonths: number
  seniorFromMonths: number
  updatedBy: number | null
  updatedAt: string | null
}

export type LifeStageBreed = {
  id: number
  market: MarketCode
  namePt: string
  nameEn: string
  sizeClass: SizeClass
  active: boolean
  updatedBy: number | null
  updatedAt: string | null
}

// One entry of the admin audit log: who changed what, and when.
export type NutritionAuditEvent = {
  id: number
  actorUserId: number | null
  actorEmail: string | null
  action: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type LifeStageOverview = {
  market: MarketCode
  sizeClasses: SizeClassLimit[]
  breeds: LifeStageBreed[]
  // An older API sends no history.
  history?: NutritionAuditEvent[]
}

export type LifeStagePreview = {
  market: MarketCode
  pets_evaluated: number
  pets_changing: number
  transitions: Array<{ from: string | null; to: string | null; count: number }>
}

// Request body of the limits: only the classes that changed.
export type LimitsInput = Partial<Record<SizeClass, { adult_from_months: number; senior_from_months: number }>>

export type BreedInput = { id?: number; name_pt?: string; name_en?: string; size_class?: SizeClass; active?: boolean }

export const LIFE_STAGE_LABELS: Record<string, string> = {
  puppy: 'filhote',
  adult: 'adulto',
  senior: 'sênior',
}

export function transitionLabel(from: string | null, to: string | null) {
  const name = (stage: string | null) => (stage ? LIFE_STAGE_LABELS[stage] ?? stage : 'sem fase')
  return `${name(from)} → ${name(to)}`
}

export type BreedGroup = 'dogue' | 'slow_metabolism' | 'terranova'

export type NutritionParameters = {
  combination: Record<string, number>
  // Giant dogs (over 40 kg or of a giant breed group). A set saved by an older API may lack it.
  combination_giant: Record<string, number>
  state: Record<string, number>
  base: Record<string, number>
  nem: Record<string, number>
  breed_groups: Record<BreedGroup, string[]>
}

export type ParameterSet = {
  id: number
  status: 'published' | 'draft' | 'retired'
  parameters: NutritionParameters
  createdBy: number | null
  publishedBy: number | null
  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type ParametersOverview = {
  published: { id: number | null; parameters: NutritionParameters; publishedAt: string | null }
  draft: ParameterSet | null
  history: ParameterSet[]
  audit?: NutritionAuditEvent[]
}

export const FACTOR_RANGE = { min: 1, max: 400 }
export const NEM_RANGE = { min: 1000, max: 8000 }
export const MONTHS_RANGE = { min: 1, max: 240 }

export type FactorSection = 'combination' | 'combination_giant' | 'state' | 'base' | 'nem'

export const FACTOR_SECTIONS: Array<{ key: FactorSection; title: string; description: string }> = [
  { key: 'combination', title: 'Matriz de manutenção', description: 'Cão adulto em manutenção até 40 kg: castrado × atividade × escore corporal.' },
  { key: 'combination_giant', title: 'Matriz de raças gigantes', description: 'Cão adulto em manutenção acima de 40 kg, ou de uma raça gigante (lista abaixo), mesmo mais leve.' },
  { key: 'state', title: 'Fatores de estágio', description: 'Filhote, gestante e sênior usam o fator do estágio, não a matriz.' },
  { key: 'base', title: 'Fatores de gatos', description: 'Gato em ambiente interno, ou ativo quando a atividade é alta.' },
  { key: 'nem', title: 'NEM padrão', description: 'Energia metabolizável do alimento, em kcal/kg.' },
]

const BASE_LABELS: Record<string, string> = {
  cat: 'Gato em ambiente interno',
  cat_active: 'Gato ativo (atividade alta)',
}

const STATE_LABELS: Record<string, string> = {
  SENIOR: 'Sênior',
  GESTANTE: 'Gestante',
  CRESCIMENTO_ATE_50: 'Crescimento até 50% do peso adulto',
  CRESCIMENTO_51_80: 'Crescimento de 51% a 80%',
  CRESCIMENTO_81_100: 'Crescimento de 81% a 100%',
}

const NEM_LABELS: Record<string, string> = { dog: 'NEM de cão (kcal/kg)', cat: 'NEM de gato (kcal/kg)' }

const GIANT_PREFIX = 'Gigante: '

const COMBINATION_WORDS: Record<string, string> = {
  SIM: 'Castrado',
  NAO: 'Não castrado',
  BAIXO: 'atividade baixa',
  MODERADO: 'atividade moderada',
  ALTO: 'atividade alta',
  ABAIXO: 'abaixo do peso',
  ADEQUADO: 'peso adequado',
  ACIMA: 'acima do peso',
}

export const BREED_GROUP_LABELS: Record<BreedGroup, string> = {
  dogue: 'Dogue e similares',
  slow_metabolism: 'São Bernardo',
  terranova: 'Terra Nova',
}

export const BREED_GROUPS: BreedGroup[] = ['dogue', 'slow_metabolism', 'terranova']

export function factorLabel(section: string, key: string): string {
  if (section === 'base') return BASE_LABELS[key] ?? key
  if (section === 'state') return STATE_LABELS[key] ?? key
  if (section === 'nem') return NEM_LABELS[key] ?? key
  if (section === 'combination_giant') return `${GIANT_PREFIX}${factorLabel('combination', key)}`
  return key.split('-').map((word) => COMBINATION_WORDS[word] ?? word).join(' · ')
}

export function cloneParameters(parameters: NutritionParameters): NutritionParameters {
  return JSON.parse(JSON.stringify(parameters)) as NutritionParameters
}

// Fields listed by a 422 of the API, or none.
export function invalidFields(error: unknown) {
  if (!(error instanceof ApiRequestError)) return []
  const fields = error.details?.fields
  return Array.isArray(fields) ? fields.map(String) : []
}

const FIELD_NAMES: Record<string, string> = {
  adult_from_months: 'adulto a partir de',
  senior_from_months: 'sênior a partir de',
  name_pt: 'nome em português',
  name_en: 'nome em inglês',
  size_class: 'porte',
}

function fieldName(field: string) {
  const [head, tail] = field.split('.')
  if (tail && head in SIZE_CLASS_LABELS) return `${SIZE_CLASS_LABELS[head as SizeClass]}: ${FIELD_NAMES[tail] ?? tail}`
  if (tail && FACTOR_SECTIONS.some((section) => section.key === head)) return factorLabel(head, tail)
  if (head === 'breed_groups' && tail) {
    const [group, breed] = tail.split(':')
    const label = BREED_GROUP_LABELS[group as BreedGroup] ?? group
    return breed ? `${label}: "${breed}" está em outro grupo` : label
  }
  return FIELD_NAMES[field] ?? field
}

export function nutritionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    if (error.code === 'market_forbidden') return 'Você só pode alterar raças do mercado em que é operador.'
    const fields = invalidFields(error)
    const list = fields.map(fieldName).join(', ')
    if (error.code === 'life_stage_limits_invalid') return `Limites inválidos (${list}). Os meses vão de 1 a 240 e sênior precisa ser maior que adulto.`
    if (error.code === 'life_stage_breed_invalid') return `Raça inválida (${list}).`
    if (error.code === 'life_stage_breed_exists') return 'Essa raça já está na lista deste mercado.'
    if (error.code === 'life_stage_breed_not_found') return 'Raça não encontrada neste mercado.'
    if (error.code === 'nutrition_parameters_invalid') return `Parâmetros inválidos: ${list}. Fatores vão de 1 a 400 e NEM de 1000 a 8000.`
    if (error.code === 'nutrition_draft_missing') return 'Não há rascunho. Salve um rascunho antes.'
    if (error.code === 'nutrition_parameter_set_not_found') return 'Conjunto não encontrado.'
    if (error.code === 'market_required') return 'Escolha um mercado.'
    if (error.status === 403) return 'Sem permissão para esta ação.'
  }
  return error instanceof Error && error.message ? error.message : fallback
}

// What each piece of data means, for the "i" next to it.
export const HELP = {
  adultFrom: 'Idade, em meses, em que o cão deixa de ser filhote e passa a receber a recomendação de adulto. Cães maiores amadurecem mais tarde, por isso o limite cresce com o porte.',
  seniorFrom: 'Idade, em meses, em que o cão passa a sênior e a recomendação usa o fator Sênior. Cães maiores envelhecem mais cedo. Precisa ser maior que a idade de adulto.',
  sizeClass: 'Classe de tamanho do cão (pequeno, médio, grande ou gigante). É ela que define as idades de mudança de fase.',
  breedsTable: 'Quando o cliente informa uma destas raças no cadastro do pet, o porte vem desta tabela e substitui o porte que ele escolheu.',
  breedNames: 'O cliente pode escrever a raça em português ou em inglês. A comparação ignora acentos e maiúsculas.',
  breedStatus: 'Uma raça desativada continua na lista, mas deixa de valer na avaliação de fase. Reative para voltar a valer.',
  preview: 'Antes de salvar, a prévia conta quantos pets com assinatura ativa mudariam de fase. Se algum mudar, a alteração só é salva depois de confirmar.',
  factor: 'Fator de energia (NRC 2006, FEDIAF 2020): as kcal por dia são o fator × peso elevado ao expoente. Cão usa peso^0,75. Gato usa peso^0,67, ou peso^0,4 quando está acima do peso.',
  base: 'Tabela 1: 60 para gato em ambiente interno (faixa 52 a 75) e 100 para gato ativo. O gato acima do peso mantém o fator e muda o expoente para 0,4.',
  state: 'Tabela 1: filhote pelo percentual do peso adulto (210, 175, 140), gestante nas primeiras 4 semanas (132) e sênior (95, faixa 80 a 120). Valem no lugar da matriz.',
  combination: 'Aba Constantes da planilha: o fator do cão adulto em manutenção pela combinação castrado × atividade × escore que o tutor informa.',
  combination_giant: 'Fatores da zootecnista Izabella para raças gigantes, que têm metabolismo mais lento. Valem acima de 40 kg e para as raças gigantes listadas, no lugar da matriz de manutenção.',
  nem: 'Energia Metabolizável do alimento, em kcal por kg. Gramas por dia = kcal por dia ÷ NEM × 1000. Uma receita com NEM próprio usa o dela.',
  breedGroups: 'Raças que usam a matriz de raças gigantes mesmo com 40 kg ou menos, por orientação da zootecnista (Dogue Alemão, Terra Nova, São Bernardo e similares).',
  draft: 'As mudanças vão para um rascunho, que não afeta clientes. Teste no Simulador nutricional e publique: aí as próximas recomendações dos dois mercados passam a usá-lo.',
  history: 'Conjuntos publicados antes. Um conjunto antigo pode voltar como rascunho, para ser publicado de novo.',
  editLog: 'Cada alteração salva fica registrada com quem fez, quando e o que mudou.',
} as const

// Combination keys as a matrix: one row per castrated × activity, one column per body score.
export const COMBINATION_ROWS: Array<{ castrado: 'SIM' | 'NAO'; activity: 'BAIXO' | 'MODERADO' | 'ALTO' }> = [
  { castrado: 'SIM', activity: 'BAIXO' },
  { castrado: 'SIM', activity: 'MODERADO' },
  { castrado: 'SIM', activity: 'ALTO' },
  { castrado: 'NAO', activity: 'BAIXO' },
  { castrado: 'NAO', activity: 'MODERADO' },
  { castrado: 'NAO', activity: 'ALTO' },
]

export const COMBINATION_SCORES: Array<{ key: 'ABAIXO' | 'ADEQUADO' | 'ACIMA'; label: string; short: string }> = [
  { key: 'ABAIXO', label: 'Abaixo do peso', short: 'Abaixo' },
  { key: 'ADEQUADO', label: 'Peso adequado', short: 'Adequado' },
  { key: 'ACIMA', label: 'Acima do peso', short: 'Acima' },
]

export function combinationRowLabel(row: { castrado: string; activity: string }) {
  return `${COMBINATION_WORDS[row.castrado]}, ${COMBINATION_WORDS[row.activity]}`
}

type BreedSnapshot = { namePt?: string; nameEn?: string; sizeClass?: SizeClass; active?: boolean }
type LimitSnapshot = { adultFromMonths?: number; seniorFromMonths?: number }
type FieldChange = { field: string; from: unknown; to: unknown }

const AUDIT_DETAIL_LIMIT = 6

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function shown(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  return String(value)
}

function changeLabel(field: string) {
  const [section, key] = field.split('.')
  if (section === 'breed_groups') return BREED_GROUP_LABELS[key as BreedGroup] ?? key
  return factorLabel(section, key)
}

function capped(lines: string[]) {
  if (lines.length <= AUDIT_DETAIL_LIMIT) return lines
  return [...lines.slice(0, AUDIT_DETAIL_LIMIT), `e mais ${lines.length - AUDIT_DETAIL_LIMIT} alterações`]
}

function factorChanges(metadata: Record<string, unknown>) {
  const changes = Array.isArray(metadata.changes) ? metadata.changes as FieldChange[] : []
  return capped(changes.map((change) => `${changeLabel(change.field)}: ${shown(change.from)} → ${shown(change.to)}`))
}

// An audit event as a title and the lines of what changed, in Portuguese.
export function describeAuditEvent(event: NutritionAuditEvent): { title: string; details: string[] } {
  const meta = asObject(event.metadata)
  if (event.action === 'life_stage.limits.update') {
    const before = asObject(meta.before)
    const after = asObject(meta.after)
    const details: string[] = []
    for (const sizeClass of SIZE_CLASSES) {
      if (!(sizeClass in after)) continue
      const from = asObject(before[sizeClass]) as LimitSnapshot
      const to = asObject(after[sizeClass]) as LimitSnapshot
      const parts: string[] = []
      if (from.adultFromMonths !== to.adultFromMonths) parts.push(`adulto ${shown(from.adultFromMonths)} → ${shown(to.adultFromMonths)} meses`)
      if (from.seniorFromMonths !== to.seniorFromMonths) parts.push(`sênior ${shown(from.seniorFromMonths)} → ${shown(to.seniorFromMonths)} meses`)
      if (parts.length) details.push(`${SIZE_CLASS_LABELS[sizeClass]}: ${parts.join('; ')}`)
    }
    return { title: 'Alterou os limites de fase', details }
  }
  if (event.action === 'life_stage.breed.update') {
    const before = meta.before ? asObject(meta.before) as BreedSnapshot : null
    const after = asObject(meta.after) as BreedSnapshot
    const size = (value?: SizeClass) => (value ? SIZE_CLASS_LABELS[value] ?? value : '—')
    if (!before) {
      return { title: `Incluiu a raça ${after.namePt ?? ''}`.trim(), details: [`${shown(after.namePt)} / ${shown(after.nameEn)}, porte ${size(after.sizeClass)}`] }
    }
    const name = after.namePt ?? before.namePt ?? ''
    const details: string[] = []
    if (before.namePt !== after.namePt) details.push(`Nome em português: ${shown(before.namePt)} → ${shown(after.namePt)}`)
    if (before.nameEn !== after.nameEn) details.push(`Nome em inglês: ${shown(before.nameEn)} → ${shown(after.nameEn)}`)
    if (before.sizeClass !== after.sizeClass) details.push(`Porte: ${size(before.sizeClass)} → ${size(after.sizeClass)}`)
    if (before.active !== after.active) return { title: `${after.active ? 'Reativou' : 'Desativou'} a raça ${name}`, details }
    return { title: `Alterou a raça ${name}`, details }
  }
  if (event.action === 'nutrition.parameters.draft.save') {
    const details = factorChanges(meta)
    return { title: `Salvou o rascunho${meta.set_id ? ` #${meta.set_id}` : ''}`, details: details.length ? details : ['Nenhum valor mudou.'] }
  }
  if (event.action === 'nutrition.parameters.draft.discard') {
    return { title: `Descartou o rascunho${meta.set_id ? ` #${meta.set_id}` : ''}`, details: [] }
  }
  if (event.action === 'nutrition.parameters.copy_to_draft') {
    return { title: `Copiou o conjunto #${shown(meta.from_set_id)} para o rascunho`, details: [] }
  }
  if (event.action === 'nutrition.parameters.publish') {
    const reason = meta.reason === 'requerimento_energetico'
      ? ['Cálculo ajustado ao documento da veterinária: matriz de raças gigantes e fatores de gatos 60 e 100.']
      : []
    return { title: `Publicou o conjunto #${shown(meta.to_set_id)}`, details: [`Substituiu o conjunto #${shown(meta.from_set_id)}.`, ...reason, ...factorChanges(meta)] }
  }
  return { title: event.action, details: [] }
}

export type Species = 'dog' | 'cat'

// The factors tab shows one species at a time; the URL names it as `especie=caes|gatos`.
export const SPECIES_OPTIONS: Array<{ id: 'caes' | 'gatos'; species: Species; label: string }> = [
  { id: 'caes', species: 'dog', label: 'Cães' },
  { id: 'gatos', species: 'cat', label: 'Gatos' },
]

// Base factors are the cats' (indoor and active); every matrix, the stage factors and the breed groups are the dogs'.
export function speciesOfKey(key: string): Species {
  return key === 'cat' ? 'cat' : 'dog'
}

// The species a field of a 422 belongs to.
export function speciesOfField(field: string): Species {
  const [section, rest = ''] = field.split('.')
  const key = rest.split(':')[0]
  if (section === 'base') return 'cat'
  if (section === 'nem') return speciesOfKey(key)
  return 'dog'
}
