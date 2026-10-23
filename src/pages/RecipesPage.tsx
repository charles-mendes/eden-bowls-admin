import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { FiltersBar } from '../components/FiltersBar'
import { MarketSelect } from '../components/MarketSelect'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { defaultMarket, sessionMarkets, type MarketCode } from '../lib/markets'
import {
  LABEL_STATUS_TEXT,
  recipeContentFailure,
  recipeKeyFromName,
  recipePagePath,
  type RecipeContent,
  type RecipeSummary,
} from '../lib/recipeContent'

type QuickFilter = 'all' | 'no-image' | 'label-incomplete'

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'no-image', label: 'Sem imagem' },
  { value: 'label-incomplete', label: 'Rótulo incompleto' },
]

type NewRecipeForm = { name: string; key: string; keyTouched: boolean }

const emptyForm: NewRecipeForm = { name: '', key: '', keyTouched: false }

function labelBadge(status: RecipeSummary['labelStatus']) {
  if (status === 'complete') return 'badge-success'
  if (status === 'incomplete') return 'badge-warning'
  return 'badge-neutral'
}

export function RecipesPage() {
  const { token, user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const canWrite = hasPermission('catalog.write')
  const allowed = sessionMarkets(user)
  const requested = (searchParams.get('market') || '').toUpperCase() as MarketCode
  const market = allowed.includes(requested) ? requested : (defaultMarket(user) ?? '')
  // Results are kept with the market they belong to, so switching markets never shows the previous list.
  const [loaded, setLoaded] = useState<{ market: string; items: RecipeSummary[] | null; error: string } | null>(null)
  const [filter, setFilter] = useState<QuickFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<NewRecipeForm>(emptyForm)
  const [dialogError, setDialogError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!token || !market) return
    let cancelled = false
    apiRequest<{ items: RecipeSummary[] }>(`/admin/catalog/recipe-content?market=${encodeURIComponent(market)}`, { token })
      .then((response) => { if (!cancelled) setLoaded({ market, items: response.items, error: '' }) })
      .catch((requestError) => {
        if (!cancelled) setLoaded({ market, items: null, error: recipeContentFailure(requestError, 'Falha ao carregar as receitas.') })
      })
    return () => {
      cancelled = true
    }
  }, [token, market])

  const current = loaded?.market === market ? loaded : null
  const items = current?.items ?? null
  const error = current?.error ?? ''
  const visible = (items ?? []).filter((item) => {
    if (filter === 'no-image') return !item.imageUrl
    if (filter === 'label-incomplete') return item.labelStatus !== 'complete'
    return true
  })

  const openDialog = () => {
    setForm(emptyForm)
    setDialogError('')
    setDialogOpen(true)
  }

  const closeDialog = () => {
    if (creating) return
    setDialogOpen(false)
  }

  const createRecipe = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !market || !canWrite || creating) return
    try {
      setCreating(true)
      const created = await apiRequest<RecipeContent>(`/admin/catalog/recipe-content?market=${encodeURIComponent(market)}`, {
        token,
        method: 'POST',
        body: { key: form.key.trim(), name: form.name.trim() },
      })
      setDialogOpen(false)
      navigate(recipePagePath(market, created.flavorSlug))
    } catch (requestError) {
      setDialogError(recipeContentFailure(requestError, 'Falha ao cadastrar a receita.'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <PageFrame
      title="Receitas"
      description="Imagem e rótulo de cada receita por mercado. As variações escolhem a receita no campo Receita (conteúdo)."
      actions={canWrite ? (
        <button className="primary-button" type="button" onClick={openDialog} disabled={!market}>Nova receita</button>
      ) : null}
    >
      {error ? <div className="alert" role="alert">{error}</div> : null}

      <Section title="Filtros">
        <FiltersBar>
          <MarketSelect
            user={user}
            value={market}
            onChange={(value) => setSearchParams(value ? { market: value } : {})}
          />
          <div className="field">
            Mostrar
            <div className="tabs recipe-filters" role="group" aria-label="Filtro rápido">
              {QUICK_FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filter === option.value ? 'tab active' : 'tab'}
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </FiltersBar>
      </Section>

      <Section
        title="Receitas do mercado"
        description={items ? `${visible.length} de ${items.length} receitas` : 'Carregando as receitas.'}
      >
        <div className="table-shell table-scroll">
          <table className="recipes-table">
            <thead>
              <tr>
                <th>Receita</th>
                <th>Variações (ativas/total)</th>
                <th>Imagem</th>
                <th>Rótulo</th>
              </tr>
            </thead>
            <tbody>
              {items && visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    {items.length === 0 ? 'Nenhuma receita cadastrada neste mercado.' : 'Nenhuma receita neste filtro.'}
                  </td>
                </tr>
              ) : visible.map((item) => {
                const active = item.variations.filter((variation) => variation.active).length
                return (
                  <tr key={item.key}>
                    <td>
                      <div className="cell-stack">
                        <Link className="link-button" to={recipePagePath(market, item.key)}>{item.name}</Link>
                        <span className="cell-meta mono">{item.key}</span>
                      </div>
                    </td>
                    <td className="numeric">{active}/{item.variations.length}</td>
                    <td>
                      <span className={item.imageUrl ? 'badge-success' : 'badge-neutral'}>
                        {item.imageUrl ? 'Imagem cadastrada' : 'Sem imagem'}
                      </span>
                    </td>
                    <td><span className={labelBadge(item.labelStatus)}>{LABEL_STATUS_TEXT[item.labelStatus]}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Dialog
        open={dialogOpen}
        title="Nova receita"
        description={`Mercado ${market}. A imagem e o rótulo são cadastrados na página da receita.`}
        onClose={closeDialog}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeDialog} disabled={creating}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void createRecipe()} disabled={creating}>
              {creating ? 'Cadastrando…' : 'Cadastrar receita'}
            </button>
          </>
        )}
      >
        <form className="access-form" onSubmit={(event) => void createRecipe(event)}>
          {dialogError ? <div className="alert">{dialogError}</div> : null}
          <div className="access-fields">
            <label className="access-field-wide">
              Nome
              <input
                aria-label="Nome"
                value={form.name}
                maxLength={120}
                onChange={(event) => {
                  const name = event.target.value
                  setForm((current) => ({ ...current, name, key: current.keyTouched ? current.key : recipeKeyFromName(name) }))
                }}
                placeholder="Ex.: Sênior Cordeiro"
              />
            </label>
            <label className="access-field-wide">
              Chave
              <input
                className="mono"
                aria-label="Chave"
                aria-describedby="recipe-key-help"
                value={form.key}
                maxLength={64}
                onChange={(event) => setForm((current) => ({ ...current, key: event.target.value, keyTouched: true }))}
                placeholder="senior-cordeiro"
              />
              <span id="recipe-key-help" className="access-hint">
                Letras minúsculas, números e hífens. A chave não muda depois de cadastrada.
              </span>
            </label>
          </div>
        </form>
      </Dialog>
    </PageFrame>
  )
}
