import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'

type Breed = { id?: number; name: string; slug?: string }
type Country = 'BR' | 'US'
type AgeUnit = 'years' | 'months'
type WeightUnit = 'kg' | 'lb'

type SimulateResult = {
  success: boolean
  data: {
    energia_kcal_dia: number
    quantidade_g_dia: number
    refeicoes: number
    quantidade_por_refeicao: number
    fator_aplicado: number
    porte: string
    especie: string
    nem_kcal_kg: number
    display: { daily: string; weight: string }
  }
}

const KG_TO_LB = 2.2046226218

const ACTIVITY_OPTIONS = [
  { value: 'BAIXO', BR: 'BAIXO', US: 'Low' },
  { value: 'MODERADO', BR: 'MODERADO', US: 'Moderate' },
  { value: 'ALTO', BR: 'ALTO', US: 'High' },
] as const

const SCORE_OPTIONS = [
  { value: 'ABAIXO', BR: 'ABAIXO', US: 'Underweight' },
  { value: 'ADEQUADO', BR: 'ADEQUADO', US: 'Ideal' },
  { value: 'ACIMA', BR: 'ACIMA', US: 'Overweight' },
] as const

const labels = {
  BR: {
    title: 'Simulador nutricional',
    country: 'País',
    name: 'Nome do pet',
    type: 'Espécie',
    dog: 'Cão',
    cat: 'Gato',
    stage: 'Fase',
    puppy: 'Filhote',
    adult: 'Adulto',
    senior: 'Sênior',
    age: 'Idade',
    ageUnit: 'Unidade da idade',
    ageYears: 'Anos',
    ageMonths: 'Meses',
    ageHint: 'Ex.: filhote de 2 meses',
    weight: 'Peso (kg)',
    breed: 'Raça',
    neutered: 'Castrado',
    yes: 'Sim',
    no: 'Não',
    activity: 'Nível de atividade',
    score: 'Score corporal',
    submit: 'Calcular',
  },
  US: {
    title: 'Nutrition simulator',
    country: 'Country',
    name: 'Pet name',
    type: 'Species',
    dog: 'Dog',
    cat: 'Cat',
    stage: 'Life stage',
    puppy: 'Puppy',
    adult: 'Adult',
    senior: 'Senior',
    age: 'Age',
    ageUnit: 'Age unit',
    ageYears: 'Years',
    ageMonths: 'Months',
    ageHint: 'Ex.: 2-month-old puppy',
    weight: 'Weight (lb)',
    breed: 'Breed',
    neutered: 'Neutered',
    yes: 'Yes',
    no: 'No',
    activity: 'Activity level',
    score: 'Body score',
    submit: 'Calculate',
  },
}

function weightUnitFor(country: Country): WeightUnit {
  return country === 'BR' ? 'kg' : 'lb'
}

function convertWeight(value: number, from: WeightUnit, to: WeightUnit) {
  if (from === to) return value
  const converted = from === 'kg' ? value * KG_TO_LB : value / KG_TO_LB
  return Math.round(converted * 10) / 10
}

function toAgePayload(age: number, unit: AgeUnit) {
  const value = Math.max(0, Math.floor(Number(age) || 0))
  if (unit === 'years') {
    return { age: value, age_years: value, age_months: 0 }
  }

  return {
    age: Math.floor(value / 12),
    age_years: Math.floor(value / 12),
    age_months: value % 12,
  }
}

