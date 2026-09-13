import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import {
  formatPrivacyIdentity,
  formatPrivacyStatus,
  formatPrivacyType,
  type PrivacyRequestType,
  type PrivacyRequestsResponse,
} from '../lib/privacy'

function FilterClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="filter-clear" aria-label={label} onClick={onClear}>
      ×
    </button>
  )
}

export function PrivacyRequestsPage() {
  const { token, hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const initialUserId = searchParams.get('userId') || ''
  const [data, setData] = useState<PrivacyRequestsResponse | null>(null)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [identityStatus, setIdentityStatus] = useState('')
  const [overdue, setOverdue] = useState('')
  const [userId, setUserId] = useState(initialUserId)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [createUserId, setCreateUserId] = useState(initialUserId)
  const [createType, setCreateType] = useState<PrivacyRequestType>('correction')
  const [createMarket, setCreateMarket] = useState('BR')
  const [createNote, setCreateNote] = useState('')
  const [creating, setCreating] = useState(false)
  const canWrite = hasPermission('privacy.requests.write')

  const load = async () => {
    if (!token) return
    setError('')
    try {
      const response = await apiRequest<PrivacyRequestsResponse>(`/admin/privacy/requests${buildQueryString({
        status: status || undefined,
        type: type || undefined,
        identityStatus: identityStatus || undefined,
        overdue: overdue || undefined,
        userId: userId || undefined,
        page,
        perPage,
      })}`, { token })
      setData(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar solicitações')
    }
  }

  useEffect(() => {
    void load()
  }, [token, status, type, identityStatus, overdue, userId, page, perPage])

  const createRequest = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !canWrite) return
    try {
      setCreating(true)
      setError('')
      await apiRequest('/admin/privacy/requests', {
        token,
        method: 'POST',
        body: {
          userId: Number(createUserId),
          type: createType,
          market: createMarket,
          note: createNote || undefined,
        },
      })
      setMessage('Solicitação aberta.')
      setCreateNote('')
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao abrir solicitação')
    } finally {
      setCreating(false)
    }
  }

  return (
    <PageFrame
      title="Privacidade"
      description="Fila DSAR com prazo, identidade e opt-out. Pedidos por e-mail só avançam depois da verificação do titular."
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Filtros" description="Atrasados vêm primeiro. Recorte por status, tipo, identidade ou prazo.">
        <FiltersBar>
          <label>
            Status
            <span className="filter-field">
              <select
                aria-label="Status"
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1) }}
              >
                <option value="">Todos</option>
                <option value="open">Aberto</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Concluído</option>
                <option value="rejected">Recusado</option>
              </select>
              {status ? (
                <FilterClearButton label="Limpar status" onClear={() => { setStatus(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Tipo
            <span className="filter-field">
              <select
                aria-label="Tipo"
                value={type}
                onChange={(event) => { setType(event.target.value); setPage(1) }}
              >
                <option value="">Todos</option>
                <option value="access">Acesso</option>
                <option value="deletion">Exclusão</option>
                <option value="correction">Correção</option>
                <option value="portability">Portabilidade</option>
                <option value="opt_out_share">Opt-out de share</option>
              </select>
              {type ? (
                <FilterClearButton label="Limpar tipo" onClear={() => { setType(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Identidade
            <span className="filter-field">
              <select
                aria-label="Identidade"
                value={identityStatus}
                onChange={(event) => { setIdentityStatus(event.target.value); setPage(1) }}
              >
                <option value="">Todas</option>
                <option value="unverified">Não verificado</option>
                <option value="verified_session">Sessão verificada</option>
                <option value="verified_account_email">E-mail da conta</option>
              </select>
              {identityStatus ? (
                <FilterClearButton label="Limpar identidade" onClear={() => { setIdentityStatus(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Prazo
            <span className="filter-field">
              <select
                aria-label="Atrasado"
                value={overdue}
                onChange={(event) => { setOverdue(event.target.value); setPage(1) }}
              >
                <option value="">Todos</option>
                <option value="true">Atrasado</option>
              </select>
              {overdue ? (
                <FilterClearButton label="Limpar atraso" onClear={() => { setOverdue(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            User ID
            <span className="filter-field">
              <input
                aria-label="User ID"
                value={userId}
                onChange={(event) => { setUserId(event.target.value); setPage(1) }}
                placeholder="id interno"
              />
              {userId ? (
                <FilterClearButton label="Limpar user id" onClear={() => { setUserId(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

      {canWrite ? (
        <Section title="Abrir pedido por e-mail" description="Use só o user_id interno. Identidade começa como não verificada.">
          <form className="form-grid" onSubmit={createRequest}>
            <label>
              User ID
              <input
                required
                value={createUserId}
                onChange={(event) => setCreateUserId(event.target.value)}
                placeholder="77"
              />
            </label>
            <label>
              Tipo
              <select aria-label="Tipo do pedido" value={createType} onChange={(event) => setCreateType(event.target.value as PrivacyRequestType)}>
                <option value="access">Acesso</option>
                <option value="deletion">Exclusão</option>
                <option value="correction">Correção</option>
                <option value="portability">Portabilidade</option>
                <option value="opt_out_share">Opt-out de share</option>
              </select>
            </label>
            <label>
              Mercado
              <select aria-label="Mercado" value={createMarket} onChange={(event) => setCreateMarket(event.target.value)}>
                <option value="BR">Brasil (15 dias)</option>
                <option value="US">EUA (45 dias)</option>
              </select>
            </label>
            <label>
              Nota
              <input value={createNote} onChange={(event) => setCreateNote(event.target.value)} placeholder="origem do e-mail" />
            </label>
            <button className="primary-button" type="submit" disabled={creating}>Abrir solicitação</button>
          </form>
        </Section>
      ) : null}

      <Section title="Solicitações" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Mercado</th>
                <th>Prazo</th>
                <th>Identidade</th>
                <th>Canal</th>
                <th>Atraso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link className="table-link" to={`/privacy/requests/${item.id}`}>#{item.id}</Link>
                  </td>
                  <td>{formatPrivacyType(item.type)}</td>
                  <td>
                    <span className={item.status === 'completed' ? 'badge-success' : item.status === 'rejected' ? 'badge-warning' : 'badge-info'}>
                      {formatPrivacyStatus(item.status)}
                    </span>
                  </td>
                  <td>{item.market || '—'}</td>
                  <td>{formatDate(item.dueAt)}</td>
                  <td>{formatPrivacyIdentity(item.identityStatus)}</td>
                  <td>{item.channel === 'email' ? 'E-mail' : 'App'}</td>
                  <td>
                    {item.overdue ? <span className="badge-warning">Atrasado</span> : '—'}
                  </td>
                  <td>
                    <Link
                      className="ghost-button"
                      to={`/privacy/requests/${item.id}`}
                      aria-label={canWrite ? `Tratar solicitação ${item.id}` : `Ver solicitação ${item.id}`}
                    >
                      {canWrite ? 'Tratar' : 'Ver'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pager
          page={data?.page ?? page}
          totalPages={Math.max(1, data?.totalPages ?? Math.ceil((data?.total ?? 0) / perPage))}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
