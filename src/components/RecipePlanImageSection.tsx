import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from './Dialog'
import { Section } from './Section'
import { apiRequest } from '../lib/api'
import { RECIPE_PLAN_IMAGE_SIZES, checkRecipePlanImage, fileToImagePayload, type ImagePayload } from '../lib/imageUpload'
import { mediaFailure, mediaListPath, usedByText, type MediaAsset } from '../lib/mediaLibrary'
import { recipeContentPath, type RecipeContent } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type PendingImage = { payload: ImagePayload; previewUrl: string; fileName: string; sizeText: string }

const SIZES_TEXT = RECIPE_PLAN_IMAGE_SIZES.map((side) => `${side} × ${side} px`).join(' ou ')

// Package thumbnail of the plan flavor picker, apart from the home banner: a library image the recipe links to
// (plan-image-library). Optional: without it the plan shows the banner image. Unlinking keeps the image in the
// library; archiving only happens there.
export function RecipePlanImageSection({ token, market, recipeKey, content, canWrite, onSaved }: {
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
}) {
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
    const check = await checkRecipePlanImage(file)
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
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/plan-image'), { token, method: 'PUT', body })
      onSaved(saved)
      setNotice({ tone: 'success', text: success })
      return true
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, 'Falha ao salvar a miniatura.') })
      return false
    } finally {
      setSaving(false)
    }
  }

  const saveImage = async () => {
    if (!pendingImage) return
    const saved = await link(
      { ...pendingImage.payload, originalFilename: pendingImage.fileName },
      'Miniatura salva e guardada na Biblioteca de imagens. A tela Plano passa a usar esta imagem.',
    )
    if (saved) clearPending()
  }

  const openPicker = async () => {
    if (!token) return
    setNotice(null)
    setPickerOpen(true)
    setLibrary({ items: null, error: '' })
    try {
      const response = await apiRequest<{ items: MediaAsset[] }>(mediaListPath(market), { token })
      setLibrary({ items: response.items, error: '' })
    } catch (requestError) {
      setLibrary({ items: null, error: mediaFailure(requestError, 'Falha ao carregar a biblioteca.') })
    }
  }

  const pickAsset = async (asset: MediaAsset) => {
    const saved = await link({ assetId: asset.id }, `Miniatura ${asset.originalFilename} vinculada. A tela Plano passa a usar esta imagem.`)
    if (saved) setPickerOpen(false)
  }

  const unlinkImage = async () => {
    if (!token || saving) return
    if (!window.confirm('Desvincular a miniatura? A imagem sai do card do plano e continua na Biblioteca de imagens.')) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/plan-image'), { token, method: 'DELETE' })
      onSaved(saved)
      setNotice({ tone: 'success', text: 'Miniatura desvinculada. A tela Plano volta a usar a imagem da tela inicial, e a imagem continua na Biblioteca de imagens.' })
    } catch (requestError) {
      setNotice({ tone: 'error', text: mediaFailure(requestError, 'Falha ao desvincular a miniatura.') })
    } finally {
      setSaving(false)
    }
  }

  const stored = content.planImageUrl ?? null
  const previewUrl = pendingImage?.previewUrl ?? stored

  return (
    <Section
      title="Miniatura do plano"
      description={`Embalagem no seletor de sabores da tela Plano. PNG, JPEG ou WebP quadrado com ${SIZES_TEXT} e até 5 MB. Toda miniatura fica guardada na Biblioteca de imagens. Opcional: sem ela, o plano usa a imagem da tela inicial.`}
    >
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
        </div>
      ) : null}
      <div className="recipe-image recipe-plan-image">
        {previewUrl ? (
          <img
            className="recipe-plan-preview"
            src={previewUrl}
            alt={pendingImage ? 'Prévia da nova miniatura' : 'Miniatura cadastrada do plano'}
          />
        ) : (
          <div className="recipe-plan-preview recipe-banner-empty">
            Sem miniatura. O plano usa a imagem da tela inicial.
          </div>
        )}
        <div className="recipe-image-side">
          <p className="field-hint">
            {pendingImage
              ? `Nova miniatura: ${pendingImage.fileName} · ${pendingImage.sizeText}. Ainda não foi salva.`
              : stored ? 'Miniatura vinculada da Biblioteca de imagens.' : 'Nenhuma miniatura vinculada.'}
          </p>
          {canWrite ? (
            <div className="inline-actions">
              <button className="ghost-button" type="button" disabled={saving} onClick={() => void openPicker()}>
                Escolher da biblioteca
              </button>
              <input
                ref={fileInput}
                id="recipe-plan-image-file"
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void chooseImage(event.target.files?.[0])}
              />
              <label className="ghost-button" htmlFor="recipe-plan-image-file">Enviar nova</label>
              {pendingImage ? (
                <>
                  <button className="primary-button" type="button" disabled={saving} onClick={() => void saveImage()}>
                    {saving ? 'Salvando…' : 'Salvar miniatura'}
                  </button>
                  <button className="ghost-button" type="button" disabled={saving} onClick={clearPending}>
                    Descartar
                  </button>
                </>
              ) : null}
              {!pendingImage && stored ? (
                <button className="ghost-button" type="button" disabled={saving} onClick={() => void unlinkImage()}>
                  Desvincular miniatura
                </button>
              ) : null}
            </div>
          ) : null}
          {!pendingImage && stored && canWrite ? (
            <p className="field-hint">
              Desvincular só tira a imagem do card. Ela continua na{' '}
              <Link to={`/catalog/media?market=${encodeURIComponent(market)}`}>Biblioteca de imagens</Link>.
            </p>
          ) : null}
        </div>
      </div>

      <Dialog
        open={pickerOpen}
        title="Escolher da biblioteca"
        description={`Miniaturas do mercado ${market} que não estão arquivadas.`}
        onClose={() => { if (!saving) setPickerOpen(false) }}
        footer={<button className="ghost-button" type="button" disabled={saving} onClick={() => setPickerOpen(false)}>Fechar</button>}
      >
        {library.error ? <div className="alert" role="alert">{library.error}</div> : null}
        {library.items === null && !library.error ? <p className="muted">Carregando a biblioteca.</p> : null}
        {library.items && library.items.length === 0 ? (
          <p className="muted">Nenhuma miniatura na biblioteca deste mercado. Use Enviar nova.</p>
        ) : null}
        <ul className="media-grid">
          {(library.items ?? []).map((asset) => {
            const current = asset.id === content.planImageAssetId
            return (
              <li key={asset.id} className="media-card">
                <img className="media-thumb" src={asset.url} alt={asset.originalFilename} />
                <div className="cell-stack">
                  <span className="media-name">{asset.originalFilename}</span>
                  {asset.usedBy.length > 0 ? <span className="cell-meta">Em uso por {usedByText(asset.usedBy)}</span> : null}
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={saving || current}
                  aria-label={current ? `${asset.originalFilename} já é a miniatura` : `Usar ${asset.originalFilename}`}
                  onClick={() => void pickAsset(asset)}
                >
                  {current ? 'Miniatura atual' : 'Usar esta'}
                </button>
              </li>
            )
          })}
        </ul>
      </Dialog>
    </Section>
  )
}
