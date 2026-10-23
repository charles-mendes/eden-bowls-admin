import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Dialog } from '../components/Dialog'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  RECIPE_IMAGE_HEIGHT,
  RECIPE_IMAGE_WIDTH,
  checkRecipeImage,
  fileToImagePayload,
  type ImagePayload,
} from '../lib/imageUpload'
import {
  LABEL_STATUS_TEXT,
  labelMissingText,
  recipeContentFailure,
  recipeContentPath,
  type RecipeContent,
  type RecipeLabel,
} from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type PendingImage = { payload: ImagePayload; previewUrl: string; fileName: string }

type LabelTextField = 'productName' | 'netWeight' | 'freshnessNote' | 'energyKg' | 'energyPackage' | 'manufacturer'
type LabelListField = 'ingredients' | 'notices' | 'storage' | 'feeding'

const TEXT_FIELDS: Array<{ field: LabelTextField; label: string }> = [
  { field: 'productName', label: 'Nome do produto' },
  { field: 'netWeight', label: 'Peso líquido' },
  { field: 'freshnessNote', label: 'Nota de frescor' },
  { field: 'energyKg', label: 'kcal/kg' },
  { field: 'energyPackage', label: 'kcal por embalagem' },
  { field: 'manufacturer', label: 'Fabricante' },
]

const LIST_FIELDS: Array<{ field: LabelListField; label: string; item: string }> = [
  { field: 'ingredients', label: 'Ingredientes', item: 'Ingrediente' },
  { field: 'notices', label: 'Avisos', item: 'Aviso' },
  { field: 'storage', label: 'Armazenamento', item: 'Armazenamento' },
  { field: 'feeding', label: 'Modo de servir', item: 'Modo de servir' },
]

function labelForm(label: Partial<RecipeLabel> | null): RecipeLabel {
  return {
    productName: label?.productName ?? '',
    netWeight: label?.netWeight ?? '',
    freshnessNote: label?.freshnessNote ?? '',
    ingredients: [...(label?.ingredients ?? [])],
    analysis: (label?.analysis ?? []).map((row) => ({ ...row })),
    energyKg: label?.energyKg ?? '',
    energyPackage: label?.energyPackage ?? '',
    notices: [...(label?.notices ?? [])],
    storage: [...(label?.storage ?? [])],
    feeding: [...(label?.feeding ?? [])],
    manufacturer: label?.manufacturer ?? '',
    manufacturerLocation: label?.manufacturerLocation ?? '',
  }
}

// Blank list rows are dropped before saving; the API trims the rest.
function labelPayload(form: RecipeLabel): RecipeLabel {
  const list = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)
  return {
    ...form,
    ingredients: list(form.ingredients),
    notices: list(form.notices),
    storage: list(form.storage),
    feeding: list(form.feeding),
    analysis: form.analysis.filter((row) => row.nutrient.trim() || row.value.trim()),
  }
}

