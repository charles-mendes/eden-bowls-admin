import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { defaultMarket, hasBothMarkets, sessionMarkets, type MarketCode } from '../lib/markets'

type Breed = { id?: number; name: string; slug?: string }
type Country = 'BR' | 'US'
type AgeUnit = 'years' | 'months'
type WeightUnit = 'kg' | 'lb'
type LifeStage = 'puppy' | 'adult' | 'senior'
type NemSource = 'recipe' | 'life_stage_average' | 'default'
type SimulatorRecipe = { key: string; name: string; life_stage: LifeStage; energy_kcal_kg: number | null }

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
    nem_source?: NemSource
    recipe_key?: string | null
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
    recipe: 'Receita',
    recipeAverage: 'Média das receitas da fase',
    recipeNoEnergy: 'sem energia no rótulo',
    submit: 'Calcular',
    nemRecipe: (name: string, kcal: number) => `Densidade da receita ${name}: ${kcal} kcal/kg (energia do rótulo).`,
    nemAverage: (kcal: number) => `Média das receitas publicadas da fase: ${kcal} kcal/kg.`,
    nemDefault: (kcal: number) => `Nenhuma receita da fase tem energia no rótulo: padrão do motor ${kcal} kcal/kg.`,
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
    recipe: 'Recipe',
    recipeAverage: 'Average of the life stage recipes',
    recipeNoEnergy: 'no label energy',
    submit: 'Calculate',
    nemRecipe: (name: string, kcal: number) => `Recipe ${name} density: ${kcal} kcal/kg (label energy).`,
    nemAverage: (kcal: number) => `Average of the published life stage recipes: ${kcal} kcal/kg.`,
    nemDefault: (kcal: number) => `No recipe of this life stage has label energy: engine default ${kcal} kcal/kg.`,
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
  const { token, user } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const [pickedCountry, setPickedCountry] = useState<Country>('BR')
  const [name, setName] = useState('')
  const [type, setType] = useState<'dog' | 'cat'>('dog')
  const [lifeStage, setLifeStage] = useState<LifeStage>('adult')
  const [recipes, setRecipes] = useState<SimulatorRecipe[]>([])
  const [recipeKey, setRecipeKey] = useState('')
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
  const country: Country = bothMarkets ? pickedCountry : (defaultMarket(user) ?? pickedCountry)
  const copy = labels[country]
  const weightUnit = weightUnitFor(country)
  const stageRecipes = recipes.filter((recipe) => recipe.life_stage === lifeStage)
  const usesRecipes = type === 'dog'

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

  useEffect(() => {
    if (!token) return
    const loadRecipes = async () => {
      try {
        const response = await apiRequest<{ success?: boolean; data?: { items?: SimulatorRecipe[] } }>(
          `/admin/nutrition/recipes${buildQueryString({ market: country })}`,
          { token },
        )
        setRecipes(response.data?.items || [])
      } catch {
        setRecipes([])
      }
    }

    void loadRecipes()
  }, [country, token])

  function handleLifeStageChange(next: LifeStage) {
    setLifeStage(next)
    setRecipeKey('')
  }

  function energyDescription(data: SimulateResult['data']) {
    if (data.nem_source === 'recipe') {
      const recipe = recipes.find((item) => item.key === data.recipe_key)
      return copy.nemRecipe(recipe?.name || data.recipe_key || '', data.nem_kcal_kg)
    }
    if (data.nem_source === 'life_stage_average') {
      return copy.nemAverage(data.nem_kcal_kg)
    }
    return copy.nemDefault(data.nem_kcal_kg)
  }

  function handleCountryChange(next: Country) {
    if (next === country || !bothMarkets) return
    setWeight((current) => convertWeight(current, weightUnitFor(country), weightUnitFor(next)))
    setRecipeKey('')
    setPickedCountry(next)
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
          ...(usesRecipes && recipeKey ? { recipe_key: recipeKey } : {}),
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
            <select
              aria-label={copy.country}
              value={country}
              disabled={!bothMarkets}
              onChange={(event) => handleCountryChange(event.target.value === 'BR' ? 'BR' : 'US')}
            >
              {(sessionMarkets(user).length ? sessionMarkets(user) : [country]).map((market: MarketCode) => (
                <option key={market} value={market}>{market}</option>
              ))}
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
            <select value={lifeStage} onChange={(event) => handleLifeStageChange(event.target.value as LifeStage)}>
              <option value="puppy">{copy.puppy}</option>
              <option value="adult">{copy.adult}</option>
              <option value="senior">{copy.senior}</option>
            </select>
          </label>
          {usesRecipes ? (
            <label>
              {copy.recipe}
              <select value={recipeKey} onChange={(event) => setRecipeKey(event.target.value)}>
                <option value="">{copy.recipeAverage}</option>
                {stageRecipes.map((recipe) => (
                  <option key={recipe.key} value={recipe.key} disabled={!recipe.energy_kcal_kg}>
                    {recipe.energy_kcal_kg
                      ? `${recipe.name} · ${recipe.energy_kcal_kg} kcal/kg`
                      : `${recipe.name} · ${copy.recipeNoEnergy}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
        <Section title="Resultado" description={energyDescription(result)}>
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
