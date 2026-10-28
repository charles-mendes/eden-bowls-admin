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

export type LifeStageOverview = {
  market: MarketCode
  sizeClasses: SizeClassLimit[]
  breeds: LifeStageBreed[]
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
}

export const FACTOR_RANGE = { min: 1, max: 400 }
export const NEM_RANGE = { min: 1000, max: 8000 }
export const MONTHS_RANGE = { min: 1, max: 240 }

export const FACTOR_SECTIONS: Array<{ key: 'combination' | 'state' | 'base' | 'nem'; title: string; description: string }> = [
  { key: 'base', title: 'Fatores base', description: 'Cão, gato e as exceções por idade, atividade, peso e grupo de raça.' },
  { key: 'state', title: 'Fatores de estado', description: 'Sênior, gestante e crescimento: substituem o fator base.' },
  { key: 'combination', title: 'Fatores de combinação', description: 'Castrado × atividade × escore corporal. Valem para todo cão adulto.' },
  { key: 'nem', title: 'NEM padrão', description: 'Energia metabolizável do alimento, em kcal/kg.' },
]

const BASE_LABELS: Record<string, string> = {
  dog: 'Cão',
  cat: 'Gato',
  cat_overweight: 'Gato acima do peso',
  work_dog_high: 'Cão de trabalho, atividade alta',
  moderate_high_impact: 'Atividade moderada de alto impacto',
  age_1_2: 'Cão de 1 a 2 anos',
  age_3_7: 'Cão de 3 a 7 anos',
  terranova: 'Grupo Terra Nova',
  dog_overweight: 'Cão acima do peso',
  dogue: 'Grupo Dogue',
  slow_metabolism: 'Metabolismo lento',
}

const STATE_LABELS: Record<string, string> = {
  SENIOR: 'Sênior',
  GESTANTE: 'Gestante',
  CRESCIMENTO_ATE_50: 'Crescimento até 50% do peso adulto',
  CRESCIMENTO_51_80: 'Crescimento de 51% a 80%',
  CRESCIMENTO_81_100: 'Crescimento de 81% a 100%',
}

const NEM_LABELS: Record<string, string> = { dog: 'Cão', cat: 'Gato' }

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
  dogue: 'Grupo Dogue',
  slow_metabolism: 'Metabolismo lento',
  terranova: 'Grupo Terra Nova',
}

export const BREED_GROUPS: BreedGroup[] = ['dogue', 'slow_metabolism', 'terranova']

export function factorLabel(section: string, key: string) {
  if (section === 'base') return BASE_LABELS[key] ?? key
  if (section === 'state') return STATE_LABELS[key] ?? key
  if (section === 'nem') return NEM_LABELS[key] ?? key
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
