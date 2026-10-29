import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from './Dialog'
import { Section } from './Section'
import { apiRequest } from '../lib/api'
import {
  RECIPE_IMAGE_HEIGHT,
  RECIPE_IMAGE_WIDTH,
  RECIPE_PLAN_IMAGE_SIZES,
  checkRecipeImage,
  checkRecipePlanImage,
  fileToImagePayload,
  type ImagePayload,
} from '../lib/imageUpload'
import { mediaFailure, mediaListPath, usedByText, type MediaAsset, type MediaKind } from '../lib/mediaLibrary'
import { recipeContentPath, type RecipeContent } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type PendingImage = { payload: ImagePayload; previewUrl: string; fileName: string; sizeText: string }

const PLAN_SIZES_TEXT = RECIPE_PLAN_IMAGE_SIZES.map((side) => `${side} × ${side} px`).join(' ou ')

// Everything that differs between the home banner and the plan thumbnail of a recipe.
const KINDS: Record<MediaKind, {
  linkSuffix: string
  check: typeof checkRecipeImage
  stored: (content: RecipeContent) => { url: string | null; assetId: number | null }
  title: string
  description: string
  wrapperClass: string
  previewClass: string
  thumbClass: string
  storedAlt: string
  pendingAlt: string
  empty: string
  pendingText: (image: PendingImage) => string
  linkedText: string
  unlinkedText: string
  pickLabel: string
  uploadLabel: string
  inputId: string
  saveLabel: string
  unlinkLabel: string
  unlinkConfirm: string
  unlinkHint: string
  savedText: string
  pickedText: (asset: MediaAsset) => string
  unlinkedNotice: string
  saveFailure: string
  unlinkFailure: string
  pickerDescription: (market: string) => string
  pickerEmpty: string
  currentLabel: string
  currentAria: (asset: MediaAsset) => string
}> = {
  banner: {
    linkSuffix: '/image',
    check: checkRecipeImage,
    stored: (content) => ({ url: content.imageUrl ?? null, assetId: content.imageAssetId ?? null }),
    title: 'Imagem da tela inicial',
    description: `Banner da receita no carrossel da tela inicial e na página da receita. PNG, JPEG ou WebP com exatamente ${RECIPE_IMAGE_WIDTH} × ${RECIPE_IMAGE_HEIGHT} px e até 5 MB. Todo destaque fica guardado na Biblioteca de imagens.`,
    wrapperClass: 'recipe-image',
    previewClass: 'recipe-banner-preview',
    thumbClass: 'media-thumb media-thumb-banner',
    storedAlt: 'Imagem cadastrada da receita',
    pendingAlt: 'Prévia da nova imagem',
    empty: 'Sem imagem cadastrada. A loja usa a imagem que está no código.',
    pendingText: (image) => `Nova imagem: ${image.fileName} · ${image.sizeText}. Ainda não foi salva.`,
    linkedText: 'Destaque vinculado da Biblioteca de imagens.',
    unlinkedText: 'Nenhuma imagem cadastrada no painel.',
    pickLabel: 'Escolher imagem da biblioteca',
    uploadLabel: 'Enviar nova imagem',
    inputId: 'recipe-image-file',
    saveLabel: 'Salvar imagem',
    unlinkLabel: 'Desvincular imagem',
    unlinkConfirm: 'Desvincular a imagem? Ela sai do destaque da tela inicial e continua na Biblioteca de imagens.',
    unlinkHint: 'Desvincular só tira a imagem do destaque. Ela continua na',
    savedText: 'Imagem salva e guardada na Biblioteca de imagens. A loja passa a usar esta imagem.',
    pickedText: (asset) => `Destaque ${asset.originalFilename} vinculado. A loja passa a usar esta imagem.`,
    unlinkedNotice: 'Imagem desvinculada. A loja volta a usar a imagem do código, e a imagem continua na Biblioteca de imagens.',
    saveFailure: 'Falha ao salvar a imagem.',
    unlinkFailure: 'Falha ao desvincular a imagem.',
    pickerDescription: (market) => `Destaques do mercado ${market} que não estão arquivados.`,
    pickerEmpty: 'Nenhum destaque na biblioteca deste mercado. Use Enviar nova imagem.',
    currentLabel: 'Destaque atual',
    currentAria: (asset) => `${asset.originalFilename} já é o destaque`,
  },
  plan: {
    linkSuffix: '/plan-image',
    check: checkRecipePlanImage,
    stored: (content) => ({ url: content.planImageUrl ?? null, assetId: content.planImageAssetId ?? null }),
    title: 'Miniatura do plano',
    description: `Embalagem no seletor de sabores da tela Plano. PNG, JPEG ou WebP quadrado com ${PLAN_SIZES_TEXT} e até 5 MB. Toda miniatura fica guardada na Biblioteca de imagens. Opcional: sem ela, o plano usa a imagem da tela inicial.`,
    wrapperClass: 'recipe-image recipe-plan-image',
    previewClass: 'recipe-plan-preview',
    thumbClass: 'media-thumb',
    storedAlt: 'Miniatura cadastrada do plano',
    pendingAlt: 'Prévia da nova miniatura',
    empty: 'Sem miniatura. O plano usa a imagem da tela inicial.',
    pendingText: (image) => `Nova miniatura: ${image.fileName} · ${image.sizeText}. Ainda não foi salva.`,
    linkedText: 'Miniatura vinculada da Biblioteca de imagens.',
    unlinkedText: 'Nenhuma miniatura vinculada.',
    pickLabel: 'Escolher da biblioteca',
    uploadLabel: 'Enviar nova',
    inputId: 'recipe-plan-image-file',
    saveLabel: 'Salvar miniatura',
    unlinkLabel: 'Desvincular miniatura',
    unlinkConfirm: 'Desvincular a miniatura? A imagem sai do card do plano e continua na Biblioteca de imagens.',
    unlinkHint: 'Desvincular só tira a imagem do card. Ela continua na',
    savedText: 'Miniatura salva e guardada na Biblioteca de imagens. A tela Plano passa a usar esta imagem.',
    pickedText: (asset) => `Miniatura ${asset.originalFilename} vinculada. A tela Plano passa a usar esta imagem.`,
    unlinkedNotice: 'Miniatura desvinculada. A tela Plano volta a usar a imagem da tela inicial, e a imagem continua na Biblioteca de imagens.',
    saveFailure: 'Falha ao salvar a miniatura.',
    unlinkFailure: 'Falha ao desvincular a miniatura.',
    pickerDescription: (market) => `Miniaturas do mercado ${market} que não estão arquivadas.`,
    pickerEmpty: 'Nenhuma miniatura na biblioteca deste mercado. Use Enviar nova.',
    currentLabel: 'Miniatura atual',
    currentAria: (asset) => `${asset.originalFilename} já é a miniatura`,
  },
}

