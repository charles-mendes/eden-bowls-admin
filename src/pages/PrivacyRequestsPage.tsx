import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Dialog } from '../components/Dialog'
import { InfoHint } from '../components/InfoHint'
import { CustomerSearchField, type CustomerOption } from '../components/CustomerSearchField'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { MarketSelect } from '../components/MarketSelect'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'
import { defaultMarket, hasBothMarkets } from '../lib/markets'
import {
  formatPrivacyIdentity,
  formatPrivacyStatus,
  formatPrivacyType,
  isTerminalPrivacyStatus,
  type PrivacyRequestType,
  type PrivacyRequestsResponse,
} from '../lib/privacy'

// payload.note: the customer reads it in Perfil > Privacidade and can reword it while the request is open.
const NOTE_HELP = 'Opcional. Resuma o que o cliente solicitou no e-mail, por exemplo o dado a corrigir. '
  + 'O cliente vê esta nota no perfil, em Privacidade, e pode editá-la enquanto a solicitação estiver aberta. '
  + 'Não escreva observações internas aqui.'

function FilterClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="filter-clear" aria-label={label} onClick={onClear}>
      ×
    </button>
  )
}

export function PrivacyRequestsPage() {
  const { token, user, hasPermission } = useAuth()
  const bothMarkets = hasBothMarkets(user)
  const [searchParams] = useSearchParams()
  const initialUserId = searchParams.get('userId') || ''
  const [data, setData] = useState<PrivacyRequestsResponse | null>(null)
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [identityStatus, setIdentityStatus] = useState('')
  const [overdue, setOverdue] = useState('')
  const [userId, setUserId] = useState(initialUserId)
  const [filterCustomer, setFilterCustomer] = useState<CustomerOption | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [createCustomer, setCreateCustomer] = useState<CustomerOption | null>(null)
  const [createType, setCreateType] = useState<PrivacyRequestType>('correction')
  const [createMarket, setCreateMarket] = useState('')
  const [createNote, setCreateNote] = useState('')
  const [creating, setCreating] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const canWrite = hasPermission('privacy.requests.write')
  const scopedCreateMarket = bothMarkets ? (createMarket || defaultMarket(user) || 'BR') : (defaultMarket(user) ?? 'BR')

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

  const chooseFilterCustomer = (customer: CustomerOption | null) => {
    setFilterCustomer(customer)
    setUserId(customer ? customer.id : '')
    setPage(1)
  }

  // Coming from the customer screen (?userId=), the filter shows that customer's name instead of the id.
  useEffect(() => {
    if (!token || !initialUserId) return
    let cancelled = false
    apiRequest<CustomerOption>(`/admin/users/${encodeURIComponent(initialUserId)}`, { token })
      .then((customer) => { if (!cancelled) setFilterCustomer(customer) })
      .catch(() => { if (!cancelled) setFilterCustomer({ id: initialUserId, email: '' }) })
    return () => { cancelled = true }
  }, [token, initialUserId])

  const chooseCustomer = (customer: CustomerOption | null) => {
    setCreateCustomer(customer)
    if (bothMarkets && (customer?.country === 'BR' || customer?.country === 'US')) {
      setCreateMarket(customer.country)
    }
  }

  const createRequest = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || !canWrite) return
    if (!createCustomer) {
      setCreateError('Escolha o cliente.')
      return
    }
    try {
      setCreating(true)
      setCreateError('')
      await apiRequest('/admin/privacy/requests', {
        token,
        method: 'POST',
        body: {
          userId: Number(createCustomer.id),
          type: createType,
          market: scopedCreateMarket,
          note: createNote || undefined,
        },
      })
      setMessage('Solicitação registrada.')
      setCreateNote('')
      setCreateOpen(false)
      await load()
    } catch (requestError) {
      setCreateError(requestError instanceof Error ? requestError.message : 'Falha ao abrir solicitação')
    } finally {
      setCreating(false)
    }
  }

  const openCreate = () => {
    setCreateError('')
    setMessage('')
    setCreateOpen(true)
    // The customer in the filter (or the one from the customer screen) comes already chosen.
    if (!createCustomer && filterCustomer) chooseCustomer(filterCustomer)
  }

  const closeCreate = () => {
    if (creating) return
    setCreateOpen(false)
  }

  return (
    <PageFrame
      title="Privacidade"
      description="Solicitações de clientes sobre os próprios dados (acesso, correção, exclusão). Solicitações por e-mail só avançam depois de confirmar a identidade."
      actions={canWrite ? (
        <button className="primary-button" type="button" onClick={openCreate}>Nova solicitação</button>
      ) : null}
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
                <option value="opt_out_share">Não compartilhar dados</option>
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
          <CustomerSearchField
            token={token}
            variant="filter"
            value={filterCustomer}
            onChange={chooseFilterCustomer}
          />
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

      <Dialog
        title="Registrar solicitação recebida por e-mail"
        description="Use quando o cliente fizer a solicitação por e-mail, e não pelo perfil na loja. Busque o cliente pelo nome ou pelo e-mail."
        open={createOpen && canWrite}
        onClose={closeCreate}
        footer={(
          <>
            <button className="ghost-button" type="button" onClick={closeCreate} disabled={creating}>Cancelar</button>
            <button className="primary-button" type="submit" form="privacy-create-form" disabled={creating}>
              {creating ? 'Registrando…' : 'Registrar solicitação'}
            </button>
          </>
        )}
      >
        <form id="privacy-create-form" className="form-grid" onSubmit={createRequest}>
          {createError ? <div className="alert" role="alert">{createError}</div> : null}
          <CustomerSearchField
            token={token}
            value={createCustomer}
            onChange={chooseCustomer}
            disabled={creating}
          />
          <label className="privacy-create-note">
            <span className="label-with-hint">
              Nota
              <InfoHint id="privacy-create-note-help" topic="nota" text={NOTE_HELP} />
            </span>
            <textarea
              rows={2}
              value={createNote}
              aria-describedby="privacy-create-note-help"
              onChange={(event) => setCreateNote(event.target.value)}
              placeholder="Ex.: corrigir o sobrenome para Mendes"
            />
          </label>
          <label>
            Tipo
            <select aria-label="Tipo da solicitação" value={createType} onChange={(event) => setCreateType(event.target.value as PrivacyRequestType)}>
              <option value="access">Acesso</option>
              <option value="deletion">Exclusão</option>
              <option value="correction">Correção</option>
              <option value="portability">Portabilidade</option>
              <option value="opt_out_share">Não compartilhar dados</option>
            </select>
          </label>
          <MarketSelect
            user={user}
            value={scopedCreateMarket}
            onChange={setCreateMarket}
          />
          <p className="muted">{scopedCreateMarket === 'US' ? 'Prazo EUA: 45 dias' : 'Prazo Brasil: 15 dias'}</p>
        </form>
      </Dialog>

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
                    {/* A closed request has nothing left to handle: it only opens to be read. */}
                    {canWrite && !isTerminalPrivacyStatus(item.status) ? (
                      <Link className="ghost-button" to={`/privacy/requests/${item.id}`} aria-label={`Tratar solicitação ${item.id}`}>
                        Tratar
                      </Link>
                    ) : (
                      <Link className="ghost-button" to={`/privacy/requests/${item.id}`} aria-label={`Ver solicitação ${item.id}`}>
                        Ver
                      </Link>
                    )}
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
