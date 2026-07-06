import { useEffect, useState } from 'react'
import { PageFrame } from '../components/PageFrame'
import { Section } from '../components/Section'
import { Pager } from '../components/Pager'
import { FiltersBar } from '../components/FiltersBar'
import { useAuth } from '../contexts/AuthContext'
import { apiRequest } from '../lib/api'
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
  skip: number
  take: number
  items: UserItem[]
}

export function UsersPage() {
  const { token } = useAuth()
  const [data, setData] = useState<UsersResponse | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return

    const load = async () => {
      try {
        setError('')
        const response = await apiRequest<UsersResponse>(`/admin/users?skip=${(page - 1) * perPage}&take=${perPage}`, { token })
        setData(response)
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Falha ao carregar usuários')
      }
    }

    void load()
  }, [token, page, perPage])

  return (
    <PageFrame
      title="Usuários"
      description="Consulta administrativa para suporte e operação."
    >
      <Section title="Filtros" description="A listagem usa skip/take para paginar o retorno administrativo.">
        <FiltersBar>
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
                  <td>{item.email}</td>
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
          page={page}
          totalPages={Math.max(1, Math.ceil((data?.total ?? 0) / perPage))}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />
      </Section>
    </PageFrame>
  )
}
