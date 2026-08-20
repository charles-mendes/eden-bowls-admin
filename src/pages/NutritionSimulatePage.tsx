import { useEffect, useState, type FormEvent } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { MetricCard } from '../components/MetricCard'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'

type Breed = { id?: number; name: string; slug?: string }

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
    age: 'Idade (anos)',
    weight: 'Peso (kg)',
    breed: 'Raça',
    neutered: 'Castrado',
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
    age: 'Age (years)',
    weight: 'Weight (kg)',
    breed: 'Breed',
    neutered: 'Neutered',
    activity: 'Activity level',
    score: 'Body score',
    submit: 'Calculate',
  },
}

export function NutritionSimulatePage() {
  const { token } = useAuth()
  const [country, setCountry] = useState<'BR' | 'US'>('US')
  const [name, setName] = useState('')
  const [type, setType] = useState<'dog' | 'cat'>('dog')
  const [lifeStage, setLifeStage] = useState<'puppy' | 'adult' | 'senior'>('adult')
  const [age, setAge] = useState(4)
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
          pet: { name, type, life_stage: lifeStage, age, weight, breed, neutered },
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
        <div className="form-grid">
          <label>
            {copy.country}
            <select value={country} onChange={(event) => setCountry(event.target.value === 'BR' ? 'BR' : 'US')}>
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
          <label>
            {copy.age}
            <input type="number" min={0} value={age} onChange={(event) => setAge(Number(event.target.value))} />
          </label>
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
          <label className="checkbox-field">
            <input type="checkbox" checked={neutered} onChange={(event) => setNeutered(event.target.checked)} />
            {copy.neutered}
          </label>
          <label>
            {copy.activity}
            <select value={activity} onChange={(event) => setActivity(event.target.value)}>
              <option value="BAIXO">BAIXO</option>
              <option value="MODERADO">MODERADO</option>
              <option value="ALTO">ALTO</option>
            </select>
          </label>
          <label>
            {copy.score}
            <select value={score} onChange={(event) => setScore(event.target.value)}>
              <option value="ABAIXO">ABAIXO</option>
              <option value="ADEQUADO">ADEQUADO</option>
              <option value="ACIMA">ACIMA</option>
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
