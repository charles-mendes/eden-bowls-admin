import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { RecipeContentSections } from '../components/RecipeContentSections'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  RECIPE_SECTION_ANCHORS,
  recipeContentFailure,
  recipeContentPath,
  type RecipeContent,
} from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

export function RecipeContentPage() {
  const { token, hasPermission } = useAuth()
  const { market: marketParam = '', recipeKey = '' } = useParams()
  const { hash } = useLocation()
  const navigate = useNavigate()
  const canWrite = hasPermission('catalog.write')
  const [content, setContent] = useState<RecipeContent | null>(null)
  const [loadError, setLoadError] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [headerNotice, setHeaderNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)
  const scrolledTo = useRef('')

  const market = marketParam.toUpperCase()
  const listPath = `/catalog/recipes?market=${encodeURIComponent(market)}`

  useEffect(() => {
    if (!token || !market || !recipeKey) return
    let cancelled = false
    const load = async () => {
      try {
        const loadedContent = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), { token })
        if (!cancelled) setContent(loadedContent)
      } catch (requestError) {
        if (!cancelled) setLoadError(recipeContentFailure(requestError, 'Falha ao carregar o conteúdo da receita.'))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token, market, recipeKey])

  // #rotulo and the other section anchors open the page on that section once the content is there.
  const anchor = hash.replace(/^#/, '')
  const loaded = content != null
  useEffect(() => {
    if (!loaded || scrolledTo.current === anchor || !(RECIPE_SECTION_ANCHORS as readonly string[]).includes(anchor)) return
    scrolledTo.current = anchor
    document.getElementById(anchor)?.scrollIntoView?.({ block: 'start' })
  }, [loaded, anchor])

  const openRename = () => {
    setRenameValue(content?.name ?? '')
    setHeaderNotice(null)
    setRenameOpen(true)
  }

  const renameRecipe = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !canWrite || busy) return
    try {
      setBusy(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), {
        token,
        method: 'PATCH',
        body: { name: renameValue.trim() },
      })
      setContent(saved)
      setRenameOpen(false)
      setHeaderNotice({ tone: 'success', text: 'Receita renomeada.' })
    } catch (requestError) {
      setHeaderNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao renomear a receita.') })
      setRenameOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const deleteRecipe = async () => {
    if (!token || !canWrite || busy || !content) return
    const confirmed = window.confirm(`Excluir a receita "${content.name}"? A imagem e o rótulo cadastrados também saem. Não pode ser desfeito.`)
    if (!confirmed) return
    try {
      setBusy(true)
      await apiRequest(recipeContentPath(recipeKey, market), { token, method: 'DELETE' })
      navigate(listPath)
    } catch (requestError) {
      setHeaderNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao excluir a receita.') })
      setBusy(false)
    }
  }

  const sharedCount = content?.variations.length ?? 0

  return (
    <PageFrame
      eyebrow="Catálogo · Receitas"
      title={content?.name || recipeKey}
      description={`Receita ${recipeKey} · mercado ${market}. Apresentação, imagem e rótulo valem para todas as variações do mercado vinculadas a esta receita.`}
      actions={(
        <div className="inline-actions">
          {canWrite && content ? (
            <button className="ghost-button" type="button" onClick={openRename} disabled={busy}>Renomear</button>
          ) : null}
          {canWrite && content && content.variations.length === 0 ? (
            <button className="danger-button" type="button" onClick={() => void deleteRecipe()} disabled={busy}>Excluir receita</button>
          ) : null}
          <Link className="ghost-button" to={listPath}>Voltar às receitas</Link>
        </div>
      )}
    >
      {loadError ? <div className="alert" role="alert">{loadError}</div> : null}
      {headerNotice ? (
        <div className={headerNotice.tone === 'error' ? 'alert' : 'success'} role={headerNotice.tone === 'error' ? 'alert' : 'status'}>
          {headerNotice.text}
        </div>
      ) : null}

      {content ? (
        <div className="stack product-detail">
          <RecipeContentSections
            token={token}
            market={market}
            recipeKey={recipeKey}
            content={content}
            canWrite={canWrite}
            onSaved={setContent}
            afterLifeStage={(
              <Section
                title="Variações que usam este conteúdo"
                description={`${sharedCount === 1 ? '1 variação' : `${sharedCount} variações`} com Receita (conteúdo) ${recipeKey}. Para vincular ou desvincular, edite a variação no produto.`}
              >
                {sharedCount === 0 ? (
                  <p className="field-hint">
                    Nenhuma variação usa esta receita. Para vincular, abra o produto, edite a variação e escolha esta receita no campo Receita (conteúdo).
                  </p>
                ) : null}
                <ul className="recipe-variations">
                  {content.variations.map((item) => (
                    <li key={item.id}>
                      {item.productId ? (
                        <Link
                          className="link-button"
                          to={`/catalog/products/${item.productId}?variation=${encodeURIComponent(item.id)}`}
                          aria-label={`Abrir variação ${item.name || item.sku}`}
                        >
                          {item.name || item.sku}
                        </Link>
                      ) : (
                        <span>{item.name || item.sku}</span>
                      )}
                      <span className="cell-meta mono">{item.sku}</span>
                      {item.productId ? (
                        <Link className="link-button" to={`/catalog/products/${item.productId}`}>{item.productName || 'Produto'}</Link>
                      ) : null}
                      <span className={item.active ? 'badge-success' : 'badge-neutral'}>{item.active ? 'Ativa' : 'Inativa'}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          />
        </div>
      ) : null}

      <Dialog
        open={renameOpen}
        title="Renomear receita"
        description={`A chave ${recipeKey} não muda.`}
        onClose={() => { if (!busy) setRenameOpen(false) }}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={() => setRenameOpen(false)} disabled={busy}>Cancelar</button>
            <button className="primary-button" type="button" onClick={() => void renameRecipe()} disabled={busy}>Salvar nome</button>
          </>
        )}
      >
        <form className="access-form" onSubmit={(event) => void renameRecipe(event)}>
          <div className="access-fields">
            <label className="access-field-wide">
              Nome
              <input aria-label="Nome da receita" value={renameValue} maxLength={120} onChange={(event) => setRenameValue(event.target.value)} />
            </label>
          </div>
        </form>
      </Dialog>
    </PageFrame>
  )
}
