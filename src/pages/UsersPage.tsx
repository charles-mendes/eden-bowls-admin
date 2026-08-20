import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest, buildQueryString } from '../lib/api'
import { formatDate } from '../lib/format'

type UserItem = {
  id: string
  email: string
  status: string
  createdAt: string
  profile: { fullName: string | null; phone: string | null } | null
}

type UsersResponse = {
  total: number
  page: number
  perPage: number
  totalPages: number
  items: UserItem[]
}

export function UsersPage() {
  const { token } = useAuth()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<UsersResponse>(`/admin/users${buildQueryString({ page, perPage, q: query || undefined })}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar usuários')
      }
    }

    void load()
  }, [token, page, perPage, query])

  return (
    <PageFrame title="Clientes" description="Lista administrativa com busca por e-mail ou nome.">
      <Section title="Filtros" description="Paginação unificada em page/perPage.">
        <FiltersBar>
          <label>
            Busca
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="e-mail ou nome" />
          </label>
          <label>
            Por página
            <input type="number" min={1} max={100} value={perPage} onChange={(event) => { setPerPage(Number(event.target.value)); setPage(1) }} />
          </label>
        </FiltersBar>

        {error ? <div className="alert">{error}</div> : null}

        <div className="table-shell table-scroll">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Status</th>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((item) => (
                <tr key={item.id}>
                  <td><Link className="table-link" to={`/users/${item.id}`}>{item.email}</Link></td>
                  <td>{item.status}</td>
                  <td>{item.profile?.fullName ?? '-'}</td>
                  <td>{item.profile?.phone ?? '-'}</td>
                  <td>{formatDate(item.createdAt)}</td>
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
