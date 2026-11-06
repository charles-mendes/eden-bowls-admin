import { OtherMarketNotice } from '../components/OtherMarketNotice'
import { isOutsideMarket } from '../lib/markets'
import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import {
  NFE_NEEDS_ACTION,
  NFE_STATUS_OPTIONS,
  blingSituacaoTone,
  formatNfeAmount,
  formatNfeDate,
  formatNfeNumber,
  formatTaxDocument,
  nfeStatusLabel,
  nfeStatusTone,
  isNfeListStatus,
  nfeApiStatus,
  nfeListHref,
  type BlingConnection,
  type NfeListFilters,
  type NfeListResponse,
} from '../lib/nfe'

const OAUTH_MESSAGES: Record<string, string> = {
  connected: 'Bling autorizado.',
  invalid: 'A autorização do Bling expirou ou não confere. Tente de novo.',
  failed: 'O Bling recusou a autorização. Tente de novo em instantes.',
}

// The API reads Bling every 5 minutes. The page only has to pick that up without a reload.
const LIST_REFRESH_MS = 60 * 1000

export function NfeListPage() {
  const { token, hasPermission, user } = useAuth()
  const otherMarket = isOutsideMarket(user, 'BR')
  // Wait for the session: its markets decide whether this screen loads at all.
  const sessionReady = Boolean(user)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState<NfeListResponse['data'] | null>(null)
  const [connection, setConnection] = useState<BlingConnection | null>(null)
  // Filters live in the URL, so a link opens the list filtered and going back from a note keeps them.
  const status = isNfeListStatus(searchParams.get('status')) ? String(searchParams.get('status')) : ''
  const from = searchParams.get('de') ?? ''
  const to = searchParams.get('ate') ?? ''
  const search = searchParams.get('busca') ?? ''
  const page = Math.max(1, Number(searchParams.get('pagina')) || 1)
  const [searchDraft, setSearchDraft] = useState(search)
  const setFilters = (next: NfeListFilters) => {
    const merged = { status, de: from, ate: to, busca: search, pagina: page, ...next }
    setSearchParams(new URLSearchParams(nfeListHref(merged).split('?')[1] ?? ''), { replace: true })
  }
  const setPage = (update: number | ((current: number) => number)) => {
    setFilters({ pagina: typeof update === 'function' ? update(page) : update })
  }
  const [error, setError] = useState('')
  const [authorizing, setAuthorizing] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const oauthMessage = OAUTH_MESSAGES[searchParams.get('bling') || '']

  useEffect(() => {
    if (!token || !sessionReady || otherMarket) return
    let active = true
    setError('')
    apiRequest<NfeListResponse>(`/admin/nfe${buildQueryString({
      status: status ? nfeApiStatus(status) : undefined,
      from: from || undefined,
      to: to || undefined,
      search: search || undefined,
      page,
    })}`, { token })
      .then((response) => { if (active) setData(response.data) })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar notas fiscais')
      })
    return () => { active = false }
  }, [token, status, from, to, search, page, refreshTick, sessionReady, otherMarket])

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshTick((current) => current + 1), LIST_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!token || !sessionReady || otherMarket) return
    apiRequest<{ success: boolean; data: BlingConnection }>('/admin/bling/connection', { token })
      .then((response) => setConnection(response.data))
      .catch(() => setConnection(null))
  }, [token, sessionReady, otherMarket])

  // The row is a shortcut for the mouse. The link inside it stays the way in for keyboard and screen readers.
  const openNote = (event: MouseEvent<HTMLTableRowElement>, id: number) => {
    if ((event.target as HTMLElement).closest('a, button')) return
    if (window.getSelection()?.toString()) return
    navigate(`/operations/nfe/${id}`)
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setFilters({ busca: searchDraft.trim(), pagina: 1 })
  }

  // The API builds the link with its state; the browser goes to Bling and the panel never talks to it.
  const authorizeBling = async () => {
    if (!token) return
    try {
      setAuthorizing(true)
      const response = await apiRequest<{ success: boolean; data: { authorize_url: string } }>('/admin/bling/connection/authorize', { token, method: 'POST' })
      window.location.assign(response.data.authorize_url)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao iniciar a autorização')
      setAuthorizing(false)
    }
  }

  if (otherMarket) return <OtherMarketNotice title="Notas fiscais" market="BR" />

  return (
    <PageFrame
      eyebrow="Operação"
      title="Notas fiscais"
      description="NF-e emitidas pelo Bling para as cobranças pagas no Brasil. As faturas EB- ficam no detalhe do assinante."
    >
      {oauthMessage ? <p className="muted">{oauthMessage}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {connection && !connection.connected ? (
        <Section
          title="Conexão com o Bling"
          description={connection.configured
            ? 'O Bling não está autorizado. As notas ficam pendentes até a autorização.'
            : 'As credenciais do Bling não estão configuradas neste ambiente. Nenhuma nota é emitida.'}
          actions={connection.configured && hasPermission('bling.connect') ? (
            <button className="primary-button" type="button" disabled={authorizing} onClick={() => void authorizeBling()}>Autorizar Bling</button>
          ) : undefined}
        >
          <span className="badge-warning">Sem conexão</span>
        </Section>
      ) : null}

      <FiltersBar className="nfe-filters">
        <label>
          Status
          <select value={status} onChange={(event) => setFilters({ status: event.target.value, pagina: 1 })}>
            <option value="">Todos</option>
            <option value={NFE_NEEDS_ACTION}>Precisam de ação</option>
            {NFE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          De
          <input type="date" value={from} onChange={(event) => setFilters({ de: event.target.value, pagina: 1 })} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(event) => setFilters({ ate: event.target.value, pagina: 1 })} />
        </label>
        <form className="nfe-search" onSubmit={submitSearch}>
          <label>
            Busca
            <input
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Nome, e-mail, documento, número ou chave"
            />
          </label>
          <button className="ghost-button" type="submit">Buscar</button>
        </form>
      </FiltersBar>

      <Section title="Notas" description={`Total: ${data?.total ?? '—'}. O status do Bling é atualizado a cada 5 minutos.`}>
        <div className="nfe-table-shell">
          <table className="nfe-table">
            <thead>
              <tr>
                <th className="nfe-col-status">Status</th>
                <th className="nfe-col-status">Bling</th>
                <th>Cliente</th>
                <th className="nfe-col-value">Valor</th>
                <th className="nfe-col-number">Número/série</th>
                <th className="nfe-col-date">Data</th>
                <th className="nfe-col-error">Erro</th>
                <th className="nfe-col-open"><span className="visually-hidden">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {!data && !error ? (
                <tr><td className="nfe-empty" colSpan={8}>Carregando notas...</td></tr>
              ) : null}
              {data && data.items.length === 0 ? (
                <tr><td className="nfe-empty" colSpan={8}>Nenhuma nota encontrada.</td></tr>
              ) : null}
              {data?.items.map((item) => (
                <tr key={item.id} className="nfe-row" onClick={(event) => openNote(event, item.id)}>
                  <td data-label="Status"><span className={nfeStatusTone(item.status)}>{nfeStatusLabel(item.status)}</span></td>
                  <td data-label="Bling">
                    {item.bling_situacao_label
                      ? <span className={blingSituacaoTone(item.bling_situacao)}>{item.bling_situacao_label}</span>
                      : '—'}
                    {item.imported ? <div className="muted nfe-origin">Criada no Bling</div> : null}
                  </td>
                  <td className="nfe-cell-customer">
                    <Link className="table-link" to={`/operations/nfe/${item.id}`}>{item.customer_name || `Nota ${item.id}`}</Link>
                    <div className="muted nfe-line" title={item.customer_email || undefined}>{item.customer_email || ''}</div>
                    <div className="muted nfe-line">{formatTaxDocument(item.customer_document)}</div>
                  </td>
                  <td data-label="Valor">{formatNfeAmount(item)}</td>
                  <td data-label="Número/série">{formatNfeNumber(item)}</td>
                  <td data-label="Data">{formatNfeDate(item.created_at)}</td>
                  <td data-label="Erro"><span className="nfe-error" title={item.last_error || undefined}>{item.last_error || '—'}</span></td>
                  <td className="nfe-cell-open">
                    <Link className="nfe-open" to={`/operations/nfe/${item.id}`} aria-label={`Ver detalhes da nota de ${item.customer_name || item.id}`}>
                      <span>Detalhes</span> <span aria-hidden="true">›</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
