import { useEffect, useRef, useState } from 'react'
import { Section } from './Section'
import { apiRequest } from '../lib/api'
import {
  RECIPE_IMAGE_HEIGHT,
  RECIPE_IMAGE_WIDTH,
  checkRecipeImage,
  fileToImagePayload,
  type ImagePayload,
} from '../lib/imageUpload'
import { recipeContentFailure, recipeContentPath, type RecipeContent } from '../lib/recipeContent'

type Notice = { tone: 'success' | 'error'; text: string } | null

type PendingImage = { payload: ImagePayload; previewUrl: string; fileName: string }

// Home banner of the recipe. A chosen file that is not saved yet is an unsaved change.
export function RecipeImageSection({ token, market, recipeKey, content, canWrite, onSaved, onDirtyChange }: {
  token: string | null
  market: string
  recipeKey: string
  content: RecipeContent
  canWrite: boolean
  onSaved: (content: RecipeContent) => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const dirty = pendingImage != null

  useEffect(() => () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.previewUrl)
  }, [pendingImage])

  useEffect(() => {
    onDirtyChange?.(dirty)
  }, [dirty, onDirtyChange])

  const clearPending = () => {
    setPendingImage(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const chooseImage = async (file: File | undefined) => {
    if (!file) return
    setNotice(null)
    const check = await checkRecipeImage(file)
    if (!check.ok) {
      clearPending()
      setNotice({ tone: 'error', text: check.message })
      return
    }
    try {
      const payload = await fileToImagePayload(file)
      setPendingImage({ payload, previewUrl: URL.createObjectURL(file), fileName: file.name })
    } catch (readError) {
      clearPending()
      setNotice({ tone: 'error', text: readError instanceof Error ? readError.message : 'Falha ao ler a imagem.' })
    }
  }

  const saveImage = async () => {
    if (!token || !pendingImage || !market || saving) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/image'), {
        token,
        method: 'PUT',
        body: pendingImage.payload,
      })
      onSaved(saved)
      clearPending()
      setNotice({ tone: 'success', text: 'Imagem salva. A loja passa a usar esta imagem.' })
    } catch (requestError) {
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao salvar a imagem.') })
    } finally {
      setSaving(false)
    }
  }

  const removeImage = async () => {
    if (!token || !market || saving) return
    const confirmed = window.confirm('Remover a imagem cadastrada? A loja volta a usar a imagem que está no código.')
    if (!confirmed) return
    try {
      setSaving(true)
      const saved = await apiRequest<RecipeContent>(recipeContentPath(recipeKey, market, '/image'), { token, method: 'DELETE' })
      onSaved(saved)
      setNotice({ tone: 'success', text: 'Imagem removida. A loja volta a usar a imagem do código.' })
    } catch (requestError) {
      setNotice({ tone: 'error', text: recipeContentFailure(requestError, 'Falha ao remover a imagem.') })
    } finally {
      setSaving(false)
    }
  }

  const previewUrl = pendingImage?.previewUrl ?? content.imageUrl ?? null

  return (
    <Section
      id="imagem"
      title="Imagem da tela inicial"
      description={`Banner da receita no carrossel da tela inicial e na página da receita. PNG, JPEG ou WebP com exatamente ${RECIPE_IMAGE_WIDTH} × ${RECIPE_IMAGE_HEIGHT} px e até 5 MB.`}
    >
      {notice ? (
        <div className={notice.tone === 'error' ? 'alert' : 'success'} role={notice.tone === 'error' ? 'alert' : 'status'}>
          {notice.text}
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
                  <button className="primary-button" type="button" disabled={saving} onClick={() => void saveImage()}>
                    {saving ? 'Salvando…' : 'Salvar imagem'}
                  </button>
                  <button className="ghost-button" type="button" disabled={saving} onClick={clearPending}>
                    Descartar
                  </button>
                </>
              ) : null}
              {!pendingImage && content.imageUrl ? (
                <button className="danger-button" type="button" disabled={saving} onClick={() => void removeImage()}>
                  Remover imagem
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  )
}