export function NutritionSimulatePage() {
  const { token } = useAuth()
  const [country, setCountry] = useState<Country>('US')
  const [name, setName] = useState('')
  const [type, setType] = useState<'dog' | 'cat'>('dog')
  const [lifeStage, setLifeStage] = useState<'puppy' | 'adult' | 'senior'>('adult')
  const [age, setAge] = useState(4)
  const [ageUnit, setAgeUnit] = useState<AgeUnit>('years')
  const [weight, setWeight] = useState(20)
  const [breed, setBreed] = useState('')
  const [neutered, setNeutered] = useState(true)
  const [activity, setActivity] = useState('BAIXO')
  const [score, setScore] = useState('ADEQUADO')
  const [breeds, setBreeds] = useState<Breed[]>([])
  const [result, setResult] = useState<SimulateResult['data'] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const copy = labels[country]
  const weightUnit = weightUnitFor(country)

  useEffect(() => {
    const loadBreeds = async () => {
      try {
        const lang = country === 'BR' ? 'pt' : 'en'
        const response = await apiRequest<{ success?: boolean; data?: { items?: Breed[] } }>(
          `/breeds${buildQueryString({ lang, limit: 500 })}`,
        )
        setBreeds(response.data?.items || [])
      } catch {
        setBreeds([])
      }
    }

    setBreed('')
    void loadBreeds()
  }, [country])

  function handleCountryChange(next: Country) {
    if (next === country) return
    setWeight((current) => convertWeight(current, weightUnitFor(country), weightUnitFor(next)))
    setCountry(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!token) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await apiRequest<SimulateResult>('/admin/nutrition/simulate', {
        token,
        method: 'POST',
        body: {
          country,
          pet: {
            name,
            type,
            life_stage: lifeStage,
            ...toAgePayload(age, ageUnit),
            weight,
            weight_unit: weightUnit,
            breed,
            neutered,
          },
          questionnaire: { nivel_atividade: activity, score_corporal: score },
        },
      })
      setResult(response.data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha no cálculo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageFrame title={copy.title} description="Mesmo motor da loja. A simulação não grava pet, checkout nem assinatura.">
      {error ? <div className="alert">{error}</div> : null}

      <form className="editor-card" onSubmit={handleSubmit}>
        <div className="form-grid simulate-grid">
          <label>
            {copy.country}
            <select value={country} onChange={(event) => handleCountryChange(event.target.value === 'BR' ? 'BR' : 'US')}>
              <option value="US">US</option>
              <option value="BR">BR</option>
            </select>
          </label>
          <label>
            {copy.name}
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            {copy.type}
            <select value={type} onChange={(event) => setType(event.target.value === 'cat' ? 'cat' : 'dog')}>
              <option value="dog">{copy.dog}</option>
              <option value="cat">{copy.cat}</option>
            </select>
          </label>
          <label>
            {copy.stage}
            <select value={lifeStage} onChange={(event) => setLifeStage(event.target.value as typeof lifeStage)}>
              <option value="puppy">{copy.puppy}</option>
              <option value="adult">{copy.adult}</option>
              <option value="senior">{copy.senior}</option>
            </select>
          </label>
          <div className="field">
            <label htmlFor="nutrition-age">{copy.age}</label>
            <div className="split-input">
              <input
                id="nutrition-age"
                type="number"
                min={0}
                value={age}
                onChange={(event) => setAge(Number(event.target.value))}
                aria-describedby="nutrition-age-hint"
              />
              <select
                aria-label={copy.ageUnit}
                value={ageUnit}
                onChange={(event) => setAgeUnit(event.target.value === 'months' ? 'months' : 'years')}
              >
                <option value="years">{copy.ageYears}</option>
                <option value="months">{copy.ageMonths}</option>
              </select>
            </div>
            <p id="nutrition-age-hint" className="field-hint">{copy.ageHint}</p>
          </div>
          <label>
            {copy.weight}
            <input type="number" min={0} step="0.1" value={weight} onChange={(event) => setWeight(Number(event.target.value))} required />
          </label>
          <label>
            {copy.breed}
            <select value={breed} onChange={(event) => setBreed(event.target.value)}>
              <option value="">—</option>
              {breeds.map((item) => (
                <option key={item.slug || item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="boolean-field">
            {copy.neutered}
            <span className="boolean-control">
              <input type="checkbox" checked={neutered} onChange={(event) => setNeutered(event.target.checked)} />
              <span className="boolean-value">{neutered ? copy.yes : copy.no}</span>
            </span>
          </label>
          <label>
            {copy.activity}
            <select value={activity} onChange={(event) => setActivity(event.target.value)}>
              {ACTIVITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option[country]}</option>
              ))}
            </select>
          </label>
          <label>
            {copy.score}
            <select value={score} onChange={(event) => setScore(event.target.value)}>
              {SCORE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option[country]}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="primary-button" type="submit" disabled={loading}>{loading ? '...' : copy.submit}</button>
      </form>

      {result ? (
        <Section title="Resultado" description="NEM vem do default do motor (3600 cão / 3800 gato).">
          <div className="grid cards-4">
            <MetricCard label="Energia" value={`${result.energia_kcal_dia} kcal`} />
            <MetricCard label="Gramas / dia" value={result.display.daily} />
            <MetricCard label="Por refeição" value={`${result.quantidade_por_refeicao} × ${result.refeicoes}`} />
            <MetricCard label="Fator" value={result.fator_aplicado} hint={`NEM ${result.nem_kcal_kg} · ${result.porte} · ${result.especie}`} />
          </div>
        </Section>
      ) : null}
    </PageFrame>
  )
}
