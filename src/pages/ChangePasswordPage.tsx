import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { getPostLoginPath } from '../lib/roles'

export function ChangePasswordPage() {
  const { token, user, reloadUser } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token) return
    setSaving(true)
    setError('')

    try {
      await apiRequest('/admin/me/password', {
        token,
        method: 'POST',
        body: { currentPassword, newPassword, confirmPassword },
      })
      const nextUser = await reloadUser()
      navigate(getPostLoginPath(nextUser?.roles ?? user?.roles ?? [], '/dashboard'), { replace: true })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao alterar a senha')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageFrame
      title="Definir senha"
      description="Troque a senha temporária antes de usar o restante do painel. Depois disso a conta passa de Pendente para Ativa."
    >
      <Section title="Primeiro acesso" description="Use a senha recebida no e-mail de convite.">
        {error ? <div className="alert">{error}</div> : null}
        <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            Senha temporária
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label>
            Nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label>
            Confirmar nova senha
            <input
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </label>
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar senha'}
          </button>
        </form>
      </Section>
    </PageFrame>
  )
}
