import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatCountry, formatDate, formatFeedbackCategory } from '../lib/format'
import { type FeedbackItem, type FeedbacksResponse } from '../lib/feedbacks'

function FilterClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button type="button" className="filter-clear" aria-label={label} onClick={onClear}>
      ×
    </button>
  )
}

export function FeedbacksPage() {
  const { token, hasPermission } = useAuth()
  const [data, setData] = useState<FeedbacksResponse | null>(null)
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const canWrite = hasPermission('feedbacks.write')

  const load = async () => {
    if (!token) return
    setError('')
    try {
      const response = await apiRequest<FeedbacksResponse>(`/admin/feedbacks${buildQueryString({
        search: search || undefined,
        country: country || undefined,
        active: status === '' ? undefined : status,
        page,
        perPage,
      })}`, { token })
      setData(response)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar feedbacks')
    }
  }

  useEffect(() => {
    void load()
  }, [token, search, country, status, page, perPage])

  const deleteFeedback = async (item: FeedbackItem) => {
    if (!token || !canWrite) return
    const confirmed = window.confirm(`Excluir o feedback de "${item.name}"? Essa ação não pode ser desfeita.`)
    if (!confirmed) return

    try {
      setBusyId(item.id)
      setError('')
      await apiRequest(`/admin/feedbacks/${item.id}`, { token, method: 'DELETE' })
      setMessage(`Feedback de ${item.name} excluído.`)
      await load()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao excluir feedback')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <PageFrame
      title="Feedbacks"
      description="Depoimentos publicados na loja, filtrados por país da versão do ecommerce."
      actions={canWrite ? <Link className="primary-button" to="/feedbacks/new">Novo feedback</Link> : null}
    >
      {error ? <div className="alert">{error}</div> : null}
      {message ? <div className="success">{message}</div> : null}

      <Section title="Filtros" description="A lista abre sem filtro. Recorte por país, status ou nome.">
        <FiltersBar>
          <label>
            Busca
            <span className="filter-field">
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1) }}
                placeholder="nome do cliente"
              />
              {search ? (
                <FilterClearButton label="Limpar busca" onClear={() => { setSearch(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            País
            <span className="filter-field">
              <select
                aria-label="País"
                value={country}
                onChange={(event) => { setCountry(event.target.value); setPage(1) }}
              >
                <option value="">Todos</option>
                <option value="BR">Brasil</option>
                <option value="US">Estados Unidos</option>
              </select>
              {country ? (
                <FilterClearButton label="Limpar país" onClear={() => { setCountry(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Status
            <span className="filter-field">
              <select
                aria-label="Status"
                value={status}
                onChange={(event) => { setStatus(event.target.value); setPage(1) }}
              >
                <option value="">Todos</option>
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
              {status ? (
                <FilterClearButton label="Limpar status" onClear={() => { setStatus(''); setPage(1) }} />
              ) : null}
            </span>
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>
      </Section>

      <Section title="Feedbacks cadastrados" description={`Total: ${data?.total ?? '—'}`}>
        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>Foto</th>
                <th>Nome</th>
                <th>Categoria</th>
                <th>País</th>
                <th>Lugar</th>
                <th>Comentário</th>
                <th>Status</th>
                <th>Data</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.photo ? (
                      <img className="table-thumb" src={item.photo} alt="" />
                    ) : (
                      <span className="photo-placeholder" aria-hidden="true" />
                    )}
                  </td>
                  <td>
                    <Link className="table-link" to={`/feedbacks/${item.id}`}>{item.name}</Link>
                  </td>
                  <td>{formatFeedbackCategory(item.category)}</td>
                  <td>{formatCountry(item.country)}</td>
                  <td>{item.place || '—'}</td>
                  <td className="table-clip" title={item.comment}>{item.comment}</td>
                  <td>
                    <span className={item.active ? 'badge-success' : 'badge-warning'}>
                      {item.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="table-actions">
                      <Link
                        className="ghost-button"
                        to={`/feedbacks/${item.id}`}
                        aria-label={canWrite ? `Editar feedback ${item.name}` : `Ver feedback ${item.name}`}
                      >
                        {canWrite ? 'Editar' : 'Ver'}
                      </Link>
                      {canWrite ? (
                        <button
                          className="danger-button"
                          type="button"
                          aria-label={`Excluir feedback ${item.name}`}
                          disabled={busyId === item.id}
                          onClick={() => void deleteFeedback(item)}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
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