// A recipe image that is a library image the recipe links to (plan-image-library): the home banner or the plan
// thumbnail. Unlinking keeps the image in the library; archiving only happens there. The banner keeps the API
// refusal to unlink while a variation is active.
export function RecipeLibraryImageSection({ kind, token, market, recipeKey, content, canWrite, onSaved }: {
  kind: MediaKind
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
}) {
  const text = KINDS[kind]
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [library, setLibrary] = useState<{ items: MediaAsset[] | null; error: string }>({ items: null, error: '' })
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
  }, [pendingImage])

  const clearPending = () => {
    setPendingImage(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const chooseImage = async (file: File | undefined) => {
    if (!file) return
    setNotice(null)
    const check = await text.check(file)
    if (!check.ok) {
      clearPending()
      setNotice({ tone: 'error', text: check.message })
      return
    }
    try {
      const payload = await fileToImagePayload(file)
      setPendingImage({ payload, previewUrl: URL.createObjectURL(file), fileName: file.name, sizeText: `${check.width} × ${check.height} px` })
    } catch (readError) {
      clearPending()
      setNotice({ tone: 'error', text: readError instanceof Error ? readError.message : 'Falha ao ler a imagem.' })
    }
  }

  const link = async (body: Record<string, unknown>, success: string) => {
    if (!token || saving) return false
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, text.linkSuffix), { token, method: 'PUT', body })
      onSaved(saved)
      setNotice({ tone: 'success', text: success })
      return true
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, text.saveFailure) })
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveImage = async () => {
    if (!pendingImage) return
    const saved = await link({ ...pendingImage.payload, originalFilename: pendingImage.fileName }, text.savedText)
    if (saved) clearPending()
  }

  const openPicker = async () => {
    if (!token) return
    setNotice(null)
    setPickerOpen(true)
    setLibrary({ items: null, error: '' })
    try {
      const response = await apiRequest<{ items: MediaAsset[] }>(mediaListPath(market, { kind }), { token })
      setLibrary({ items: response.items, error: '' })
    } catch (requestError) {
      setLibrary({ items: null, error: mediaFailure(requestError, 'Falha ao carregar a biblioteca.') })
    }
  }

  const pickAsset = async (asset: MediaAsset) => {
    const saved = await link({ assetId: asset.id }, text.pickedText(asset))
    if (saved) setPickerOpen(false)
  }

  const unlinkImage = async () => {
    if (!token || saving) return
    if (!window.confirm(text.unlinkConfirm)) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, text.linkSuffix), { token, method: 'DELETE' })
      onSaved(saved)
      setNotice({ tone: 'success', text: text.unlinkedNotice })
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, text.unlinkFailure) })
    } finally {
      setSaving(false)
    }
  }

  const stored = text.stored(content)
  const previewUrl = pendingImage?.previewUrl ?? stored.url

  return (
    <Section title={text.title} description={text.description}>
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      ) : null}
      <div className={text.wrapperClass}>
        {previewUrl ? (
          <img className={text.previewClass} src={previewUrl} alt={pendingImage ? text.pendingAlt : text.storedAlt} />
        ) : (
          <div className={`${text.previewClass} recipe-banner-empty`}>{text.empty}</div>
        )}
        <div className="recipe-image-side">
          <p className="field-hint">
            {pendingImage ? text.pendingText(pendingImage) : stored.url ? text.linkedText : text.unlinkedText}
          </p>
          {canWrite ? (
            <div className="inline-actions">
              <button className="ghost-button" type="button" disabled={saving} onClick={() => void openPicker()}>
                {text.pickLabel}
              </button>
              <input
                ref={fileInput}
                id={text.inputId}
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void chooseImage(event.target.files?.[0])}
              />
              <label className="ghost-button" htmlFor={text.inputId}>{text.uploadLabel}</label>
              {pendingImage ? (
                <>
                  <button className="primary-button" type="button" disabled={saving} onClick={() => void saveImage()}>
                    {saving ? 'Salvando…' : text.saveLabel}
                  </button>
                  <button className="ghost-button" type="button" disabled={saving} onClick={clearPending}>
                    Descartar
                  </button>
                </>
              ) : null}
              {!pendingImage && stored.url ? (
                <button className="ghost-button" type="button" disabled={saving} onClick={() => void unlinkImage()}>
                  {text.unlinkLabel}
                </button>
              ) : null}
            </div>
          ) : null}
          {!pendingImage && stored.url && canWrite ? (
            <p className="field-hint">
              {text.unlinkHint}{' '}
              <Link to={`/catalog/media?market=${encodeURIComponent(market)}${kind === 'plan' ? '&kind=plan' : ''}`}>Biblioteca de imagens</Link>.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog
        open={pickerOpen}
        title={text.pickLabel}
        description={text.pickerDescription(market)}
        onClose={() => { if (!saving) setPickerOpen(false) }}
        footer={<button className="ghost-button" type="button" disabled={saving} onClick={() => setPickerOpen(false)}>Fechar</button>}
      >
        {library.error ? <div className="alert" role="alert">{library.error}</div> : null}
        {library.items === null && !library.error ? <p className="muted">Carregando a biblioteca.</p> : null}
        {library.items && library.items.length === 0 ? <p className="muted">{text.pickerEmpty}</p> : null}
        <ul className="media-grid">
          {(library.items ?? []).map((asset) => {
            const current = asset.id === stored.assetId
            return (
              <li key={asset.id} className="media-card">
                <img className={text.thumbClass} src={asset.url} alt={asset.originalFilename} />
                <div className="cell-stack">
                  <span className="media-name">{asset.originalFilename}</span>
                  {asset.usedBy.length > 0 ? <span className="cell-meta">Em uso por {usedByText(asset.usedBy)}</span> : null}
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={saving || current}
                  aria-label={current ? text.currentAria(asset) : `Usar ${asset.originalFilename}`}
                  onClick={() => void pickAsset(asset)}
                >
                  {current ? text.currentLabel : 'Usar esta'}
                </button>
              </li>
            )
          })}
        </ul>
      </Dialog>
    </Section>
  )
}
