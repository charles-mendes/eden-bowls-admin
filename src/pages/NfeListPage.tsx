import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import {
  NFE_STATUS_OPTIONS,
  formatNfeAmount,
  formatNfeDate,
  formatNfeNumber,
  formatTaxDocument,
  nfeStatusLabel,
  nfeStatusTone,
  type BlingConnection,
  type NfeListResponse,
} from '../lib/nfe'

const OAUTH_MESSAGES: Record<string, string> = {
  connected: 'Bling autorizado.',
  invalid: 'A autorização do Bling expirou ou não confere. Tente de novo.',
  failed: 'O Bling recusou a autorização. Tente de novo em instantes.',
}

export function NfeListPage() {
  const { token, hasPermission } = useAuth()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<NfeListResponse['data'] | null>(null)
  const [connection, setConnection] = useState<BlingConnection | null>(null)
  const [status, setStatus] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [authorizing, setAuthorizing] = useState(false)
  const oauthMessage = OAUTH_MESSAGES[searchParams.get('bling') || '']

  useEffect(() => {
    if (!token) return
    let active = true
    setError('')
    apiRequest<NfeListResponse>(`/admin/nfe${buildQueryString({
      status: status || undefined,
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
  }, [token, status, from, to, search, page])

  useEffect(() => {
    if (!token) return
    apiRequest<{ success: boolean; data: BlingConnection }>('/admin/bling/connection', { token })
      .then((response) => setConnection(response.data))
      .catch(() => setConnection(null))
  }, [token])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    setPage(1)
    setSearch(searchDraft.trim())
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

      <FiltersBar>
        <label>
          Status
          <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value) }}>
            <option value="">Todos</option>
            {NFE_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          De
          <input type="date" value={from} onChange={(event) => { setPage(1); setFrom(event.target.value) }} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(event) => { setPage(1); setTo(event.target.value) }} />
        </label>
        <form onSubmit={submitSearch}>
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

      <Section title="Notas" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Cliente</th>
                <th>Documento</th>
                <th>Valor</th>
                <th>Número/série</th>
                <th>Chave</th>
                <th>Data</th>
                <th>Erro</th>
              </tr>
            </thead>
            <tbody>
              {data && data.items.length === 0 ? (
                <tr><td colSpan={8}>Nenhuma nota encontrada.</td></tr>
              ) : null}
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td><span className={nfeStatusTone(item.status)}>{nfeStatusLabel(item.status)}</span></td>
                  <td>
                    <Link className="table-link" to={`/operations/nfe/${item.id}`}>{item.customer_name || `Nota ${item.id}`}</Link>
                    <div className="muted">{item.customer_email || ''}</div>
                  </td>
                  <td>{formatTaxDocument(item.customer_document)}</td>
                  <td>{formatNfeAmount(item)}</td>
                  <td>{formatNfeNumber(item)}</td>
                  <td>{item.access_key || '—'}</td>
                  <td>{formatNfeDate(item.created_at)}</td>
                  <td>{item.last_error || '—'}</td>
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
