import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
import { formatDate } from '../lib/format'
import {
  formatPrivacyIdentity,
  formatPrivacyStatus,
  formatPrivacyType,
  isTerminalPrivacyStatus,
  needsIdentityToComplete,
  type PrivacyRequestItem,
} from '../lib/privacy'

export function PrivacyRequestDetailPage() {
  const { id } = useParams()
  const { token, hasPermission } = useAuth()
  const canWrite = hasPermission('privacy.requests.write')
  const [item, setItem] = useState<PrivacyRequestItem | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [note, setNote] = useState('')
  const [extendReason, setExtendReason] = useState('')
  const [busy, setBusy] = useState('')

  const load = async () => {
    if (!token || !id) return
    try {
      setError('')
      const response = await apiRequest<PrivacyRequestItem>(`/admin/privacy/requests/${id}`, { token })
      setItem(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar solicitação')
    }
  }

  useEffect(() => {
    void load()
  }, [token, id])

  const runAction = async (action: string, path: string, body?: unknown) => {
    if (!token || !id || !canWrite) return
    try {
      setBusy(action)
      setError('')
      const response = await apiRequest<PrivacyRequestItem | { sent?: boolean; to?: string }>(path, {
        token,
        method: 'POST',
        body,
      })
      if (action === 'verify-email') {
        setMessage(`Verificação enviada para ${(response as { to?: string }).to || 'o e-mail da conta'}.`)
        await load()
      } else {
        setItem(response as PrivacyRequestItem)
        setMessage('Solicitação atualizada.')
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao atualizar solicitação')
    } finally {
      setBusy('')
    }
  }

  const downloadPackage = async () => {
    if (!token || !id) return
    try {
      setError('')
      const pack = await apiRequest<unknown>(`/admin/privacy/requests/${id}/export`, { token })
      const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `privacy-${id}.json`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao baixar o pacote')
    }
  }

  const completeBlocked = Boolean(item && needsIdentityToComplete(item))
  const closed = isTerminalPrivacyStatus(item?.status)

  const onComplete = (event: FormEvent) => {
    event.preventDefault()
    void runAction('complete', `/admin/privacy/requests/${id}/complete`, { note: note || undefined })
  }

  const onExtend = (event: FormEvent) => {
    event.preventDefault()
    void runAction('extend', `/admin/privacy/requests/${id}/extend`, { reason: extendReason })
  }

  return (
    <PageFrame
      title={item ? `Solicitação #${item.id}` : 'Solicitação'}
      description="Concluir acesso, exclusão ou portabilidade exige identidade verificada."
      actions={<Link className="ghost-button" to="/privacy/requests">Voltar</Link>}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Resumo">
        <p>{formatPrivacyType(item?.type)} · <span className={item?.status === 'completed' ? 'badge-success' : 'badge-warning'}>{formatPrivacyStatus(item?.status)}</span></p>
        <p className="muted">Mercado {item?.market || '—'} · canal {item?.channel === 'email' ? 'e-mail' : 'app'}</p>
        <p>Prazo: {formatDate(item?.dueAt)} {item?.overdue ? <span className="badge-warning">Atrasado</span> : null}</p>
        <p>Identidade: {formatPrivacyIdentity(item?.identityStatus)}</p>
        {item?.userId ? <p><Link className="table-link" to={`/users/${item.userId}`}>Cliente #{item.userId}</Link></p> : <p className="muted">Sem user_id vinculado.</p>}
        {item?.resultNote ? <p>Nota: {item.resultNote}</p> : null}
        {item?.extensionReason ? <p className="muted">Prorrogação: {item.extensionReason}</p> : null}
      </Section>

      {canWrite && !closed ? (
        <Section title="Ações" description="Uma prorrogação por pedido. Completar acesso/exclusão/portabilidade fica bloqueado enquanto a identidade estiver unverified.">
          <div className="inline-actions">
            <button
              className="ghost-button"
              type="button"
              disabled={busy !== '' || item?.status === 'in_progress'}
              onClick={() => void runAction('progress', `/admin/privacy/requests/${id}/in-progress`)}
            >
              Em andamento
            </button>
            {item?.identityStatus === 'unverified' && item.userId ? (
              <>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={busy !== ''}
                  onClick={() => void runAction('verify-email', `/admin/privacy/requests/${id}/send-verification`)}
                >
                  Enviar verificação ao e-mail da conta
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  disabled={busy !== ''}
                  onClick={() => void runAction('verify-mark', `/admin/privacy/requests/${id}/verify-identity`)}
                >
                  Marcar identidade verificada
                </button>
              </>
            ) : null}
            {(item?.type === 'access' || item?.type === 'portability') && !completeBlocked ? (
              <button className="ghost-button" type="button" onClick={() => void downloadPackage()}>
                Baixar pacote
              </button>
            ) : null}
          </div>

          <form className="stack" onSubmit={onExtend}>
            <label>
              Motivo da prorrogação
              <input
                value={extendReason}
                onChange={(event) => setExtendReason(event.target.value)}
                disabled={Boolean(item?.extendedAt)}
                placeholder="obrigatório para prorrogar uma vez"
              />
            </label>
            <button className="ghost-button" type="submit" disabled={busy !== '' || Boolean(item?.extendedAt) || extendReason.trim().length < 3}>
              Prorrogar uma vez
            </button>
          </form>

          <form className="stack" onSubmit={onComplete}>
            <label>
              Nota
              <textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            <div className="inline-actions">
              <button
                className="primary-button"
                type="submit"
                disabled={busy !== '' || completeBlocked}
              >
                Concluir
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={busy !== ''}
                onClick={() => void runAction('reject', `/admin/privacy/requests/${id}/reject`, { note: note || undefined })}
              >
                Recusar
              </button>
            </div>
            {completeBlocked ? (
              <p className="muted">Não é possível concluir acesso, exclusão ou portabilidade sem verificar a identidade.</p>
            ) : null}
          </form>
        </Section>
      ) : (
        <Section title="Pacote">
          {(item?.type === 'access' || item?.type === 'portability') && !completeBlocked ? (
            <button className="ghost-button" type="button" onClick={() => void downloadPackage()}>
              Baixar pacote
            </button>
          ) : (
            <p className="muted">Somente leitura. Mutações ficam ocultas sem permissão de escrita.</p>
          )}
        </Section>
      )}
    </PageFrame>
  )
}