function ListEditor({ label, item, values, disabled, onChange }: {
  label: string
  item: string
  values: string[]
  disabled: boolean
  onChange: (values: string[]) => void
}) {
  return (
    <fieldset className="label-list">
      <legend>{label}</legend>
      {values.length === 0 ? <p className="field-hint">Nenhum item.</p> : null}
      {values.map((value, index) => (
        <div className="label-list-row" key={index}>
          <input
            aria-label={`${item} ${index + 1}`}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(values.map((current, at) => (at === index ? event.target.value : current)))}
          />
          {!disabled ? (
            <button
              className="ghost-button"
              type="button"
              aria-label={`Remover ${item.toLowerCase()} ${index + 1}`}
              onClick={() => onChange(values.filter((_, at) => at !== index))}
            >
              Remover
            </button>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <button className="link-button" type="button" onClick={() => onChange([...values, ''])}>
          Adicionar {item.toLowerCase()}
        </button>
      ) : null}
    </fieldset>
  )
}

export function RecipeContentPage() {
  const { token, hasPermission } = useAuth()
  const { market: marketParam = '', recipeKey = '' } = useParams()
  const navigate = useNavigate()
  const canWrite = hasPermission('catalog.write')
  const [content, setContent] = useState<RecipeContent | null>(null)
  const [loadError, setLoadError] = useState('')
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [imageNotice, setImageNotice] = useState<Notice>(null)
  const [savingImage, setSavingImage] = useState(false)
  const [label, setLabel] = useState<RecipeLabel>(() => labelForm(null))
  const [labelNotice, setLabelNotice] = useState<Notice>(null)
  const [savingLabel, setSavingLabel] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [headerNotice, setHeaderNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const market = marketParam.toUpperCase()
  const listPath = `/catalog/recipes?market=${encodeURIComponent(market)}`

  useEffect(() => {
    if (!token || !market || !recipeKey) return
    let cancelled = false
    const load = async () => {
      try {
        const loadedContent = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market), { token })
        if (!cancelled) {
          setContent(loadedContent)
          setLabel(labelForm(loadedContent.label))
        }
      } catch (requestError) {
        if (!cancelled) setLoadError(recipeContentFailure(requestError, 'Falha ao carregar o conteúdo da receita.'))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token, market, recipeKey])

  useEffect(() => () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
  }, [pendingImage])

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

  const clearPending = () => {
    setPendingImage(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const chooseImage = async (file: File | undefined) => {
    if (!file) return
    setImageNotice(null)
    const check = await checkRecipeImage(file)
    if (!check.ok) {
      clearPending()
      setImageNotice({ tone: 'error', text: check.message })
      return
    }
    try {
      const payload = await fileToImagePayload(file)
      setPendingImage({ payload, previewUrl: URL.createObjectURL(file), fileName: file.name })
    } catch (readError) {
      clearPending()
      setImageNotice({ tone: 'error', text: readError instanceof Error ? readError.message : 'Falha ao ler a imagem.' })
    }
  }

  const saveImage = async () => {
    if (!token || !pendingImage || !market || savingImage) return
    try {
      setSavingImage(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/image'), {
        token,
        method: 'PUT',
        body: pendingImage.payload,
      })
      setContent(saved)
      clearPending()
      setImageNotice({ tone: 'success', text: 'Imagem salva. A loja passa a usar esta imagem.' })
    } catch (requestError) {
      setImageNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar a imagem.') })
    } finally {
      setSavingImage(false)
    }
  }

  const removeImage = async () => {
    if (!token || !market || savingImage) return
    const confirmed = window.confirm('Remover a imagem cadastrada? A loja volta a usar a imagem que está no código.')
    if (!confirmed) return
    try {
      setSavingImage(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/image'), { token, method: 'DELETE' })
      setContent(saved)
      setImageNotice({ tone: 'success', text: 'Imagem removida. A loja volta a usar a imagem do código.' })
    } catch (requestError) {
      setImageNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao remover a imagem.') })
    } finally {
      setSavingImage(false)
    }
  }

  const updateLabel = (patch: Partial<RecipeLabel>) => setLabel((current) => ({ ...current, ...patch }))

  const saveLabel = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !market || !canWrite || savingLabel) return
    try {
      setSavingLabel(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/label'), {
        token,
        method: 'PUT',
        body: { label: labelPayload(label) },
      })
      setContent(saved)
      setLabel(labelForm(saved.label))
      setLabelNotice({
        tone: 'success',
        text: saved.labelStatus === 'complete' ? 'Rótulo salvo e completo.' : 'Rótulo salvo como rascunho.',
      })
    } catch (requestError) {
      setLabelNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar o rótulo.') })
    } finally {
      setSavingLabel(false)
    }
  }

  const labelBadge = content?.labelStatus === 'complete'
    ? 'badge-success'
    : content?.labelStatus === 'incomplete' ? 'badge-warning' : 'badge-neutral'
  const labelLanguage = market === 'US' ? 'Rótulo em inglês · US' : 'Rótulo em português · BR'
  const readOnlyLabel = !canWrite

  const previewUrl = pendingImage?.previewUrl ?? content?.imageUrl ?? null
  const sharedCount = content?.variations.length ?? 0

  return (
    <PageFrame
      eyebrow="Catálogo · Receitas"
      title={content?.name || recipeKey}
      description={`Receita ${recipeKey} · mercado ${market}. Imagem e rótulo valem para todas as variações do mercado vinculadas a esta receita.`}
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
                  <span>{item.name || item.sku}</span>
                  <span className="cell-meta mono">{item.sku}</span>
                  {item.productId ? (
                    <Link className="link-button" to={`/catalog/products/${item.productId}`}>{item.productName || 'Produto'}</Link>
                  ) : null}
                  <span className={item.active ? 'badge-success' : 'badge-neutral'}>{item.active ? 'Ativa' : 'Inativa'}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section
            title="Imagem"
            description={`Banner da receita na loja. PNG, JPEG ou WebP com exatamente ${RECIPE_IMAGE_WIDTH} × ${RECIPE_IMAGE_HEIGHT} px e até 5 MB.`}
          >
            {imageNotice ? (
              <div className={imageNotice.tone === 'error' ? 'alert' : 'success'} role={imageNotice.tone === 'error' ? 'alert' : 'status'}>
                {imageNotice.text}
              </div>
            ) : null}
            <div className="recipe-image">
              {previewUrl ? (
                <img
                  className="recipe-banner-preview"
                  src={previewUrl}
                  alt={pendingImage ? 'Prévia da nova imagem' : 'Imagem cadastrada da receita'}
                />
              ) : (
                <div className="recipe-banner-preview recipe-banner-empty">
                  Sem imagem cadastrada. A loja usa a imagem que está no código.
                </div>
              )}
              <div className="recipe-image-side">
                <p className="field-hint">
                  {pendingImage
                    ? `Nova imagem: ${pendingImage.fileName} · ${RECIPE_IMAGE_WIDTH} × ${RECIPE_IMAGE_HEIGHT} px. Ainda não foi salva.`
                    : content.imageUrl ? 'Imagem cadastrada no painel.' : 'Nenhuma imagem cadastrada no painel.'}
                </p>
                {canWrite ? (
                  <div className="inline-actions">
                    <input
                      ref={fileInput}
                      id="recipe-image-file"
                      className="sr-only"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(event) => void chooseImage(event.target.files?.[0])}
                    />
                    <label className="ghost-button" htmlFor="recipe-image-file">Escolher imagem</label>
                    {pendingImage ? (
                      <>
                        <button className="primary-button" type="button" disabled={savingImage} onClick={() => void saveImage()}>
                          {savingImage ? 'Salvando…' : 'Salvar imagem'}
                        </button>
                        <button className="ghost-button" type="button" disabled={savingImage} onClick={clearPending}>
                          Descartar
                        </button>
                      </>
                    ) : null}
                    {!pendingImage && content.imageUrl ? (
                      <button className="danger-button" type="button" disabled={savingImage} onClick={() => void removeImage()}>
                        Remover imagem
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </Section>

          <Section
            title="Rótulo"
            description={`${labelLanguage}. Ingredientes, níveis de garantia, kcal/kg e kcal por embalagem completam o rótulo${market === 'US' ? ', com ao menos um aviso' : ''}.`}
            actions={<span className={labelBadge}>{LABEL_STATUS_TEXT[content.labelStatus]}</span>}
          >
            {labelNotice ? (
              <div className={labelNotice.tone === 'error' ? 'alert' : 'success'} role={labelNotice.tone === 'error' ? 'alert' : 'status'}>
                {labelNotice.text}
              </div>
            ) : null}
            {content.labelStatus === 'incomplete' && content.labelMissing.length ? (
              <p className="field-hint warning-text">Falta: {labelMissingText(content.labelMissing)}.</p>
            ) : null}
            <form className="label-form" onSubmit={(event) => void saveLabel(event)}>
              <div className="form-grid">
                {TEXT_FIELDS.map(({ field, label: text }) => (
                  <label key={field}>
                    {text}
                    <input value={label[field]} disabled={readOnlyLabel} onChange={(event) => updateLabel({ [field]: event.target.value })} />
                  </label>
                ))}
                <label className="label-form-wide">
                  Endereço do fabricante
                  <textarea
                    rows={2}
                    value={label.manufacturerLocation}
                    disabled={readOnlyLabel}
                    onChange={(event) => updateLabel({ manufacturerLocation: event.target.value })}
                  />
                </label>
              </div>

              <fieldset className="label-list">
                <legend>Níveis de garantia</legend>
                {label.analysis.length === 0 ? <p className="field-hint">Nenhuma linha.</p> : null}
                {label.analysis.map((row, index) => (
                  <div className="label-list-row label-analysis-row" key={index}>
                    <input
                      aria-label={`Nutriente ${index + 1}`}
                      placeholder="Proteína bruta (mín.)"
                      value={row.nutrient}
                      disabled={readOnlyLabel}
                      onChange={(event) => updateLabel({ analysis: label.analysis.map((current, at) => (at === index ? { ...current, nutrient: event.target.value } : current)) })}
                    />
                    <input
                      aria-label={`Valor ${index + 1}`}
                      placeholder="9,0%"
                      value={row.value}
                      disabled={readOnlyLabel}
                      onChange={(event) => updateLabel({ analysis: label.analysis.map((current, at) => (at === index ? { ...current, value: event.target.value } : current)) })}
                    />
                    {!readOnlyLabel ? (
                      <button
                        className="ghost-button"
                        type="button"
                        aria-label={`Remover nível de garantia ${index + 1}`}
                        onClick={() => updateLabel({ analysis: label.analysis.filter((_, at) => at !== index) })}
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ))}
                {!readOnlyLabel ? (
                  <button className="link-button" type="button" onClick={() => updateLabel({ analysis: [...label.analysis, { nutrient: '', value: '' }] })}>
                    Adicionar nível de garantia
                  </button>
                ) : null}
              </fieldset>

              {LIST_FIELDS.map(({ field, label: text, item }) => (
                <ListEditor
                  key={field}
                  label={text}
                  item={item}
                  values={label[field]}
                  disabled={readOnlyLabel}
                  onChange={(values) => updateLabel({ [field]: values })}
                />
              ))}

              {canWrite ? (
                <div className="inline-actions">
                  <button className="primary-button" type="submit" disabled={savingLabel}>
                    {savingLabel ? 'Salvando…' : 'Salvar rótulo'}
                  </button>
                </div>
              ) : null}
            </form>
          </Section>
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
