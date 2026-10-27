import { useEffect, useRef, useState } from 'react'
import { Section } from './Section'
import { apiRequest } from '../lib/api'
import { RECIPE_PLAN_IMAGE_SIZES, checkRecipePlanImage, fileToImagePayload, type ImagePayload } from '../lib/imageUpload'
import { recipeContentFailure, recipeContentPath, type RecipeContent } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type PendingImage = { payload: ImagePayload; previewUrl: string; fileName: string }

const SIZES_TEXT = RECIPE_PLAN_IMAGE_SIZES.map((side) => `${side} × ${side} px`).join(' ou ')

// Package thumbnail of the plan flavor picker, apart from the home banner. Optional: without it the plan
// shows the banner image.
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
      setPendingImage({ payload, previewUrl: URL.createObjectURL(file), fileName: `${file.name} · ${check.width} × ${check.height} px` })
    } catch (readError) {
      clearPending()
      setNotice({ tone: 'error', text: readError instanceof Error ? readError.message : 'Falha ao ler a imagem.' })
    }
  }

  const saveImage = async () => {
    if (!token || !pendingImage || saving) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/plan-image'), {
        token,
        method: 'PUT',
        body: pendingImage.payload,
      })
      onSaved(saved)
      clearPending()
      setNotice({ tone: 'success', text: 'Miniatura salva. A tela Plano passa a usar esta imagem.' })
    } catch (requestError) {
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar a miniatura.') })
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async () => {
    if (!token || saving) return
    if (!window.confirm('Remover a miniatura do plano? A tela Plano volta a usar a imagem da tela inicial.')) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/plan-image'), { token, method: 'DELETE' })
      onSaved(saved)
      setNotice({ tone: 'success', text: 'Miniatura removida. A tela Plano volta a usar a imagem da tela inicial.' })
    } catch (requestError) {
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao remover a miniatura.') })
    } finally {
      setSaving(false)
    }
  }

  const stored = content.planImageUrl ?? null
  const previewUrl = pendingImage?.previewUrl ?? stored

  return (
    <Section
      title="Miniatura do plano"
      description={`Embalagem no seletor de sabores da tela Plano. PNG, JPEG ou WebP quadrado com ${SIZES_TEXT} e até 5 MB. Opcional: sem ela, o plano usa a imagem da tela inicial.`}
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
              ? `Nova miniatura: ${pendingImage.fileName}. Ainda não foi salva.`
              : stored ? 'Miniatura cadastrada no painel.' : 'Nenhuma miniatura cadastrada no painel.'}
          </p>
          {canWrite ? (
            <div className="inline-actions">
              <input
                ref={fileInput}
                id="recipe-plan-image-file"
                className="sr-only"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => void chooseImage(event.target.files?.[0])}
              />
              <label className="ghost-button" htmlFor="recipe-plan-image-file">Escolher miniatura</label>
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
                <button className="danger-button" type="button" disabled={saving} onClick={() => void removeImage()}>
                  Remover miniatura
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  )
}
