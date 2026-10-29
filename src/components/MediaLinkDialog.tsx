import { useState } from 'react'
import { Dialog } from './Dialog'
import { apiRequest } from '../lib/api'
import { mediaFailure, type MediaAsset, type MediaKind } from '../lib/mediaLibrary'
import { LIFE_STAGE_LABELS, recipeContentPath, type LifeStage, type RecipeContent, type RecipeSummary } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

export type LinkableRecipe = RecipeSummary & { planImageUrl?: string | null }

const LIFE_STAGE_ORDER: LifeStage[] = ['adult', 'puppy', 'senior']

const TEXT: Record<MediaKind, {
  linkSuffix: string
  current: (recipe: LinkableRecipe) => string | null | undefined
  replaces: string
  none: string
}> = {
  banner: {
    linkSuffix: '/image',
    current: (recipe) => recipe.imageUrl,
    replaces: 'Substitui o destaque atual desta receita. O atual continua na biblioteca.',
    none: 'A receita ainda não tem destaque.',
  },
  plan: {
    linkSuffix: '/plan-image',
    current: (recipe) => recipe.planImageUrl,
    replaces: 'Substitui a miniatura atual desta receita. A atual continua na biblioteca.',
    none: 'A receita ainda não tem miniatura.',
  },
}

// Links of one library image to the recipes of its market: unlink a wrong recipe and link the right one. Neither
// action deletes the image, which stays in the library.
export function MediaLinkDialog({ token, asset, recipes, recipesError, onClose, onChanged }: {
  token: string | null
  asset: MediaAsset | null
  recipes: LinkableRecipe[] | null
  recipesError: string
  onClose: () => void
  onChanged: (asset: MediaAsset) => void
}) {
  const [recipeKey, setRecipeKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const kind = asset?.kind ?? 'banner'
  const text = TEXT[kind]
  const linkedKeys = new Set((asset?.usedBy ?? []).map((user) => user.key))
  const target = (recipes ?? []).find((recipe) => recipe.key === recipeKey)

  const close = () => {
    if (saving) return
    setRecipeKey('')
    setNotice(null)
    onClose()
  }

  const call = async (key: string, method: 'PUT' | 'DELETE') => {
    if (!token || !asset || saving) return null
    setSaving(true)
    setNotice(null)
    try {
      return await apiRequest<RecipeContent>(recipeContentPath(key, asset.market, text.linkSuffix), {
        token,
        method,
        ...(method === 'PUT' ? { body: { assetId: asset.id } } : {}),
      })
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, method === 'PUT' ? 'Falha ao vincular a imagem.' : 'Falha ao desvincular a imagem.') })
      return null
    } finally {
      setSaving(false)
    }
  }

  const unlink = async (key: string, name: string) => {
    if (!asset) return
    if (!window.confirm(`Desvincular ${asset.originalFilename} de ${name} (${asset.market})? A imagem continua na biblioteca.`)) return
    const saved = await call(key, 'DELETE')
    if (!saved) return
    onChanged({ ...asset, usedBy: asset.usedBy.filter((user) => user.key !== key) })
    setNotice({ tone: 'success', text: `Desvinculada de ${name} (${asset.market}).` })
  }

  const link = async () => {
    if (!asset || !target) return
    const saved = await call(target.key, 'PUT')
    if (!saved) return
    onChanged({ ...asset, usedBy: [...asset.usedBy, { key: target.key, name: target.name, market: asset.market }] })
    setNotice({ tone: 'success', text: `Vinculada a ${target.name} (${asset.market}).` })
    setRecipeKey('')
  }

  return (
    <Dialog
      open={asset !== null}
      title={asset?.usedBy.length ? 'Editar vínculo' : 'Vincular a uma receita'}
      description={asset ? `${asset.originalFilename} · ${asset.market}. Vinculou errado? Desvincule a receita errada e vincule a certa. A imagem nunca sai da biblioteca.` : undefined}
      onClose={close}
    >
      {asset ? (
        <div className="media-link">
          <img
            className={asset.kind === 'banner' ? 'media-link-preview media-link-preview-banner' : 'media-link-preview'}
            src={asset.url}
            alt={`Prévia de ${asset.originalFilename}`}
          />
          {notice ? (
            <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
              {notice.text}
            </div>
          ) : null}

          <div className="media-link-block">
            <h4>Vinculada a</h4>
            {asset.usedBy.length === 0 ? (
              <p className="muted">Nenhuma receita usa esta imagem.</p>
            ) : (
              <ul className="media-link-list">
                {asset.usedBy.map((user) => {
                  const recipe = (recipes ?? []).find((item) => item.key === user.key)
                  return (
                    <li key={user.key}>
                      <span>
                        <strong>{user.name}</strong>
                        <span className="cell-meta">{recipe ? ` · Linha ${LIFE_STAGE_LABELS[recipe.lifeStage]}` : ''} · {user.market}</span>
                      </span>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={saving}
                        aria-label={`Desvincular de ${user.name}`}
                        onClick={() => void unlink(user.key, user.name)}
                      >
                        Desvincular
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="media-link-block">
            <h4>Vincular a outra receita</h4>
            {recipesError ? <div className="alert" role="alert">{recipesError}</div> : null}
            {recipes === null && !recipesError ? <p className="muted">Carregando as receitas.</p> : null}
            {recipes ? (
              <div className="media-link-form">
                <label className="field">
                  Receita de {asset.market}
                  <select value={recipeKey} disabled={saving} onChange={(event) => setRecipeKey(event.target.value)}>
                    <option value="">Escolha a receita</option>
                    {LIFE_STAGE_ORDER.map((stage) => {
                      const options = recipes.filter((recipe) => recipe.lifeStage === stage && !linkedKeys.has(recipe.key))
                      return options.length ? (
                        <optgroup key={stage} label={LIFE_STAGE_LABELS[stage]}>
                          {options.map((recipe) => <option key={recipe.key} value={recipe.key}>{recipe.name}</option>)}
                        </optgroup>
                      ) : null
                    })}
                  </select>
                </label>
                <button className="primary-button" type="button" disabled={saving || !target} onClick={() => void link()}>
                  {saving ? 'Salvando…' : 'Vincular'}
                </button>
              </div>
            ) : null}
            {target ? (
              <span className="field-hint">
                Linha {LIFE_STAGE_LABELS[target.lifeStage]} · {target.name} ({asset.market}).{' '}
                {text.current(target) ? text.replaces : text.none}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </Dialog>
  )
}
