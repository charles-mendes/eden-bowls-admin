import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import {
  fileToFeedbackPhoto,
  type FeedbackItem,
  type FeedbackPhotoPayload,
} from '../lib/feedbacks'

type FormState = {
  name: string
  category: 'tutor' | 'tutora'
  country: 'BR' | 'US'
  place: string
  comment: string
  active: boolean
}

const emptyForm: FormState = {
  name: '',
  category: 'tutor',
  country: 'BR',
  place: '',
  comment: '',
  active: true,
}

export function FeedbackFormPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const { token, hasPermission } = useAuth()
  const canWrite = hasPermission('feedbacks.write')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoPayload, setPhotoPayload] = useState<FeedbackPhotoPayload | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!token || isNew) return
    let cancelled = false
    ;(async () => {
      try {
        setError('')
        const item = await apiRequest<FeedbackItem>(`/admin/feedbacks/${id}`, { token })
        if (cancelled) return
        setForm({
          name: item.name,
          category: item.category === 'tutora' ? 'tutora' : 'tutor',
          country: item.country === 'US' ? 'US' : 'BR',
          place: item.place || '',
          comment: item.comment,
          active: item.active,
        })
        setPhotoUrl(item.photo || '')
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar feedback')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, id, isNew])

  const onSelectPhoto = async (file: File | undefined) => {
    if (!file) return
    try {
      setError('')
      const payload = await fileToFeedbackPhoto(file)
      setPhotoPayload(payload)
      setRemovePhoto(false)
      setPhotoUrl(URL.createObjectURL(file))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao ler a imagem')
    }
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !canWrite) return
    const name = form.name.trim()
    const place = form.place.trim()
    const comment = form.comment.trim()
    if (!name || !place || !comment) {
      setError('Nome, lugar e comentário são obrigatórios.')
      return
    }

    const body: Record<string, unknown> = {
      name,
      category: form.category,
      country: form.country,
      place,
      comment,
      active: form.active,
    }
    if (photoPayload) {
      body.photo = photoPayload
    } else if (removePhoto) {
      body.photo = null
    }

    try {
      setSaving(true)
      setError('')
      if (isNew) {
        await apiRequest<FeedbackItem>('/admin/feedbacks', { token, method: 'POST', body })
      } else {
        await apiRequest<FeedbackItem>(`/admin/feedbacks/${id}`, { token, method: 'PATCH', body })
      }
      navigate('/feedbacks')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao salvar feedback')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async () => {
    if (!token || !canWrite || isNew || !id) return
    const nextActive = !form.active
    try {
      setSaving(true)
      setError('')
      setMessage('')
      await apiRequest(`/admin/feedbacks/${id}/active`, {
        token,
        method: 'PATCH',
        body: { active: nextActive },
      })
      setForm((current) => ({ ...current, active: nextActive }))
      setMessage(nextActive ? 'Feedback publicado na loja.' : 'Feedback desativado.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao alterar status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageFrame
      title={isNew ? 'Novo feedback' : 'Editar feedback'}
      description="O depoimento publicado aparece na home da loja do país escolhido."
      actions={(
        <div className="inline-actions">
          {!isNew && canWrite ? (
            <button className="ghost-button" type="button" onClick={() => void toggleActive()} disabled={saving}>
              {form.active ? 'Desativar' : 'Ativar'}
            </button>
          ) : null}
          <Link className="ghost-button" to="/feedbacks">Voltar</Link>
        </div>
      )}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Cadastro" description="Foto, nome, categoria e comentário exibidos no ecommerce.">
        <form className="stack" onSubmit={save}>
          <div className="form-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do cliente"
                required
                disabled={!canWrite}
              />
            </label>
            <label>
              Categoria
              <select
                aria-label="Categoria"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as FormState['category'] }))}
                disabled={!canWrite}
              >
                <option value="tutor">Tutor</option>
                <option value="tutora">Tutora</option>
              </select>
            </label>
            <label>
              País
              <select
                aria-label="País"
                value={form.country}
                onChange={(event) => setForm((current) => ({ ...current, country: event.target.value as FormState['country'] }))}
                disabled={!canWrite}
              >
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
              </select>
            </label>
            <label>
              Lugar
              <input
                value={form.place}
                onChange={(event) => setForm((current) => ({ ...current, place: event.target.value }))}
                placeholder="Nova York, São Paulo"
                required
                disabled={!canWrite}
              />
            </label>
          </div>

          <label>
            Foto
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!canWrite}
              onChange={(event) => void onSelectPhoto(event.target.files?.[0])}
            />
          </label>
          {photoUrl ? (
            <div className="photo-preview-row">
              <img
                className={removePhoto && !photoPayload ? 'photo-preview is-removed' : 'photo-preview'}
                src={photoUrl}
                alt="Pré-visualização da foto"
              />
              {canWrite && !isNew && !photoPayload ? (
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={removePhoto}
                    onChange={(event) => {
                      setRemovePhoto(event.target.checked)
                      if (event.target.checked) {
                        setPhotoPayload(null)
                      }
                    }}
                  />
                  Remover foto atual
                </label>
              ) : null}
            </div>
          ) : null}

          <label>
            Comentário
            <textarea
              rows={5}
              value={form.comment}
              onChange={(event) => setForm((current) => ({ ...current, comment: event.target.value }))}
              required
              disabled={!canWrite}
            />
          </label>

          <label className="boolean-field">
            Status
            <span className="boolean-control">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                disabled={!canWrite}
                aria-label="Ativo"
              />
              <span className="boolean-value">{form.active ? 'Ativo' : 'Inativo'}</span>
            </span>
          </label>

          {canWrite ? (
            <div className="inline-actions">
              <button className="primary-button" type="submit" disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          ) : null}
        </form>
      </Section>
    </PageFrame>
  )
}
